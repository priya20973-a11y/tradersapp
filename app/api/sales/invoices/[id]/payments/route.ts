import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  AuditEvent,
  DocumentSequence,
  SalesDocument,
} from "@/models";
import {
  databaseUnavailable,
  getSalesScope,
  isDatabaseConnectionError,
  respondError,
} from "../../../sales-service";

interface InvoicePaymentPayload {
  organizationId?: string;
  amount?: number;
  method?: "Cash" | "Bank" | "UPI" | "Cheque";
  paymentDate?: string | number;
  referenceNumber?: string;
  notes?: string;
}

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
    if (!session?.user) return respondError("Sign in to view payments.", 401);

    const url = new URL(request.url);
    const requestedOrganizationId = url.searchParams.get("organizationId") ?? undefined;
    const scope = await getSalesScope(requestedOrganizationId, session);
    if ("error" in scope) return scope.error;

    const { organizationId } = scope;
    await connectToDatabase();

    const payments = await SalesDocument.find({
      organizationId: new Types.ObjectId(organizationId),
      type: "Payment Received",
      relatedDocumentId: new Types.ObjectId(id),
    })
      .sort({ issueDate: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      payments: payments.map((p) => ({
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
      })),
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("GET payments error:", error);
    return respondError("Failed to fetch payments.", 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return respondError("Invalid invoice ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to record payment.", 401);

    let payload: InvoicePaymentPayload;
    try {
      payload = await request.json();
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
      return respondError("Cannot record payment against a void invoice.", 400);
    }

    const paymentAmount = Math.round((Number(payload.amount) || 0) * 100) / 100;
    if (paymentAmount <= 0) {
      return respondError("Payment amount must be greater than zero.", 400);
    }

    const currentTotal = Number(invoice.total || 0);
    const currentPaid = Number(invoice.amountPaid || 0);
    const currentCredited = Number(invoice.creditedAmount || 0);
    const balanceDue = Math.max(0, Math.round((currentTotal - currentPaid - currentCredited) * 100) / 100);

    if (paymentAmount > balanceDue + 0.05) {
      return respondError(
        `Payment amount (₹${paymentAmount}) cannot exceed outstanding balance (₹${balanceDue}).`,
        400,
      );
    }

    const method =
      payload.method === "Cash" ||
      payload.method === "Bank" ||
      payload.method === "UPI" ||
      payload.method === "Cheque"
        ? payload.method
        : "Bank";

    // Allocate unique Receipt Number
    const sequence = await DocumentSequence.findOneAndUpdate(
      { organizationId, modelName: "Payment Received" },
      { $inc: { nextNumber: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const receiptSeq = sequence?.nextNumber || 1;
    const receiptNumber = `PAY-${String(receiptSeq).padStart(4, "0")}`;

    const paymentDate = payload.paymentDate ? new Date(payload.paymentDate) : new Date();

    // Create Payment Received SalesDocument
    const paymentDoc = await SalesDocument.create({
      organizationId,
      type: "Payment Received",
      number: receiptNumber,
      receiptNumber,
      customerId: invoice.customerId,
      relatedDocumentId: invoice._id,
      status: "Posted",
      issueDate: paymentDate,
      paymentDate,
      total: paymentAmount,
      method,
      referenceNumber: (payload.referenceNumber || "").trim(),
      notes: (payload.notes || "").trim(),
      currency: invoice.currency || "INR",
    });

    // Update Invoice atomically
    const newAmountPaid = Math.round((currentPaid + paymentAmount) * 100) / 100;
    const newBalanceDue = Math.max(0, Math.round((currentTotal - newAmountPaid - currentCredited) * 100) / 100);

    let newStatus = invoice.status;
    if (newBalanceDue === 0) {
      newStatus = "Paid";
    } else {
      newStatus = "Partly paid";
    }

    invoice.amountPaid = newAmountPaid;
    invoice.status = newStatus;
    await invoice.save();

    // Audit Event
    await AuditEvent.create({
      organizationId,
      actorId: String(session.user.id),
      action: "RECORD_PAYMENT",
      entityType: "Payment",
      entityId: String(paymentDoc._id),
      changes: {
        invoiceNumber: invoice.number,
        receiptNumber,
        amount: paymentAmount,
        method,
        remainingBalance: newBalanceDue,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        payment: {
          id: String(paymentDoc._id),
          receiptNumber,
          amount: paymentAmount,
          method,
          referenceNumber: paymentDoc.referenceNumber,
          paymentDate: paymentDoc.issueDate ? new Date(paymentDoc.issueDate).toISOString() : "",
          notes: paymentDoc.notes,
        },
        invoice: {
          id: String(invoice._id),
          number: invoice.number,
          total: invoice.total,
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status: invoice.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("POST payment error:", error);
    return respondError("Failed to record payment.", 500);
  }
}
