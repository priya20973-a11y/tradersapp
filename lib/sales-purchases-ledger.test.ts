import { describe, expect, it } from "vitest";
import {
  calculateCustomerLedger,
  calculateVendorLedger,
  generateLedgerCsv,
  generatePaymentsCsv,
} from "./ledger-utils";

describe("Customer Ledger & Payment Logic", () => {
  it("computes accurate running balance through invoices, partial payments, full payments, and credit notes", () => {
    const openingBalance = 20000; // Customer owes ₹20,000 initially

    const transactions = [
      // 1. New invoice for ₹50,000 -> Running balance = 70,000 Dr
      {
        id: "inv-1",
        date: "2026-10-01",
        type: "Invoice" as const,
        referenceNumber: "INV-2001",
        amount: 50000,
      },
      // 2. Partial payment received of ₹30,000 -> Running balance = 40,000 Dr
      {
        id: "pay-1",
        date: "2026-10-05",
        type: "Payment Received" as const,
        referenceNumber: "PAY-1001",
        amount: 30000,
      },
      // 3. Return credit note of ₹5,000 -> Running balance = 35,000 Dr
      {
        id: "cn-1",
        date: "2026-10-10",
        type: "Credit Note" as const,
        referenceNumber: "CN-101",
        amount: 5000,
      },
      // 4. Second invoice for ₹15,000 -> Running balance = 50,000 Dr
      {
        id: "inv-2",
        date: "2026-10-15",
        type: "Invoice" as const,
        referenceNumber: "INV-2002",
        amount: 15000,
      },
      // 5. Final payment received of ₹50,000 -> Running balance = 0
      {
        id: "pay-2",
        date: "2026-10-20",
        type: "Payment Received" as const,
        referenceNumber: "PAY-1002",
        amount: 50000,
      },
    ];

    const { lines, summary } = calculateCustomerLedger(openingBalance, transactions);

    expect(summary.openingBalance).toBe(20000);
    expect(summary.totalDebit).toBe(65000); // 50,000 + 15,000
    expect(summary.totalCredit).toBe(85000); // 30,000 + 5,000 + 50,000
    expect(summary.closingBalance).toBe(0); // 20,000 + 65,000 - 85,000
    expect(summary.netOutstanding).toBe(0);

    expect(lines[0].balance).toBe(20000);
    expect(lines[1].balance).toBe(70000);
    expect(lines[2].balance).toBe(40000);
    expect(lines[3].balance).toBe(35000);
    expect(lines[4].balance).toBe(50000);
    expect(lines[5].balance).toBe(0);
  });

  it("handles customer advance payment creating a credit balance", () => {
    const openingBalance = 0;
    const transactions = [
      {
        id: "pay-adv",
        date: "2026-10-01",
        type: "Payment Received" as const,
        referenceNumber: "PAY-ADV",
        amount: 25000,
      },
    ];

    const { summary } = calculateCustomerLedger(openingBalance, transactions);
    expect(summary.closingBalance).toBe(-25000); // Customer has ₹25,000 credit/advance
    expect(summary.totalCredit).toBe(25000);
    expect(summary.totalDebit).toBe(0);
  });
});

