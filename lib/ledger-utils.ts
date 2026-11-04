export interface LedgerLine {
  id: string;
  date: string;
  type: "Opening Balance" | "Invoice" | "Payment Received" | "Credit Note" | "Purchase Bill" | "Payment Made" | "Vendor Credit";
  referenceNumber: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  rawDoc?: Record<string, unknown>;
}

export interface LedgerSummary {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  netOutstanding: number;
  transactionCount: number;
}

/**
 * Calculates Customer Ledger:
 * Customer account is an Asset (Accounts Receivable)
 * Opening Balance: typically debit (customer owes money)
 * Invoices: Debit (increases receivable)
 * Payments Received: Credit (reduces receivable)
 * Credit Notes: Credit (reduces receivable)
 * Running Balance = Opening Balance + Total Debit - Total Credit
 */
export function calculateCustomerLedger(
  openingBalance: number,
  transactions: {
    id: string;
    date: string | Date;
    type: "Invoice" | "Payment Received" | "Credit Note";
    referenceNumber: string;
    description?: string;
    amount: number;
    rawDoc?: Record<string, unknown>;
  }[],
  options?: {
    startDate?: string | Date;
    endDate?: string | Date;
  },
): { lines: LedgerLine[]; summary: LedgerSummary } {
  // Sort all transactions chronologically ascending
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const startMs = options?.startDate ? new Date(options.startDate).getTime() : 0;
  const endMs = options?.endDate ? new Date(options.endDate).getTime() : Infinity;

  let currentBalance = Math.round(openingBalance * 100) / 100;
  let totalDebit = 0;
  let totalCredit = 0;

  const lines: LedgerLine[] = [];

  // Add initial opening balance line if applicable
  lines.push({
    id: "opening-bal",
    date: options?.startDate
      ? new Date(options.startDate).toISOString()
      : sorted[0]?.date
      ? new Date(sorted[0].date).toISOString()
      : new Date().toISOString(),
    type: "Opening Balance",
    referenceNumber: "OP-BAL",
    description: "Opening Balance Forwarded",
    debit: openingBalance >= 0 ? openingBalance : 0,
    credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
    balance: currentBalance,
  });

  for (const tx of sorted) {
    const txMs = new Date(tx.date).getTime();
    const amount = Math.round((Number(tx.amount) || 0) * 100) / 100;

    let debit = 0;
    let credit = 0;

    if (tx.type === "Invoice") {
      debit = amount;
      currentBalance = Math.round((currentBalance + debit) * 100) / 100;
    } else if (tx.type === "Payment Received" || tx.type === "Credit Note") {
      credit = amount;
      currentBalance = Math.round((currentBalance - credit) * 100) / 100;
    }

    if (txMs >= startMs && txMs <= endMs) {
      totalDebit = Math.round((totalDebit + debit) * 100) / 100;
      totalCredit = Math.round((totalCredit + credit) * 100) / 100;

      lines.push({
        id: tx.id,
        date: new Date(tx.date).toISOString(),
        type: tx.type,
        referenceNumber: tx.referenceNumber,
        description: tx.description || `${tx.type} #${tx.referenceNumber}`,
        debit,
        credit,
        balance: currentBalance,
        rawDoc: tx.rawDoc,
      });
    }
  }

  return {
    lines,
    summary: {
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance: currentBalance,
      netOutstanding: currentBalance,
      transactionCount: lines.length - 1, // excluding opening balance line
    },
  };
}

/**
 * Calculates Vendor Ledger:
 * Vendor account is a Liability (Accounts Payable)
 * Opening Balance: typically credit (we owe vendor)
 * Purchase Bills: Credit (increases payable)
 * Payments Made: Debit (reduces payable)
 * Vendor Credits: Debit (reduces payable)
 * Running Balance = Opening Balance + Total Credit (Bills) - Total Debit (Payments)
 */
