import { Types } from "mongoose";
import { PurchaseBill, VendorCredit } from "@/models";

/**
 * Atomically applies an available Vendor Credit to one or more Purchase Bills.
 */
export async function applyVendorCreditToBills({
  creditId,
  organizationId,
  applications,
}: {
  creditId: string | Types.ObjectId;
  organizationId: string | Types.ObjectId;
  applications: { billId: string; amount: number }[];
}) {
  const orgObjId = typeof organizationId === "string" ? new Types.ObjectId(organizationId) : organizationId;
  const credObjId = typeof creditId === "string" ? new Types.ObjectId(creditId) : creditId;

  const credit = await VendorCredit.findOne({ _id: credObjId, organizationId: orgObjId });
  if (!credit) {
    throw new Error("Vendor credit not found.");
  }

  if (credit.status === "Void" || credit.status === "Draft") {
    throw new Error(`Cannot apply credit in "${credit.status}" status.`);
  }

  if (credit.balanceRemaining <= 0) {
    throw new Error("This vendor credit has already been fully applied.");
  }

  // Filter positive applications
  const validApps = applications.filter((a) => Number(a.amount) > 0);
  if (validApps.length === 0) {
    throw new Error("Please specify at least one valid amount to apply.");
  }

  const totalAttemptingToApply = validApps.reduce((sum, a) => sum + Number(a.amount), 0);
  const roundedTotalAttempt = Math.round(totalAttemptingToApply * 100) / 100;

  if (roundedTotalAttempt > credit.balanceRemaining + 0.01) {
    throw new Error(
      `Total applied (₹${roundedTotalAttempt}) exceeds available credit balance (₹${credit.balanceRemaining}).`,
    );
  }

  const appliedBillsSummary: {
    billId: string;
    billNumber: string;
    amountApplied: number;
    newBalanceDue: number;
    newStatus: string;
  }[] = [];

  const now = new Date();

  for (const app of validApps) {
    const billObjId = new Types.ObjectId(app.billId);
    const bill = await PurchaseBill.findOne({
      _id: billObjId,
      organizationId: orgObjId,
      vendorId: credit.vendorId,
    });

    if (!bill) {
      throw new Error(`Purchase bill ${app.billId} not found or does not belong to vendor ${credit.vendorName}.`);
    }

    const appAmt = Math.round(Number(app.amount) * 100) / 100;
    const currentCreditApplied = Number(bill.vendorCreditApplied || 0);
    const currentPaid = Number(bill.amountPaid || 0);
    const currentBalanceDue = Math.max(0, Math.round((bill.total - currentCreditApplied - currentPaid) * 100) / 100);

    if (appAmt > currentBalanceDue + 0.01) {
      throw new Error(
        `Applied amount (₹${appAmt}) exceeds bill ${bill.billNumber}'s balance due (₹${currentBalanceDue}).`,
      );
    }

    // Update bill
    bill.vendorCreditApplied = Math.round((currentCreditApplied + appAmt) * 100) / 100;
    bill.balanceDue = Math.max(0, Math.round((bill.total - bill.vendorCreditApplied - currentPaid) * 100) / 100);
    bill.status = bill.balanceDue === 0 ? "Paid" : "Partially Paid";
    bill.creditsApplied = bill.creditsApplied || [];
    bill.creditsApplied.push({
      creditId: credit._id,
      creditNoteNumber: credit.creditNoteNumber,
      amount: appAmt,
      appliedDate: now,
      notes: `Applied credit note ${credit.creditNoteNumber}`,
    });
    await bill.save();

    // Record application in vendor credit
    credit.billsApplied = credit.billsApplied || [];
    credit.billsApplied.push({
      billId: bill._id,
      billNumber: bill.billNumber,
      amountApplied: appAmt,
      appliedDate: now,
      notes: `Applied credit note ${credit.creditNoteNumber}`,
    });

    appliedBillsSummary.push({
      billId: String(bill._id),
      billNumber: bill.billNumber,
      amountApplied: appAmt,
      newBalanceDue: bill.balanceDue,
      newStatus: bill.status,
    });
  }

  // Update credit balance and status
  credit.appliedAmount = Math.round((credit.appliedAmount + roundedTotalAttempt) * 100) / 100;
  credit.balanceRemaining = Math.max(0, Math.round((credit.total - credit.appliedAmount) * 100) / 100);
  credit.status = credit.balanceRemaining === 0 ? "Closed" : "Partially Applied";

  await credit.save();

  return {
    credit,
    appliedTotal: roundedTotalAttempt,
    balanceRemaining: credit.balanceRemaining,
    appliedBills: appliedBillsSummary,
  };
}

/**
 * Atomically applies one or more available Vendor Credits to a single Purchase Bill.
 */
