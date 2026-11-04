import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Vendor, VendorCredit } from "@/models";
import { formatDateOnly } from "@/lib/bill-utils";
import { calculateCreditTotals, vendorCreditSchema } from "@/lib/vendor-credit-utils";

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
      return respondError("Sign in to view vendor credit.", 401);
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

    return NextResponse.json({
      credit: {
        ...credit,
        id: String(credit._id),
        vendorCreditDate: credit.vendorCreditDate ? formatDateOnly(new Date(credit.vendorCreditDate)) : "",
        createdAt: credit.createdAt ? new Date(credit.createdAt).toISOString() : "",
      },
    });
  } catch (error) {
    console.error("GET /api/purchases/vendor-credits/[id] error:", error);
    return respondError("Failed to fetch vendor credit.", 500);
  }
}

export async function PUT(
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
      return respondError("Sign in to update vendor credit.", 401);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    const validation = vendorCreditSchema.safeParse(payload);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0]?.message || "Invalid input data.";
      return respondError(firstIssue, 400);
    }

    const data = validation.data;

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);
    const credObjId = new Types.ObjectId(id);

    const existingCredit = await VendorCredit.findOne({ _id: credObjId, organizationId: orgObjId });
    if (!existingCredit) {
      return respondError("Vendor credit not found.", 404);
    }

    // Check duplicate credit note number if changed
    if (data.creditNoteNumber && data.creditNoteNumber.trim() !== existingCredit.creditNoteNumber) {
      const dup = await VendorCredit.findOne({
        _id: { $ne: credObjId },
        organizationId: orgObjId,
        creditNoteNumber: { $regex: new RegExp(`^${data.creditNoteNumber.trim()}$`, "i") },
      });
      if (dup) {
        return respondError(`Credit note number "${data.creditNoteNumber}" already exists.`, 409);
      }
      existingCredit.creditNoteNumber = data.creditNoteNumber.trim();
    }

    // Validate vendor exists or get vendor details
    let vendorObjId: Types.ObjectId = existingCredit.vendorId;
    let vendorName = data.vendorName;
    if (isValidObjectId(data.vendorId)) {
      vendorObjId = new Types.ObjectId(data.vendorId);
      const vend = await Vendor.findOne({ _id: vendorObjId, organizationId: orgObjId }).select("name");
      if (vend && vend.name) vendorName = String(vend.name);
    }

    // Recalculate totals
    const calcOutput = calculateCreditTotals({
      items: data.items.map((it) => ({
        quantity: Math.max(0.001, Number(it.quantity) || 1),
        rate: Math.max(0, Number(it.rate) || 0),
        taxRate: Number(it.taxRate) || 0,
      })),
      discount: Number(data.discount) || 0,
      discountType: data.discountType,
      taxType: data.taxType,
      taxRate: Number(data.taxRate) || 0,
      adjustment: Number(data.adjustment) || 0,
    });

    if (calcOutput.total < 0) {
      return respondError("Vendor credit total cannot be negative.", 400);
    }

    // If new total is less than already applied amount, reject
    if (calcOutput.total < (existingCredit.appliedAmount || 0)) {
      return respondError(
        `New total (₹${calcOutput.total}) cannot be less than already applied amount (₹${existingCredit.appliedAmount}).`,
        400,
      );
    }

    const newBalanceRemaining = Math.max(0, Math.round((calcOutput.total - (existingCredit.appliedAmount || 0)) * 100) / 100);

    existingCredit.vendorId = vendorObjId;
    existingCredit.vendorName = vendorName;
    existingCredit.orderNumber = data.orderNumber || "";
    existingCredit.vendorCreditDate = new Date(data.vendorCreditDate);
    existingCredit.subject = data.subject || "";
    existingCredit.accountsPayable = data.accountsPayable || "Accounts Payable";
    existingCredit.notes = data.notes || "";

    existingCredit.items = data.items.map((it) => ({
      itemId: it.itemId,
      name: it.name.trim(),
      description: it.description?.trim() || "",
      account: it.account || "Cost of Goods Sold",
      quantity: Math.max(0.001, Number(it.quantity) || 1),
      rate: Math.max(0, Number(it.rate) || 0),
      taxRate: Number(it.taxRate) || 0,
      taxAmount: Math.round(((Number(it.quantity || 1) * Number(it.rate || 0) * (Number(it.taxRate) || 0)) / 100) * 100) / 100,
      amount: Math.round(Number(it.quantity || 1) * Number(it.rate || 0) * 100) / 100,
    }));

    existingCredit.subTotal = calcOutput.subTotal;
    existingCredit.discount = data.discount;
    existingCredit.discountType = data.discountType;
    existingCredit.discountAmount = calcOutput.discountAmount;
    existingCredit.taxType = data.taxType;
    existingCredit.taxRate = data.taxRate;
    existingCredit.taxAmount = calcOutput.taxAmount;
    existingCredit.cgst = calcOutput.cgst;
    existingCredit.sgst = calcOutput.sgst;
    existingCredit.igst = calcOutput.igst;
    existingCredit.adjustment = data.adjustment;
    existingCredit.total = calcOutput.total;
    existingCredit.balanceRemaining = newBalanceRemaining;

    if (data.status) {
      existingCredit.status = data.status;
    } else {
      if (newBalanceRemaining === 0 && (existingCredit.appliedAmount || 0) > 0) {
        existingCredit.status = "Closed";
      } else if ((existingCredit.appliedAmount || 0) > 0) {
        existingCredit.status = "Partially Applied";
      }
    }

    if (data.attachments) {
      existingCredit.attachments = data.attachments;
    }

    await existingCredit.save();

    return NextResponse.json({
      success: true,
      message: `Vendor credit ${existingCredit.creditNoteNumber} updated successfully.`,
      credit: existingCredit,
    });
  } catch (error) {
    console.error("PUT /api/purchases/vendor-credits/[id] error:", error);
    return respondError("Failed to update vendor credit.", 500);
  }
}

export async function DELETE(
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
      return respondError("Sign in to delete vendor credit.", 401);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);
    const credObjId = new Types.ObjectId(id);

    const credit = await VendorCredit.findOne({ _id: credObjId, organizationId: orgObjId });
    if (!credit) {
      return respondError("Vendor credit not found.", 404);
    }

    if ((credit.appliedAmount || 0) > 0) {
      return respondError(
        `Cannot delete vendor credit because ₹${credit.appliedAmount} has already been applied to bills.`,
        400,
      );
    }

    await VendorCredit.findByIdAndDelete(credObjId);

    return NextResponse.json({
      success: true,
      message: `Vendor credit ${credit.creditNoteNumber} deleted successfully.`,
    });
  } catch (error) {
    console.error("DELETE /api/purchases/vendor-credits/[id] error:", error);
    return respondError("Failed to delete vendor credit.", 500);
  }
}
