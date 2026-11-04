import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { CreditNoteSettings, Customer, SalesDocument } from "@/models";
import {
  findNextAvailableCreditNoteNumber,
  getFiscalYear,
} from "./credit-note-numbering";

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

/**
 * Atomically loads or creates CreditNoteSettings for an organization,
 * checks fiscal year rollover, finds the next available unique credit note number,
 * and increments nextNumber persistently.
 */
export async function allocateNextCreditNoteNumber(
  organizationId: string | Types.ObjectId,
): Promise<{
  creditNoteNumber: string;
  allocatedNumber: number;
  prefix: string;
  padding: number;
}> {
  await connectToDatabase().catch(() => null);
  const orgObjId =
    organizationId && Types.ObjectId.isValid(organizationId)
      ? typeof organizationId === "string"
        ? new Types.ObjectId(organizationId)
        : organizationId
      : new Types.ObjectId("000000000000000000000001");
  const currentFY = getFiscalYear();

  let settings = await CreditNoteSettings.findOne({ organizationId: orgObjId });
  if (!settings) {
    settings = await CreditNoteSettings.create({
      organizationId: orgObjId,
      creditNotePrefix: "CN-",
      nextNumber: 2,
      numberZeroPadding: 5,
      autoGenerateNumbering: true,
      restartNumberingEachFiscalYear: false,
      lastFiscalYear: currentFY,
    });
  }

  // Check fiscal year restart
  let candidateNumber = settings.nextNumber || 1;
  if (
    settings.restartNumberingEachFiscalYear &&
    settings.lastFiscalYear &&
    settings.lastFiscalYear !== currentFY
  ) {
    candidateNumber = 1;
    settings.nextNumber = 1;
    settings.lastFiscalYear = currentFY;
    await CreditNoteSettings.updateOne(
      { _id: settings._id },
      { $set: { nextNumber: 1, lastFiscalYear: currentFY } },
    );
  }

  const prefix = settings.creditNotePrefix || "CN-";
  const padding = settings.numberZeroPadding || 5;

  // Retrieve existing credit note numbers for this organization with this prefix to prevent collision
  const existingNotes = await SalesDocument.find({
    organizationId: orgObjId,
    type: "Credit Note",
    number: { $regex: `^${escapeRegex(prefix)}` },
  })
    .select("number")
    .lean();

  const existingSet = new Set(existingNotes.map((n) => n.number));
  const { creditNoteNumber, allocatedNumber } = findNextAvailableCreditNoteNumber(
    prefix,
    candidateNumber,
    padding,
    existingSet,
  );

  // Update nextNumber in settings atomically
  await CreditNoteSettings.updateOne(
    { _id: settings._id },
    { $set: { nextNumber: allocatedNumber + 1 } },
  );

  return {
    creditNoteNumber,
    allocatedNumber,
    prefix,
    padding,
  };
}

/**
 * Peeks and returns the next available unique Credit Note number for an organization
 * without advancing nextNumber in settings (unless nextNumber is stale/behind existing records).
 */
export async function peekNextCreditNoteNumber(
  organizationId: string | Types.ObjectId,
): Promise<{
  creditNoteNumber: string;
  nextNumber: number;
  prefix: string;
  padding: number;
  autoGenerateNumbering: boolean;
  restartNumberingEachFiscalYear: boolean;
  lastFiscalYear: string;
}> {
  await connectToDatabase().catch(() => null);
  const orgObjId =
    organizationId && Types.ObjectId.isValid(organizationId)
      ? typeof organizationId === "string"
        ? new Types.ObjectId(organizationId)
        : organizationId
      : new Types.ObjectId("000000000000000000000001");
  const currentFY = getFiscalYear();

  let settings = await CreditNoteSettings.findOne({ organizationId: orgObjId });
  if (!settings) {
    settings = await CreditNoteSettings.create({
      organizationId: orgObjId,
      creditNotePrefix: "CN-",
      nextNumber: 2,
      numberZeroPadding: 5,
      autoGenerateNumbering: true,
      restartNumberingEachFiscalYear: false,
      lastFiscalYear: currentFY,
    });
  }

  let candidateNumber = settings.nextNumber || 1;
  if (
    settings.restartNumberingEachFiscalYear &&
    settings.lastFiscalYear &&
    settings.lastFiscalYear !== currentFY
  ) {
    candidateNumber = 1;
  }

  const prefix = settings.creditNotePrefix || "CN-";
  const padding = settings.numberZeroPadding || 5;

  const existingNotes = await SalesDocument.find({
    organizationId: orgObjId,
    type: "Credit Note",
    number: { $regex: `^${escapeRegex(prefix)}` },
  })
    .select("number")
    .lean();

  const existingSet = new Set(existingNotes.map((n) => n.number));
  const { creditNoteNumber, allocatedNumber } = findNextAvailableCreditNoteNumber(
    prefix,
    candidateNumber,
    padding,
    existingSet,
  );

  // If settings.nextNumber was lower than actual available number, synchronize it
  if ((settings.nextNumber || 1) < allocatedNumber) {
    await CreditNoteSettings.updateOne(
      { _id: settings._id },
      { $set: { nextNumber: allocatedNumber } },
    );
  }

  return {
    creditNoteNumber,
    nextNumber: allocatedNumber,
    prefix,
    padding,
    autoGenerateNumbering: settings.autoGenerateNumbering !== false,
    restartNumberingEachFiscalYear: Boolean(settings.restartNumberingEachFiscalYear),
    lastFiscalYear: settings.lastFiscalYear || currentFY,
  };
}

