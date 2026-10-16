import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Customer, DocumentSequence, Organization, SalesDocument } from "@/models";

type DocumentType =
  | "Quote"
  | "Sales Order"
  | "Invoice"
  | "Recurring Invoice"
  | "Delivery Challan"
  | "Payment Received"
  | "Credit Note";
const paymentMethods = ["Cash", "Bank", "UPI", "Cheque"] as const;
const frequencyOptions = ["Weekly", "Monthly", "Quarterly", "Yearly"] as const;

const createSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("Customer"),
    name: z.string().trim().min(2).max(120),
    customerType: z.enum(["Business", "Individual"]).default("Business"),
    salutation: z.string().trim().max(20).optional(),
    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    companyName: z.string().trim().max(160).optional(),
    contactPerson: z.string().trim().max(160).optional(),
    email: z.union([z.email(), z.literal("")]).optional(),
    phone: z.string().trim().max(30).optional(),
    mobile: z.string().trim().max(30).optional(),
    gstin: z.string().trim().toUpperCase().max(20).optional(),
    pan: z.string().trim().toUpperCase().max(10).optional(),
    state: z.string().trim().max(100).optional(),
    customerLanguage: z.string().trim().max(50).default("English"),
    currency: z.string().trim().max(10).default("INR"),
    openingBalance: z.coerce.number().min(0).max(1_000_000_000).default(0),
    paymentTerms: z.string().trim().max(100).default("Due on Receipt"),
    allowPortal: z.boolean().default(false),
    billingAddress: z.object({
      attention: z.string().trim().max(120).optional(),
      street: z.string().trim().max(250).optional(),
      city: z.string().trim().max(100).optional(),
      state: z.string().trim().max(100).optional(),
      postalCode: z.string().trim().max(20).optional(),
      country: z.string().trim().max(100).optional(),
    }).optional(),
    shippingAddress: z.object({
      attention: z.string().trim().max(120).optional(),
      street: z.string().trim().max(250).optional(),
      city: z.string().trim().max(100).optional(),
      state: z.string().trim().max(100).optional(),
      postalCode: z.string().trim().max(20).optional(),
      country: z.string().trim().max(100).optional(),
    }).optional(),
    contactPersons: z.array(z.object({
      name: z.string().trim().max(120),
      email: z.union([z.email(), z.literal("")]).optional(),
      phone: z.string().trim().max(30).optional(),
      mobile: z.string().trim().max(30).optional(),
    })).max(20).default([]),
    customFields: z.array(z.object({
      label: z.string().trim().max(80),
      value: z.string().trim().max(250),
    })).max(30).default([]),
    reportingTags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
    remarks: z.string().trim().max(2000).optional(),
  }),
  z.object({
    type: z.enum(["Quote", "Sales Order", "Invoice"]),
    customerId: z.string().refine(isValidObjectId),
    total: z.coerce.number().positive().max(1_000_000_000),
    issueDate: z.iso.date().optional(),
    dueDate: z.iso.date().optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
  z.object({
    type: z.literal("Recurring Invoice"),
    customerId: z.string().refine(isValidObjectId),
    total: z.coerce.number().positive().max(1_000_000_000),
    frequency: z.enum(frequencyOptions),
    nextRunDate: z.iso.date(),
    notes: z.string().trim().max(1000).optional(),
  }),
  z.object({
    type: z.literal("Delivery Challan"),
    customerId: z.string().refine(isValidObjectId),
    relatedDocumentId: z.string().refine(isValidObjectId).optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
  z.object({
    type: z.literal("Payment Received"),
    relatedDocumentId: z.string().refine(isValidObjectId),
    total: z.coerce.number().positive().max(1_000_000_000),
    method: z.enum(paymentMethods),
    referenceNumber: z.string().trim().max(100).optional(),
  }),
  z.object({
    type: z.literal("Credit Note"),
    relatedDocumentId: z.string().refine(isValidObjectId),
    total: z.coerce.number().positive().max(1_000_000_000),
    notes: z.string().trim().max(1000).optional(),
  }),
]);

const transitionSchema = z.object({
  documentId: z.string().refine(isValidObjectId),
  status: z.string(),
});
const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("convert-quote"), documentId: z.string().refine(isValidObjectId) }),
  z.object({ action: z.literal("invoice-from-order"), documentId: z.string().refine(isValidObjectId) }),
  z.object({ action: z.literal("generate-recurring"), documentId: z.string().refine(isValidObjectId) }),
]);

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isDatabaseConnectionError(error: unknown) {
  return (
    error instanceof Error &&
    /MongooseServerSelectionError|buffering timed out|querySrv|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/.test(error.message)
  );
}

