import { isValidObjectId } from "mongoose";
import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { DocumentSequence, Organization, SalesDocument } from "@/models";
import { type DocumentType, type frequencyOptions, type paymentMethods } from "./schemas";

export function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function isDatabaseConnectionError(error: unknown) {
  return (
    error instanceof Error &&
    /MongooseServerSelectionError|buffering timed out|querySrv|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/.test(error.message)
  );
}

export function databaseUnavailable(error: unknown) {
  console.error("Sales API database connection failed.", error);
  return respondError("Sales data is temporarily unavailable. Check the MongoDB connection and try again.", 503);
}

export async function getSalesScope(
  requestedOrganizationId?: string,
  existingSession?: Session | null,
) {
  const session = existingSession ?? (await getServerSession(authOptions));
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

export async function nextNumber(organizationId: string, type: DocumentType) {
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

export function invoiceStatus(amountPaid: number, total: number, creditedAmount: number) {
  if (amountPaid >= total - creditedAmount) return "Paid";
  return amountPaid > 0 ? "Partly paid" : "Sent";
}

export async function createPayment(
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

export async function createCreditNote(
  organizationId: string,
  invoiceId: string,
  total: number,
  notes?: string,
) {
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

export async function createLinkedDocument(
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
      items: source.items,
      subTotal: source.subTotal,
      discount: source.discount,
      discountType: source.discountType,
      taxType: source.taxType,
      taxName: source.taxName,
      taxRate: source.taxRate,
      taxAmount: source.taxAmount,
      adjustment: source.adjustment,
      salesperson: source.salesperson,
      customerNotes: source.customerNotes,
      termsAndConditions: source.termsAndConditions,
      notes: source.notes,
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

export function getNextRunDate(date: Date, frequency: (typeof frequencyOptions)[number]) {
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

export async function generateRecurringInvoice(organizationId: string, recurringId: string) {
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
