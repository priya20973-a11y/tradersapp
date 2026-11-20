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

  it("preserves item units accurately without affecting quantity, rate, or amount calculations", () => {
    const result = calculateBillTotals({
      items: [
        {
          name: "Basmati Rice 25kg",
          account: "Cost of Goods Sold",
          quantity: 200,
          unit: "bags",
          rate: 1850,
          taxRate: 5,
        },
        {
          name: "Milling Wheat",
          account: "Cost of Goods Sold",
          quantity: 15.5,
          unit: "MT",
          rate: 26000,
          taxRate: 0,
        },
        {
          name: "Jute Packaging Bags",
          account: "Packaging Consumables",
          quantity: 500,
          unit: "pcs",
          rate: 45,
          taxRate: 18,
        },
        {
          name: "Premium Cashew Nuts",
          account: "Cost of Goods Sold",
          quantity: 120,
          unit: "kg",
          rate: 800,
          taxRate: 5,
        },
      ],
      discount: 2,
      discountType: "percent",
      taxType: "GST",
      isIntraState: true,
    });

    expect(result.items[0].unit).toBe("bags");
    expect(result.items[0].quantity).toBe(200);
    expect(result.items[0].rate).toBe(1850);
    expect(result.items[0].amount).toBe(370000);

    expect(result.items[1].unit).toBe("MT");
    expect(result.items[1].quantity).toBe(15.5);
    expect(result.items[1].rate).toBe(26000);
    expect(result.items[1].amount).toBe(403000);

    expect(result.items[2].unit).toBe("pcs");
    expect(result.items[2].quantity).toBe(500);
    expect(result.items[2].rate).toBe(45);
    expect(result.items[2].amount).toBe(22500);

    expect(result.items[3].unit).toBe("kg");
    expect(result.items[3].quantity).toBe(120);
    expect(result.items[3].rate).toBe(800);
    expect(result.items[3].amount).toBe(96000);

    // subtotal = 370000 + 403000 + 22500 + 96000 = 891500
    expect(result.subTotal).toBe(891500);
    expect(result.discountAmount).toBe(17830);
  });
});