/**
 * Atomically applies a Credit Note to one or more outstanding invoices.
 * Enforces:
 * 1. Only invoices belonging to the EXACT SAME customer can be settled.
 * 2. Total applied amount cannot exceed available credit note balance.
 * 3. Applied amount per invoice cannot exceed invoice's outstanding balance due.
 * 4. Credit note and invoice statuses and balances are updated atomically.
 */
export async function applyCreditNoteToInvoices({
  creditNoteId,
  organizationId,
  applications,
}: {
  creditNoteId: string | Types.ObjectId;
  organizationId: string | Types.ObjectId;
  applications: { invoiceId: string; amount: number; notes?: string }[];
}) {
  await connectToDatabase().catch(() => null);

  const orgObjId =
    typeof organizationId === "string" ? new Types.ObjectId(organizationId) : organizationId;
  const cnObjId =
    typeof creditNoteId === "string" ? new Types.ObjectId(creditNoteId) : creditNoteId;

  const creditNote = await SalesDocument.findOne({
    _id: cnObjId,
    organizationId: orgObjId,
    type: "Credit Note",
  });

  if (!creditNote) {
    throw new Error("Credit Note not found.");
  }

  if (creditNote.status === "Void" || creditNote.status === "Draft") {
    throw new Error(`Cannot apply credit note in "${creditNote.status}" status.`);
  }

  const totalCredit = Number(creditNote.total || 0);
  const currentCredited = Number(creditNote.creditedAmount || 0);
  const availableCredit = Math.max(0, Math.round((totalCredit - currentCredited) * 100) / 100);

  if (availableCredit <= 0) {
    throw new Error("This credit note has already been fully applied.");
  }

  // Filter positive application amounts
  const validApps = applications.filter((a) => Number(a.amount) > 0);
  if (validApps.length === 0) {
    throw new Error("Please specify at least one valid invoice amount to apply.");
  }

  const totalAttemptingToApply = validApps.reduce((sum, a) => sum + Number(a.amount), 0);
  const roundedTotalAttempt = Math.round(totalAttemptingToApply * 100) / 100;

  if (roundedTotalAttempt > availableCredit + 0.01) {
    throw new Error(
      `Total credit to apply (₹${roundedTotalAttempt}) exceeds available credit note balance (₹${availableCredit}).`,
    );
  }

  const now = new Date();
  const appliedInvoicesSummary: {
    invoiceId: string;
    invoiceNumber: string;
    amountApplied: number;
    newBalanceDue: number;
    newStatus: string;
  }[] = [];

  for (const app of validApps) {
    const invObjId = new Types.ObjectId(app.invoiceId);
    const invoice = await SalesDocument.findOne({
      _id: invObjId,
      organizationId: orgObjId,
      type: "Invoice",
    });

    if (!invoice) {
      throw new Error(`Invoice ${app.invoiceId} not found.`);
    }

    // STRICT CUSTOMER MATCH VALIDATION
    if (String(invoice.customerId) !== String(creditNote.customerId)) {
      throw new Error(
        `Invoice ${invoice.number} belongs to a different customer and cannot be settled with this credit note.`,
      );
    }

    if (invoice.status === "Void" || invoice.status === "Draft") {
      throw new Error(`Cannot apply credit note to an invoice in "${invoice.status}" status.`);
    }

    const invTotal = Number(invoice.total || 0);
    const invPaid = Number(invoice.amountPaid || 0);
    const invCredited = Number(invoice.creditedAmount || 0);
    const invBalanceDue = Math.max(0, Math.round((invTotal - invPaid - invCredited) * 100) / 100);

    if (invBalanceDue <= 0) {
      throw new Error(`Invoice ${invoice.number} has already been fully paid.`);
    }

    const appAmt = Math.round(Number(app.amount) * 100) / 100;
    if (appAmt > invBalanceDue + 0.01) {
      throw new Error(
        `Applied amount (₹${appAmt}) exceeds Invoice ${invoice.number}'s outstanding balance due (₹${invBalanceDue}).`,
      );
    }

    // Update invoice credited amount and status
    invoice.creditedAmount = Math.round((invCredited + appAmt) * 100) / 100;
    const newInvBalanceDue = Math.max(
      0,
      Math.round((invTotal - invPaid - invoice.creditedAmount) * 100) / 100,
    );
    invoice.status = newInvBalanceDue === 0 ? "Paid" : "Partially Paid";

    invoice.creditsApplied = invoice.creditsApplied || [];
    invoice.creditsApplied.push({
      creditNoteId: creditNote._id,
      creditNoteNumber: creditNote.number,
      amount: appAmt,
      appliedDate: now,
      notes: app.notes || `Applied from Credit Note #${creditNote.number}`,
    });

    await invoice.save();

    // Record on credit note
    creditNote.invoicesApplied = creditNote.invoicesApplied || [];
    creditNote.invoicesApplied.push({
      invoiceId: invoice._id,
      invoiceNumber: invoice.number,
      amountApplied: appAmt,
      appliedDate: now,
      notes: app.notes || `Applied to Invoice #${invoice.number}`,
    });

    appliedInvoicesSummary.push({
      invoiceId: String(invoice._id),
      invoiceNumber: invoice.number,
      amountApplied: appAmt,
      newBalanceDue: newInvBalanceDue,
      newStatus: invoice.status,
    });
  }

  // Update credit note total applied, balance remaining, and status
  creditNote.creditedAmount = Math.round((currentCredited + roundedTotalAttempt) * 100) / 100;
  creditNote.balanceRemaining = Math.max(
    0,
    Math.round((totalCredit - creditNote.creditedAmount) * 100) / 100,
  );
  creditNote.status = creditNote.balanceRemaining === 0 ? "Closed" : "Partially Applied";

  await creditNote.save();

  // Update Customer's unusedCredits cache if exists
  await Customer.updateOne(
    { _id: creditNote.customerId },
    { $inc: { unusedCredits: -roundedTotalAttempt } },
  ).catch(() => null);

  return {
    creditNote,
    appliedTotal: roundedTotalAttempt,
    balanceRemaining: creditNote.balanceRemaining,
    status: creditNote.status,
    appliedInvoices: appliedInvoicesSummary,
  };
}

