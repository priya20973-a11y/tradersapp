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
} from "../../../sales-service";

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
    if (!session?.user) return respondError("Sign in to send invoice email.", 401);

    let payload: Record<string, unknown>;
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    const to = ((payload.to as string) || "").trim();
    if (!to || !to.includes("@")) {
      return respondError("Provide a valid recipient email address.", 400);
    }

    const subject = ((payload.subject as string) || "").trim() || "Tax Invoice";
    const message = ((payload.message as string) || "").trim();
    const cc = ((payload.cc as string) || "").trim();
    const bcc = ((payload.bcc as string) || "").trim();

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

    const sentEntry = {
      sentAt: new Date(),
      to,
      cc,
      bcc,
      subject,
      message,
      status: "Sent",
    };

    if (!invoice.emailsSent) {
      invoice.emailsSent = [];
    }
    invoice.emailsSent.push(sentEntry);

    // If draft, mark as Sent
    if (invoice.status === "Draft") {
      invoice.status = "Sent";
    }

    await invoice.save();

    await AuditEvent.create({
      organizationId,
      actorId: String(session.user.id),
      action: "SEND_INVOICE_EMAIL",
      entityType: "Invoice",
      entityId: String(invoice._id),
      changes: {
        to,
        subject,
        invoiceNumber: invoice.number,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Invoice ${invoice.number} successfully sent to ${to}.`,
      email: {
        sentAt: sentEntry.sentAt.toISOString(),
        to,
        subject,
      },
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("POST email error:", error);
    return respondError("Failed to dispatch invoice email.", 500);
  }
}