function databaseUnavailable(error: unknown) {
  console.error("Sales API database connection failed.", error);
  return respondError("Sales data is temporarily unavailable. Check the MongoDB connection and try again.", 503);
}

async function getSalesScope(requestedOrganizationId?: string) {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user) {
    return { error: respondError("Sign in to access sales.", 401) } as const;
  }

  if (user.id !== "admin") {
    const organizationId = user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return { error: respondError("Your account is not linked to an organization.", 403) } as const;
    }
    if (requestedOrganizationId && requestedOrganizationId !== organizationId) {
      return { error: respondError("You can only access your own organization.", 403) } as const;
    }
    return { organizationId, isAdmin: false } as const;
  }

  if (!requestedOrganizationId || !isValidObjectId(requestedOrganizationId)) {
    return { error: respondError("Select an organization to manage its sales.", 400) } as const;
  }
  const organization = await Organization.findById(requestedOrganizationId).select("_id");
  if (!organization) {
    return { error: respondError("The selected organization was not found.", 404) } as const;
  }
  return { organizationId: String(organization._id), isAdmin: true } as const;
}

async function nextNumber(organizationId: string, type: DocumentType) {
  const prefixes: Record<DocumentType, string> = {
    Quote: "QUO",
    "Sales Order": "SO",
    Invoice: "INV",
    "Recurring Invoice": "REC",
    "Delivery Challan": "DC",
    "Payment Received": "PAY",
    "Credit Note": "CN",
  };
  let sequence = await DocumentSequence.findOne({ organizationId, modelName: type });
  if (!sequence) {
    const count = await SalesDocument.countDocuments({ organizationId, type });
    try {
      sequence = await DocumentSequence.create({
        organizationId,
        prefix: prefixes[type],
        modelName: type,
        nextNumber: count,
      });
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) {
        throw error;
      }
    }
  }
  const allocated = await DocumentSequence.findOneAndUpdate(
    { organizationId, modelName: type },
    { $inc: { nextNumber: 1 } },
    { new: true },
  );
  if (!allocated) throw new Error(`Unable to allocate a number for ${type}.`);
  return `${prefixes[type]}-${String(allocated.nextNumber).padStart(4, "0")}`;
}

function invoiceStatus(amountPaid: number, total: number, creditedAmount: number) {
  if (amountPaid >= total - creditedAmount) return "Paid";
  return amountPaid > 0 ? "Partly paid" : "Sent";
}

async function createPayment(
  organizationId: string,
  invoiceId: string,
  total: number,
  method: (typeof paymentMethods)[number],
  referenceNumber?: string,
) {
  const invoice = await SalesDocument.findOne({
    _id: invoiceId,
    organizationId,
    type: "Invoice",
  });
  if (!invoice) return respondError("Select a valid invoice in this organization.", 404);

  const currentPaid = Number(invoice.amountPaid ?? 0);
  const creditedAmount = Number(invoice.creditedAmount ?? 0);
  const invoiceTotal = Number(invoice.total ?? 0);
  if (total > invoiceTotal - creditedAmount - currentPaid) {
    return respondError("The payment exceeds this invoice's remaining balance.", 400);
  }

  const receiptNumber = await nextNumber(organizationId, "Payment Received");
  const receipt = await SalesDocument.create({
    organizationId,
    type: "Payment Received",
    number: receiptNumber,
    customerId: invoice.customerId,
    relatedDocumentId: invoice._id,
    status: "Posted",
    total,
    method,
    referenceNumber,
  });

  try {
    const updatedInvoice = await SalesDocument.findOneAndUpdate(
      {
        _id: invoice._id,
        organizationId,
        type: "Invoice",
        amountPaid: currentPaid,
        creditedAmount,
      },
      {
        $inc: { amountPaid: total },
        $set: { status: invoiceStatus(currentPaid + total, invoiceTotal, creditedAmount) },
      },
      { new: true },
    );
    if (!updatedInvoice) {
      await SalesDocument.deleteOne({ _id: receipt._id, organizationId });
      return respondError("The invoice changed while recording payment. Refresh and try again.", 409);
    }

  } catch (error) {
    await SalesDocument.deleteOne({ _id: receipt._id, organizationId });
    throw error;
  }
  return NextResponse.json({ ok: true, id: String(receipt._id) }, { status: 201 });
}

