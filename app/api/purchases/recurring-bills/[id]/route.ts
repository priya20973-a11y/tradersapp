import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { RecurringBill, Vendor } from "@/models";
import { calculateBillTotals, formatDateOnly } from "@/lib/bill-utils";
import {
  readRecurringBillRequestMetadata,
  recurringBillSchema,
} from "@/lib/recurring-bill-utils";

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
      return respondError("Invalid profile ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to view recurring bill.", 401);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);
    const profObjId = new Types.ObjectId(id);

    const profile = await RecurringBill.findOne({ _id: profObjId, organizationId: orgObjId }).lean();
    if (!profile) {
      return respondError("Recurring bill profile not found.", 404);
    }

    return NextResponse.json({
      profile: {
        ...profile,
        id: String(profile._id),
        startDate: profile.startDate ? formatDateOnly(new Date(profile.startDate)) : "",
        endsOn: profile.endsOn ? formatDateOnly(new Date(profile.endsOn)) : "",
        nextBillDate: profile.nextBillDate ? formatDateOnly(new Date(profile.nextBillDate)) : "",
        lastGeneratedDate: profile.lastGeneratedDate ? new Date(profile.lastGeneratedDate).toISOString() : null,
      },
    });
  } catch (error) {
    console.error("GET /api/purchases/recurring-bills/[id] error:", error);
    return respondError("Failed to fetch recurring bill profile.", 500);
  }
}

export async function PUT(
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
      return respondError("Sign in to update recurring bill.", 401);
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

    const validation = recurringBillSchema.safeParse(payload);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0]?.message || "Invalid input data.";
      return respondError(firstIssue, 400);
    }

    const data = validation.data;
    const requestMetadata = readRecurringBillRequestMetadata(payload);

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);
    const profObjId = new Types.ObjectId(id);

    const existingProfile = await RecurringBill.findOne({ _id: profObjId, organizationId: orgObjId });
    if (!existingProfile) {
      return respondError("Recurring bill profile not found.", 404);
    }

    // Validate vendor exists or get vendor details
    let vendorObjId: Types.ObjectId = existingProfile.vendorId;
    let vendorName = data.vendorName;
    if (isValidObjectId(data.vendorId)) {
      vendorObjId = new Types.ObjectId(data.vendorId);
      const vend = await Vendor.findOne({ _id: vendorObjId, organizationId: orgObjId }).select("name");
      if (vend && vend.name) vendorName = String(vend.name);
    }

    // Authoritative totals calculation
    const calcOutput = calculateBillTotals({
      items: data.items.map((it) => ({
        itemId: it.itemId ? String(it.itemId) : undefined,
        name: it.name.trim(),
        description: it.description?.trim() || "",
        account: it.account || "Cost of Goods Sold",
        quantity: Math.max(0.001, Number(it.quantity) || 1),
        rate: Math.max(0, Number(it.rate) || 0),
        taxRate: Number(it.taxRate) || 0,
        customerId: it.customerId ? String(it.customerId) : undefined,
        customerName: it.customerName || "",
        amount: Math.round(Number(it.quantity || 1) * Number(it.rate || 0) * 100) / 100,
      })),
      discount: Number(data.discount) || 0,
      discountType: data.discountType,
      taxType: data.taxType,
      taxRate: Number(data.taxRate) || 0,
      adjustment: Number(data.adjustment) || 0,
    });

    if (calcOutput.total < 0) {
      return respondError("Recurring bill total cannot be negative.", 400);
    }

    // Update fields
    existingProfile.profileName = data.profileName.trim();
    existingProfile.vendorId = vendorObjId;
    existingProfile.vendorName = vendorName;
    existingProfile.repeatEvery = data.repeatEvery;
    existingProfile.startDate = new Date(data.startDate);
    existingProfile.endsOn = data.neverExpires || !data.endsOn ? null : new Date(data.endsOn);
    existingProfile.neverExpires = data.neverExpires;
    existingProfile.paymentTerms = data.paymentTerms || "Due on Receipt";
    existingProfile.accountsPayable = data.accountsPayable || "Accounts Payable";
    existingProfile.status = data.status || "Active";
    existingProfile.notes = data.notes || "";
    existingProfile.termsAndConditions = data.termsAndConditions || "";

    // If nextBillDate needs adjustment
    if (requestMetadata.nextBillDate) {
      existingProfile.nextBillDate = new Date(requestMetadata.nextBillDate);
    }

    existingProfile.items = data.items.map((it) => ({
      itemId: it.itemId,
      name: it.name.trim(),
      description: it.description?.trim() || "",
      account: it.account || "Cost of Goods Sold",
      quantity: Math.max(0.001, Number(it.quantity) || 1),
      rate: Math.max(0, Number(it.rate) || 0),
      taxRate: Number(it.taxRate) || 0,
      taxAmount: Math.round(((Number(it.quantity || 1) * Number(it.rate || 0) * (Number(it.taxRate) || 0)) / 100) * 100) / 100,
      customerId: it.customerId,
      customerName: it.customerName || "",
      amount: Math.round(Number(it.quantity || 1) * Number(it.rate || 0) * 100) / 100,
    }));

    existingProfile.subTotal = calcOutput.subTotal;
    existingProfile.discount = data.discount;
    existingProfile.discountType = data.discountType;
    existingProfile.discountAmount = calcOutput.discountAmount;
    existingProfile.taxType = data.taxType;
    existingProfile.taxRate = data.taxRate;
    existingProfile.taxAmount = calcOutput.taxAmount;
    existingProfile.cgst = calcOutput.cgst;
    existingProfile.sgst = calcOutput.sgst;
    existingProfile.igst = calcOutput.igst;
    existingProfile.adjustment = data.adjustment;
    existingProfile.total = calcOutput.total;

    await existingProfile.save();

    return NextResponse.json({
      success: true,
      message: "Recurring bill profile updated successfully.",
      profile: existingProfile,
    });
  } catch (error) {
    console.error("PUT /api/purchases/recurring-bills/[id] error:", error);
    return respondError("Failed to update recurring bill profile.", 500);
  }
}

export async function DELETE(
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
      return respondError("Sign in to delete recurring bill.", 401);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);
    const profObjId = new Types.ObjectId(id);

    const deleted = await RecurringBill.findOneAndDelete({ _id: profObjId, organizationId: orgObjId });
    if (!deleted) {
      return respondError("Recurring bill profile not found.", 404);
    }

    return NextResponse.json({
      success: true,
      message: "Recurring bill profile deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE /api/purchases/recurring-bills/[id] error:", error);
    return respondError("Failed to delete recurring bill profile.", 500);
  }
}
