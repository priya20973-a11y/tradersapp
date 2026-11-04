import { describe, it, expect } from "vitest";
import {
  recurringExpenseSchema,
  calculateNextDate,
} from "@/app/api/purchases/recurring-expenses/route";
import {
  calculateNextScheduledDate,
  formatDateLocale,
} from "@/components/purchases/recurring-expense-form";

describe("Recurring Expense Module Tests", () => {
  describe("Schedule & Next Date Calculations", () => {
    const baseDate = "2026-10-23";

    it("calculates next date correctly for weekly schedule (7 days)", () => {
      const nextDate = calculateNextScheduledDate(baseDate, "Week");
      expect(nextDate).toBe("2026-10-30");
      expect(calculateNextDate(baseDate, "Week")).toBe("2026-10-30");
    });

    it("calculates next date correctly for bi-weekly schedule (14 days)", () => {
      const nextDate = calculateNextScheduledDate(baseDate, "2 Weeks");
      expect(nextDate).toBe("2026-11-06");
      expect(calculateNextDate(baseDate, "2 Weeks")).toBe("2026-11-06");
    });

    it("calculates next date correctly for monthly schedule (1 month)", () => {
      const nextDate = calculateNextScheduledDate(baseDate, "Month");
      expect(nextDate).toBe("2026-11-23");
      expect(calculateNextDate(baseDate, "Month")).toBe("2026-11-23");
    });

    it("calculates next date correctly for quarterly schedule (3 months)", () => {
      const nextDate = calculateNextScheduledDate(baseDate, "3 Months");
      expect(nextDate).toBe("2027-01-23");
      expect(calculateNextDate(baseDate, "3 Months")).toBe("2027-01-23");
    });

    it("calculates next date correctly for semi-annual schedule (6 months)", () => {
      const nextDate = calculateNextScheduledDate(baseDate, "6 Months");
      expect(nextDate).toBe("2027-04-23");
      expect(calculateNextDate(baseDate, "6 Months")).toBe("2027-04-23");
    });

    it("calculates next date correctly for annual schedule (1 year)", () => {
      const nextDate = calculateNextScheduledDate(baseDate, "Year");
      expect(nextDate).toBe("2027-10-23");
      expect(calculateNextDate(baseDate, "Year")).toBe("2027-10-23");
    });

    it("handles invalid or empty dates gracefully", () => {
      expect(calculateNextScheduledDate("", "Month")).toBe("");
      expect(calculateNextScheduledDate("invalid-date", "Month")).toBe("");
    });
  });

  describe("Schema Validation", () => {
    it("validates a full valid recurring expense profile payload", () => {
      const payload = {
        profileName: "Warehouse Lease - Unit B",
        repeatEvery: "Month",
        startDate: "2026-10-23",
        endsOn: "",
        neverExpires: true,
        expenseAccount: "Rent & Lease Expense",
        amount: 75000,
        currency: "INR",
        paidThrough: "HDFC Primary Bank",
        vendor: "IndoSpace Properties",
        notes: "Monthly warehouse lease retainer",
        customerName: "Astra Foods",
        reportingTags: ["Lease", "Warehouse"],
        status: "Active",
      };

      const result = recurringExpenseSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.profileName).toBe("Warehouse Lease - Unit B");
        expect(result.data.amount).toBe(75000);
        expect(result.data.neverExpires).toBe(true);
      }
    });

    it("rejects when profileName is empty", () => {
      const payload = {
        profileName: "   ",
        repeatEvery: "Month",
        startDate: "2026-10-23",
        expenseAccount: "Rent & Lease Expense",
        amount: 75000,
        paidThrough: "HDFC Primary Bank",
      };

      const result = recurringExpenseSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("rejects non-positive amount", () => {
      const payload = {
        profileName: "Cloud ERP",
        repeatEvery: "Month",
        startDate: "2026-10-23",
        expenseAccount: "Software",
        amount: 0,
        paidThrough: "HDFC Primary Bank",
      };

      const result = recurringExpenseSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("rejects missing expenseAccount or paidThrough", () => {
      const missingAccount = {
        profileName: "Office Internet",
        repeatEvery: "Month",
        startDate: "2026-10-23",
        expenseAccount: "",
        amount: 2500,
        paidThrough: "HDFC Primary Bank",
      };

      const result = recurringExpenseSchema.safeParse(missingAccount);
      expect(result.success).toBe(false);

      const missingPaidThrough = {
        profileName: "Office Internet",
        repeatEvery: "Month",
        startDate: "2026-10-23",
        expenseAccount: "Telephone & Internet Charges",
        amount: 2500,
        paidThrough: "",
      };

      const result2 = recurringExpenseSchema.safeParse(missingPaidThrough);
      expect(result2.success).toBe(false);
    });

    it("rejects notes longer than 500 characters", () => {
      const payload = {
        profileName: "Office Internet",
        repeatEvery: "Month",
        startDate: "2026-10-23",
        expenseAccount: "Telephone & Internet Charges",
        amount: 2500,
        paidThrough: "HDFC Primary Bank",
        notes: "A".repeat(501),
      };

      const result = recurringExpenseSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("Formatting Helpers", () => {
    it("formats dates to DD/MM/YYYY format", () => {
      expect(formatDateLocale("2026-10-30")).toBe("30/10/2026");
      expect(formatDateLocale("2027-01-05")).toBe("05/01/2027");
      expect(formatDateLocale("")).toBe("—");
    });
  });
});
