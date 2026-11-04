import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Organization } from "@/models";
import { unapplyCreditNoteFromInvoice } from "@/lib/credit-note-service";

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
      return respondError("Invalid credit note ID.", 400);
    }

    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    if (!orgId) {
      return respondError("Organization not found.", 400);
    }

    const body = await request.json().catch(() => ({}));
    if (!body.invoiceId || !isValidObjectId(body.invoiceId)) {
      return respondError("Valid invoice ID is required to unapply credit.", 400);
    }

    const orgObjId = new Types.ObjectId(orgId);
    const cnObjId = new Types.ObjectId(id);

    const result = await unapplyCreditNoteFromInvoice({
      creditNoteId: cnObjId,
      invoiceId: body.invoiceId,
      organizationId: orgObjId,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully unapplied ₹${result.rollbackAmount} from invoice.`,
      creditNoteBalance: result.creditNoteBalance,
      invoiceBalanceDue: result.invoiceBalanceDue,
    });
  } catch (error) {
    console.error("POST /api/sales/credit-notes/[id]/unapply error:", error);
    const msg = error instanceof Error ? error.message : "Failed to unapply credit note.";
    return respondError(msg, 400);
  }
}