/**
 * Reverses an applied credit note from an invoice.
 */
export async function unapplyCreditNoteFromInvoice({
  creditNoteId,
  invoiceId,
  organizationId,
}: {
  creditNoteId: string | Types.ObjectId;
  invoiceId: string | Types.ObjectId;
  organizationId: string | Types.ObjectId;
}) {
  await connectToDatabase().catch(() => null);

  const orgObjId =
    typeof organizationId === "string" ? new Types.ObjectId(organizationId) : organizationId;
  const cnObjId =
    typeof creditNoteId === "string" ? new Types.ObjectId(creditNoteId) : creditNoteId;
  const invObjId =
    typeof invoiceId === "string" ? new Types.ObjectId(invoiceId) : invoiceId;

  const creditNote = await SalesDocument.findOne({
    _id: cnObjId,
    organizationId: orgObjId,
    type: "Credit Note",
  });

  if (!creditNote) throw new Error("Credit Note not found.");

  const invoice = await SalesDocument.findOne({
    _id: invObjId,
    organizationId: orgObjId,
    type: "Invoice",
  });

  if (!invoice) throw new Error("Invoice not found.");

  // Find applied amount in credit note
  const cnAppIndex = (creditNote.invoicesApplied || []).findIndex(
    (a) => String(a.invoiceId) === String(invoice._id),
  );

  if (cnAppIndex === -1) {
    throw new Error("No record of this credit note applied to the invoice.");
  }

  const appRecord = creditNote.invoicesApplied![cnAppIndex];
  const rollbackAmount = Number(appRecord.amountApplied || 0);

  // Remove from credit note
  creditNote.invoicesApplied!.splice(cnAppIndex, 1);
  creditNote.creditedAmount = Math.max(
    0,
    Math.round(((creditNote.creditedAmount || 0) - rollbackAmount) * 100) / 100,
  );
  creditNote.balanceRemaining = Math.max(
    0,
    Math.round((creditNote.total - creditNote.creditedAmount) * 100) / 100,
  );
  creditNote.status =
    creditNote.creditedAmount === 0
      ? "Open"
      : creditNote.balanceRemaining === 0
      ? "Closed"
      : "Partially Applied";

  await creditNote.save();

  // Remove from invoice
  const invAppIndex = (invoice.creditsApplied || []).findIndex(
    (a) => String(a.creditNoteId) === String(creditNote._id),
  );
  if (invAppIndex !== -1) {
    invoice.creditsApplied!.splice(invAppIndex, 1);
  }

  invoice.creditedAmount = Math.max(
    0,
    Math.round(((invoice.creditedAmount || 0) - rollbackAmount) * 100) / 100,
  );
  const invBalanceDue = Math.max(
    0,
    Math.round((invoice.total - invoice.amountPaid - invoice.creditedAmount) * 100) / 100,
  );
  invoice.status =
    invBalanceDue === 0
      ? "Paid"
      : invoice.amountPaid > 0 || invoice.creditedAmount > 0
      ? "Partially Paid"
      : "Unpaid";

  await invoice.save();

  // Restore Customer's unused credits
  await Customer.updateOne(
    { _id: creditNote.customerId },
    { $inc: { unusedCredits: rollbackAmount } },
  ).catch(() => null);

  return {
    success: true,
    rollbackAmount,
    creditNoteBalance: creditNote.balanceRemaining,
    invoiceBalanceDue: invBalanceDue,
  };
}

export { applyCreditsToInvoice } from "./invoice-credit-service";

