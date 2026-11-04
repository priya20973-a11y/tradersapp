import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

// Mock Mongoose models before importing credit-note-service
vi.mock("@/lib/db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/models", () => {
  return {
    SalesDocument: {
      find: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      updateOne: vi.fn(),
      deleteOne: vi.fn(),
    },
    CreditNoteSettings: {
      findOne: vi.fn(),
      create: vi.fn(),
      updateOne: vi.fn(),
    },
    Customer: {
      findOne: vi.fn().mockReturnValue(Promise.resolve(null)),
      updateOne: vi.fn().mockReturnValue(Promise.resolve(null)),
    },
    Organization: {
      findOne: vi.fn(),
    },
  };
});

import { CreditNoteSettings, Customer, SalesDocument } from "@/models";

interface MockCreditApplication {
  amount?: number;
  amountApplied?: number;
  creditNoteNumber?: string;
  creditNoteId?: unknown;
  invoiceId?: unknown;
  invoiceNumber?: string;
  appliedDate?: Date | string;
}

interface MockInvoiceDoc extends Record<string, unknown> {
  creditsApplied: MockCreditApplication[];
  save?: ReturnType<typeof vi.fn>;
}

interface MockCreditNoteDoc extends Record<string, unknown> {
  invoicesApplied: MockCreditApplication[];
  save?: ReturnType<typeof vi.fn>;
}

type MockDoc = MockInvoiceDoc | MockCreditNoteDoc | Record<string, unknown>;
import {
  extractNumberPart,
  findNextAvailableCreditNoteNumber,
  formatCreditNoteNumber,
  getFiscalYear,
  parseNextNumberInput,
} from "./credit-note-numbering";
import {
  allocateNextCreditNoteNumber,
  applyCreditNoteToInvoices,
  applyCreditsToInvoice,
  unapplyCreditNoteFromInvoice,
} from "./credit-note-service";

