import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { RecurringBill } from "@/models";
import { generateBillFromRecurringProfile } from "@/lib/recurring-bill-service";
import { formatDateOnly } from "@/lib/bill-utils";

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to process recurring bills.", 401);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    const todayStr = formatDateOnly(new Date());
    const todayEnd = new Date(todayStr);
    todayEnd.setHours(23, 59, 59, 999);

    // Find all active profiles due today or earlier
    const dueProfiles = await RecurringBill.find({
      organizationId: orgObjId,
      status: "Active",
      nextBillDate: { $lte: todayEnd },
    });

    const results: {
      profileId: string;
      profileName: string;
      billNumber?: string;
      total?: number;
      success: boolean;
      error?: string;
    }[] = [];

    for (const profile of dueProfiles) {
      try {
        const gen = await generateBillFromRecurringProfile(profile._id, orgObjId);
        results.push({
          profileId: String(profile._id),
          profileName: profile.profileName,
          billNumber: gen.bill.billNumber,
          total: gen.bill.total,
          success: true,
        });
      } catch (err: unknown) {
        console.error(`Error processing recurring profile ${profile._id}:`, err);
        results.push({
          profileId: String(profile._id),
          profileName: profile.profileName,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const succeededCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Processed ${dueProfiles.length} recurring bill profiles. (${succeededCount} succeeded, ${failedCount} failed)`,
      totalDue: dueProfiles.length,
      succeededCount,
      failedCount,
      results,
    });
  } catch (error) {
    console.error("POST /api/purchases/recurring-bills/process error:", error);
    return respondError("Failed to process scheduled recurring bills.", 500);
  }
}
