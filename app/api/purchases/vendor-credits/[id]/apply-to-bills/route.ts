import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { applyVendorCreditToBills } from "@/lib/vendor-credit-service";

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

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to apply vendor credit.", 401);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    const applications = payload.applications as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(applications) || applications.length === 0) {
      return respondError("Please provide an array of bill applications with amounts.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);
    const credObjId = new Types.ObjectId(id);

    const result = await applyVendorCreditToBills({
      creditId: credObjId,
      organizationId: orgObjId,
      applications: applications.map((a) => ({
        billId: String(a.billId),
        amount: Number(a.amount) || 0,
      })),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully applied ₹${result.appliedTotal} of credit to ${result.appliedBills.length} bills.`,
      appliedTotal: result.appliedTotal,
      balanceRemaining: result.balanceRemaining,
      appliedBills: result.appliedBills,
      credit: result.credit,
    });
  } catch (error) {
    console.error("POST /api/purchases/vendor-credits/[id]/apply-to-bills error:", error);
    const msg = error instanceof Error ? error.message : "Failed to apply vendor credit.";
    return respondError(msg, 400);
  }
}
