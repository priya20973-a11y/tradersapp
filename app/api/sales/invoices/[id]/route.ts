import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  AuditEvent,
  Customer,
  InvoiceSettings,
  Organization,
  SalesDocument,
  User,
} from "@/models";
import {
  calculateInvoiceTotals,
  type CalculateItemInput,
} from "@/lib/invoice-utils";
import {
  databaseUnavailable,
  getSalesScope,
  isDatabaseConnectionError,
  respondError,
} from "../../sales-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return respondError("Invalid invoice ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to view invoice.", 401);

    const url = new URL(request.url);
    const requestedOrganizationId = url.searchParams.get("organizationId") ?? undefined;
    const scope = await getSalesScope(requestedOrganizationId, session);
    if ("error" in scope) return scope.error;

    const { organizationId } = scope;
    await connectToDatabase();

    const [invoice, settingsDoc, org, payments, userDoc] = await Promise.all([
      SalesDocument.findOne({
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        type: "Invoice",
      }).lean(),
      InvoiceSettings.findOne({ organizationId }).lean(),
      Organization.findById(organizationId).lean(),
      SalesDocument.find({
        organizationId: new Types.ObjectId(organizationId),
        type: "Payment Received",
        relatedDocumentId: new Types.ObjectId(id),
      })
        .sort({ issueDate: -1, createdAt: -1 })
        .lean(),
      session.user.id
        ? User.findById(session.user.id).lean()
        : User.findOne({ email: session.user.email }).lean(),
    ]);

    const profileLogo = String(userDoc?.logo || org?.logo || "");
    const settings = settingsDoc
      ? {
          ...settingsDoc,
          companyDetails: {
            ...settingsDoc.companyDetails,
            logoUrl: settingsDoc.companyDetails?.logoUrl || profileLogo,
          },
          showCompanyLogo:
            settingsDoc.pdfTemplate?.showCompanyLogo !== undefined
              ? Boolean(settingsDoc.pdfTemplate.showCompanyLogo)
              : settingsDoc.showCompanyLogo !== undefined
              ? Boolean(settingsDoc.showCompanyLogo)
              : true,
          pdfTemplate: {
            ...settingsDoc.pdfTemplate,
            showCompanyLogo:
              settingsDoc.pdfTemplate?.showCompanyLogo !== undefined
                ? Boolean(settingsDoc.pdfTemplate.showCompanyLogo)
                : settingsDoc.showCompanyLogo !== undefined
                ? Boolean(settingsDoc.showCompanyLogo)
                : true,
          },
        }
      : null;

    if (!invoice) {
      return respondError("Invoice not found.", 404);
    }

    // Also get live customer if available for current contact info
    const liveCustomer = await Customer.findOne({
      _id: invoice.customerId,
      organizationId,
    }).lean();

    const total = Number(invoice.total ?? 0);
    const amountPaid = Number(invoice.amountPaid ?? 0);
    const creditedAmount = Number(invoice.creditedAmount ?? 0);
    const balanceDue = Math.max(0, Math.round((total - amountPaid - creditedAmount) * 100) / 100);

    const now = new Date();
    let effectiveStatus = invoice.status;
    const isPastDue = invoice.dueDate && new Date(invoice.dueDate) < now && balanceDue > 0;

    if (invoice.status === "Void") {
      effectiveStatus = "Void";
    } else if (balanceDue === 0 && total > 0) {
      effectiveStatus = "Paid";
    } else if (amountPaid > 0 && balanceDue > 0) {
      effectiveStatus = isPastDue ? "Overdue" : "Partially Paid";
    } else if (isPastDue && invoice.status !== "Draft") {
      effectiveStatus = "Overdue";
    }

    const formattedPayments = payments.map((p) => ({
      id: String(p._id),
      number: p.number,
      receiptNumber: p.receiptNumber || p.number,
      amount: Number(p.total ?? 0),
      paymentDate: p.issueDate ? new Date(p.issueDate).toISOString() : "",
      method: p.method || "Bank",
      referenceNumber: p.referenceNumber || "",
      notes: p.notes || "",
      status: p.status || "Posted",
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : "",
    }));

    return NextResponse.json({
      invoice: {
        id: String(invoice._id),
        number: invoice.number,
        customerId: String(invoice.customerId),
        customerName: invoice.customerSnapshot?.name || liveCustomer?.name || "Customer",
        customerCompany: invoice.customerSnapshot?.companyName || liveCustomer?.companyName || "",
        customerSnapshot: invoice.customerSnapshot || {
          name: liveCustomer?.name || "",
          companyName: liveCustomer?.companyName || "",
          gstin: liveCustomer?.gstin || "",
          pan: liveCustomer?.pan || "",
          email: liveCustomer?.email || "",
          phone: liveCustomer?.phone || liveCustomer?.mobile || "",
          billingAddress: liveCustomer?.billingAddress,
          shippingAddress: liveCustomer?.shippingAddress,
        },
        status: effectiveStatus,
        issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString() : "",
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : "",
        paymentTerms: invoice.paymentTerms || "Due on Receipt",
        salesperson: invoice.salesperson || "",
        subject: invoice.subject || "",
        referenceNumber: invoice.referenceNumber || "",
        customerNotes: invoice.customerNotes || "",
        termsAndConditions: invoice.termsAndConditions || "",
        placeOfSupply: invoice.placeOfSupply || "",
        currency: invoice.currency || org?.currency || "INR",
        subTotal: Number(invoice.subTotal ?? 0),
        discount: Number(invoice.discount ?? 0),
        discountType: invoice.discountType || "percent",
        taxRate: Number(invoice.taxRate ?? 0),
        taxAmount: Number(invoice.taxAmount ?? 0),
        cgst: Number(invoice.cgst ?? 0),
        sgst: Number(invoice.sgst ?? 0),
        igst: Number(invoice.igst ?? 0),
        shippingCharges: Number(invoice.shippingCharges ?? 0),
        adjustment: Number(invoice.adjustment ?? 0),
        roundOff: Number(invoice.roundOff ?? 0),
        total,
        amountPaid,
        creditedAmount,
        balanceDue,
        items: (invoice.items || []).map((item) => ({
          itemId: item.itemId ? String(item.itemId) : undefined,
          name: item.name,
          description: item.description || "",
          hsnCode: item.hsnCode || "",
          unit: item.unit || "pcs",
          quantity: Number(item.quantity ?? 1),
          rate: Number(item.rate ?? 0),
          discount: Number(item.discount ?? 0),
          discountType: item.discountType || "percent",
          taxRate: Number(item.taxRate ?? 0),
          taxAmount: Number(item.taxAmount ?? 0),
          amount: Number(item.amount ?? 0),
        })),
        bankDetailsSnapshot: invoice.bankDetailsSnapshot || settings?.bankDetails,
        emailsSent: (invoice.emailsSent || []).map((e) => ({
          sentAt: e.sentAt ? new Date(e.sentAt).toISOString() : "",
          to: e.to,
          cc: e.cc || "",
          bcc: e.bcc || "",
          subject: e.subject,
          message: e.message || "",
          status: e.status || "Sent",
        })),
        payments: formattedPayments,
        creditsApplied: ((invoice.creditsApplied || []) as Array<Record<string, unknown>>).map((c) => ({
          creditNoteId: String(c.creditNoteId),
          creditNoteNumber: c.creditNoteNumber as string | undefined,
          amount: Number(c.amount || 0),
          appliedDate: c.appliedDate ? new Date(c.appliedDate as string | number | Date).toISOString() : "",
          notes: (c.notes as string) || "",
        })),
        createdAt: invoice.createdAt ? new Date(invoice.createdAt).toISOString() : "",
        updatedAt: invoice.updatedAt ? new Date(invoice.updatedAt).toISOString() : "",
      },
      settings: settings || null,
      organization: {
        id: String(org?._id),
        name: org?.name || "Company",
        gstin: org?.gstin || "",
        currency: org?.currency || "INR",
      },
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("GET /api/sales/invoices/[id] error:", error);
    return respondError("Failed to fetch invoice details.", 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return respondError("Invalid invoice ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to edit invoice.", 401);

    let payload: Record<string, unknown>;
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    const requestedOrganizationId = payload.organizationId as string | undefined;
    const scope = await getSalesScope(requestedOrganizationId, session);
    if ("error" in scope) return scope.error;

    const { organizationId } = scope;
    await connectToDatabase();

    const invoice = await SalesDocument.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      type: "Invoice",
    });

    if (!invoice) {
      return respondError("Invoice not found.", 404);
    }

    if (invoice.status === "Void") {
      return respondError("Cannot edit a voided invoice.", 400);
    }

    // Validate Customer if changed
    const customerId = (payload.customerId as string | undefined) || invoice.customerId;
    const customer = await Customer.findOne({ _id: customerId, organizationId }).lean();
    if (!customer) {
      return respondError("Customer not found.", 404);
    }

    // Validate Items
    const rawItems = (Array.isArray(payload.items) ? payload.items : invoice.items || []) as Array<Record<string, unknown>>;
    if (rawItems.length === 0) {
      return respondError("Invoice must have at least one line item.", 400);
    }

    const validItems: CalculateItemInput[] = rawItems.map((item) => ({
      quantity: Math.max(0, Number(item.quantity) || 1),
      rate: Math.max(0, Number(item.rate) || 0),
      discount: Math.max(0, Number(item.discount) || 0),
      discountType: item.discountType === "amount" ? "amount" : "percent",
      taxRate: Math.max(0, Number(item.taxRate) || 0),
    }));

    const settings = await InvoiceSettings.findOne({ organizationId });

    const orgState = settings?.companyDetails?.state || "";
    const placeOfSupply = ((payload.placeOfSupply as string | undefined) || invoice.placeOfSupply || customer.state || orgState).trim();

    const calculatedTotals = calculateInvoiceTotals({
      items: validItems,
      invoiceDiscount: Number(payload.discount ?? invoice.discount) || 0,
      invoiceDiscountType: (payload.discountType || invoice.discountType) === "amount" ? "amount" : "percent",
      shippingCharges: Number(payload.shippingCharges ?? invoice.shippingCharges) || 0,
      adjustment: Number(payload.adjustment ?? invoice.adjustment) || 0,
      autoRoundOff: true,
      placeOfSupply,
      organizationState: orgState,
      amountPaid: Number(invoice.amountPaid || 0),
    });

    // Check if new total is less than amount already paid
    if (calculatedTotals.grandTotal < Number(invoice.amountPaid || 0)) {
      return respondError(
        `Invoice total cannot be less than already received payment amount of ₹${invoice.amountPaid}.`,
        400,
      );
    }

    // Recalculate status
    let newStatus = invoice.status;
    if (newStatus !== "Draft") {
      if (invoice.amountPaid >= calculatedTotals.grandTotal) {
        newStatus = "Paid";
      } else if (invoice.amountPaid > 0) {
        newStatus = "Partly paid";
      } else {
        newStatus = "Sent";
      }
    }

    // Update customer snapshot if customer changed
    const customerSnapshot = {
      name: String(customer.name || "Customer"),
      companyName: customer.companyName ? String(customer.companyName) : "",
      gstin: customer.gstin ? String(customer.gstin) : "",
      pan: customer.pan ? String(customer.pan) : "",
      email: customer.email ? String(customer.email) : "",
      phone: customer.phone ? String(customer.phone) : (customer.mobile ? String(customer.mobile) : ""),
      mobile: customer.mobile ? String(customer.mobile) : "",
      billingAddress: customer.billingAddress as Record<string, unknown> | undefined,
      shippingAddress: customer.shippingAddress as Record<string, unknown> | undefined,
    };

    const itemsSnapshot = rawItems.map((item, idx: number) => {
      const calc = calculatedTotals.items[idx];
      const itemIdValue = item.itemId !== undefined && item.itemId !== null ? String(item.itemId) : "";
      const nameValue = typeof item.name === "string" ? item.name : String(item.name ?? "");
      const descriptionValue = typeof item.description === "string" ? item.description : String(item.description ?? "");
      const hsnCodeValue = typeof item.hsnCode === "string" ? item.hsnCode : String(item.hsnCode ?? "");
      const unitValue = typeof item.unit === "string" ? item.unit : String(item.unit ?? "pcs");
      return {
        itemId: itemIdValue && isValidObjectId(itemIdValue) ? new Types.ObjectId(itemIdValue) : undefined,
        name: nameValue.trim() || "Item",
        description: descriptionValue.trim(),
        hsnCode: hsnCodeValue.trim(),
        unit: unitValue.trim() || "pcs",
        quantity: calc.quantity,
        rate: calc.rate,
        discount: Number(item.discount) || 0,
        discountType: (item.discountType === "amount" ? "amount" : "percent") as "amount" | "percent",
        taxRate: calc.taxRate,
        taxAmount: calc.taxAmount,
        amount: calc.amount,
      };
    });

    const issueDate = payload.issueDate ? new Date(String(payload.issueDate)) : invoice.issueDate;
    const dueDate = payload.dueDate ? new Date(String(payload.dueDate)) : invoice.dueDate;

    invoice.customerId = new Types.ObjectId(String(customer._id));
    invoice.customerSnapshot = customerSnapshot;
    invoice.issueDate = issueDate;
    invoice.dueDate = dueDate;
    invoice.paymentTerms = typeof payload.paymentTerms === "string" ? payload.paymentTerms : invoice.paymentTerms;
    invoice.salesperson = payload.salesperson !== undefined ? String(payload.salesperson).trim() : invoice.salesperson;
    invoice.subject = payload.subject !== undefined ? String(payload.subject).trim() : invoice.subject;
    invoice.referenceNumber = payload.referenceNumber !== undefined ? String(payload.referenceNumber).trim() : invoice.referenceNumber;
    invoice.customerNotes = payload.customerNotes !== undefined ? String(payload.customerNotes) : invoice.customerNotes;
    invoice.termsAndConditions = payload.termsAndConditions !== undefined ? String(payload.termsAndConditions) : invoice.termsAndConditions;
    invoice.placeOfSupply = placeOfSupply;
    invoice.subTotal = calculatedTotals.subTotal;
    invoice.discount = calculatedTotals.totalDiscount;
    invoice.discountType = (payload.discountType || invoice.discountType) === "amount" ? "amount" : "percent";
    invoice.taxRate = calculatedTotals.items[0]?.taxRate || 0;
    invoice.taxAmount = calculatedTotals.totalTax;
    invoice.cgst = calculatedTotals.cgst;
    invoice.sgst = calculatedTotals.sgst;
    invoice.igst = calculatedTotals.igst;
    invoice.shippingCharges = calculatedTotals.shippingCharges;
    invoice.adjustment = calculatedTotals.adjustment;
    invoice.roundOff = calculatedTotals.roundOff;
    invoice.total = calculatedTotals.grandTotal;
    invoice.status = newStatus;
    invoice.items = itemsSnapshot;

    await invoice.save();

    await AuditEvent.create({
      organizationId,
      actorId: String(session.user.id),
      action: "UPDATE_INVOICE",
      entityType: "Invoice",
      entityId: String(invoice._id),
      changes: {
        number: invoice.number,
        total: calculatedTotals.grandTotal,
      },
    });

    return NextResponse.json({
      ok: true,
      invoice: {
        id: String(invoice._id),
        number: invoice.number,
        total: invoice.total,
        status: invoice.status,
      },
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("PUT /api/sales/invoices/[id] error:", error);
    return respondError("Failed to update invoice.", 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return respondError("Invalid invoice ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to update status.", 401);

    const payload = await request.json().catch(() => ({}));
    const newStatus = payload.status;
    const allowed = ["Draft", "Sent", "Partly paid", "Partially Paid", "Paid", "Overdue", "Void"];
    if (!newStatus || !allowed.includes(newStatus)) {
      return respondError("Select a valid invoice status.", 400);
    }

    const requestedOrganizationId = payload.organizationId;
    const scope = await getSalesScope(requestedOrganizationId, session);
    if ("error" in scope) return scope.error;

    const { organizationId } = scope;
    await connectToDatabase();

    const invoice = await SalesDocument.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      type: "Invoice",
    });

    if (!invoice) {
      return respondError("Invoice not found.", 404);
    }

    const previousStatus = invoice.status;
    invoice.status = newStatus === "Partially Paid" ? "Partly paid" : newStatus;
    await invoice.save();

    await AuditEvent.create({
      organizationId,
      actorId: String(session.user.id),
      action: "UPDATE_INVOICE_STATUS",
      entityType: "Invoice",
      entityId: String(invoice._id),
      changes: {
        from: previousStatus,
        to: invoice.status,
      },
    });

    return NextResponse.json({ ok: true, status: invoice.status });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("PATCH /api/sales/invoices/[id] error:", error);
    return respondError("Failed to update invoice status.", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return respondError("Invalid invoice ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to delete invoice.", 401);

    const url = new URL(request.url);
    const requestedOrganizationId = url.searchParams.get("organizationId") ?? undefined;
    const scope = await getSalesScope(requestedOrganizationId, session);
    if ("error" in scope) return scope.error;

    const { organizationId } = scope;
    await connectToDatabase();

    const invoice = await SalesDocument.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      type: "Invoice",
    });

    if (!invoice) {
      return respondError("Invoice not found.", 404);
    }

    // Check if payments exist
    const paymentCount = await SalesDocument.countDocuments({
      organizationId,
      type: "Payment Received",
      relatedDocumentId: new Types.ObjectId(id),
    });

    if (paymentCount > 0) {
      return respondError(
        "Cannot delete an invoice with recorded payments. Void the invoice or delete payments first.",
        400,
      );
    }

    if (invoice.status !== "Draft") {
      // Mark as void instead of hard delete if already sent or published
      invoice.status = "Void";
      await invoice.save();
      return NextResponse.json({ ok: true, message: "Invoice marked as Void." });
    }

    await SalesDocument.deleteOne({ _id: invoice._id, organizationId });

    await AuditEvent.create({
      organizationId,
      actorId: String(session.user.id),
      action: "DELETE_INVOICE",
      entityType: "Invoice",
      entityId: String(invoice._id),
      changes: { number: invoice.number },
    });

    return NextResponse.json({ ok: true, message: "Draft invoice deleted." });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("DELETE /api/sales/invoices/[id] error:", error);
    return respondError("Failed to delete invoice.", 500);
  }
}
