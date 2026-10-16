export type AccountEntryType = "debit" | "credit";

export type InvoiceBreakdownInput = {
  subtotal: number;
  discount?: number;
  shipping?: number;
  taxRate?: number;
  placeOfSupply?: string;
  customerState?: string;
  isInclusive?: boolean;
};

export type InvoiceBreakdown = {
  subtotal: number;
  discount: number;
  shipping: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
  taxRate: number;
  isIntraState: boolean;
};

export type JournalLine = {
  account: string;
  type: AccountEntryType;
  amount: number;
};

export function roundMoney(value: number) {
  return Number(Math.round((value + Number.EPSILON) * 100) / 100);
}

export function calculateInvoiceBreakdown({
  subtotal,
  discount = 0,
  shipping = 0,
  taxRate = 0,
  placeOfSupply,
  customerState,
  isInclusive = false,
}: InvoiceBreakdownInput): InvoiceBreakdown {
  const safeSubtotal = roundMoney(subtotal);
  const safeDiscount = roundMoney(discount);
  const safeShipping = roundMoney(shipping);
  const rate = Math.max(0, taxRate);
  const baseBeforeTax = Math.max(0, safeSubtotal - safeDiscount);
  const taxableBase = roundMoney(baseBeforeTax + safeShipping);
  const isIntraState =
    !!placeOfSupply && !!customerState && placeOfSupply.toUpperCase() === customerState.toUpperCase();

  let taxableAmount = taxableBase;

  if (rate > 0 && isInclusive) {
    taxableAmount = roundMoney(taxableBase / (1 + rate / 100));
  }

  const taxOnTaxableAmount = roundMoney((taxableAmount * rate) / 100);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (rate > 0) {
    if (isIntraState) {
      cgst = roundMoney(taxOnTaxableAmount / 2);
      sgst = roundMoney(taxOnTaxableAmount / 2);
    } else {
      igst = roundMoney(taxOnTaxableAmount);
    }
  }

  const totalTax = roundMoney(cgst + sgst + igst);
  const grandTotal = roundMoney(baseBeforeTax + safeShipping + totalTax);

  return {
    subtotal: safeSubtotal,
    discount: safeDiscount,
    shipping: safeShipping,
    taxableAmount: roundMoney(taxableAmount),
    cgst,
    sgst,
    igst,
    totalTax,
    grandTotal,
    taxRate: rate,
    isIntraState,
  };
}

export function createJournalEntry({
  description,
  lines,
}: {
  description: string;
  lines: JournalLine[];
}) {
  const debitTotal = roundMoney(
    lines
      .filter((line) => line.type === "debit")
      .reduce((sum, line) => sum + line.amount, 0),
  );

  const creditTotal = roundMoney(
    lines
      .filter((line) => line.type === "credit")
      .reduce((sum, line) => sum + line.amount, 0),
  );

  return {
    description,
    debitTotal,
    creditTotal,
    isBalanced: debitTotal === creditTotal,
    lines,
  };
}

export function getTrialBalance(lines: JournalLine[]) {
  const totals: Record<string, number> = {};

  lines.forEach((line) => {
    const previous = totals[line.account] ?? 0;
    const delta = line.type === "debit" ? line.amount : -line.amount;
    totals[line.account] = roundMoney(previous + delta);
  });

  return totals;
}

export function applyPayment({
  outstanding,
  amount,
  invoiceNumber,
}: {
  outstanding: number;
  amount: number;
  invoiceNumber: string;
}) {
  const paymentApplied = Math.min(outstanding, amount);
  const remaining = roundMoney(outstanding - paymentApplied);

  return {
    invoiceNumber,
    paymentApplied: roundMoney(paymentApplied),
    outstanding: remaining,
    remaining,
  };
}
