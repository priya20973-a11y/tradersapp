import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

// Mock the models before importing vendor-credit-service
vi.mock("@/models/purchase-bill", () => {
  return {
    PurchaseBill: {
      findOne: vi.fn(),
      find: vi.fn(),
    },
  };
});

vi.mock("@/models/vendor-credit", () => {
  return {
    VendorCredit: {
      findOne: vi.fn(),
      find: vi.fn(),
    },
  };
});

import { PurchaseBill } from "@/models/purchase-bill";
import { VendorCredit } from "@/models/vendor-credit";
import {
  applyCreditsToBill,
  applyVendorCreditToBills,
} from "./vendor-credit-service";

interface MockApplicationItem {
  amount?: number;
  amountApplied?: number;
  creditNoteNumber?: string;
  billNumber?: string;
  creditId?: unknown;
  billId?: unknown;
  appliedDate?: Date | string;
  notes?: string;
}

interface MockBillDoc extends Record<string, unknown> {
  creditsApplied: MockApplicationItem[];
  save?: ReturnType<typeof vi.fn>;
}

interface MockCreditDoc extends Record<string, unknown> {
  billsApplied: MockApplicationItem[];
  save?: ReturnType<typeof vi.fn>;
}

type MockDoc = MockBillDoc | MockCreditDoc | Record<string, unknown>;

