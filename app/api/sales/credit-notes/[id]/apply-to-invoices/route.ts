import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Organization } from "@/models";
import { applyCreditNoteToInvoices } from "@/lib/credit-note-service";

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

    let payload: Record<string, unknown>;
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    const applications = payload.applications as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(applications) || applications.length === 0) {
      return respondError("Please provide an array of invoice applications with amounts.", 400);
    }

    const orgObjId = new Types.ObjectId(orgId);
    const cnObjId = new Types.ObjectId(id);

    const result = await applyCreditNoteToInvoices({
      creditNoteId: cnObjId,
      organizationId: orgObjId,
      applications: applications.map((a) => ({
        invoiceId: String(a.invoiceId),
        amount: Number(a.amount) || 0,
        notes: a.notes ? String(a.notes) : undefined,
      })),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully applied ₹${result.appliedTotal} of credit to ${result.appliedInvoices.length} invoice(s).`,
      appliedTotal: result.appliedTotal,
      balanceRemaining: result.balanceRemaining,
      status: result.status,
      appliedInvoices: result.appliedInvoices,
    });
  } catch (error) {
    console.error("POST /api/sales/credit-notes/[id]/apply-to-invoices error:", error);
    const msg = error instanceof Error ? error.message : "Failed to apply credit note.";
    return respondError(msg, 400);
  }
}

