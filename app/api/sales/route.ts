import { isValidObjectId, type Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Customer, Organization, SalesDocument } from "@/models";
import {
  type DocumentType,
  commandSchema,
  createSchema,
  transitionSchema,
} from "./schemas";
import {
  createCreditNote,
  createLinkedDocument,
  createPayment,
  databaseUnavailable,
  generateRecurringInvoice,
  getSalesScope,
  isDatabaseConnectionError,
  nextNumber,
  respondError,
} from "./sales-service";
import { calculateQuoteTotals } from "@/lib/quote-tax-utils";

async function getSales(request: Request) {
  let requestedOrganizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const session = await getServerSession(authOptions);
  if (!session?.user) return respondError("Sign in to access sales.", 401);

  await connectToDatabase();

  if (session.user.id === "admin" && !requestedOrganizationId) {
    const customerIdParam = new URL(request.url).searchParams.get("customerId");
    if (customerIdParam && isValidObjectId(customerIdParam)) {
      const cust = await Customer.findById(customerIdParam).select("organizationId").lean();
      if (cust?.organizationId) {
        requestedOrganizationId = String(cust.organizationId);
      }
    }
  }

  if (session.user.id === "admin" && !requestedOrganizationId) {
    const organizations = await Organization.find({ status: "active" }).select("_id name").sort({ name: 1 }).lean();
    return NextResponse.json({
      organizations: organizations.map((organization) => ({
        id: String(organization._id),
        name: organization.name,
      })),
      customers: [],
      documents: [],
      isAdmin: true,
    });
  }

  const scope = await getSalesScope(requestedOrganizationId, session);
  if ("error" in scope) return scope.error;

  const url = new URL(request.url);
  const section = url.searchParams.get("section")?.toLowerCase();
  const documentTypeFilter = url.searchParams.get("type");

  const docQuery: Record<string, unknown> = { organizationId: scope.organizationId };
  if (documentTypeFilter) {
    docQuery.type = documentTypeFilter;
  } else if (section === "quotes") {
    docQuery.type = "Quote";
  } else if (section === "orders") {
    docQuery.type = "Sales Order";
  } else if (section === "invoices") {
    docQuery.type = "Invoice";
  } else if (section === "recurring-invoices") {
    docQuery.type = "Recurring Invoice";
  } else if (section === "delivery-challans") {
    docQuery.type = "Delivery Challan";
  } else if (section === "payments-received") {
    docQuery.type = "Payment Received";
  } else if (section === "credit-notes") {
    docQuery.type = "Credit Note";
  }

  const [organization, allOrganizations, customers, documents] = await Promise.all([
    Organization.findById(scope.organizationId).select("_id name").lean(),
    scope.isAdmin
      ? Organization.find({ status: "active" }).select("_id name").sort({ name: 1 }).lean()
      : Promise.resolve([]),
    Customer.find({ organizationId: scope.organizationId })
      .sort({ name: 1 })
      .lean(),
    SalesDocument.find(docQuery).sort({ createdAt: -1 }).lean(),
  ]);
  if (!organization) return respondError("The selected organization was not found.", 404);
  return NextResponse.json({
    organizations: (scope.isAdmin ? allOrganizations : [organization]).map((item) => ({
      id: String(item._id),
      name: item.name,
    })),
    customers: customers.map((customer) => ({
      id: String(customer._id),
      name: customer.name,
      customerType: customer.customerType ?? "Business",
      companyName: customer.companyName ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      mobile: customer.mobile ?? "",
      openingBalance: Number(customer.openingBalance ?? 0),
      creditLimit: Number(customer.creditLimit ?? 0),
      unusedCredits: Number(customer.unusedCredits ?? 0),
      status: customer.status ?? "Active",
      gstin: customer.gstin ?? "",
      pan: customer.pan ?? "",
      state: customer.state ?? "",
      customerLanguage: customer.customerLanguage ?? "English",
      currency: customer.currency ?? "INR",
      paymentTerms: customer.paymentTerms ?? "Due on Receipt",
      billingAddress: customer.billingAddress,
      shippingAddress: customer.shippingAddress,
      contactPersons: customer.contactPersons ?? [],
      customFields: customer.customFields ?? [],
      reportingTags: customer.reportingTags ?? [],
      remarks: customer.remarks ?? "",
      comments: ((customer as unknown as Record<string, unknown>).comments as unknown[]) ?? [],
      createdAt: customer.createdAt ? new Date(String(customer.createdAt)).toISOString() : "",
      updatedAt: customer.updatedAt ? new Date(String(customer.updatedAt)).toISOString() : "",
    })),
    documents: documents.map((document) => {
      const docRec = document as unknown as Record<string, unknown>;
      return {
        id: String(document._id),
        type: document.type,
        number: document.number,
        customerId: String(document.customerId),
        relatedDocumentId: document.relatedDocumentId ? String(document.relatedDocumentId) : "",
        status: document.status,
        total: Number(document.total ?? 0),
        amountPaid: Number(document.amountPaid ?? 0),
        creditedAmount: Number(document.creditedAmount ?? 0),
        issueDate: document.issueDate?.toISOString() ?? "",
        dueDate: document.dueDate?.toISOString() ?? "",
        nextRunDate: document.nextRunDate?.toISOString() ?? "",
        frequency: document.frequency ?? "",
        method: document.method ?? "",
        referenceNumber: document.referenceNumber ?? "",
        notes: document.notes ?? "",
        expiryDate: document.expiryDate?.toISOString() ?? "",
        expectedShipmentDate: document.expectedShipmentDate?.toISOString() ?? "",
        paymentTerms: document.paymentTerms ?? "",
        deliveryMethod: document.deliveryMethod ?? "",
        salesperson: document.salesperson ?? "",
        projectName: document.projectName ?? "",
        subject: document.subject ?? "",
        customerNotes: document.customerNotes ?? "",
        termsAndConditions: document.termsAndConditions ?? "",
        subTotal: document.subTotal ?? 0,
        discount: document.discount ?? 0,
        discountType: document.discountType ?? "percent",
        taxType: document.taxType ?? (document.type === "Quote" ? "GST" : "TDS"),
        taxName: document.taxName ?? "",
        taxRate: document.taxRate ?? 0,
        taxAmount: document.taxAmount ?? 0,
        tdsTcsType: (docRec.tdsTcsType as string) ?? ((document.taxType === "TDS" || document.taxType === "TCS") ? document.taxType : "None"),
        tdsTcsName: (docRec.tdsTcsName as string) ?? ((document.taxType === "TDS" || document.taxType === "TCS") ? document.taxName : ""),
        tdsTcsRate: (docRec.tdsTcsRate as number) ?? ((document.taxType === "TDS" || document.taxType === "TCS") ? document.taxRate : 0),
        tdsTcsAmount: (docRec.tdsTcsAmount as number) ?? ((document.taxType === "TDS" || document.taxType === "TCS") ? document.taxAmount : 0),
        adjustment: document.adjustment ?? 0,
        items: document.items ?? [],
        createdAt: document.createdAt ? new Date(String(document.createdAt)).toISOString() : "",
        paymentDate: docRec.paymentDate ? new Date(String(docRec.paymentDate)).toISOString() : "",
      };
    }),
    isAdmin: scope.isAdmin,
  });
}