describe("Purchase Bill & Vendor Credit Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Financial Calculations: Total, Credit Applied, Payment Made, Payment Due", () => {
    it("strictly computes Payment Due as: Bill Total - Vendor Credit Applied - Payment Made", () => {
      const billTotal = 25000;
      const vendorCreditApplied = 5000;
      const paymentMade = 10000;

      const paymentDue = Math.max(
        0,
        Math.round((billTotal - vendorCreditApplied - paymentMade) * 100) / 100
      );

      expect(paymentDue).toBe(10000);
    });

    it("evaluates Payment Due to 0 and status to 'Paid' when credit fully covers bill", () => {
      const billTotal = 15000;
      const vendorCreditApplied = 15000;
      const paymentMade = 0;

      const paymentDue = Math.max(
        0,
        Math.round((billTotal - vendorCreditApplied - paymentMade) * 100) / 100
      );
      const status = paymentDue === 0 ? "Paid" : "Partially Paid";

      expect(paymentDue).toBe(0);
      expect(status).toBe("Paid");
    });

    it("evaluates Payment Due to 0 and status to 'Paid' when credit + payment combined equal bill total", () => {
      const billTotal = 18500.5;
      const vendorCreditApplied = 6500.25;
      const paymentMade = 12000.25;

      const paymentDue = Math.max(
        0,
        Math.round((billTotal - vendorCreditApplied - paymentMade) * 100) / 100
      );
      const status = paymentDue === 0 ? "Paid" : "Partially Paid";

      expect(paymentDue).toBe(0);
      expect(status).toBe("Paid");
    });

    it("evaluates status to 'Partially Paid' when Payment Due > 0 and credit applied > 0", () => {
      const billTotal = 50000;
      const vendorCreditApplied = 12000;
      const paymentMade = 0;

      const paymentDue = Math.max(
        0,
        Math.round((billTotal - vendorCreditApplied - paymentMade) * 100) / 100
      );
      const status =
        paymentDue === 0
          ? "Paid"
          : vendorCreditApplied > 0 || paymentMade > 0
          ? "Partially Paid"
          : "Pending";

      expect(paymentDue).toBe(38000);
      expect(status).toBe("Partially Paid");
    });

    it("keeps status as 'Pending' when no payment or credit has been applied", () => {
      const billTotal = 30000;
      const vendorCreditApplied = 0;
      const paymentMade = 0;

      const paymentDue = Math.max(
        0,
        Math.round((billTotal - vendorCreditApplied - paymentMade) * 100) / 100
      );
      const status =
        paymentDue === 0
          ? "Paid"
          : vendorCreditApplied > 0 || paymentMade > 0
          ? "Partially Paid"
          : "Pending";

      expect(paymentDue).toBe(30000);
      expect(status).toBe("Pending");
    });
  });

  describe("2. applyCreditsToBill: Applying Vendor Credits to a Bill", () => {
    const orgId = new Types.ObjectId();
    const vendorId = new Types.ObjectId();
    const billId = new Types.ObjectId();
    const credit1Id = new Types.ObjectId();
    const credit2Id = new Types.ObjectId();

    it("applies a single vendor credit partially, reducing credit balance and updating bill payment due", async () => {
      const mockBill: MockBillDoc = {
        _id: billId,
        billNumber: "BILL-2026-001",
        vendorId,
        vendorName: "Steel Corp India",
        total: 10000,
        amountPaid: 0,
        vendorCreditApplied: 0,
        balanceDue: 10000,
        status: "Pending",
        creditsApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockCredit: MockCreditDoc = {
        _id: credit1Id,
        creditNoteNumber: "CN-001",
        vendorId,
        total: 5000,
        appliedAmount: 0,
        balanceRemaining: 5000,
        status: "Open",
        billsApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(PurchaseBill.findOne).mockResolvedValue(mockBill as never);
      vi.mocked(VendorCredit.findOne).mockResolvedValue(mockCredit as never);

      const result = await applyCreditsToBill({
        billId: String(billId),
        organizationId: String(orgId),
        creditApplications: [{ creditId: String(credit1Id), amount: 3000 }],
      });

      // Verify bill updates
      expect(result.appliedTotal).toBe(3000);
      expect(result.billTotal).toBe(10000);
      expect(result.vendorCreditApplied).toBe(3000);
      expect(result.paymentMade).toBe(0);
      expect(result.paymentDue).toBe(7000);
      expect(result.status).toBe("Partially Paid");

      expect(mockBill.vendorCreditApplied).toBe(3000);
      expect(mockBill.balanceDue).toBe(7000);
      expect(mockBill.status).toBe("Partially Paid");
      expect(mockBill.creditsApplied).toHaveLength(1);
      expect(mockBill.creditsApplied[0].amount).toBe(3000);
      expect(mockBill.creditsApplied[0].creditNoteNumber).toBe("CN-001");

      // Verify credit updates
      expect(mockCredit.appliedAmount).toBe(3000);
      expect(mockCredit.balanceRemaining).toBe(2000);
      expect(mockCredit.status).toBe("Partially Applied");
      expect(mockCredit.billsApplied).toHaveLength(1);
      expect(mockCredit.billsApplied[0].amountApplied).toBe(3000);
      expect(mockCredit.billsApplied[0].billNumber).toBe("BILL-2026-001");
    });

    it("applies multiple vendor credits to a single bill in one atomic action", async () => {
      const mockBill: MockBillDoc = {
        _id: billId,
        billNumber: "BILL-2026-002",
        vendorId,
        vendorName: "Steel Corp India",
        total: 10000,
        amountPaid: 2000,
        vendorCreditApplied: 0,
        balanceDue: 8000,
        status: "Partially Paid",
        creditsApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockCredit1: MockCreditDoc = {
        _id: credit1Id,
        creditNoteNumber: "CN-001",
        vendorId,
        total: 5000,
        appliedAmount: 0,
        balanceRemaining: 5000,
        status: "Open",
        billsApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockCredit2: MockCreditDoc = {
        _id: credit2Id,
        creditNoteNumber: "CN-002",
        vendorId,
        total: 3000,
        appliedAmount: 0,
        balanceRemaining: 3000,
        status: "Open",
        billsApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(PurchaseBill.findOne).mockResolvedValue(mockBill as never);
      (VendorCredit.findOne as unknown as ReturnType<typeof vi.fn>).mockImplementation((filter: unknown) => {
        const _id = (filter as { _id?: unknown })?._id;
        if (String(_id) === String(credit1Id)) return Promise.resolve(mockCredit1 as never);
        if (String(_id) === String(credit2Id)) return Promise.resolve(mockCredit2 as never);
        return Promise.resolve(null as never);
      });

      // Apply 5000 from CN-001 and 3000 from CN-002 => total 8000
      // Bill: 10000 - 8000 credit - 2000 payment = 0 Payment Due -> "Paid"
      const result = await applyCreditsToBill({
        billId: String(billId),
        organizationId: String(orgId),
        creditApplications: [
          { creditId: String(credit1Id), amount: 5000 },
          { creditId: String(credit2Id), amount: 3000 },
        ],
      });

      expect(result.appliedTotal).toBe(8000);
      expect(result.billTotal).toBe(10000);
      expect(result.vendorCreditApplied).toBe(8000);
      expect(result.paymentMade).toBe(2000);
      expect(result.paymentDue).toBe(0);
      expect(result.status).toBe("Paid");

      // Verify CN-001 closed
      expect(mockCredit1.appliedAmount).toBe(5000);
      expect(mockCredit1.balanceRemaining).toBe(0);
      expect(mockCredit1.status).toBe("Closed");

      // Verify CN-002 closed
      expect(mockCredit2.appliedAmount).toBe(3000);
      expect(mockCredit2.balanceRemaining).toBe(0);
      expect(mockCredit2.status).toBe("Closed");

      // Verify bill has 2 credit applied entries
      expect(mockBill.creditsApplied).toHaveLength(2);
      expect(mockBill.creditsApplied[0].creditNoteNumber).toBe("CN-001");
      expect(mockBill.creditsApplied[1].creditNoteNumber).toBe("CN-002");
    });

    it("rejects application when vendor credit belongs to a different vendor", async () => {
      const differentVendorId = new Types.ObjectId();

      const mockBill: MockDoc = {
        _id: billId,
        billNumber: "BILL-2026-003",
        vendorId,
        vendorName: "Steel Corp India",
        total: 10000,
        amountPaid: 0,
        vendorCreditApplied: 0,
        balanceDue: 10000,
        status: "Pending",
        creditsApplied: [],
        save: vi.fn(),
      };

      const mockCreditMismatch: MockDoc = {
        _id: credit1Id,
        creditNoteNumber: "CN-MISMATCH",
        vendorId: differentVendorId, // Different vendor!
        total: 5000,
        appliedAmount: 0,
        balanceRemaining: 5000,
        status: "Open",
        billsApplied: [],
        save: vi.fn(),
      };

      vi.mocked(PurchaseBill.findOne).mockResolvedValue(mockBill as never);
      vi.mocked(VendorCredit.findOne).mockResolvedValue(mockCreditMismatch as never);

      await expect(
        applyCreditsToBill({
          billId: String(billId),
          organizationId: String(orgId),
          creditApplications: [{ creditId: String(credit1Id), amount: 1000 }],
        })
      ).rejects.toThrow(/does not belong to vendor Steel Corp India/);

      expect(mockBill.save).not.toHaveBeenCalled();
      expect(mockCreditMismatch.save).not.toHaveBeenCalled();
    });

    it("rejects application when credit amount exceeds bill's remaining payment due", async () => {
      const mockBill: MockDoc = {
        _id: billId,
        billNumber: "BILL-2026-004",
        vendorId,
        vendorName: "Steel Corp India",
        total: 10000,
        amountPaid: 8000,
        vendorCreditApplied: 0,
        balanceDue: 2000, // Only 2000 remaining
        status: "Partially Paid",
        creditsApplied: [],
        save: vi.fn(),
      };

      vi.mocked(PurchaseBill.findOne).mockResolvedValue(mockBill as never);

      await expect(
        applyCreditsToBill({
          billId: String(billId),
          organizationId: String(orgId),
          creditApplications: [{ creditId: String(credit1Id), amount: 2500 }],
        })
      ).rejects.toThrow(/exceeds bill's payment due/);
    });

    it("rejects application when credit amount exceeds the credit note's remaining balance", async () => {
      const mockBill: MockDoc = {
        _id: billId,
        billNumber: "BILL-2026-005",
        vendorId,
        vendorName: "Steel Corp India",
        total: 10000,
        amountPaid: 0,
        vendorCreditApplied: 0,
        balanceDue: 10000,
        status: "Pending",
        creditsApplied: [],
        save: vi.fn(),
      };

      const mockCreditExhausted: MockDoc = {
        _id: credit1Id,
        creditNoteNumber: "CN-LOW-BAL",
        vendorId,
        total: 5000,
        appliedAmount: 4500,
        balanceRemaining: 500, // Only 500 left
        status: "Partially Applied",
        billsApplied: [],
        save: vi.fn(),
      };

      vi.mocked(PurchaseBill.findOne).mockResolvedValue(mockBill as never);
      vi.mocked(VendorCredit.findOne).mockResolvedValue(mockCreditExhausted as never);

      await expect(
        applyCreditsToBill({
          billId: String(billId),
          organizationId: String(orgId),
          creditApplications: [{ creditId: String(credit1Id), amount: 800 }],
        })
      ).rejects.toThrow(/exceeds credit note CN-LOW-BAL's available balance/);
    });

    it("rejects application on a bill that is already fully paid", async () => {
      const mockBillPaid: MockDoc = {
        _id: billId,
        billNumber: "BILL-2026-006",
        vendorId,
        vendorName: "Steel Corp India",
        total: 10000,
        amountPaid: 10000,
        vendorCreditApplied: 0,
        balanceDue: 0,
        status: "Paid",
        save: vi.fn(),
      };

      vi.mocked(PurchaseBill.findOne).mockResolvedValue(mockBillPaid as never);

      await expect(
        applyCreditsToBill({
          billId: String(billId),
          organizationId: String(orgId),
          creditApplications: [{ creditId: String(credit1Id), amount: 1000 }],
        })
      ).rejects.toThrow(/already been fully settled/);
    });

    it("rejects application on a draft or void bill", async () => {
      const mockBillDraft: MockDoc = {
        _id: billId,
        billNumber: "BILL-2026-007",
        vendorId,
        vendorName: "Steel Corp India",
        total: 10000,
        amountPaid: 0,
        vendorCreditApplied: 0,
        balanceDue: 10000,
        status: "Draft",
        save: vi.fn(),
      };

      vi.mocked(PurchaseBill.findOne).mockResolvedValue(mockBillDraft as never);

      await expect(
        applyCreditsToBill({
          billId: String(billId),
          organizationId: String(orgId),
          creditApplications: [{ creditId: String(credit1Id), amount: 1000 }],
        })
      ).rejects.toThrow(/Cannot apply credit to a bill in "Draft" status/);
    });
  });

  describe("3. applyVendorCreditToBills: Applying a Vendor Credit to multiple bills", () => {
    const orgId = new Types.ObjectId();
    const vendorId = new Types.ObjectId();
    const creditId = new Types.ObjectId();

    it("correctly reduces credit balance and updates each bill's vendorCreditApplied and balanceDue", async () => {
      const mockCredit: MockDoc = {
        _id: creditId,
        creditNoteNumber: "CN-MULTI",
        vendorId,
        vendorName: "Agro Seeds Hub",
        total: 10000,
        appliedAmount: 0,
        balanceRemaining: 10000,
        status: "Open",
        billsApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockBillA: MockDoc = {
        _id: new Types.ObjectId(),
        billNumber: "BILL-A",
        vendorId,
        total: 6000,
        amountPaid: 1000,
        vendorCreditApplied: 0,
        balanceDue: 5000,
        status: "Partially Paid",
        creditsApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockBillB: MockDoc = {
        _id: new Types.ObjectId(),
        billNumber: "BILL-B",
        vendorId,
        total: 4000,
        amountPaid: 0,
        vendorCreditApplied: 0,
        balanceDue: 4000,
        status: "Pending",
        creditsApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(VendorCredit.findOne).mockResolvedValue(mockCredit as never);
      (PurchaseBill.findOne as unknown as ReturnType<typeof vi.fn>).mockImplementation((filter: unknown) => {
        const _id = (filter as { _id?: unknown })?._id;
        if (String(_id) === String(mockBillA._id)) return Promise.resolve(mockBillA as never);
        if (String(_id) === String(mockBillB._id)) return Promise.resolve(mockBillB as never);
        return Promise.resolve(null as never);
      });

      const result = await applyVendorCreditToBills({
        creditId: String(creditId),
        organizationId: String(orgId),
        applications: [
          { billId: String(mockBillA._id), amount: 5000 },
          { billId: String(mockBillB._id), amount: 3000 },
        ],
      });

      // Total applied = 8000
      expect(result.appliedTotal).toBe(8000);
      expect(result.balanceRemaining).toBe(2000);
      expect(mockCredit.status).toBe("Partially Applied");

      // Bill A was 6000 total - 5000 credit - 1000 paid = 0 balance due -> "Paid"
      expect(mockBillA.vendorCreditApplied).toBe(5000);
      expect(mockBillA.balanceDue).toBe(0);
      expect(mockBillA.status).toBe("Paid");
      expect(mockBillA.creditsApplied).toHaveLength(1);

      // Bill B was 4000 total - 3000 credit - 0 paid = 1000 balance due -> "Partially Paid"
      expect(mockBillB.vendorCreditApplied).toBe(3000);
      expect(mockBillB.balanceDue).toBe(1000);
      expect(mockBillB.status).toBe("Partially Paid");
      expect(mockBillB.creditsApplied).toHaveLength(1);
    });
  });
});