export function calculateVendorLedger(
  openingBalance: number,
  transactions: {
    id: string;
    date: string | Date;
    type: "Purchase Bill" | "Payment Made" | "Vendor Credit";
    referenceNumber: string;
    description?: string;
    amount: number;
    rawDoc?: Record<string, unknown>;
  }[],
  options?: {
    startDate?: string | Date;
    endDate?: string | Date;
  },
): { lines: LedgerLine[]; summary: LedgerSummary } {
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const startMs = options?.startDate ? new Date(options.startDate).getTime() : 0;
  const endMs = options?.endDate ? new Date(options.endDate).getTime() : Infinity;

  let currentBalance = Math.round(openingBalance * 100) / 100;
  let totalDebit = 0;
  let totalCredit = 0;

  const lines: LedgerLine[] = [];

  // Opening balance row
  lines.push({
    id: "opening-bal",
    date: options?.startDate
      ? new Date(options.startDate).toISOString()
      : sorted[0]?.date
      ? new Date(sorted[0].date).toISOString()
      : new Date().toISOString(),
    type: "Opening Balance",
    referenceNumber: "OP-BAL",
    description: "Opening Balance Forwarded",
    debit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
    credit: openingBalance >= 0 ? openingBalance : 0,
    balance: currentBalance,
  });

  for (const tx of sorted) {
    const txMs = new Date(tx.date).getTime();
    const amount = Math.round((Number(tx.amount) || 0) * 100) / 100;

    let debit = 0;
    let credit = 0;

    if (tx.type === "Purchase Bill") {
      credit = amount;
      currentBalance = Math.round((currentBalance + credit) * 100) / 100;
    } else if (tx.type === "Payment Made" || tx.type === "Vendor Credit") {
      debit = amount;
      currentBalance = Math.round((currentBalance - debit) * 100) / 100;
    }

    if (txMs >= startMs && txMs <= endMs) {
      totalDebit = Math.round((totalDebit + debit) * 100) / 100;
      totalCredit = Math.round((totalCredit + credit) * 100) / 100;

      lines.push({
        id: tx.id,
        date: new Date(tx.date).toISOString(),
        type: tx.type,
        referenceNumber: tx.referenceNumber,
        description: tx.description || `${tx.type} #${tx.referenceNumber}`,
        debit,
        credit,
        balance: currentBalance,
        rawDoc: tx.rawDoc,
      });
    }
  }

  return {
    lines,
    summary: {
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance: currentBalance,
      netOutstanding: currentBalance,
      transactionCount: lines.length - 1,
    },
  };
}

/**
 * Generates formatted CSV string for Ledger export
 */
export function generateLedgerCsv(
  entityType: "Customer" | "Vendor",
  entityName: string,
  lines: LedgerLine[],
  summary: LedgerSummary,
): string {
  const headers = ["Date", "Type", "Ref Number", "Description", "Debit (INR)", "Credit (INR)", "Running Balance (INR)"];

  const rows = lines.map((l) => [
    `"${new Date(l.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}"`,
    `"${l.type}"`,
    `"${l.referenceNumber}"`,
    `"${(l.description || "").replace(/"/g, '""')}"`,
    l.debit > 0 ? l.debit.toFixed(2) : "0.00",
    l.credit > 0 ? l.credit.toFixed(2) : "0.00",
    l.balance.toFixed(2),
  ]);

  const summaryRows = [
    [],
    [`"${entityType} Name:"`, `"${entityName}"`],
    [`"Opening Balance:"`, summary.openingBalance.toFixed(2)],
    [`"Total Debit:"`, summary.totalDebit.toFixed(2)],
    [`"Total Credit:"`, summary.totalCredit.toFixed(2)],
    [`"Closing Balance:"`, summary.closingBalance.toFixed(2)],
  ];

  const csvContent = [
    `"${entityType} Ledger Statement - ${entityName}"`,
    `"Exported on: ${new Date().toLocaleString("en-IN")}"`,
    "",
    headers.join(","),
    ...rows.map((r) => r.join(",")),
    ...summaryRows.map((r) => r.join(",")),
  ].join("\r\n");

  return csvContent;
}

/**
 * Generates formatted CSV string for Payments list export
 */
export function generatePaymentsCsv(
  type: "Customer Payments" | "Vendor Payments",
  payments: {
    date: string;
    number: string;
    partyName: string;
    linkedDoc?: string;
    mode: string;
    referenceNumber: string;
    amount: number;
    status: string;
  }[],
): string {
  const headers = ["Date", "Payment / Receipt #", "Party Name", "Linked Invoice / Bill", "Payment Mode", "Ref / UTR #", "Amount (INR)", "Status"];

  const rows = payments.map((p) => [
    `"${new Date(p.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}"`,
    `"${p.number}"`,
    `"${(p.partyName || "").replace(/"/g, '""')}"`,
    `"${(p.linkedDoc || "On Account").replace(/"/g, '""')}"`,
    `"${p.mode}"`,
    `"${(p.referenceNumber || "").replace(/"/g, '""')}"`,
    p.amount.toFixed(2),
    `"${p.status}"`,
  ]);

  return [
    `"${type} Register"`,
    `"Exported on: ${new Date().toLocaleString("en-IN")}"`,
    "",
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\r\n");
}