export async function GET(request: Request) {
  try {
    return await getSales(request);
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    throw error;
  }
}

async function postSales(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return respondError("Submit valid JSON data.", 400);
  }

  await connectToDatabase();

  const rawPayload = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  let requestedOrganizationId =
    "organizationId" in rawPayload && rawPayload.organizationId
      ? String(rawPayload.organizationId)
      : undefined;

  if (!requestedOrganizationId) {
    const urlOrgId = new URL(request.url).searchParams.get("organizationId");
    if (urlOrgId && isValidObjectId(urlOrgId)) {
      requestedOrganizationId = urlOrgId;
    }
  }

  if (!requestedOrganizationId && "customerId" in rawPayload) {
    const cid = String(rawPayload.customerId);
    if (isValidObjectId(cid)) {
      const targetCustomer = await Customer.findById(cid).select("organizationId").lean();
      if (targetCustomer?.organizationId) {
        requestedOrganizationId = String(targetCustomer.organizationId);
      }
    }
  }

  if (!requestedOrganizationId) {
    const session = await getServerSession(authOptions);
    if (session?.user?.id === "admin") {
      const defaultOrg = await Organization.findOne({ status: "active" }).select("_id").lean();
      if (defaultOrg) {
        requestedOrganizationId = String(defaultOrg._id);
      }
    }
  }

  const scope = await getSalesScope(requestedOrganizationId);
  if ("error" in scope) return scope.error;
  let { organizationId } = scope;

  if (typeof payload === "object" && payload !== null && "action" in payload) {
    const command = commandSchema.safeParse(payload);
    if (!command.success) return respondError("Select a valid sales action and record.", 400);
    if (command.data.action === "convert-quote") {
      return createLinkedDocument(organizationId, command.data.documentId, "Quote", "Sales Order");
    }
    if (command.data.action === "invoice-from-order") {
      return createLinkedDocument(organizationId, command.data.documentId, "Sales Order", "Invoice");
    }
    return generateRecurringInvoice(organizationId, command.data.documentId);
  }

  const data = createSchema.safeParse(payload);
  if (!data.success) {
    const firstIssue = data.error.issues[0];
    const fieldMsg = firstIssue ? ` (${firstIssue.path.join(".")}: ${firstIssue.message})` : "";
    return respondError(`Check the required fields and try again.${fieldMsg}`, 400);
  }

  if (data.data.type === "Customer") {
    const customer = await Customer.create({
      organizationId,
      name: data.data.name,
      customerType: data.data.customerType,
      salutation: data.data.salutation,
      firstName: data.data.firstName,
      lastName: data.data.lastName,
      companyName: data.data.companyName,
      contactPerson: data.data.contactPerson,
      email: data.data.email?.toLowerCase(),
      phone: data.data.phone,
      mobile: data.data.mobile,
      gstin: data.data.gstin,
      pan: data.data.pan,
      state: data.data.state,
      customerLanguage: data.data.customerLanguage,
      currency: data.data.currency,
      openingBalance: data.data.openingBalance,
      paymentTerms: data.data.paymentTerms,
      allowPortal: data.data.allowPortal,
      billingAddress: data.data.billingAddress,
      shippingAddress: data.data.shippingAddress,
      contactPersons: data.data.contactPersons,
      customFields: data.data.customFields,
      reportingTags: data.data.reportingTags,
      remarks: data.data.remarks,
    });
    return NextResponse.json({ ok: true, id: String(customer._id) }, { status: 201 });
  }

  if (data.data.type === "Payment Received") {
    return createPayment(
      organizationId,
      data.data.relatedDocumentId,
      data.data.total,
      data.data.method,
      data.data.referenceNumber,
    );
  }
  if (data.data.type === "Credit Note") {
    return createCreditNote(organizationId, data.data.relatedDocumentId, data.data.total, data.data.notes);
  }

  const customerId =
    data.data.type === "Delivery Challan"
      ? data.data.customerId
      : "customerId" in data.data
        ? data.data.customerId
        : undefined;

  let customer = customerId
    ? await Customer.findOne({ _id: customerId, organizationId }).select("_id organizationId")
    : null;

  if (!customer && customerId) {
    const anyCustomer = await Customer.findById(customerId).select("_id organizationId");
    if (!anyCustomer) return respondError("Select a customer in this organization.", 404);
    if (scope.isAdmin && anyCustomer.organizationId) {
      organizationId = String(anyCustomer.organizationId);
      customer = anyCustomer;
    } else {
      return respondError("Select a customer in this organization.", 404);
    }
  }

  let relatedDocumentId: Types.ObjectId | undefined;
  const status = "status" in data.data && data.data.status ? data.data.status : "Draft";
  if (data.data.type === "Delivery Challan" && data.data.relatedDocumentId) {
    const order = await SalesDocument.findOne({
      _id: data.data.relatedDocumentId,
      organizationId,
      customerId,
      type: "Sales Order",
    }).select("_id");
    if (!order) return respondError("Select a sales order for this customer.", 400);
    relatedDocumentId = order._id;
  }

  const type = data.data.type as DocumentType;
  const number =
    "number" in data.data && data.data.number?.trim()
      ? data.data.number.trim()
      : await nextNumber(organizationId, type);

  let verifiedTotal = "total" in data.data ? Number(data.data.total) : 0;
  let verifiedTaxAmount = "taxAmount" in data.data ? data.data.taxAmount : undefined;
  let verifiedTdsTcsAmount = "tdsTcsAmount" in data.data ? data.data.tdsTcsAmount : undefined;

  if (type === "Quote" && "subTotal" in data.data && data.data.subTotal !== undefined) {
    const verified = calculateQuoteTotals({
      subTotal: Number(data.data.subTotal) || 0,
      discountAmount: "discount" in data.data ? Number(data.data.discount) || 0 : 0,
      gstRate: "taxRate" in data.data ? Number(data.data.taxRate) || 0 : 0,
      tdsTcsType: "tdsTcsType" in data.data ? data.data.tdsTcsType : undefined,
      tdsTcsRate: "tdsTcsRate" in data.data ? Number(data.data.tdsTcsRate) || 0 : 0,
      adjustmentValue: "adjustment" in data.data ? Number(data.data.adjustment) || 0 : 0,
    });
    verifiedTaxAmount = verified.gstAmount;
    verifiedTdsTcsAmount = verified.tdsTcsAmount;
    verifiedTotal = verified.total;
  }

  const rawItems = "items" in data.data && Array.isArray(data.data.items) ? data.data.items : undefined;
  const sanitizedItems = rawItems?.map((it) => ({
    ...it,
    itemId: it.itemId && isValidObjectId(it.itemId) ? it.itemId : undefined,
  }));

  const buildDocPayload = (docNumber: string) => ({
    organizationId,
    type,
    number: docNumber,
    customerId,
    relatedDocumentId,
    status,
    total: verifiedTotal,
    issueDate: "issueDate" in data.data && data.data.issueDate ? new Date(data.data.issueDate) : new Date(),
    dueDate: "dueDate" in data.data && data.data.dueDate ? new Date(data.data.dueDate) : undefined,
    expiryDate: "expiryDate" in data.data && data.data.expiryDate ? new Date(data.data.expiryDate) : undefined,
    expectedShipmentDate: "expectedShipmentDate" in data.data && data.data.expectedShipmentDate ? new Date(data.data.expectedShipmentDate) : undefined,
    paymentTerms: "paymentTerms" in data.data ? data.data.paymentTerms : undefined,
    deliveryMethod: "deliveryMethod" in data.data ? data.data.deliveryMethod : undefined,
    salesperson: "salesperson" in data.data ? data.data.salesperson : undefined,
    projectName: "projectName" in data.data ? data.data.projectName : undefined,
    subject: "subject" in data.data ? data.data.subject : undefined,
    customerNotes: "customerNotes" in data.data ? data.data.customerNotes : undefined,
    termsAndConditions: "termsAndConditions" in data.data ? data.data.termsAndConditions : undefined,
    subTotal: "subTotal" in data.data ? data.data.subTotal : undefined,
    discount: "discount" in data.data ? data.data.discount : undefined,
    discountType: "discountType" in data.data ? data.data.discountType : undefined,
    taxType: "taxType" in data.data ? data.data.taxType : undefined,
    taxName: "taxName" in data.data ? data.data.taxName : undefined,
    taxRate: "taxRate" in data.data ? data.data.taxRate : undefined,
    taxAmount: verifiedTaxAmount !== undefined ? verifiedTaxAmount : ("taxAmount" in data.data ? data.data.taxAmount : undefined),
    tdsTcsType: "tdsTcsType" in data.data ? data.data.tdsTcsType : undefined,
    tdsTcsName: "tdsTcsName" in data.data ? data.data.tdsTcsName : undefined,
    tdsTcsRate: "tdsTcsRate" in data.data ? data.data.tdsTcsRate : undefined,
    tdsTcsAmount: verifiedTdsTcsAmount !== undefined ? verifiedTdsTcsAmount : ("tdsTcsAmount" in data.data ? data.data.tdsTcsAmount : undefined),
    adjustment: "adjustment" in data.data ? data.data.adjustment : undefined,
    items: sanitizedItems,
    referenceNumber: "referenceNumber" in data.data ? data.data.referenceNumber : undefined,
    nextRunDate: "nextRunDate" in data.data ? new Date(data.data.nextRunDate) : undefined,
    frequency: "frequency" in data.data ? data.data.frequency : undefined,
    notes: "notes" in data.data ? data.data.notes : undefined,
  });

  try {
    const document = await SalesDocument.create(buildDocPayload(number));
    return NextResponse.json({ ok: true, id: String(document._id), number }, { status: 201 });
  } catch (err: unknown) {
    const mongoErr = typeof err === "object" && err !== null && "code" in err ? (err as { code: number }) : null;
    if (mongoErr?.code === 11000) {
      if ("number" in data.data && data.data.number?.trim()) {
        return respondError(`A ${type.toLowerCase()} with number "${number}" already exists.`, 409);
      }
      const retryNumber = await nextNumber(organizationId, type);
      const document = await SalesDocument.create(buildDocPayload(retryNumber));
      return NextResponse.json({ ok: true, id: String(document._id), number: retryNumber }, { status: 201 });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    return await postSales(request);
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    throw error;
  }
}

