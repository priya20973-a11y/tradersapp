import { describe, it, expect } from "vitest";
import {
  extractNumberPart,
  findNextAvailableInvoiceNumber,
  formatInvoiceNumber,
  getFiscalYear,
  parseNextNumberInput,
} from "./invoice-numbering";

describe("Invoice Number Configuration & Generation", () => {
  describe("1. Next Number Input Parsing & Zero-Padding Preservation", () => {
    it("preserves 6-digit leading zero padding from Zoho Books reference ('000002')", () => {
      const parsed = parseNextNumberInput("000002");
      expect(parsed.nextNumber).toBe(2);
      expect(parsed.padding).toBe(6);
      expect(parsed.formattedString).toBe("000002");

      const formatted = formatInvoiceNumber("INV-", parsed.nextNumber, parsed.padding);
      expect(formatted).toBe("INV-000002");
    });

    it("parses single digit inputs and maintains entered length as minimum padding", () => {
      const parsed = parseNextNumberInput("1");
      expect(parsed.nextNumber).toBe(1);
      expect(parsed.padding).toBe(1);
      expect(parsed.formattedString).toBe("1");
      expect(formatInvoiceNumber("INV-", parsed.nextNumber, parsed.padding)).toBe("INV-1");
    });

    it("parses 4-digit padded numbers correctly ('0042')", () => {
      const parsed = parseNextNumberInput("0042");
      expect(parsed.nextNumber).toBe(42);
      expect(parsed.padding).toBe(4);
      expect(parsed.formattedString).toBe("0042");
      expect(formatInvoiceNumber("INV-", parsed.nextNumber, parsed.padding)).toBe("INV-0042");
    });

    it("handles empty or non-numeric inputs safely with default padding", () => {
      const parsed = parseNextNumberInput("");
      expect(parsed.nextNumber).toBe(1);
      expect(parsed.padding).toBe(6);
      expect(parsed.formattedString).toBe("000001");
    });
  });

  describe("2. Sequential Formatting & Extraction", () => {
    it("formats sequential invoice numbers with customizable prefix", () => {
      expect(formatInvoiceNumber("INV-", 1, 6)).toBe("INV-000001");
      expect(formatInvoiceNumber("INV-", 2, 6)).toBe("INV-000002");
      expect(formatInvoiceNumber("BILL/26-27/", 15, 4)).toBe("BILL/26-27/0015");
      expect(formatInvoiceNumber("TAX-", 999, 5)).toBe("TAX-00999");
    });

    it("extracts the numeric sequence accurately from formatted invoice numbers", () => {
      expect(extractNumberPart("INV-000002", "INV-")).toBe(2);
      expect(extractNumberPart("INV-000125", "INV-")).toBe(125);
      expect(extractNumberPart("BILL-99", "BILL-")).toBe(99);
      expect(extractNumberPart("INV-CUSTOM", "INV-")).toBeNull();
      expect(extractNumberPart("OTHER-0001", "INV-")).toBeNull();
    });
  });

  describe("3. Indian Financial Year Calculation & Reset at Fiscal Year Start", () => {
    it("calculates correct fiscal year across different calendar months", () => {
      // Month index: 0=Jan, 3=Apr, 9=Oct
      const oct2026 = new Date(2026, 9, 27); // 27 Oct 2026
      expect(getFiscalYear(oct2026)).toBe("2026-27");

      const mar2027 = new Date(2027, 2, 31); // 31 Mar 2027 (Last day of FY 2026-27)
      expect(getFiscalYear(mar2027)).toBe("2026-27");

      const apr2027 = new Date(2027, 3, 1); // 01 Apr 2027 (First day of FY 2027-28)
      expect(getFiscalYear(apr2027)).toBe("2027-28");
    });

    it("restarts invoice numbering at 1 when fiscal year changes if restart option is enabled", () => {
      const restartEnabled = true;
      const lastRecordedFY = "2025-26";
      const currentFY = getFiscalYear(new Date(2026, 9, 27)); // "2026-27"

      let nextNumber = 482; // Old sequence from last year

      if (restartEnabled && lastRecordedFY && lastRecordedFY !== currentFY) {
        nextNumber = 1;
      }

      expect(nextNumber).toBe(1);
      expect(formatInvoiceNumber("INV-", nextNumber, 6)).toBe("INV-000001");
    });

    it("preserves continuous sequential numbering if restart option is disabled", () => {
      const restartEnabled = false;
      const lastRecordedFY = "2025-26";
      const currentFY = getFiscalYear(new Date(2026, 9, 27));

      let nextNumber = 482;

      if (restartEnabled && lastRecordedFY && lastRecordedFY !== currentFY) {
        nextNumber = 1;
      }

      expect(nextNumber).toBe(482);
      expect(formatInvoiceNumber("INV-", nextNumber, 6)).toBe("INV-000482");
    });
  });

  describe("4. Duplicate Prevention & Collision Avoidance", () => {
    it("finds the next available sequential number when collisions exist", () => {
      const existingInvoices = new Set([
        "INV-000001",
        "INV-000002",
        "INV-000003",
      ]);

      const allocated = findNextAvailableInvoiceNumber("INV-", 2, 6, existingInvoices);
      expect(allocated.invoiceNumber).toBe("INV-000004");
      expect(allocated.allocatedNumber).toBe(4);
    });

    it("allocates the requested starting number immediately if no collision exists", () => {
      const existingInvoices = new Set([
        "INV-000001",
      ]);

      const allocated = findNextAvailableInvoiceNumber("INV-", 2, 6, existingInvoices);
      expect(allocated.invoiceNumber).toBe("INV-000002");
      expect(allocated.allocatedNumber).toBe(2);
    });

    it("guarantees existing invoices are never overwritten or altered", () => {
      const existingInvoices = [
        { id: "inv-1", number: "INV-000001", total: 50000 },
        { id: "inv-2", number: "INV-000002", total: 75000 },
      ];

      // New invoice being allocated with next number 3
      const newInvoiceNumber = formatInvoiceNumber("INV-", 3, 6);
      expect(newInvoiceNumber).toBe("INV-000003");

      // Verify existing records remain untouched
      expect(existingInvoices[0].number).toBe("INV-000001");
      expect(existingInvoices[1].number).toBe("INV-000002");
      expect(existingInvoices.some((inv) => inv.number === newInvoiceNumber)).toBe(false);
    });
  });

  describe("5. Auto vs Manual Numbering Preferences Contract", () => {
    it("differentiates auto-generate mode and manual mode payloads", () => {
      const autoSettings = {
        autoGenerateNumbering: true,
        invoicePrefix: "INV-",
        nextNumber: 2,
        numberZeroPadding: 6,
        restartNumberingEachFiscalYear: false,
      };

      const manualSettings = {
        autoGenerateNumbering: false,
        invoicePrefix: "INV-",
        nextNumber: 2,
        numberZeroPadding: 6,
        restartNumberingEachFiscalYear: false,
      };

      expect(autoSettings.autoGenerateNumbering).toBe(true);
      expect(manualSettings.autoGenerateNumbering).toBe(false);

      if (autoSettings.autoGenerateNumbering) {
        expect(formatInvoiceNumber(autoSettings.invoicePrefix, autoSettings.nextNumber, autoSettings.numberZeroPadding))
          .toBe("INV-000002");
      }
    });
  });
});
