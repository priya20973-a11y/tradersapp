import { describe, expect, it } from "vitest";
import { calculateBillTotals, calculateDueDate, GST_RATES, PAYMENT_TERMS_OPTIONS } from "./bill-utils";

describe("bill-utils", () => {
  it("calculates due date based on payment terms accurately", () => {
    expect(calculateDueDate("2026-10-10", "Due on Receipt")).toBe("2026-10-10");
    expect(calculateDueDate("2026-10-10", "Net 15")).toBe("2026-10-25");
    expect(calculateDueDate("2026-10-10", "Net 30")).toBe("2026-11-09");
    expect(calculateDueDate("2026-10-10", "Net 45")).toBe("2026-11-24");
    expect(calculateDueDate("2026-10-10", "Net 60")).toBe("2026-12-09");
    expect(calculateDueDate("2026-10-10", "Due end of the month")).toBe("2026-10-31");
    expect(calculateDueDate("2026-02-15", "Due end of the month")).toBe("2026-02-28");
  });

  it("calculates bill totals with line items, percentage discount, and GST", () => {
    const result = calculateBillTotals({
      items: [
        {
          name: "Packaging Bags 25kg",
          account: "Packaging Consumables",
          quantity: 100,
          rate: 50,
          taxRate: 18,
          amount: 5000,
        },
        {
          name: "Pallet Stretch Wrap",
          account: "Packaging Consumables",
          quantity: 10,
          rate: 300,
          taxRate: 18,
          amount: 3000,
        },
      ],
      discount: 10, // 10%
      discountType: "percent",
      taxType: "GST",
      isIntraState: true,
      adjustment: -20,
    });

    expect(result.subTotal).toBe(8000); // 5000 + 3000
    expect(result.discountAmount).toBe(800); // 10% of 8000
    expect(result.taxableAmount).toBe(7200); // 8000 - 800
    expect(result.taxAmount).toBe(1296); // 18% of 7200
    expect(result.cgst).toBe(648);
    expect(result.sgst).toBe(648);
    expect(result.igst).toBe(0);
    expect(result.adjustment).toBe(-20);
    expect(result.total).toBe(8476); // 7200 + 1296 - 20
  });

  it("handles inter-state IGST and fixed amount discount", () => {
    const result = calculateBillTotals({
      items: [
        {
          name: "Cold Storage Logistics",
          account: "Freight & Logistics",
          quantity: 1,
          rate: 15000,
          taxRate: 18,
          amount: 15000,
        },
      ],
      discount: 1000,
      discountType: "amount",
      taxType: "GST",
      isIntraState: false,
    });

    expect(result.subTotal).toBe(15000);
    expect(result.discountAmount).toBe(1000);
    expect(result.taxableAmount).toBe(14000);
    expect(result.taxAmount).toBe(2520); // 18% of 14000
    expect(result.igst).toBe(2520);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.total).toBe(16520);
  });

  it("handles empty items gracefully with zero totals", () => {
    const result = calculateBillTotals({
      items: [],
      discount: 100,
      discountType: "percent",
      taxType: "GST",
      isIntraState: true,
      adjustment: 50,
    });

    expect(result.subTotal).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(50);
  });

  it("handles zero tax (exempt) items and precision rounding", () => {
    const result = calculateBillTotals({
      items: [
        {
          name: "Raw Agricultural Produce",
          account: "Cost of Goods Sold",
          quantity: 33.33,
          rate: 100.5,
          taxRate: 0,
        },
      ],
      discount: 0,
      taxType: "None",
      isIntraState: true,
      adjustment: 0.25,
    });

    // 33.33 * 100.5 = 3349.665 -> rounded to 3349.67
    expect(result.subTotal).toBe(3349.67);
    expect(result.discountAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(3349.92);
  });

  it("ensures standard payment terms and GST rate constants are defined", () => {
    const labels = PAYMENT_TERMS_OPTIONS.map((opt) => opt.label);
    expect(labels).toContain("Due on Receipt");
    expect(labels).toContain("Net 15");
    expect(labels).toContain("Net 30");
    expect(labels).toContain("Due end of the month");

    const rates = GST_RATES.map((g) => g.rate);
    expect(rates).toContain(0);
    expect(rates).toContain(5);
    expect(rates).toContain(12);
    expect(rates).toContain(18);
    expect(rates).toContain(28);
  });
});
