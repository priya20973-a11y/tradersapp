import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Customer, SalesDocument } from "@/models";

/**
 * Atomically applies one or more available Credit Notes to a single Sales Invoice.
 * Enforces:
 * 1. Invoice must exist and not be in "Draft" or "Void" status.
 * 2. Only Credit Notes belonging to the EXACT SAME customer can be applied.
 * 3. Total applied credit cannot exceed invoice's payment due (total - amountPaid - creditedAmount).
 * 4. Applied amount for each credit note cannot exceed that credit note's available balance (total - creditedAmount).
 * 5. Updates invoice creditedAmount, status (Paid / Partially Paid), creditsApplied record.
 * 6. Updates each credit note's creditedAmount, balanceRemaining, status (Closed / Partially Applied), invoicesApplied record.
 * 7. Atomically decrements customer unusedCredits.
 */
export async function applyCreditsToInvoice({
  invoiceId,
  organizationId,
  creditApplications,
}: {
  invoiceId: string | Types.ObjectId;
  organizationId: string | Types.ObjectId;
  creditApplications: { creditNoteId: string; amount: number; notes?: string }[];
}) {
  await connectToDatabase().catch(() => null);

  const orgObjId =
    typeof organizationId === "string" ? new Types.ObjectId(organizationId) : organizationId;
  const invObjId =
    typeof invoiceId === "string" ? new Types.ObjectId(invoiceId) : invoiceId;

  const invoice = await SalesDocument.findOne({
    _id: invObjId,
    organizationId: orgObjId,
    type: "Invoice",
  });

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  if (invoice.status === "Void" || invoice.status === "Draft") {
    throw new Error(`Cannot apply credit to an invoice in "${invoice.status}" status.`);
  }

  const currentCredited = Number(invoice.creditedAmount || 0);
  const currentPaid = Number(invoice.amountPaid || 0);
  const invoiceTotal = Number(invoice.total || 0);
  const currentBalanceDue = Math.max(
    0,
    Math.round((invoiceTotal - currentCredited - currentPaid) * 100) / 100,
  );

  if (currentBalanceDue <= 0) {
    throw new Error("This invoice has already been fully settled.");
  }

  const validApps = creditApplications.filter((a) => Number(a.amount) > 0);
  if (validApps.length === 0) {
    throw new Error("Please specify at least one valid credit amount to apply.");
  }

  const totalAttemptingToApply = validApps.reduce((sum, a) => sum + Number(a.amount), 0);
  const roundedTotalAttempt = Math.round(totalAttemptingToApply * 100) / 100;

  if (roundedTotalAttempt > currentBalanceDue + 0.01) {
    throw new Error(
      `Total credit applied (₹${roundedTotalAttempt}) exceeds invoice's balance due (₹${currentBalanceDue}).`,
    );
  }

  const now = new Date();
  const appliedCreditsSummary: {
    creditNoteId: string;
    creditNoteNumber: string;
    amount: number;
    remainingCreditBalance: number;
    status: string;
  }[] = [];

  for (const app of validApps) {
    const cnObjId = new Types.ObjectId(app.creditNoteId);
    const creditNote = await SalesDocument.findOne({
      _id: cnObjId,
      organizationId: orgObjId,
      type: "Credit Note",
    });

    if (!creditNote) {
      throw new Error(`Credit Note ${app.creditNoteId} not found.`);
    }

    // STRICT CUSTOMER MATCH VALIDATION
    if (String(creditNote.customerId) !== String(invoice.customerId)) {
      throw new Error(
        `Credit Note ${creditNote.number} belongs to a different customer and cannot be applied to this invoice.`,
      );
    }

    if (creditNote.status === "Void" || creditNote.status === "Draft") {
      throw new Error(`Cannot apply credit note in "${creditNote.status}" status.`);
    }

    const cnTotal = Number(creditNote.total || 0);
    const cnCredited = Number(creditNote.creditedAmount || 0);
    const cnAvailable = Math.max(0, Math.round((cnTotal - cnCredited) * 100) / 100);

    if (cnAvailable <= 0) {
      throw new Error(`Credit Note ${creditNote.number} has already been fully applied.`);
    }

    const appAmt = Math.round(Number(app.amount) * 100) / 100;
    if (appAmt > cnAvailable + 0.01) {
      throw new Error(
        `Applied amount (₹${appAmt}) exceeds Credit Note ${creditNote.number}'s available balance (₹${cnAvailable}).`,
      );
    }

    // Update credit note
    creditNote.creditedAmount = Math.round((cnCredited + appAmt) * 100) / 100;
    creditNote.balanceRemaining = Math.max(
      0,
      Math.round((cnTotal - creditNote.creditedAmount) * 100) / 100,
    );
    creditNote.status = creditNote.balanceRemaining === 0 ? "Closed" : "Partially Applied";

    creditNote.invoicesApplied = creditNote.invoicesApplied || [];
    creditNote.invoicesApplied.push({
      invoiceId: invoice._id,
      invoiceNumber: invoice.number,
      amountApplied: appAmt,
      appliedDate: now,
      notes: app.notes || `Applied to Invoice #${invoice.number}`,
    });

    await creditNote.save();

    // Record on invoice
    invoice.creditsApplied = invoice.creditsApplied || [];
    invoice.creditsApplied.push({
      creditNoteId: creditNote._id,
      creditNoteNumber: creditNote.number,
      amount: appAmt,
      appliedDate: now,
      notes: app.notes || `Applied from Credit Note #${creditNote.number}`,
    });

    appliedCreditsSummary.push({
      creditNoteId: String(creditNote._id),
      creditNoteNumber: creditNote.number,
      amount: appAmt,
      remainingCreditBalance: creditNote.balanceRemaining,
      status: creditNote.status,
    });
  }

  // Update invoice credited amount, balance due, and status
  invoice.creditedAmount = Math.round((currentCredited + roundedTotalAttempt) * 100) / 100;
  const newBalanceDue = Math.max(
    0,
    Math.round((invoiceTotal - currentPaid - invoice.creditedAmount) * 100) / 100,
  );
  invoice.status = newBalanceDue === 0 ? "Paid" : "Partially Paid";

  await invoice.save();

  // Atomically decrement customer unused credits
  await Customer.updateOne(
    { _id: invoice.customerId },
    { $inc: { unusedCredits: -roundedTotalAttempt } },
  ).catch(() => null);

  return {
    invoice,
    appliedTotal: roundedTotalAttempt,
    invoiceTotal,
    creditedAmount: invoice.creditedAmount,
    amountPaid: currentPaid,
    balanceDue: newBalanceDue,
    status: invoice.status,
    appliedCredits: appliedCreditsSummary,
  };
}

