import { describe, it, expect } from "vitest";
import {
  extractNumberPart,
  findNextAvailableDeliveryChallanNumber,
  formatDeliveryChallanNumber,
  getFiscalYear,
  parseNextNumberInput,
} from "./delivery-challan-numbering";

describe("Delivery Challan Number Configuration & Generation", () => {
  describe("1. Next Number Input Parsing & Zero-Padding Preservation", () => {
    it("preserves 5-digit leading zero padding matching Zoho reference ('00002')", () => {
      const parsed = parseNextNumberInput("00002");
      expect(parsed.nextNumber).toBe(2);
      expect(parsed.padding).toBe(5);
      expect(parsed.formattedString).toBe("00002");

      const formatted = formatDeliveryChallanNumber("DC-", parsed.nextNumber, parsed.padding);
      expect(formatted).toBe("DC-00002");
    });

    it("parses single digit inputs and maintains entered length as minimum padding", () => {
      const parsed = parseNextNumberInput("5");
      expect(parsed.nextNumber).toBe(5);
      expect(parsed.padding).toBe(1);
      expect(parsed.formattedString).toBe("5");
      expect(formatDeliveryChallanNumber("DC-", parsed.nextNumber, parsed.padding)).toBe("DC-5");
    });

    it("handles empty or non-numeric inputs safely with defaults", () => {
      const parsed = parseNextNumberInput("");
      expect(parsed.nextNumber).toBe(2);
      expect(parsed.padding).toBe(5);
      expect(parsed.formattedString).toBe("00002");
    });
  });

  describe("2. Number Formatting", () => {
    it("formats DC number correctly with custom prefix", () => {
      expect(formatDeliveryChallanNumber("CHALLAN-", 1, 4)).toBe("CHALLAN-0001");
      expect(formatDeliveryChallanNumber("DC-", 2, 5)).toBe("DC-00002");
    });

    it("handles large number sequences without truncation", () => {
      expect(formatDeliveryChallanNumber("DC-", 10005, 4)).toBe("DC-10005");
    });
  });

  describe("3. Number Extraction", () => {
    it("extracts numeric parts correctly from formatted DC string", () => {
      expect(extractNumberPart("DC-00002", "DC-")).toBe(2);
      expect(extractNumberPart("DC-123", "DC-")).toBe(123);
      expect(extractNumberPart("INV-00002", "DC-")).toBeNull();
      expect(extractNumberPart("DC-abc", "DC-")).toBeNull();
    });
  });

  describe("4. Collision Avoidance", () => {
    it("skips taken numbers and returns the next unused sequential number", () => {
      const existing = new Set(["dc-00001", "dc-00002", "dc-00003"]);
      const next = findNextAvailableDeliveryChallanNumber("DC-", 1, 5, existing);
      expect(next.challanNumber).toBe("DC-00004");
      expect(next.allocatedNumber).toBe(4);
    });
  });

  describe("5. Indian Financial Year helper", () => {
    it("returns correct financial year across months", () => {
      expect(getFiscalYear(new Date("2026-10-30"))).toBe("2026-27");
      expect(getFiscalYear(new Date("2027-02-15"))).toBe("2026-27");
      expect(getFiscalYear(new Date("2027-04-01"))).toBe("2027-28");
    });
  });
});

