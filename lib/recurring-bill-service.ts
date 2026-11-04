import { Types } from "mongoose";
import { DocumentSequence, PurchaseBill, RecurringBill } from "@/models";
import { calculateBillTotals, calculateDueDate, formatDateOnly } from "./bill-utils";
import { calculateNextBillDate } from "./recurring-bill-utils";

/**
 * Generates an actual PurchaseBill from an active RecurringBill profile,
 * updates the profile's nextBillDate, lastGeneratedDate, billsGeneratedCount, and logs.
 */
export async function generateBillFromRecurringProfile(
  profileId: string | Types.ObjectId,
  organizationId: string | Types.ObjectId,
  options: { force?: boolean; billDate?: string } = {},
) {
  const orgObjId = typeof organizationId === "string" ? new Types.ObjectId(organizationId) : organizationId;
  const profObjId = typeof profileId === "string" ? new Types.ObjectId(profileId) : profileId;

  const profile = await RecurringBill.findOne({ _id: profObjId, organizationId: orgObjId });
  if (!profile) {
    throw new Error("Recurring bill profile not found.");
  }

  if (profile.status !== "Active" && !options.force) {
    throw new Error(`Profile is currently ${profile.status}. Resume it before generating bills.`);
  }

  // Determine bill date
  const billDateStr = options.billDate || formatDateOnly(profile.nextBillDate || new Date());
  const billDateObj = new Date(billDateStr);

  // Check duplicate prevention: has a bill already been generated for this exact billDate?
  if (!options.force && profile.generatedBills && profile.generatedBills.length > 0) {
    const alreadyGenerated = profile.generatedBills.some((g) => {
      const gDateStr = formatDateOnly(new Date(g.generatedAt));
      return gDateStr === billDateStr;
    });
    if (alreadyGenerated) {
      throw new Error(`A bill has already been generated for scheduled date ${billDateStr}.`);
    }
  }

  // Allocate next sequence number BILL-xxxx
  const sequence = await DocumentSequence.findOneAndUpdate(
    { organizationId: orgObjId, modelName: "Purchase Bill" },
    { $inc: { nextNumber: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const nextSeq = sequence?.nextNumber || 1;
  const billNumber = `BILL-${String(nextSeq).padStart(4, "0")}`;

  // Calculate Due Date based on paymentTerms
  const dueDateStr = calculateDueDate(billDateStr, profile.paymentTerms || "Due on Receipt");
  const dueDateObj = dueDateStr ? new Date(dueDateStr) : billDateObj;

  // Recalculate totals to be authoritative
  const calcOutput = calculateBillTotals({
    items: profile.items.map((it) => ({
      itemId: it.itemId ? String(it.itemId) : undefined,
      name: it.name,
      description: it.description || "",
      account: it.account || "Cost of Goods Sold",
      quantity: Number(it.quantity) || 1,
      rate: Number(it.rate) || 0,
      taxRate: Number(it.taxRate) || 0,
      customerId: it.customerId ? String(it.customerId) : undefined,
      customerName: it.customerName || "",
      amount: Math.round(Number(it.quantity || 1) * Number(it.rate || 0) * 100) / 100,
    })),
    discount: Number(profile.discount) || 0,
    discountType: profile.discountType || "percent",
    taxType: profile.taxType || "GST",
    taxRate: Number(profile.taxRate) || 0,
    adjustment: Number(profile.adjustment) || 0,
  });

  // Create actual PurchaseBill in database
  const createdBill = await PurchaseBill.create({
    organizationId: orgObjId,
    billNumber,
    vendorId: profile.vendorId,
    vendorName: profile.vendorName,
    orderNumber: `REC-${profile.profileName.slice(0, 8).toUpperCase()}`,
    billDate: billDateObj,
    dueDate: dueDateObj,
    paymentTerms: profile.paymentTerms || "Due on Receipt",
    accountsPayable: profile.accountsPayable || "Accounts Payable",
    subject: `Recurring: ${profile.profileName}`,
    items: profile.items.map((it) => ({
      itemId: it.itemId,
      name: it.name,
      description: it.description || "",
      account: it.account || "Cost of Goods Sold",
      quantity: Number(it.quantity) || 1,
      rate: Number(it.rate) || 0,
      taxRate: Number(it.taxRate) || 0,
      taxAmount: Math.round(((Number(it.quantity || 1) * Number(it.rate || 0) * (Number(it.taxRate) || 0)) / 100) * 100) / 100,
      customerId: it.customerId,
      customerName: it.customerName || "",
      amount: Math.round(Number(it.quantity || 1) * Number(it.rate || 0) * 100) / 100,
    })),
    subTotal: calcOutput.subTotal,
    discount: profile.discount,
    discountType: profile.discountType,
    discountAmount: calcOutput.discountAmount,
    taxType: profile.taxType,
    taxRate: profile.taxRate,
    taxAmount: calcOutput.taxAmount,
    cgst: calcOutput.cgst,
    sgst: calcOutput.sgst,
    igst: calcOutput.igst,
    adjustment: profile.adjustment,
    total: calcOutput.total,
    amountPaid: 0,
    status: "Pending",
    notes: profile.notes || "",
    termsAndConditions: profile.termsAndConditions || "",
    currency: profile.currency || "INR",
  });

  // Advance next bill date
  const nextDateStr = calculateNextBillDate(billDateStr, profile.repeatEvery);
  const nextDateObj = new Date(nextDateStr);

  // Check if new nextDate exceeds endsOn
  let newStatus: "Active" | "Paused" | "Expired" = profile.status;
  if (!profile.neverExpires && profile.endsOn) {
    const endsOnStr = formatDateOnly(new Date(profile.endsOn));
    if (nextDateStr > endsOnStr) {
      newStatus = "Expired";
    }
  }

  // Update profile
  profile.lastGeneratedDate = new Date();
  profile.billsGeneratedCount = (profile.billsGeneratedCount || 0) + 1;
  profile.nextBillDate = nextDateObj;
  profile.status = newStatus;
  profile.generatedBills = profile.generatedBills || [];
  profile.generatedBills.unshift({
    billId: createdBill._id,
    billNumber: createdBill.billNumber,
    generatedAt: new Date(),
    total: createdBill.total,
    status: "Pending",
  });

  await profile.save();

  return {
    bill: createdBill,
    profile,
    nextBillDate: nextDateStr,
  };
}
