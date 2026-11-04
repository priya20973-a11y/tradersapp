import { describe, expect, it } from "vitest";
import {
  calculateCustomerLedger,
  calculateVendorLedger,
  generateLedgerCsv,
  generatePaymentsCsv,
} from "./ledger-utils";

describe("ledger-utils", () => {
  it("calculates customer ledger running balance accurately", () => {
    const openingBalance = 10000;
    const transactions = [
      {
        id: "tx-1",
        date: "2026-10-01",
        type: "Invoice" as const,
        referenceNumber: "INV-1001",
        amount: 25000,
      },
      {
        id: "tx-2",
        date: "2026-10-05",
        type: "Payment Received" as const,
        referenceNumber: "PAY-001",
        amount: 15000,
      },
      {
        id: "tx-3",
        date: "2026-10-10",
        type: "Invoice" as const,
        referenceNumber: "INV-1002",
        amount: 8000,
      },
      {
        id: "tx-4",
        date: "2026-10-12",
        type: "Credit Note" as const,
        referenceNumber: "CN-001",
        amount: 2000,
      },
    ];

    const result = calculateCustomerLedger(openingBalance, transactions);

    expect(result.summary.openingBalance).toBe(10000);
    expect(result.summary.totalDebit).toBe(33000); // 25000 + 8000
    expect(result.summary.totalCredit).toBe(17000); // 15000 + 2000
    expect(result.summary.closingBalance).toBe(26000); // 10000 + 33000 - 17000
    expect(result.summary.netOutstanding).toBe(26000);

    // Verify chronological line balances
    expect(result.lines[0].balance).toBe(10000); // OP-BAL
    expect(result.lines[1].balance).toBe(35000); // INV-1001 (10000 + 25000)
    expect(result.lines[2].balance).toBe(20000); // PAY-001 (35000 - 15000)
    expect(result.lines[3].balance).toBe(28000); // INV-1002 (20000 + 8000)
    expect(result.lines[4].balance).toBe(26000); // CN-001 (28000 - 2000)
  });

  it("calculates vendor ledger running balance accurately", () => {
    const openingBalance = 5000; // Company owes vendor 5000
    const transactions = [
      {
        id: "tx-1",
        date: "2026-10-02",
        type: "Purchase Bill" as const,
        referenceNumber: "BILL-2001",
        amount: 40000,
      },
      {
        id: "tx-2",
        date: "2026-10-06",
        type: "Payment Made" as const,
        referenceNumber: "VPAY-001",
        amount: 20000,
      },
      {
        id: "tx-3",
        date: "2026-10-14",
        type: "Vendor Credit" as const,
        referenceNumber: "VC-001",
        amount: 3000,
      },
    ];

    const result = calculateVendorLedger(openingBalance, transactions);

    expect(result.summary.openingBalance).toBe(5000);
    expect(result.summary.totalCredit).toBe(40000); // Purchase bill increases payable
    expect(result.summary.totalDebit).toBe(23000); // Payment + Credit reduces payable
    expect(result.summary.closingBalance).toBe(22000); // 5000 + 40000 - 23000
    expect(result.summary.netOutstanding).toBe(22000);

    expect(result.lines[0].balance).toBe(5000); // OP-BAL
    expect(result.lines[1].balance).toBe(45000); // BILL-2001 (5000 + 40000)
    expect(result.lines[2].balance).toBe(25000); // VPAY-001 (45000 - 20000)
    expect(result.lines[3].balance).toBe(22000); // VC-001 (25000 - 3000)
  });

  it("filters transactions by date range accurately", () => {
    const transactions = [
      { id: "1", date: "2026-10-01", type: "Invoice" as const, referenceNumber: "INV-1", amount: 1000 },
      { id: "2", date: "2026-10-15", type: "Invoice" as const, referenceNumber: "INV-2", amount: 2000 },
      { id: "3", date: "2026-10-31", type: "Invoice" as const, referenceNumber: "INV-3", amount: 3000 },
    ];

    const result = calculateCustomerLedger(0, transactions, {
      startDate: "2026-10-10",
      endDate: "2026-10-20",
    });

    // Opening bal + 1 line in range
    expect(result.lines.length).toBe(2);
    expect(result.lines[1].referenceNumber).toBe("INV-2");
    expect(result.summary.totalDebit).toBe(2000);
  });

  it("generates CSV export string with required headers", () => {
    const result = calculateCustomerLedger(5000, [
      { id: "tx-1", date: "2026-10-01", type: "Invoice", referenceNumber: "INV-101", amount: 12000 },
    ]);

    const csv = generateLedgerCsv("Customer", "Astra Foods", result.lines, result.summary);
    expect(csv).toContain("Customer Ledger Statement - Astra Foods");
    expect(csv).toContain("Date,Type,Ref Number,Description,Debit (INR),Credit (INR),Running Balance (INR)");
    expect(csv).toContain("INV-101");
    expect(csv).toContain("12000.00");
  });

  it("generates payments CSV export string correctly", () => {
    const csv = generatePaymentsCsv("Customer Payments", [
      {
        date: "2026-10-15",
        number: "PAY-0012",
        partyName: "Astra Foods",
        linkedDoc: "INV-1028",
        mode: "Bank Transfer",
        referenceNumber: "UTR123456",
        amount: 42500,
        status: "Posted",
      },
    ]);

    expect(csv).toContain("Customer Payments Register");
    expect(csv).toContain("PAY-0012");
    expect(csv).toContain("Astra Foods");
    expect(csv).toContain("42500.00");
  });
});