describe("Vendor Ledger & Payment Logic", () => {
  it("computes accurate running balance through purchase bills and vendor payments", () => {
    const openingBalance = 15000; // We owe vendor ₹15,000 initially

    const transactions = [
      // 1. Purchase Bill of ₹80,000 -> Balance = 95,000 Cr
      {
        id: "bill-1",
        date: "2026-10-02",
        type: "Purchase Bill" as const,
        referenceNumber: "BILL-5001",
        amount: 80000,
      },
      // 2. Disbursement of ₹45,000 -> Balance = 50,000 Cr
      {
        id: "vpay-1",
        date: "2026-10-08",
        type: "Payment Made" as const,
        referenceNumber: "VPAY-3001",
        amount: 45000,
      },
      // 3. Vendor Credit of ₹5,000 -> Balance = 45,000 Cr
      {
        id: "vc-1",
        date: "2026-10-14",
        type: "Vendor Credit" as const,
        referenceNumber: "VC-201",
        amount: 5000,
      },
      // 4. Final Disbursement of ₹45,000 -> Balance = 0 (Settled)
      {
        id: "vpay-2",
        date: "2026-10-22",
        type: "Payment Made" as const,
        referenceNumber: "VPAY-3002",
        amount: 45000,
      },
    ];

    const { lines, summary } = calculateVendorLedger(openingBalance, transactions);

    expect(summary.openingBalance).toBe(15000);
    expect(summary.totalCredit).toBe(80000); // Billed increases payable
    expect(summary.totalDebit).toBe(95000); // Disbursements + Credits reduce payable
    expect(summary.closingBalance).toBe(0); // 15000 + 80000 - 95000
    expect(summary.netOutstanding).toBe(0);

    expect(lines[0].balance).toBe(15000);
    expect(lines[1].balance).toBe(95000);
    expect(lines[2].balance).toBe(50000);
    expect(lines[3].balance).toBe(45000);
    expect(lines[4].balance).toBe(0);
  });

  it("handles vendor advance disbursement creating a debit advance balance", () => {
    const openingBalance = 0;
    const transactions = [
      {
        id: "vpay-adv",
        date: "2026-10-01",
        type: "Payment Made" as const,
        referenceNumber: "VPAY-ADV",
        amount: 10000,
      },
    ];

    const { summary } = calculateVendorLedger(openingBalance, transactions);
    expect(summary.closingBalance).toBe(-10000); // Company has advance paid to vendor
    expect(summary.totalDebit).toBe(10000);
    expect(summary.totalCredit).toBe(0);
  });
});

describe("CSV Export Formatting", () => {
  it("formats Customer and Vendor Ledger CSVs properly", () => {
    const custRes = calculateCustomerLedger(10000, [
      { id: "1", date: "2026-10-01", type: "Invoice", referenceNumber: "INV-101", amount: 12000 },
    ]);
    const custCsv = generateLedgerCsv("Customer", "Astra Foods", custRes.lines, custRes.summary);
    expect(custCsv).toContain("Customer Ledger Statement - Astra Foods");
    expect(custCsv).toContain("Debit (INR),Credit (INR),Running Balance (INR)");
    expect(custCsv).toContain("12000.00");

    const vendRes = calculateVendorLedger(8000, [
      { id: "1", date: "2026-10-02", type: "Purchase Bill", referenceNumber: "BILL-202", amount: 15000 },
    ]);
    const vendCsv = generateLedgerCsv("Vendor", "Mohan Traders", vendRes.lines, vendRes.summary);
    expect(vendCsv).toContain("Vendor Ledger Statement - Mohan Traders");
    expect(vendCsv).toContain("BILL-202");
    expect(vendCsv).toContain("15000.00");
  });

  it("formats Payments Register CSV properly", () => {
    const custPayCsv = generatePaymentsCsv("Customer Payments", [
      {
        date: "2026-10-18",
        number: "PAY-0048",
        partyName: "Astra Foods",
        linkedDoc: "INV-1028",
        mode: "UPI",
        referenceNumber: "UPI12345",
        amount: 40000,
        status: "Posted",
      },
    ]);
    expect(custPayCsv).toContain("Customer Payments Register");
    expect(custPayCsv).toContain("PAY-0048");
    expect(custPayCsv).toContain("40000.00");

    const vendPayCsv = generatePaymentsCsv("Vendor Payments", [
      {
        date: "2026-10-19",
        number: "VPAY-0895",
        partyName: "Mohan Traders",
        linkedDoc: "BILL-4421",
        mode: "NEFT / RTGS",
        referenceNumber: "HDFCN123",
        amount: 35000,
        status: "Cleared",
      },
    ]);
    expect(vendPayCsv).toContain("Vendor Payments Register");
    expect(vendPayCsv).toContain("VPAY-0895");
    expect(vendPayCsv).toContain("35000.00");
  });
});
