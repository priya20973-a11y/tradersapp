import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { generateBillFromRecurringProfile } from "@/lib/recurring-bill-service";

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
      return respondError("Invalid profile ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to generate bill.", 401);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      // Empty body is acceptable
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);
    const profObjId = new Types.ObjectId(id);

    const result = await generateBillFromRecurringProfile(profObjId, orgObjId, {
      force: payload.force === true,
      billDate: payload.billDate as string | undefined,
    });

    return NextResponse.json({
      success: true,
      message: `Bill ${result.bill.billNumber} created successfully!`,
      bill: result.bill,
      nextBillDate: result.nextBillDate,
      profile: result.profile,
    });
  } catch (error) {
    console.error("POST /api/purchases/recurring-bills/[id]/generate error:", error);
    const msg = error instanceof Error ? error.message : "Failed to generate bill.";
    return respondError(msg, 400);
  }
}