async function createCreditNote(organizationId: string, invoiceId: string, total: number, notes?: string) {
  const invoice = await SalesDocument.findOne({
    _id: invoiceId,
    organizationId,
    type: "Invoice",
  });
  if (!invoice) return respondError("Select a valid invoice in this organization.", 404);

  const currentPaid = Number(invoice.amountPaid ?? 0);
  const currentCredited = Number(invoice.creditedAmount ?? 0);
  const invoiceTotal = Number(invoice.total ?? 0);
  if (total > invoiceTotal - currentPaid - currentCredited) {
    return respondError("The credit note exceeds this invoice's remaining balance.", 400);
  }

  const noteNumber = await nextNumber(organizationId, "Credit Note");
  const creditNote = await SalesDocument.create({
    organizationId,
    type: "Credit Note",
    number: noteNumber,
    customerId: invoice.customerId,
    relatedDocumentId: invoice._id,
    status: "Issued",
    total,
    notes,
  });

  try {
    const updatedInvoice = await SalesDocument.findOneAndUpdate(
      {
        _id: invoice._id,
        organizationId,
        type: "Invoice",
        amountPaid: currentPaid,
        creditedAmount: currentCredited,
      },
      {
        $inc: { creditedAmount: total },
        $set: { status: invoiceStatus(currentPaid, invoiceTotal, currentCredited + total) },
      },
      { new: true },
    );
    if (!updatedInvoice) {
      await SalesDocument.deleteOne({ _id: creditNote._id, organizationId });
      return respondError("The invoice changed while issuing this credit note. Refresh and try again.", 409);
    }

  } catch (error) {
    await SalesDocument.deleteOne({ _id: creditNote._id, organizationId });
    throw error;
  }
  return NextResponse.json({ ok: true, id: String(creditNote._id) }, { status: 201 });
}

async function createLinkedDocument(
  organizationId: string,
  sourceId: string,
  sourceType: "Quote" | "Sales Order",
  targetType: "Sales Order" | "Invoice",
) {
  const source = await SalesDocument.findOne({
    _id: sourceId,
    organizationId,
    type: sourceType,
  });
  if (!source) return respondError(`${sourceType} not found.`, 404);
  if (sourceType === "Quote" && ["Rejected", "Converted"].includes(source.status)) {
    return respondError("Only open or accepted quotes can be converted.", 400);
  }

  const alreadyCreated = await SalesDocument.exists({
    organizationId,
    type: targetType,
    relatedDocumentId: source._id,
  });
  if (alreadyCreated) return respondError(`This ${sourceType.toLowerCase()} already has a ${targetType.toLowerCase()}.`, 409);
  if (targetType === "Invoice" && source.status === "Cancelled") {
    return respondError("A cancelled sales order cannot be invoiced.", 400);
  }

  const number = await nextNumber(organizationId, targetType);
  const sourceStatus = source.status;
  const transition = await SalesDocument.updateOne(
    {
      _id: source._id,
      organizationId,
      status: sourceStatus,
    },
    { $set: { status: targetType === "Sales Order" ? "Converted" : "Invoiced" } },
  );
  if (transition.modifiedCount !== 1) {
    return respondError("This record changed while it was being processed. Refresh and try again.", 409);
  }

  try {
    const issueDate = new Date();
    const dueDate = targetType === "Invoice" ? new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000) : undefined;
    const document = await SalesDocument.create({
      organizationId,
      type: targetType,
      number,
      customerId: source.customerId,
      relatedDocumentId: source._id,
      status: targetType === "Invoice" ? "Sent" : "Draft",
      total: Number(source.total ?? 0),
      issueDate,
      dueDate,
    });
    return NextResponse.json({ ok: true, id: String(document._id), number }, { status: 201 });
  } catch (error) {
    await SalesDocument.updateOne(
      { _id: source._id, organizationId, status: targetType === "Sales Order" ? "Converted" : "Invoiced" },
      { $set: { status: sourceStatus } },
    );
    throw error;
  }
}

