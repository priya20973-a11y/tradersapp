import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { applyCreditsToBill } from "@/lib/vendor-credit-service";

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
      return respondError("Invalid bill ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to apply vendor credits.", 401);
    }

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") ?? undefined;

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && requestedOrgId && isValidObjectId(requestedOrgId)) {
      organizationId = requestedOrgId;
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    const credits = payload.credits;
    if (!Array.isArray(credits) || credits.length === 0) {
      return respondError("Please provide an array of vendor credits with amounts to apply.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);
    const billObjId = new Types.ObjectId(id);

    const result = await applyCreditsToBill({
      billId: billObjId,
      organizationId: orgObjId,
      creditApplications: (credits as Array<{ creditId?: unknown; amount?: unknown; notes?: unknown }>).map((c) => ({
        creditId: String(c.creditId),
        amount: Number(c.amount) || 0,
        notes: c.notes ? String(c.notes).trim() : undefined,
      })),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully applied ₹${result.appliedTotal} of vendor credit to Bill #${result.bill.billNumber}.`,
      appliedTotal: result.appliedTotal,
      billTotal: result.billTotal,
      vendorCreditApplied: result.vendorCreditApplied,
      paymentMade: result.paymentMade,
      paymentDue: result.paymentDue,
      status: result.status,
      appliedCredits: result.appliedCredits,
      bill: {
        id: String(result.bill._id),
        billNumber: result.bill.billNumber,
        total: result.bill.total,
        vendorCreditApplied: result.bill.vendorCreditApplied,
        amountPaid: result.bill.amountPaid,
        balanceDue: result.bill.balanceDue,
        status: result.bill.status,
        creditsApplied: result.bill.creditsApplied,
      },
    });
  } catch (error) {
    console.error("POST /api/purchases/bills/[id]/apply-credits error:", error);
    const msg = error instanceof Error ? error.message : "Failed to apply vendor credits to bill.";
    return respondError(msg, 400);
  }
}

