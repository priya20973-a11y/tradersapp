import { describe, expect, it } from "vitest";
import {
  calculateInvoiceBreakdown,
  createJournalEntry,
  getTrialBalance,
  applyPayment,
} from "./accounting";

describe("accounting engine", () => {
  it("calculates intra-state GST and invoice totals accurately", () => {
    const totals = calculateInvoiceBreakdown({
      subtotal: 1000,
      discount: 100,
      shipping: 50,
      taxRate: 18,
      placeOfSupply: "MH",
      customerState: "MH",
      isInclusive: false,
    });

    expect(totals.subtotal).toBe(1000);
    expect(totals.discount).toBe(100);
    expect(totals.taxableAmount).toBe(950);
    expect(totals.cgst).toBe(85.5);
    expect(totals.sgst).toBe(85.5);
    expect(totals.igst).toBe(0);
    expect(totals.grandTotal).toBe(1121);
  });

  it("balances debits and credits for a posted invoice entry", () => {
    const journal = createJournalEntry({
      description: "Invoice posting",
      lines: [
        { account: "Accounts Receivable", type: "debit", amount: 1121 },
        { account: "Sales Revenue", type: "credit", amount: 1000 },
        { account: "Output GST", type: "credit", amount: 121 },
      ],
    });

    expect(journal.debitTotal).toBe(1121);
    expect(journal.creditTotal).toBe(1121);
    expect(journal.isBalanced).toBe(true);
  });

  it("tracks partial payments without double-applying", () => {
    const state = applyPayment({
      outstanding: 1121,
      amount: 500,
      invoiceNumber: "INV-1001",
    });

    expect(state.outstanding).toBe(621);
    expect(state.paymentApplied).toBe(500);
    expect(state.remaining).toBe(621);
  });

  it("derives a trial balance from ledger lines", () => {
    const balances = getTrialBalance([
      { account: "Cash", type: "debit", amount: 2000 },
      { account: "Revenue", type: "credit", amount: 1500 },
      { account: "Expense", type: "debit", amount: 500 },
      { account: "Accounts Payable", type: "credit", amount: 1000 },
    ]);

    expect(balances["Cash"]).toBe(2000);
    expect(balances["Revenue"]).toBe(-1500);
    expect(balances["Expense"]).toBe(500);
    expect(balances["Accounts Payable"]).toBe(-1000);
  });
});