function getNextRunDate(date: Date, frequency: (typeof frequencyOptions)[number]) {
  const next = new Date(date);
  if (frequency === "Weekly") next.setDate(next.getDate() + 7);
  if (frequency !== "Weekly") {
    const originalDay = next.getDate();
    const monthsToAdd = frequency === "Monthly" ? 1 : frequency === "Quarterly" ? 3 : 12;
    next.setDate(1);
    next.setMonth(next.getMonth() + monthsToAdd);
    const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(originalDay, lastDayOfMonth));
  }
  return next;
}

async function generateRecurringInvoice(organizationId: string, recurringId: string) {
  const recurring = await SalesDocument.findOne({
    _id: recurringId,
    organizationId,
    type: "Recurring Invoice",
    status: "Active",
  });
  if (!recurring || !recurring.nextRunDate || !recurring.frequency) {
    return respondError("An active recurring invoice with a scheduled date is required.", 400);
  }

  const runDate = new Date(recurring.nextRunDate);
  const nextRunDate = getNextRunDate(runDate, recurring.frequency as (typeof frequencyOptions)[number]);
  const transition = await SalesDocument.updateOne(
    { _id: recurring._id, organizationId, status: "Active", nextRunDate: recurring.nextRunDate },
    { $set: { nextRunDate } },
  );
  if (transition.modifiedCount !== 1) {
    return respondError("This schedule changed while it was being processed. Refresh and try again.", 409);
  }

  try {
    const number = await nextNumber(organizationId, "Invoice");
    const document = await SalesDocument.create({
      organizationId,
      type: "Invoice",
      number,
      customerId: recurring.customerId,
      relatedDocumentId: recurring._id,
      status: "Sent",
      total: Number(recurring.total ?? 0),
      issueDate: runDate,
      dueDate: new Date(runDate.getTime() + 30 * 24 * 60 * 60 * 1000),
    });
    return NextResponse.json({ ok: true, id: String(document._id), number }, { status: 201 });
  } catch (error) {
    await SalesDocument.updateOne(
      { _id: recurring._id, organizationId, nextRunDate },
      { $set: { nextRunDate: runDate } },
    );
    throw error;
  }
}

async function getSales(request: Request) {
  const requestedOrganizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const session = await getServerSession(authOptions);
  if (!session?.user) return respondError("Sign in to access sales.", 401);

  await connectToDatabase();
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

  const scope = await getSalesScope(requestedOrganizationId);
  if ("error" in scope) return scope.error;

  const [organization, allOrganizations, customers, documents] = await Promise.all([
    Organization.findById(scope.organizationId).select("_id name").lean(),
    scope.isAdmin
      ? Organization.find({ status: "active" }).select("_id name").sort({ name: 1 }).lean()
      : Promise.resolve([]),
    Customer.find({ organizationId: scope.organizationId })
      .select("_id name customerType companyName email phone mobile openingBalance creditLimit unusedCredits status")
      .sort({ name: 1 })
      .lean(),
    SalesDocument.find({ organizationId: scope.organizationId }).sort({ createdAt: -1 }).lean(),
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
    })),
    documents: documents.map((document) => ({
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
    })),
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

  const requestedOrganizationId =
    typeof payload === "object" && payload !== null && "organizationId" in payload
      ? String(payload.organizationId)
      : undefined;
  const scope = await getSalesScope(requestedOrganizationId);
  if ("error" in scope) return scope.error;
  await connectToDatabase();
  const { organizationId } = scope;

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
    return respondError("Check the required fields and try again.", 400);
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
  const customer = customerId
    ? await Customer.findOne({ _id: customerId, organizationId }).select("_id")
    : null;
  if (!customer) return respondError("Select a customer in this organization.", 404);

  let relatedDocumentId: Types.ObjectId | undefined;
  const status = "Draft";
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
  const number = await nextNumber(organizationId, type);
  const document = await SalesDocument.create({
    organizationId,
    type,
    number,
    customerId,
    relatedDocumentId,
    status,
    total: "total" in data.data ? data.data.total : 0,
    issueDate: "issueDate" in data.data && data.data.issueDate ? new Date(data.data.issueDate) : new Date(),
    dueDate: "dueDate" in data.data && data.data.dueDate ? new Date(data.data.dueDate) : undefined,
    nextRunDate: "nextRunDate" in data.data ? new Date(data.data.nextRunDate) : undefined,
    frequency: "frequency" in data.data ? data.data.frequency : undefined,
    notes: "notes" in data.data ? data.data.notes : undefined,
  });
  return NextResponse.json({ ok: true, id: String(document._id), number }, { status: 201 });
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
