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
      return respondError("Invalid credit note ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to fetch vendor bills.", 401);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);
    const credObjId = new Types.ObjectId(id);

    const credit = await VendorCredit.findOne({ _id: credObjId, organizationId: orgObjId }).lean();
    if (!credit) {
      return respondError("Vendor credit not found.", 404);
    }

    // Find all bills for this vendor with balanceDue > 0
    const billsDb = await PurchaseBill.find({
      organizationId: orgObjId,
      vendorId: credit.vendorId,
      status: { $in: ["Pending", "Partially Paid", "Draft"] },
    })
      .sort({ billDate: 1, createdAt: 1 })
      .lean();

    const openBills = billsDb
      .map((b) => {
        const total = Number(b.total || 0);
        const amountPaid = Number(b.amountPaid || 0);
        const balanceDue = Math.max(0, Math.round((total - amountPaid) * 100) / 100);
        return {
          id: String(b._id),
          billNumber: b.billNumber,
          billDate: b.billDate ? formatDateOnly(new Date(b.billDate)) : "",
          dueDate: b.dueDate ? formatDateOnly(new Date(b.dueDate)) : "",
          total,
          amountPaid,
          balanceDue,
          status: b.status,
          subject: b.subject || "",
        };
      })
      .filter((b) => b.balanceDue > 0);

    return NextResponse.json({
      credit: {
        id: String(credit._id),
        creditNoteNumber: credit.creditNoteNumber,
        vendorId: String(credit.vendorId),
        vendorName: credit.vendorName,
        total: credit.total,
        balanceRemaining: credit.balanceRemaining,
        appliedAmount: credit.appliedAmount,
        status: credit.status,
      },
      openBills,
    });
  } catch (error) {
    console.error("GET /api/purchases/vendor-credits/[id]/bills error:", error);
    return respondError("Failed to fetch open bills for vendor credit.", 500);
  }
}
