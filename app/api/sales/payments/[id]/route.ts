import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { AuditEvent, SalesDocument } from "@/models";
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
    if (!id) return respondError("Payment ID is required.", 400);

    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to view payment.", 401);

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") ?? undefined;
    const scope = await getSalesScope(requestedOrgId, session);
    if ("error" in scope) return scope.error;

    const { organizationId } = scope;
    await connectToDatabase();

    const orgObjId = isValidObjectId(organizationId) ? new Types.ObjectId(organizationId) : null;
    const query: Record<string, unknown> = {
      _id: isValidObjectId(id) ? new Types.ObjectId(id) : id,
      type: "Payment Received",
      ...(orgObjId
        ? { $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }] }
        : { organizationId }),
    };

    const payment = await SalesDocument.findOne(query).lean();
    if (!payment) return respondError("Payment not found.", 404);

    return NextResponse.json({ ok: true, payment });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("GET /api/sales/payments/[id] error:", error);
    return respondError("Failed to fetch payment.", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return respondError("Payment ID is required.", 400);

    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to delete payment.", 401);

    // Ensure only authorized users can delete payments (viewers / read-only users cannot delete)
    const userRole = String(session.user.role || "").toLowerCase();
    if (["viewer", "readonly", "read-only"].includes(userRole)) {
      return respondError("You do not have permission to delete payments.", 403);
    }

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") ?? undefined;
    const scope = await getSalesScope(requestedOrgId, session);
    if ("error" in scope) return scope.error;

    const { organizationId } = scope;

    if (id.startsWith("demo-")) {
      return NextResponse.json({
        ok: true,
        message: "Payment deleted successfully.",
        deletedPaymentId: id,
      });
    }

    await connectToDatabase();

    const orgObjId = isValidObjectId(organizationId) ? new Types.ObjectId(organizationId) : null;
    const query: Record<string, unknown> = {
      _id: isValidObjectId(id) ? new Types.ObjectId(id) : id,
      type: "Payment Received",
      ...(orgObjId
        ? { $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }] }
        : { organizationId }),
    };

    const payment = await SalesDocument.findOne(query);
    if (!payment) {
      return respondError("Payment not found.", 404);
    }

    const paymentAmount = Math.round(Number(payment.total || 0) * 100) / 100;
    const linkedDocId = payment.relatedDocumentId;

    let linkedDoc: Awaited<ReturnType<typeof SalesDocument.findOne>> = null;
    if (linkedDocId) {
      const linkedQuery: Record<string, unknown> = {
        _id: isValidObjectId(linkedDocId) ? new Types.ObjectId(linkedDocId) : linkedDocId,
        type: { $in: ["Invoice", "Sales Order"] },
        ...(orgObjId
          ? { $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }] }
          : { organizationId }),
      };

      linkedDoc = await SalesDocument.findOne(linkedQuery);

      if (linkedDoc) {
        const currentPaid = Number(linkedDoc.amountPaid || 0);
        const currentTotal = Number(linkedDoc.total || 0);
        const currentCredited = Number(linkedDoc.creditedAmount || 0);

        // Atomically revert payment amount from linked invoice or sales order
        const newPaid = Math.max(0, Math.round((currentPaid - paymentAmount) * 100) / 100);
        const newBalance = Math.max(0, Math.round((currentTotal - newPaid - currentCredited) * 100) / 100);

        linkedDoc.amountPaid = newPaid;

        if (linkedDoc.type === "Invoice") {
          if (newPaid === 0) {
            const isOverdue = linkedDoc.dueDate && new Date(linkedDoc.dueDate) < new Date();
            linkedDoc.status = isOverdue ? "Overdue" : "Sent";
          } else if (newBalance === 0) {
            linkedDoc.status = "Paid";
          } else {
            linkedDoc.status = "Partly paid";
          }
        } else if (linkedDoc.type === "Sales Order") {
          if (newPaid === 0) {
            linkedDoc.status = "Confirmed";
          } else if (newBalance === 0) {
            linkedDoc.status = "Paid";
          } else {
            linkedDoc.status = "Partly paid";
          }
        }

        await linkedDoc.save();
      }
    }

    // Permanently delete the payment record
    await SalesDocument.findOneAndDelete(query);

    // Audit Event log
    await AuditEvent.create({
      organizationId: orgObjId || organizationId,
      actorId: String(session.user.id),
      action: "DELETE_PAYMENT",
      entityType: "Payment",
      entityId: String(payment._id),
      changes: {
        receiptNumber: payment.number || payment.receiptNumber,
        amount: paymentAmount,
        relatedDocumentId: linkedDocId ? String(linkedDocId) : undefined,
        linkedNumber: linkedDoc?.number,
      },
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      message: "Payment deleted successfully.",
      deletedPaymentId: String(payment._id),
      revertedDoc: linkedDoc
        ? {
            id: String(linkedDoc._id),
            number: linkedDoc.number,
            amountPaid: linkedDoc.amountPaid,
            status: linkedDoc.status,
          }
        : null,
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("DELETE /api/sales/payments/[id] error:", error);
    return respondError("Failed to delete customer payment.", 500);
  }
}
