import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Organization } from "@/models";
import { applyCreditsToInvoice } from "@/lib/invoice-credit-service";

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    if (!orgId) {
      return respondError("Valid organization ID is required.", 400);
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    const credits = payload.credits as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(credits) || credits.length === 0) {
      return respondError("Please provide an array of credit notes with amounts to apply.", 400);
    }

    const orgObjId = new Types.ObjectId(orgId);
    const invObjId = new Types.ObjectId(id);

    const result = await applyCreditsToInvoice({
      invoiceId: invObjId,
      organizationId: orgObjId,
      creditApplications: credits.map((c) => ({
        creditNoteId: String(c.creditNoteId),
        amount: Number(c.amount) || 0,
        notes: c.notes ? String(c.notes).trim() : undefined,
      })),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully applied ₹${result.appliedTotal} of credit to Invoice #${result.invoice.number}.`,
      appliedTotal: result.appliedTotal,
      invoiceTotal: result.invoiceTotal,
      creditedAmount: result.creditedAmount,
      amountPaid: result.amountPaid,
      balanceDue: result.balanceDue,
      status: result.status,
      appliedCredits: result.appliedCredits,
      invoice: {
        id: String(result.invoice._id),
        invoiceNumber: result.invoice.number,
        total: result.invoice.total,
        creditedAmount: result.invoice.creditedAmount,
        amountPaid: result.invoice.amountPaid,
        balanceDue: result.balanceDue,
        status: result.invoice.status,
        creditsApplied: result.invoice.creditsApplied,
      },
    });
  } catch (error) {
    console.error("POST /api/sales/invoices/[id]/apply-credits error:", error);
    const msg = error instanceof Error ? error.message : "Failed to apply credits to invoice.";
    return respondError(msg, 400);
  }
}