async function patchSales(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return respondError("Submit valid JSON data.", 400);
  }

  const data = transitionSchema.safeParse(payload);
  if (!data.success) return respondError("Select a valid sales record and status.", 400);
  const requestedOrganizationId =
    typeof payload === "object" && payload !== null && "organizationId" in payload
      ? String(payload.organizationId)
      : undefined;
  const scope = await getSalesScope(requestedOrganizationId);
  if ("error" in scope) return scope.error;
  await connectToDatabase();

  const document = await SalesDocument.findOne({
    _id: data.data.documentId,
    organizationId: scope.organizationId,
  });
  if (!document) return respondError("Sales record not found.", 404);

  const allowedStatuses: Partial<Record<DocumentType, string[]>> = {
    Quote: ["Accepted", "Rejected"],
    "Sales Order": ["Confirmed", "Fulfilled", "Cancelled"],
    "Recurring Invoice": ["Active", "Paused"],
    "Delivery Challan": ["Dispatched", "Delivered"],
  };
  if (!allowedStatuses[document.type as DocumentType]?.includes(data.data.status)) {
    return respondError("That status change is not allowed for this record.", 400);
  }
  if (
    (document.type === "Quote" && ["Converted", "Rejected"].includes(document.status)) ||
    (document.type === "Sales Order" && ["Invoiced", "Cancelled"].includes(document.status)) ||
    (document.type === "Delivery Challan" && document.status === "Delivered")
  ) {
    return respondError("This record is already closed and cannot change status.", 409);
  }
  await SalesDocument.updateOne({ _id: document._id, organizationId: scope.organizationId }, {
    $set: { status: data.data.status },
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  try {
    return await patchSales(request);
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    throw error;
  }
}

async function putSales(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return respondError("Submit valid JSON data.", 400);
  }
  const documentId =
    typeof payload.id === "string"
      ? payload.id
      : typeof payload.documentId === "string"
        ? payload.documentId
        : undefined;
  if (!documentId) return respondError("Document ID is required.", 400);
  if (!isValidObjectId(documentId)) return respondError("Sales document not found.", 404);

  await connectToDatabase();

  let requestedOrganizationId = payload.organizationId ? String(payload.organizationId) : undefined;
  if (!requestedOrganizationId) {
    const existingDoc = await SalesDocument.findById(documentId).select("organizationId").lean();
    if (existingDoc?.organizationId) {
      requestedOrganizationId = String(existingDoc.organizationId);
    }
  }
  if (!requestedOrganizationId && typeof payload.customerId === "string" && isValidObjectId(payload.customerId)) {
    const cust = await Customer.findById(payload.customerId).select("organizationId").lean();
    if (cust?.organizationId) {
      requestedOrganizationId = String(cust.organizationId);
    }
  }
  if (!requestedOrganizationId) {
    const session = await getServerSession(authOptions);
    if (session?.user?.id === "admin") {
      const defaultOrg = await Organization.findOne({ status: "active" }).select("_id").lean();
      if (defaultOrg) {
        requestedOrganizationId = String(defaultOrg._id);
      }
    }
  }

  const scope = await getSalesScope(requestedOrganizationId);
  if ("error" in scope) return scope.error;

  const doc = await SalesDocument.findOne({
    _id: documentId,
    organizationId: scope.organizationId,
  });
  if (!doc) return respondError("Sales document not found.", 404);

  if (typeof payload.customerId === "string") doc.customerId = payload.customerId as unknown as Types.ObjectId;
  if (typeof payload.number === "string") doc.number = payload.number;
  if (payload.referenceNumber !== undefined) doc.referenceNumber = String(payload.referenceNumber);
  if (payload.issueDate) doc.issueDate = new Date(String(payload.issueDate));
  if (payload.expiryDate) doc.expiryDate = new Date(String(payload.expiryDate));
  if (payload.subject !== undefined) doc.subject = String(payload.subject);
  if (payload.customerNotes !== undefined) doc.customerNotes = String(payload.customerNotes);
  if (payload.termsAndConditions !== undefined) doc.termsAndConditions = String(payload.termsAndConditions);
  if (payload.subTotal !== undefined) doc.subTotal = Number(payload.subTotal);
  if (payload.discount !== undefined) doc.discount = Number(payload.discount);
  if (payload.discountType) doc.discountType = payload.discountType as "percent" | "amount";
  if (payload.taxType) doc.taxType = payload.taxType as "TDS" | "TCS" | "GST";
  if (payload.taxName !== undefined) doc.taxName = String(payload.taxName);
  if (payload.taxRate !== undefined) doc.taxRate = Number(payload.taxRate);
  if (payload.taxAmount !== undefined) doc.taxAmount = Number(payload.taxAmount);

  const docRecord = doc as unknown as Record<string, unknown>;
  if (payload.tdsTcsType !== undefined) docRecord.tdsTcsType = payload.tdsTcsType;
  if (payload.tdsTcsName !== undefined) docRecord.tdsTcsName = payload.tdsTcsName;
  if (payload.tdsTcsRate !== undefined) docRecord.tdsTcsRate = payload.tdsTcsRate;
  if (payload.tdsTcsAmount !== undefined) docRecord.tdsTcsAmount = payload.tdsTcsAmount;
  if (payload.adjustment !== undefined) doc.adjustment = Number(payload.adjustment);
  if (payload.total !== undefined) doc.total = Number(payload.total);
  if (typeof payload.status === "string") doc.status = payload.status;
  if (payload.items && Array.isArray(payload.items)) {
    doc.items = payload.items.map((it: { itemId?: string; name?: string; description?: string; quantity?: number; rate?: number; amount?: number }) => ({
      itemId: it.itemId && isValidObjectId(it.itemId) ? it.itemId : undefined,
      name: it.name || "Item",
      description: it.description || undefined,
      quantity: Number(it.quantity) || 1,
      rate: Number(it.rate) || 0,
      amount: Number(it.amount) || 0,
    })) as unknown as typeof doc.items;
  }
  if (payload.notes !== undefined) doc.notes = String(payload.notes);

  if (
    doc.type === "Quote" &&
    (payload.subTotal !== undefined ||
      payload.tdsTcsRate !== undefined ||
      payload.taxRate !== undefined ||
      payload.tdsTcsType !== undefined)
  ) {
    const verified = calculateQuoteTotals({
      subTotal: payload.subTotal !== undefined ? Number(payload.subTotal) || 0 : Number(doc.subTotal) || 0,
      discountAmount: payload.discount !== undefined ? Number(payload.discount) || 0 : Number(doc.discount) || 0,
      gstRate: payload.taxRate !== undefined ? Number(payload.taxRate) || 0 : Number(doc.taxRate) || 0,
      tdsTcsType: (payload.tdsTcsType !== undefined ? payload.tdsTcsType : docRecord.tdsTcsType) as "TDS" | "TCS" | "None",
      tdsTcsRate: payload.tdsTcsRate !== undefined ? Number(payload.tdsTcsRate) || 0 : Number(docRecord.tdsTcsRate) || 0,
      adjustmentValue: payload.adjustment !== undefined ? Number(payload.adjustment) || 0 : Number(doc.adjustment) || 0,
    });
    doc.taxAmount = verified.gstAmount;
    docRecord.tdsTcsAmount = verified.tdsTcsAmount;
    doc.total = verified.total;
  }

  try {
    await doc.save();
    return NextResponse.json({ ok: true, id: String(doc._id), number: doc.number });
  } catch (err: unknown) {
    const mongoErr = typeof err === "object" && err !== null && "code" in err ? (err as { code: number }) : null;
    if (mongoErr?.code === 11000) {
      return respondError(`A sales document with number "${doc.number}" already exists.`, 409);
    }
    throw err;
  }
}

export async function PUT(request: Request) {
  try {
    return await putSales(request);
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    throw error;
  }
}