describe("Credit Notes Module: Numbering, Calculations, Application & Ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Credit Note Number Parsing & Leading Zero Preservation", () => {
    it("preserves leading zero-padding of 5 digits for default '00002'", () => {
      const res = parseNextNumberInput("00002");
      expect(res.nextNumber).toBe(2);
      expect(res.padding).toBe(5);
      expect(res.formattedString).toBe("00002");
    });

    it("preserves custom padding when user enters '00015'", () => {
      const res = parseNextNumberInput("00015");
      expect(res.nextNumber).toBe(15);
      expect(res.padding).toBe(5);
      expect(res.formattedString).toBe("00015");
    });

    it("handles short padding when user enters '01'", () => {
      const res = parseNextNumberInput("01");
      expect(res.nextNumber).toBe(1);
      expect(res.padding).toBe(2);
      expect(res.formattedString).toBe("01");
    });

    it("handles large numbers with 6 digits '000150'", () => {
      const res = parseNextNumberInput("000150");
      expect(res.nextNumber).toBe(150);
      expect(res.padding).toBe(6);
      expect(res.formattedString).toBe("000150");
    });

    it("falls back to default nextNumber: 2, padding: 5 when input is empty or invalid", () => {
      const res = parseNextNumberInput("");
      expect(res.nextNumber).toBe(2);
      expect(res.padding).toBe(5);
      expect(res.formattedString).toBe("00002");
    });
  });

  describe("2. Formatting Credit Note Numbers", () => {
    it("formats with default prefix 'CN-' and 5-digit padding", () => {
      expect(formatCreditNoteNumber("CN-", 2, 5)).toBe("CN-00002");
      expect(formatCreditNoteNumber("CN-", 10, 5)).toBe("CN-00010");
      expect(formatCreditNoteNumber("CN-", 99999, 5)).toBe("CN-99999");
    });

    it("formats with custom user prefix 'CR-NOTE/'", () => {
      expect(formatCreditNoteNumber("CR-NOTE/", 5, 4)).toBe("CR-NOTE/0005");
    });

    it("handles number beyond original padding without truncation", () => {
      expect(formatCreditNoteNumber("CN-", 100005, 5)).toBe("CN-100005");
    });
  });

  describe("3. Indian Fiscal Year & Extraction", () => {
    it("calculates fiscal year correctly in October 2026", () => {
      const d = new Date(2026, 9, 29);
      expect(getFiscalYear(d)).toBe("2026-27");
    });

    it("calculates fiscal year correctly in January 2027", () => {
      const d = new Date(2027, 0, 15);
      expect(getFiscalYear(d)).toBe("2026-27");
    });

    it("rolls over to 2027-28 on April 1, 2027", () => {
      const d = new Date(2027, 3, 1);
      expect(getFiscalYear(d)).toBe("2027-28");
    });

    it("extracts numeric part when prefix matches", () => {
      expect(extractNumberPart("CN-00002", "CN-")).toBe(2);
      expect(extractNumberPart("CN-00125", "CN-")).toBe(125);
    });

    it("returns null if prefix does not match", () => {
      expect(extractNumberPart("INV-00002", "CN-")).toBeNull();
    });
  });

  describe("4. Sequential Non-Colliding Number Allocation", () => {
    it("allocates the next available number skipping already existing numbers", () => {
      const existing = new Set(["CN-00001", "CN-00002", "CN-00003"]);
      const res = findNextAvailableCreditNoteNumber("CN-", 2, 5, existing);
      expect(res.allocatedNumber).toBe(4);
      expect(res.creditNoteNumber).toBe("CN-00004");
    });

    it("allocates starting number directly if not in existing set", () => {
      const existing = new Set(["CN-00001"]);
      const res = findNextAvailableCreditNoteNumber("CN-", 2, 5, existing);
      expect(res.allocatedNumber).toBe(2);
      expect(res.creditNoteNumber).toBe("CN-00002");
    });
  });

  describe("5. allocateNextCreditNoteNumber Persistence & Fiscal Year Rollover", () => {
    const orgId = new Types.ObjectId();

    it("allocates CN-00002 as default next number and updates settings to 3", async () => {
      const mockSettings: MockDoc = {
        _id: new Types.ObjectId(),
        organizationId: orgId,
        autoGenerateNumbering: true,
        creditNotePrefix: "CN-",
        nextNumber: 2,
        numberZeroPadding: 5,
        restartNumberingEachFiscalYear: false,
        lastFiscalYear: getFiscalYear(),
      };

      vi.mocked(CreditNoteSettings.findOne).mockResolvedValue(mockSettings as never);
      vi.mocked(SalesDocument.find).mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      } as unknown as ReturnType<typeof SalesDocument.find>);

      const res = await allocateNextCreditNoteNumber(orgId);
      expect(res.creditNoteNumber).toBe("CN-00002");
      expect(res.allocatedNumber).toBe(2);
      expect(CreditNoteSettings.updateOne).toHaveBeenCalledWith(
        { _id: mockSettings._id },
        { $set: { nextNumber: 3 } },
      );
    });

    it("restarts numbering at fiscal year start without creating duplicates", async () => {
      const mockSettings: MockDoc = {
        _id: new Types.ObjectId(),
        organizationId: orgId,
        autoGenerateNumbering: true,
        creditNotePrefix: "CN-",
        nextNumber: 50,
        numberZeroPadding: 5,
        restartNumberingEachFiscalYear: true,
        lastFiscalYear: "2025-26", // Prior FY
      };

      const existingNotes = [{ number: "CN-00001" }];

      vi.mocked(CreditNoteSettings.findOne).mockResolvedValue(mockSettings as never);
      vi.mocked(SalesDocument.find).mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(existingNotes),
        }),
      } as unknown as ReturnType<typeof SalesDocument.find>);

      const res = await allocateNextCreditNoteNumber(orgId);
      // Restart attempted at 1, but CN-00001 exists, so it safely allocates CN-00002
      expect(res.creditNoteNumber).toBe("CN-00002");
      expect(res.allocatedNumber).toBe(2);
      expect(CreditNoteSettings.updateOne).toHaveBeenCalledWith(
        { _id: mockSettings._id },
        { $set: { nextNumber: 3 } },
      );
    });
  });

  describe("6. applyCreditNoteToInvoices: Application, Calculations & Validation", () => {
    const orgId = new Types.ObjectId();
    const customerA = new Types.ObjectId();
    const customerB = new Types.ObjectId();

    it("applies credit note to an invoice of the same customer and updates balances and status to Paid", async () => {
      const creditNoteId = new Types.ObjectId();
      const invoiceId = new Types.ObjectId();

      const mockCreditNote: MockCreditNoteDoc = {
        _id: creditNoteId,
        organizationId: orgId,
        type: "Credit Note",
        number: "CN-00002",
        customerId: customerA,
        status: "Open",
        total: 1000,
        creditedAmount: 0,
        balanceRemaining: 1000,
        invoicesApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockInvoice: MockInvoiceDoc = {
        _id: invoiceId,
        organizationId: orgId,
        type: "Invoice",
        number: "INV-00100",
        customerId: customerA,
        status: "Sent",
        total: 800,
        amountPaid: 0,
        creditedAmount: 0,
        creditsApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(SalesDocument.findOne)
        .mockResolvedValueOnce(mockCreditNote as never) // Fetch credit note
        .mockResolvedValueOnce(mockInvoice as never); // Fetch invoice

      const result = await applyCreditNoteToInvoices({
        creditNoteId,
        organizationId: orgId,
        applications: [{ invoiceId: String(invoiceId), amount: 800 }],
      });

      // Assertions
      expect(result.appliedTotal).toBe(800);
      expect(result.balanceRemaining).toBe(200); // 1000 - 800
      expect(result.status).toBe("Partially Applied"); // Still has 200 remaining

      // Invoice assertions
      expect(mockInvoice.creditedAmount).toBe(800);
      expect(mockInvoice.status).toBe("Paid"); // Fully settled!
      expect(mockInvoice.creditsApplied).toHaveLength(1);
      expect(mockInvoice.creditsApplied[0].amount).toBe(800);
      expect(mockInvoice.creditsApplied[0].creditNoteNumber).toBe("CN-00002");

      // Credit note assertions
      expect(mockCreditNote.creditedAmount).toBe(800);
      expect(mockCreditNote.invoicesApplied).toHaveLength(1);
      expect(mockCreditNote.invoicesApplied[0].amountApplied).toBe(800);

      // Customer unused credits decreased
      expect(Customer.updateOne).toHaveBeenCalledWith(
        { _id: customerA },
        { $inc: { unusedCredits: -800 } },
      );
    });

    it("applies credit note across multiple invoices belonging to the same customer", async () => {
      const creditNoteId = new Types.ObjectId();
      const inv1Id = new Types.ObjectId();
      const inv2Id = new Types.ObjectId();

      const mockCreditNote: MockDoc = {
        _id: creditNoteId,
        organizationId: orgId,
        type: "Credit Note",
        number: "CN-00002",
        customerId: customerA,
        status: "Open",
        total: 1000,
        creditedAmount: 0,
        balanceRemaining: 1000,
        invoicesApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockInv1: MockDoc = {
        _id: inv1Id,
        organizationId: orgId,
        type: "Invoice",
        number: "INV-00101",
        customerId: customerA,
        status: "Sent",
        total: 500,
        amountPaid: 0,
        creditedAmount: 0,
        creditsApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockInv2: MockDoc = {
        _id: inv2Id,
        organizationId: orgId,
        type: "Invoice",
        number: "INV-00102",
        customerId: customerA,
        status: "Sent",
        total: 700,
        amountPaid: 0,
        creditedAmount: 0,
        creditsApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(SalesDocument.findOne)
        .mockResolvedValueOnce(mockCreditNote as never)
        .mockResolvedValueOnce(mockInv1 as never)
        .mockResolvedValueOnce(mockInv2 as never);

      const result = await applyCreditNoteToInvoices({
        creditNoteId,
        organizationId: orgId,
        applications: [
          { invoiceId: String(inv1Id), amount: 500 },
          { invoiceId: String(inv2Id), amount: 500 },
        ],
      });

      expect(result.appliedTotal).toBe(1000);
      expect(result.balanceRemaining).toBe(0);
      expect(result.status).toBe("Closed"); // Credit note is now fully exhausted!

      expect(mockInv1.status).toBe("Paid"); // 500 of 500
      expect(mockInv2.status).toBe("Partially Paid"); // 500 of 700 (200 remaining due)
    });

    it("STRICTLY REJECTS application to an invoice of a DIFFERENT customer", async () => {
      const creditNoteId = new Types.ObjectId();
      const invoiceId = new Types.ObjectId();

      const mockCreditNote: MockDoc = {
        _id: creditNoteId,
        organizationId: orgId,
        type: "Credit Note",
        number: "CN-00002",
        customerId: customerA, // Customer A
        status: "Open",
        total: 500,
        creditedAmount: 0,
        balanceRemaining: 500,
        invoicesApplied: [],
      };

      const mockInvoice: MockDoc = {
        _id: invoiceId,
        organizationId: orgId,
        type: "Invoice",
        number: "INV-00999",
        customerId: customerB, // Customer B (DIFFERENT!)
        status: "Sent",
        total: 500,
        amountPaid: 0,
        creditedAmount: 0,
      };

      vi.mocked(SalesDocument.findOne)
        .mockResolvedValueOnce(mockCreditNote as never)
        .mockResolvedValueOnce(mockInvoice as never);

      await expect(
        applyCreditNoteToInvoices({
          creditNoteId,
          organizationId: orgId,
          applications: [{ invoiceId: String(invoiceId), amount: 300 }],
        }),
      ).rejects.toThrow(/different customer/i);
    });

    it("REJECTS application when amount exceeds invoice's balance due", async () => {
      const creditNoteId = new Types.ObjectId();
      const invoiceId = new Types.ObjectId();

      const mockCreditNote: MockDoc = {
        _id: creditNoteId,
        organizationId: orgId,
        type: "Credit Note",
        number: "CN-00002",
        customerId: customerA,
        status: "Open",
        total: 1000,
        creditedAmount: 0,
        balanceRemaining: 1000,
        invoicesApplied: [],
      };

      const mockInvoice: MockDoc = {
        _id: invoiceId,
        organizationId: orgId,
        type: "Invoice",
        number: "INV-00100",
        customerId: customerA,
        status: "Partially Paid",
        total: 500,
        amountPaid: 300,
        creditedAmount: 0, // Balance due is 200
      };

      vi.mocked(SalesDocument.findOne)
        .mockResolvedValueOnce(mockCreditNote as never)
        .mockResolvedValueOnce(mockInvoice as never);

      await expect(
        applyCreditNoteToInvoices({
          creditNoteId,
          organizationId: orgId,
          applications: [{ invoiceId: String(invoiceId), amount: 250 }], // 250 > 200
        }),
      ).rejects.toThrow(/exceeds Invoice INV-00100's outstanding balance due/i);
    });

    it("REJECTS application when total amount exceeds available credit note balance", async () => {
      const creditNoteId = new Types.ObjectId();

      const mockCreditNote: MockDoc = {
        _id: creditNoteId,
        organizationId: orgId,
        type: "Credit Note",
        number: "CN-00002",
        customerId: customerA,
        status: "Open",
        total: 300,
        creditedAmount: 100,
        balanceRemaining: 200, // Available is only 200
        invoicesApplied: [],
      };

      vi.mocked(SalesDocument.findOne).mockResolvedValueOnce(mockCreditNote as never);

      await expect(
        applyCreditNoteToInvoices({
          creditNoteId,
          organizationId: orgId,
          applications: [{ invoiceId: String(new Types.ObjectId()), amount: 250 }], // 250 > 200
        }),
      ).rejects.toThrow(/exceeds available credit note balance/i);
    });

    it("REJECTS application when credit note is in Draft or Void status", async () => {
      const creditNoteId = new Types.ObjectId();

      const mockCreditNote: MockDoc = {
        _id: creditNoteId,
        organizationId: orgId,
        type: "Credit Note",
        number: "CN-00002",
        customerId: customerA,
        status: "Draft",
        total: 500,
        creditedAmount: 0,
        balanceRemaining: 0,
      };

      vi.mocked(SalesDocument.findOne).mockResolvedValueOnce(mockCreditNote as never);

      await expect(
        applyCreditNoteToInvoices({
          creditNoteId,
          organizationId: orgId,
          applications: [{ invoiceId: String(new Types.ObjectId()), amount: 100 }],
        }),
      ).rejects.toThrow(/Cannot apply credit note in "Draft" status/i);
    });
  });

  describe("7. unapplyCreditNoteFromInvoice: Reversal & Balance Restoration", () => {
    const orgId = new Types.ObjectId();
    const customerA = new Types.ObjectId();
    const creditNoteId = new Types.ObjectId();
    const invoiceId = new Types.ObjectId();

    it("reverses applied credit and restores both credit note balance and invoice balance due", async () => {
      const mockCreditNote: MockDoc = {
        _id: creditNoteId,
        organizationId: orgId,
        type: "Credit Note",
        number: "CN-00002",
        customerId: customerA,
        total: 1000,
        creditedAmount: 800,
        balanceRemaining: 200,
        status: "Partially Applied",
        invoicesApplied: [
          {
            invoiceId,
            invoiceNumber: "INV-00100",
            amountApplied: 800,
            appliedDate: new Date(),
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockInvoice: MockDoc = {
        _id: invoiceId,
        organizationId: orgId,
        type: "Invoice",
        number: "INV-00100",
        customerId: customerA,
        total: 800,
        amountPaid: 0,
        creditedAmount: 800,
        status: "Paid",
        creditsApplied: [
          {
            creditNoteId,
            creditNoteNumber: "CN-00002",
            amount: 800,
            appliedDate: new Date(),
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(SalesDocument.findOne)
        .mockResolvedValueOnce(mockCreditNote as never)
        .mockResolvedValueOnce(mockInvoice as never);

      const result = await unapplyCreditNoteFromInvoice({
        creditNoteId,
        invoiceId,
        organizationId: orgId,
      });

      expect(result.success).toBe(true);
      expect(result.rollbackAmount).toBe(800);
      expect(result.creditNoteBalance).toBe(1000); // Fully restored
      expect(result.invoiceBalanceDue).toBe(800); // Fully open again

      expect(mockCreditNote.status).toBe("Open");
      expect(mockCreditNote.creditedAmount).toBe(0);
      expect(mockCreditNote.invoicesApplied).toHaveLength(0);

      expect(mockInvoice.status).toBe("Unpaid");
      expect(mockInvoice.creditedAmount).toBe(0);
      expect(mockInvoice.creditsApplied).toHaveLength(0);

      // Restored to customer
      expect(Customer.updateOne).toHaveBeenCalledWith(
        { _id: customerA },
        { $inc: { unusedCredits: 800 } },
      );
    });
  });

  describe("8. applyCreditsToInvoice: Invoice-Initiated Credit Application", () => {
    const orgId = new Types.ObjectId();
    const customerA = new Types.ObjectId();
    const customerB = new Types.ObjectId();

    it("applies a single credit note to an invoice, updating balances and marking invoice Paid", async () => {
      const invoiceId = new Types.ObjectId();
      const creditNoteId = new Types.ObjectId();

      const mockInvoice: MockInvoiceDoc = {
        _id: invoiceId,
        organizationId: orgId,
        type: "Invoice",
        number: "INV-00200",
        customerId: customerA,
        status: "Sent",
        total: 1500,
        amountPaid: 500,
        creditedAmount: 0,
        creditsApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockCreditNote: MockCreditNoteDoc = {
        _id: creditNoteId,
        organizationId: orgId,
        type: "Credit Note",
        number: "CN-00005",
        customerId: customerA,
        status: "Open",
        total: 1000,
        creditedAmount: 0,
        balanceRemaining: 1000,
        invoicesApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(SalesDocument.findOne)
        .mockResolvedValueOnce(mockInvoice as never)
        .mockResolvedValueOnce(mockCreditNote as never);

      const result = await applyCreditsToInvoice({
        invoiceId,
        organizationId: orgId,
        creditApplications: [{ creditNoteId: String(creditNoteId), amount: 1000 }],
      });

      // Invoice was 1500, amountPaid was 500 (due: 1000). Applied 1000 credit -> balanceDue = 0, status = Paid!
      expect(result.appliedTotal).toBe(1000);
      expect(result.invoiceTotal).toBe(1500);
      expect(result.creditedAmount).toBe(1000);
      expect(result.amountPaid).toBe(500);
      expect(result.balanceDue).toBe(0);
      expect(result.status).toBe("Paid");

      // Check invoice mutation
      expect(mockInvoice.creditedAmount).toBe(1000);
      expect(mockInvoice.status).toBe("Paid");
      expect(mockInvoice.creditsApplied).toHaveLength(1);
      expect(mockInvoice.creditsApplied[0].amount).toBe(1000);
      expect(mockInvoice.creditsApplied[0].creditNoteNumber).toBe("CN-00005");

      // Check credit note mutation
      expect(mockCreditNote.creditedAmount).toBe(1000);
      expect(mockCreditNote.balanceRemaining).toBe(0);
      expect(mockCreditNote.status).toBe("Closed");
      expect(mockCreditNote.invoicesApplied).toHaveLength(1);

      // Customer unused credits decremented
      expect(Customer.updateOne).toHaveBeenCalledWith(
        { _id: customerA },
        { $inc: { unusedCredits: -1000 } },
      );
    });

    it("applies multiple credit notes to an invoice up to invoice balance due", async () => {
      const invoiceId = new Types.ObjectId();
      const cn1Id = new Types.ObjectId();
      const cn2Id = new Types.ObjectId();

      const mockInvoice: MockDoc = {
        _id: invoiceId,
        organizationId: orgId,
        type: "Invoice",
        number: "INV-00201",
        customerId: customerA,
        status: "Sent",
        total: 1000,
        amountPaid: 0,
        creditedAmount: 0,
        creditsApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockCn1: MockDoc = {
        _id: cn1Id,
        organizationId: orgId,
        type: "Credit Note",
        number: "CN-00006",
        customerId: customerA,
        status: "Open",
        total: 600,
        creditedAmount: 0,
        balanceRemaining: 600,
        invoicesApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockCn2: MockDoc = {
        _id: cn2Id,
        organizationId: orgId,
        type: "Credit Note",
        number: "CN-00007",
        customerId: customerA,
        status: "Open",
        total: 800,
        creditedAmount: 0,
        balanceRemaining: 800,
        invoicesApplied: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(SalesDocument.findOne)
        .mockResolvedValueOnce(mockInvoice as never)
        .mockResolvedValueOnce(mockCn1 as never)
        .mockResolvedValueOnce(mockCn2 as never);

      const result = await applyCreditsToInvoice({
        invoiceId,
        organizationId: orgId,
        creditApplications: [
          { creditNoteId: String(cn1Id), amount: 600 },
          { creditNoteId: String(cn2Id), amount: 300 },
        ],
      });

      expect(result.appliedTotal).toBe(900);
      expect(result.creditedAmount).toBe(900);
      expect(result.balanceDue).toBe(100); // 1000 - 900 = 100
      expect(result.status).toBe("Partially Paid");

      expect(mockCn1.balanceRemaining).toBe(0);
      expect(mockCn1.status).toBe("Closed");

      expect(mockCn2.balanceRemaining).toBe(500); // 800 - 300 = 500
      expect(mockCn2.status).toBe("Partially Applied");
    });

    it("STRICTLY REJECTS applying credit note belonging to a DIFFERENT customer", async () => {
      const invoiceId = new Types.ObjectId();
      const creditNoteId = new Types.ObjectId();

      const mockInvoice: MockDoc = {
        _id: invoiceId,
        organizationId: orgId,
        type: "Invoice",
        number: "INV-00202",
        customerId: customerA,
        status: "Sent",
        total: 1000,
        amountPaid: 0,
        creditedAmount: 0,
      };

      const mockCreditNote: MockDoc = {
        _id: creditNoteId,
        organizationId: orgId,
        type: "Credit Note",
        number: "CN-00999",
        customerId: customerB, // Customer B (DIFFERENT!)
        status: "Open",
        total: 500,
        creditedAmount: 0,
        balanceRemaining: 500,
      };

      vi.mocked(SalesDocument.findOne)
        .mockResolvedValueOnce(mockInvoice as never)
        .mockResolvedValueOnce(mockCreditNote as never);

      await expect(
        applyCreditsToInvoice({
          invoiceId,
          organizationId: orgId,
          creditApplications: [{ creditNoteId: String(creditNoteId), amount: 300 }],
        }),
      ).rejects.toThrow(/different customer/i);
    });

    it("REJECTS application when total applied credit exceeds invoice's balance due", async () => {
      const invoiceId = new Types.ObjectId();

      const mockInvoice: MockDoc = {
        _id: invoiceId,
        organizationId: orgId,
        type: "Invoice",
        number: "INV-00203",
        customerId: customerA,
        status: "Sent",
        total: 500,
        amountPaid: 200,
        creditedAmount: 100, // Balance due is 200
      };

      vi.mocked(SalesDocument.findOne).mockResolvedValueOnce(mockInvoice as never);

      await expect(
        applyCreditsToInvoice({
          invoiceId,
          organizationId: orgId,
          creditApplications: [{ creditNoteId: String(new Types.ObjectId()), amount: 300 }], // 300 > 200
        }),
      ).rejects.toThrow(/exceeds invoice's balance due/i);
    });

    it("REJECTS application when amount exceeds credit note's available balance", async () => {
      const invoiceId = new Types.ObjectId();
      const creditNoteId = new Types.ObjectId();

      const mockInvoice: MockDoc = {
        _id: invoiceId,
        organizationId: orgId,
        type: "Invoice",
        number: "INV-00204",
        customerId: customerA,
        status: "Sent",
        total: 1000,
        amountPaid: 0,
        creditedAmount: 0, // Balance due is 1000
      };

      const mockCreditNote: MockDoc = {
        _id: creditNoteId,
        organizationId: orgId,
        type: "Credit Note",
        number: "CN-00008",
        customerId: customerA,
        status: "Open",
        total: 400,
        creditedAmount: 250,
        balanceRemaining: 150, // Only 150 available
      };

      vi.mocked(SalesDocument.findOne)
        .mockResolvedValueOnce(mockInvoice as never)
        .mockResolvedValueOnce(mockCreditNote as never);

      await expect(
        applyCreditsToInvoice({
          invoiceId,
          organizationId: orgId,
          creditApplications: [{ creditNoteId: String(creditNoteId), amount: 200 }], // 200 > 150
        }),
      ).rejects.toThrow(/exceeds Credit Note CN-00008's available balance/i);
    });

    it("REJECTS application when invoice is in Draft or Void status", async () => {
      const invoiceId = new Types.ObjectId();

      const mockInvoice: MockDoc = {
        _id: invoiceId,
        organizationId: orgId,
        type: "Invoice",
        number: "INV-00205",
        customerId: customerA,
        status: "Draft",
        total: 1000,
      };

      vi.mocked(SalesDocument.findOne).mockResolvedValueOnce(mockInvoice as never);

      await expect(
        applyCreditsToInvoice({
          invoiceId,
          organizationId: orgId,
          creditApplications: [{ creditNoteId: String(new Types.ObjectId()), amount: 100 }],
        }),
      ).rejects.toThrow(/Cannot apply credit to an invoice in "Draft" status/i);
    });
  });
});
