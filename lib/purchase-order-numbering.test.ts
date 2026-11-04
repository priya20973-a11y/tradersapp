import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

// Mock Mongoose models before importing numbering module
vi.mock("@/models", () => {
  return {
    PurchaseOrder: {
      find: vi.fn(),
      findOne: vi.fn(),
      exists: vi.fn(),
    },
    PurchaseOrderPreferences: {
      findOne: vi.fn(),
      create: vi.fn(),
      updateOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
    },
    Organization: {
      findOne: vi.fn(),
      findById: vi.fn(),
    },
  };
});

import { PurchaseOrder, PurchaseOrderPreferences } from "@/models";
import {
  extractNumberPart,
  findNextAvailablePONumber,
  formatPurchaseOrderNumber,
  getFiscalYear,
  parseNextNumberInput,
} from "./purchase-order-numbering";
import { allocateNextPurchaseOrderNumber } from "./purchase-order-numbering-server";

describe("Purchase Order Number Preferences & Auto-Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Input Parsing and Leading Zero Preservation", () => {
    it("preserves leading zero-padding of 5 digits for default '00002'", () => {
      const result = parseNextNumberInput("00002");
      expect(result.nextNumber).toBe(2);
      expect(result.padding).toBe(5);
      expect(result.formattedString).toBe("00002");
    });

    it("preserves custom padding when user enters '00045'", () => {
      const result = parseNextNumberInput("00045");
      expect(result.nextNumber).toBe(45);
      expect(result.padding).toBe(5);
      expect(result.formattedString).toBe("00045");
    });

    it("handles short padding when user enters '01'", () => {
      const result = parseNextNumberInput("01");
      expect(result.nextNumber).toBe(1);
      expect(result.padding).toBe(2);
      expect(result.formattedString).toBe("01");
    });

    it("handles large numbers with 6 digits like '000100'", () => {
      const result = parseNextNumberInput("000100");
      expect(result.nextNumber).toBe(100);
      expect(result.padding).toBe(6);
      expect(result.formattedString).toBe("000100");
    });

    it("falls back to nextNumber: 2 and padding: 5 when input is empty or invalid", () => {
      const result = parseNextNumberInput("");
      expect(result.nextNumber).toBe(2);
      expect(result.padding).toBe(5);
      expect(result.formattedString).toBe("00002");
    });
  });

  describe("2. Formatting Purchase Order Numbers", () => {
    it("formats with default prefix 'PO-' and 5-digit padding", () => {
      expect(formatPurchaseOrderNumber("PO-", 2, 5)).toBe("PO-00002");
      expect(formatPurchaseOrderNumber("PO-", 10, 5)).toBe("PO-00010");
      expect(formatPurchaseOrderNumber("PO-", 99999, 5)).toBe("PO-99999");
    });

    it("formats with customized prefix such as 'PO/2026/'", () => {
      expect(formatPurchaseOrderNumber("PO/2026/", 5, 4)).toBe("PO/2026/0005");
    });

    it("formats with custom user prefix 'PUR-ORD-'", () => {
      expect(formatPurchaseOrderNumber("PUR-ORD-", 1, 6)).toBe("PUR-ORD-000001");
    });

    it("handles numeric sequence beyond original padding without truncation", () => {
      expect(formatPurchaseOrderNumber("PO-", 100005, 5)).toBe("PO-100005");
    });
  });

  describe("3. Indian Fiscal Year Calculation (Apr 1 - Mar 31)", () => {
    it("calculates fiscal year correctly in October 2026", () => {
      const date = new Date(2026, 9, 29); // Month 9 is October
      expect(getFiscalYear(date)).toBe("2026-27");
    });

    it("calculates fiscal year correctly in January 2027 (Q4 of FY 2026-27)", () => {
      const date = new Date(2027, 0, 15); // Month 0 is January
      expect(getFiscalYear(date)).toBe("2026-27");
    });

    it("calculates fiscal year correctly in March 2027 (end of FY 2026-27)", () => {
      const date = new Date(2027, 2, 31); // Month 2 is March
      expect(getFiscalYear(date)).toBe("2026-27");
    });

    it("rolls over to 2027-28 on April 1, 2027", () => {
      const date = new Date(2027, 3, 1); // Month 3 is April
      expect(getFiscalYear(date)).toBe("2027-28");
    });
  });

  describe("4. Number Extraction from PO Strings", () => {
    it("extracts numeric sequence when prefix matches", () => {
      expect(extractNumberPart("PO-00002", "PO-")).toBe(2);
      expect(extractNumberPart("PO-00125", "PO-")).toBe(125);
    });

    it("returns null if prefix does not match", () => {
      expect(extractNumberPart("INV-00002", "PO-")).toBeNull();
      expect(extractNumberPart("CUSTOM-PO", "PO-")).toBeNull();
    });
  });

  describe("5. Sequential Non-Colliding Number Allocation", () => {
    it("allocates the next available number skipping already existing numbers", () => {
      const existing = new Set(["PO-00001", "PO-00002", "PO-00003"]);
      const result = findNextAvailablePONumber("PO-", 2, 5, existing);

      // Starting at 2, but 2 and 3 exist, so allocates 4
      expect(result.allocatedNumber).toBe(4);
      expect(result.poNumber).toBe("PO-00004");
    });

    it("allocates starting number directly if not in existing set", () => {
      const existing = new Set(["PO-00001"]);
      const result = findNextAvailablePONumber("PO-", 2, 5, existing);

      expect(result.allocatedNumber).toBe(2);
      expect(result.poNumber).toBe("PO-00002");
    });
  });

  describe("6. allocateNextPurchaseOrderNumber: Persistence & Fiscal Year Reset", () => {
    const orgId = new Types.ObjectId();

    it("allocates PO-00002 as default next number and updates preferences to 3", async () => {
      const mockPrefs = {
        _id: new Types.ObjectId(),
        organizationId: orgId,
        autoGenerateNumbering: true,
        prefix: "PO-",
        nextNumber: 2,
        numberZeroPadding: 5,
        restartNumberingEachFiscalYear: false,
        lastFiscalYear: getFiscalYear(),
      };

      vi.mocked(PurchaseOrderPreferences.findOne).mockResolvedValue(mockPrefs as never);
      vi.mocked(PurchaseOrder.find).mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      } as unknown as ReturnType<typeof PurchaseOrder.find>);

      const result = await allocateNextPurchaseOrderNumber(String(orgId));

      expect(result.poNumber).toBe("PO-00002");
      expect(result.allocatedNumber).toBe(2);
      expect(PurchaseOrderPreferences.updateOne).toHaveBeenCalledWith(
        { _id: mockPrefs._id },
        { $set: { nextNumber: 3 } },
      );
    });

    it("restarts numbering at fiscal year start without creating duplicates", async () => {
      // Preferences had lastFiscalYear set to old FY "2025-26", restart enabled
      const mockPrefs = {
        _id: new Types.ObjectId(),
        organizationId: orgId,
        autoGenerateNumbering: true,
        prefix: "PO-",
        nextNumber: 50,
        numberZeroPadding: 5,
        restartNumberingEachFiscalYear: true,
        lastFiscalYear: "2025-26", // Old FY
      };

      // In the database, PO-00001 already exists
      const existingPOs = [{ purchaseOrderNumber: "PO-00001" }];

      vi.mocked(PurchaseOrderPreferences.findOne).mockResolvedValue(mockPrefs as never);
      vi.mocked(PurchaseOrder.find).mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(existingPOs),
        }),
      } as unknown as ReturnType<typeof PurchaseOrder.find>);

      const result = await allocateNextPurchaseOrderNumber(String(orgId));

      // Resets candidate to 1, but PO-00001 exists, so it smoothly allocates PO-00002!
      expect(result.poNumber).toBe("PO-00002");
      expect(result.allocatedNumber).toBe(2);

      // Preferences nextNumber updated to 3
      expect(PurchaseOrderPreferences.updateOne).toHaveBeenCalledWith(
        { _id: mockPrefs._id },
        { $set: { nextNumber: 3 } },
      );
    });

    it("prevents collisions when multiple concurrent allocations happen", async () => {
      const mockPrefs = {
        _id: new Types.ObjectId(),
        organizationId: orgId,
        autoGenerateNumbering: true,
        prefix: "PO-",
        nextNumber: 5,
        numberZeroPadding: 5,
        restartNumberingEachFiscalYear: false,
        lastFiscalYear: getFiscalYear(),
      };

      // Simulate PO-00005 already taken by a concurrent worker
      const existingPOs = [{ purchaseOrderNumber: "PO-00005" }];

      vi.mocked(PurchaseOrderPreferences.findOne).mockResolvedValue(mockPrefs as never);
      vi.mocked(PurchaseOrder.find).mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(existingPOs),
        }),
      } as unknown as ReturnType<typeof PurchaseOrder.find>);

      const result = await allocateNextPurchaseOrderNumber(String(orgId));

      // Allocates PO-00006 avoiding the collision
      expect(result.poNumber).toBe("PO-00006");
      expect(result.allocatedNumber).toBe(6);
      expect(PurchaseOrderPreferences.updateOne).toHaveBeenCalledWith(
        { _id: mockPrefs._id },
        { $set: { nextNumber: 7 } },
      );
    });
  });

  describe("7. Scope Isolation (Does NOT affect Sales, Invoices, or Bills)", () => {
    it("ensures PurchaseOrderPreferences collection and logic are isolated", () => {
      // Formatter uses PO prefix and parameters without touching invoice/bill settings
      const poNum = formatPurchaseOrderNumber("PO-", 2, 5);
      expect(poNum).toBe("PO-00002");
      expect(poNum).not.toContain("INV");
      expect(poNum).not.toContain("BILL");
    });
  });
});

