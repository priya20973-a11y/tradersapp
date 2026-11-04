import { describe, expect, it } from "vitest";
import {
  calculateNextBillDate,
  isProfileDue,
  recurringBillSchema,
  REPEAT_FREQUENCIES,
} from "./recurring-bill-utils";
import { calculateBillTotals, calculateDueDate } from "./bill-utils";

describe("Recurring Bills Module", () => {
  describe("Schedule & Recurrence Date Calculations", () => {
    const baseDate = "2026-10-23";

    it("calculates weekly next date (+7 days)", () => {
      expect(calculateNextBillDate(baseDate, "Week")).toBe("2026-10-30");
    });

    it("calculates bi-weekly next date (+14 days)", () => {
      expect(calculateNextBillDate(baseDate, "2 Weeks")).toBe("2026-11-06");
    });

    it("calculates monthly next date (+1 month)", () => {
      expect(calculateNextBillDate(baseDate, "Month")).toBe("2026-11-23");
    });

    it("calculates bi-monthly next date (+2 months)", () => {
      expect(calculateNextBillDate(baseDate, "2 Months")).toBe("2026-12-23");
    });

    it("calculates quarterly next date (+3 months)", () => {
      expect(calculateNextBillDate(baseDate, "3 Months")).toBe("2027-01-23");
    });

    it("calculates semi-annual next date (+6 months)", () => {
      expect(calculateNextBillDate(baseDate, "6 Months")).toBe("2027-04-23");
    });

    it("calculates annual next date (+1 year)", () => {
      expect(calculateNextBillDate(baseDate, "Year")).toBe("2027-10-23");
    });

    it("handles month rollover smoothly (e.g., Jan 31 -> Feb 28)", () => {
      const jan31 = "2026-01-31";
      expect(calculateNextBillDate(jan31, "Month")).toBe("2026-02-28");
    });

    it("handles invalid or empty dates safely", () => {
      expect(calculateNextBillDate("", "Month")).toBe("");
      expect(calculateNextBillDate("invalid", "Month")).toBe("");
    });

    it("verifies all repeat frequencies are defined with descriptions", () => {
      expect(REPEAT_FREQUENCIES.length).toBeGreaterThanOrEqual(7);
      const values = REPEAT_FREQUENCIES.map((f) => f.value);
      expect(values).toContain("Week");
      expect(values).toContain("2 Weeks");
      expect(values).toContain("Month");
      expect(values).toContain("Year");
    });
  });

  describe("Due Date and Schedule Due Evaluation", () => {
    it("flags profile as due when nextBillDate is today or earlier", () => {
      const today = new Date("2026-10-23");

      const dueProfile = {
        status: "Active",
        nextBillDate: "2026-10-20",
        neverExpires: true,
      };
      expect(isProfileDue(dueProfile, today)).toBe(true);

      const dueTodayProfile = {
        status: "Active",
        nextBillDate: "2026-10-23",
        neverExpires: true,
      };
      expect(isProfileDue(dueTodayProfile, today)).toBe(true);
    });

    it("does not flag profile as due when nextBillDate is in the future", () => {
      const today = new Date("2026-10-23");

      const futureProfile = {
        status: "Active",
        nextBillDate: "2026-10-25",
        neverExpires: true,
      };
      expect(isProfileDue(futureProfile, today)).toBe(false);
    });

    it("does not flag paused or expired profiles as due", () => {
      const today = new Date("2026-10-23");

      const pausedProfile = {
        status: "Paused",
        nextBillDate: "2026-10-20",
        neverExpires: true,
      };
      expect(isProfileDue(pausedProfile, today)).toBe(false);

      const expiredProfile = {
        status: "Expired",
        nextBillDate: "2026-10-20",
        neverExpires: true,
      };
      expect(isProfileDue(expiredProfile, today)).toBe(false);
    });

    it("respects expiration date when neverExpires is false", () => {
      const today = new Date("2026-10-23");

      const expiredByDate = {
        status: "Active",
        nextBillDate: "2026-10-22",
        endsOn: "2026-10-20", // already ended
        neverExpires: false,
      };
      expect(isProfileDue(expiredByDate, today)).toBe(false);
    });

    it("calculates bill due date correctly for recurring bills", () => {
      expect(calculateDueDate("2026-10-23", "Due on Receipt")).toBe("2026-10-23");
      expect(calculateDueDate("2026-10-23", "Net 30")).toBe("2026-11-22");
      expect(calculateDueDate("2026-10-23", "Net 15")).toBe("2026-11-07");
      expect(calculateDueDate("2026-10-23", "Due end of the month")).toBe("2026-10-31");
    });
  });

  describe("Schema Validation", () => {
    it("validates a complete recurring bill profile payload", () => {
      const validPayload = {
        profileName: "Cold Storage Warehouse Lease",
        vendorId: "64f1a2b3c4d5e6f7a8b9c0d1",
        vendorName: "Apex Logistics & Cold Storage",
        repeatEvery: "Month",
        startDate: "2026-10-23",
        endsOn: "",
        neverExpires: true,
        paymentTerms: "Net 30",
        accountsPayable: "Accounts Payable",
        items: [
          {
            name: "Cold Storage Bay 4 Lease",
            account: "Warehouse Rent & Lease",
            quantity: 1,
            rate: 65000,
            amount: 65000,
          },
          {
            name: "Reefer Power & Backup",
            account: "Utilities & Power",
            quantity: 1,
            rate: 12000,
            amount: 12000,
          },
        ],
        discount: 2000,
        discountType: "amount",
        taxType: "GST",
        taxRate: 18,
        adjustment: 0,
        notes: "Monthly lease retainer",
        status: "Active",
      };

      const result = recurringBillSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.profileName).toBe("Cold Storage Warehouse Lease");
        expect(result.data.items.length).toBe(2);
        expect(result.data.repeatEvery).toBe("Month");
      }
    });

    it("rejects when required profileName is missing", () => {
      const invalidPayload = {
        profileName: "",
        vendorId: "64f1a2b3c4d5e6f7a8b9c0d1",
        vendorName: "Apex Logistics",
        repeatEvery: "Month",
        startDate: "2026-10-23",
        items: [{ name: "Service", quantity: 1, rate: 100 }],
      };
      const result = recurringBillSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("rejects when items array is empty", () => {
      const invalidPayload = {
        profileName: "Packaging Retainer",
        vendorId: "64f1a2b3c4d5e6f7a8b9c0d1",
        vendorName: "Apex Packaging",
        repeatEvery: "Week",
        startDate: "2026-10-23",
        items: [],
      };
      const result = recurringBillSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("Calculations on Recurring Bill Totals", () => {
    it("accurately computes subtotal, discount, GST, and final total", () => {
      const calc = calculateBillTotals({
        items: [
          {
            name: "Agricultural Packaging Bags",
            account: "Packaging Consumables",
            quantity: 500,
            rate: 20, // 10,000
          },
          {
            name: "Pallet Strapping Rolls",
            account: "Packaging Consumables",
            quantity: 10,
            rate: 500, // 5,000
          },
        ],
        discount: 10, // 10%
        discountType: "percent",
        taxType: "GST",
        taxRate: 18,
        adjustment: 50,
      });

      expect(calc.subTotal).toBe(15000); // 10000 + 5000
      expect(calc.discountAmount).toBe(1500); // 10% of 15000
      expect(calc.taxableAmount).toBe(13500); // 15000 - 1500
      expect(calc.taxAmount).toBe(2430); // 18% of 13500
      expect(calc.adjustment).toBe(50);
      expect(calc.total).toBe(15980); // 13500 + 2430 + 50
    });

    it("computes TDS deduction accurately", () => {
      const calc = calculateBillTotals({
        items: [
          {
            name: "Legal Retainer Consulting",
            account: "Consulting & Legal",
            quantity: 1,
            rate: 50000,
          },
        ],
        discount: 0,
        taxType: "TDS",
        taxRate: 10, // 10% TDS
        adjustment: 0,
      });

      expect(calc.subTotal).toBe(50000);
      expect(calc.taxAmount).toBe(-5000); // 10% TDS withholding
      // In TDS, taxAmount is deducted from total
      expect(calc.total).toBe(45000); // 50000 - 5000
    });
  });
});