export async function applyCreditsToBill({
  billId,
  organizationId,
  creditApplications,
}: {
  billId: string | Types.ObjectId;
  organizationId: string | Types.ObjectId;
  creditApplications: { creditId: string; amount: number; notes?: string }[];
}) {
  const orgObjId = typeof organizationId === "string" ? new Types.ObjectId(organizationId) : organizationId;
  const billObjId = typeof billId === "string" ? new Types.ObjectId(billId) : billId;

  const bill = await PurchaseBill.findOne({ _id: billObjId, organizationId: orgObjId });
  if (!bill) {
    throw new Error("Purchase bill not found.");
  }

  if (bill.status === "Void" || bill.status === "Draft") {
    throw new Error(`Cannot apply credit to a bill in "${bill.status}" status.`);
  }

  const currentCreditApplied = Number(bill.vendorCreditApplied || 0);
  const currentPaid = Number(bill.amountPaid || 0);
  const currentBalanceDue = Math.max(0, Math.round((bill.total - currentCreditApplied - currentPaid) * 100) / 100);

  if (currentBalanceDue <= 0) {
    throw new Error("This bill has already been fully settled.");
  }

  const validApps = creditApplications.filter((a) => Number(a.amount) > 0);
  if (validApps.length === 0) {
    throw new Error("Please specify at least one valid credit amount to apply.");
  }

  const totalAttemptingToApply = validApps.reduce((sum, a) => sum + Number(a.amount), 0);
  const roundedTotalAttempt = Math.round(totalAttemptingToApply * 100) / 100;

  if (roundedTotalAttempt > currentBalanceDue + 0.01) {
    throw new Error(
      `Total credit applied (₹${roundedTotalAttempt}) exceeds bill's payment due (₹${currentBalanceDue}).`,
    );
  }

  const now = new Date();
  const appliedCreditsSummary: {
    creditId: string;
    creditNoteNumber: string;
    amount: number;
    remainingCreditBalance: number;
  }[] = [];

  for (const app of validApps) {
    const credObjId = new Types.ObjectId(app.creditId);
    const credit = await VendorCredit.findOne({
      _id: credObjId,
      organizationId: orgObjId,
    });

    if (!credit) {
      throw new Error(`Vendor credit ${app.creditId} not found.`);
    }

    if (String(credit.vendorId) !== String(bill.vendorId)) {
      throw new Error(`Vendor credit ${credit.creditNoteNumber} does not belong to vendor ${bill.vendorName}.`);
    }

    if (credit.status === "Void" || credit.status === "Draft") {
      throw new Error(`Cannot apply credit note ${credit.creditNoteNumber} in "${credit.status}" status.`);
    }

    const appAmt = Math.round(Number(app.amount) * 100) / 100;
    if (appAmt > credit.balanceRemaining + 0.01) {
      throw new Error(
        `Applied amount (₹${appAmt}) exceeds credit note ${credit.creditNoteNumber}'s available balance (₹${credit.balanceRemaining}).`,
      );
    }

    // Update credit
    credit.appliedAmount = Math.round((credit.appliedAmount + appAmt) * 100) / 100;
    credit.balanceRemaining = Math.max(0, Math.round((credit.total - credit.appliedAmount) * 100) / 100);
    credit.status = credit.balanceRemaining === 0 ? "Closed" : "Partially Applied";
    credit.billsApplied = credit.billsApplied || [];
    credit.billsApplied.push({
      billId: bill._id,
      billNumber: bill.billNumber,
      amountApplied: appAmt,
      appliedDate: now,
      notes: app.notes || `Applied to Bill #${bill.billNumber}`,
    });
    await credit.save();

    // Record on bill
    bill.creditsApplied = bill.creditsApplied || [];
    bill.creditsApplied.push({
      creditId: credit._id,
      creditNoteNumber: credit.creditNoteNumber,
      amount: appAmt,
      appliedDate: now,
      notes: app.notes || `Applied from Credit Note #${credit.creditNoteNumber}`,
    });

    appliedCreditsSummary.push({
      creditId: String(credit._id),
      creditNoteNumber: credit.creditNoteNumber,
      amount: appAmt,
      remainingCreditBalance: credit.balanceRemaining,
    });
  }

  // Update bill total credit applied, balance due, and status
  bill.vendorCreditApplied = Math.round((currentCreditApplied + roundedTotalAttempt) * 100) / 100;
  bill.balanceDue = Math.max(0, Math.round((bill.total - bill.vendorCreditApplied - currentPaid) * 100) / 100);
  bill.status = bill.balanceDue === 0 ? "Paid" : "Partially Paid";
  await bill.save();

  return {
    bill,
    appliedTotal: roundedTotalAttempt,
    billTotal: bill.total,
    vendorCreditApplied: bill.vendorCreditApplied,
    paymentMade: bill.amountPaid,
    paymentDue: bill.balanceDue,
    status: bill.status,
    appliedCredits: appliedCreditsSummary,
  };
}
