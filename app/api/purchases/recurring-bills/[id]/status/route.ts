import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { RecurringBill } from "@/models";

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
      return respondError("Sign in to modify recurring bill status.", 401);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    let payload: { status?: string } = {};
    try {
      payload = (await request.json()) as { status?: string };
    } catch {
      // Empty body is acceptable
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);
    const profObjId = new Types.ObjectId(id);

    const profile = await RecurringBill.findOne({ _id: profObjId, organizationId: orgObjId });
    if (!profile) {
      return respondError("Recurring bill profile not found.", 404);
    }

    // Toggle status or use requested status
    let nextStatus: "Active" | "Paused" | "Expired" =
      (profile.status as "Active" | "Paused" | "Expired") || "Active";
    const requestedStatus = payload.status;
    if (
      requestedStatus === "Active" ||
      requestedStatus === "Paused" ||
      requestedStatus === "Expired"
    ) {
      nextStatus = requestedStatus;
    } else {
      nextStatus = profile.status === "Active" ? "Paused" : "Active";
    }

    profile.status = nextStatus;
    await profile.save();

    return NextResponse.json({
      success: true,
      message: `Profile status updated to ${nextStatus}.`,
      status: nextStatus,
    });
  } catch (error) {
    console.error("POST /api/purchases/recurring-bills/[id]/status error:", error);
    return respondError("Failed to update status.", 500);
  }
}
