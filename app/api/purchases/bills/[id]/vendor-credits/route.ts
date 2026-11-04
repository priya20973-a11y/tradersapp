import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { PurchaseBill, VendorCredit } from "@/models";
import { formatDateOnly } from "@/lib/bill-utils";

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
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
      return respondError("Sign in to fetch bill vendor credits.", 401);
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

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);
    const billObjId = new Types.ObjectId(id);

    const bill = await PurchaseBill.findOne({ _id: billObjId, organizationId: orgObjId }).lean();
    if (!bill) {
      return respondError("Bill not found.", 404);
    }

    // Find all open/partially-applied vendor credits for this vendor with available balance
    const availableCreditsDb = await VendorCredit.find({
      organizationId: orgObjId,
      vendorId: bill.vendorId,
      status: { $in: ["Open", "Partially Applied"] },
      balanceRemaining: { $gt: 0 },
    })
      .sort({ vendorCreditDate: 1, createdAt: 1 })
      .lean();

    const availableCredits = availableCreditsDb.map((c) => ({
      id: String(c._id),
      creditNoteNumber: c.creditNoteNumber,
      vendorId: String(c.vendorId),
      vendorName: c.vendorName,
      vendorCreditDate: c.vendorCreditDate ? formatDateOnly(new Date(c.vendorCreditDate)) : "",
      subject: c.subject || "",
      total: Number(c.total || 0),
      balanceRemaining: Number(c.balanceRemaining ?? c.total ?? 0),
      appliedAmount: Number(c.appliedAmount || 0),
      status: c.status,
    }));

    const billTotal = Number(bill.total || 0);
    const vendorCreditApplied = Number(bill.vendorCreditApplied || 0);
    const paymentMade = Number(bill.amountPaid || 0);
    const paymentDue = Math.max(0, Math.round((billTotal - vendorCreditApplied - paymentMade) * 100) / 100);

    return NextResponse.json({
      bill: {
        id: String(bill._id),
        billNumber: bill.billNumber,
        vendorId: String(bill.vendorId),
        vendorName: bill.vendorName,
        total: billTotal,
        vendorCreditApplied,
        paymentMade,
        paymentDue,
        status: bill.status,
        creditsApplied: (bill.creditsApplied || []).map((c: { creditId?: unknown; creditNoteNumber?: string; amount?: number; appliedDate?: Date | string; notes?: string }) => ({
          creditId: String(c.creditId),
          creditNoteNumber: c.creditNoteNumber,
          amount: Number(c.amount || 0),
          appliedDate: c.appliedDate ? new Date(c.appliedDate).toISOString() : "",
          notes: c.notes || "",
        })),
      },
      availableCredits,
      totalAvailableCredit: availableCredits.reduce((sum, c) => sum + c.balanceRemaining, 0),
    });
  } catch (error) {
    console.error("GET /api/purchases/bills/[id]/vendor-credits error:", error);
    return respondError("Failed to fetch available vendor credits for this bill.", 500);
  }
}

