import { describe, expect, it } from "vitest";
import { calculateQuoteTotals } from "./quote-tax-utils";
import { DEFAULT_TDS_RATES, DEFAULT_TCS_RATES } from "@/components/sales/quote/quote-types";
import { createSchema } from "@/app/api/sales/schemas";

describe("Quote TDS / TCS and GST Tax Calculations", () => {
  it("calculates subtotal with discount, GST, and TDS deduction correctly", () => {
    // 10,000 subtotal, 10% discount -> 9,000 taxable base
    // 18% GST -> 1,620 GST amount
    // 2% TDS (Sec 194H) -> 180 TDS deduction
    // Adjustment: 0
    // Total = 9,000 + 1,620 - 180 = 10,440
    const res = calculateQuoteTotals({
      subTotal: 10000,
      discountValue: 10,
      discountType: "percent",
      gstRate: 18,
      tdsTcsType: "TDS",
      tdsTcsRate: 2,
      adjustmentValue: 0,
    });

    expect(res.subTotal).toBe(10000);
    expect(res.discountAmount).toBe(1000);
    expect(res.taxableAmount).toBe(9000);
    expect(res.gstAmount).toBe(1620);
    expect(res.tdsTcsType).toBe("TDS");
    expect(res.tdsTcsRate).toBe(2);
    expect(res.tdsTcsAmount).toBe(180);
    expect(res.adjustment).toBe(0);
    expect(res.total).toBe(10440);
  });

  it("calculates subtotal with fixed discount, GST, and TCS addition correctly", () => {
    // 50,000 subtotal, 2,000 fixed discount -> 48,000 taxable base
    // 18% GST -> 8,640 GST amount
    // 0.1% TCS (Sec 206C(1H)) -> 48 TCS addition
    // Adjustment: 12
    // Total = 48,000 + 8,640 + 48 + 12 = 56,700
    const res = calculateQuoteTotals({
      subTotal: 50000,
      discountValue: 2000,
      discountType: "amount",
      gstRate: 18,
      tdsTcsType: "TCS",
      tdsTcsRate: 0.1,
      adjustmentValue: 12,
    });

    expect(res.subTotal).toBe(50000);
    expect(res.discountAmount).toBe(2000);
    expect(res.taxableAmount).toBe(48000);
    expect(res.gstAmount).toBe(8640);
    expect(res.tdsTcsType).toBe("TCS");
    expect(res.tdsTcsRate).toBe(0.1);
    expect(res.tdsTcsAmount).toBe(48);
    expect(res.adjustment).toBe(12);
    expect(res.total).toBe(56700);
  });

  it("calculates correctly when TDS is selected without GST", () => {
    // 25,000 subtotal, 0 discount -> 25,000 taxable base
    // 0% GST -> 0
    // 10% TDS (Sec 194J Professional Services) -> 2,500 deduction
    // Adjustment: -100
    // Total = 25,000 - 2,500 - 100 = 22,400
    const res = calculateQuoteTotals({
      subTotal: 25000,
      discountValue: 0,
      gstRate: 0,
      tdsTcsType: "TDS",
      tdsTcsRate: 10,
      adjustmentValue: -100,
    });

    expect(res.taxableAmount).toBe(25000);
    expect(res.gstAmount).toBe(0);
    expect(res.tdsTcsAmount).toBe(2500);
    expect(res.total).toBe(22400);
  });

  it("calculates correctly when TCS is selected without GST", () => {
    // 100,000 subtotal, 0 discount -> 100,000 taxable base
    // 1% TCS (Scrap Sale) -> 1,000 addition
    // Total = 100,000 + 1,000 = 101,000
    const res = calculateQuoteTotals({
      subTotal: 100000,
      discountValue: 0,
      gstRate: 0,
      tdsTcsType: "TCS",
      tdsTcsRate: 1,
    });

    expect(res.taxableAmount).toBe(100000);
    expect(res.tdsTcsAmount).toBe(1000);
    expect(res.total).toBe(101000);
  });

  it("returns 0 TDS/TCS when mode is None or rate is 0", () => {
    const res1 = calculateQuoteTotals({
      subTotal: 10000,
      tdsTcsType: "None",
      tdsTcsRate: 5,
    });
    expect(res1.tdsTcsAmount).toBe(0);
    expect(res1.total).toBe(10000);

    const res2 = calculateQuoteTotals({
      subTotal: 10000,
      tdsTcsType: "TDS",
      tdsTcsRate: 0,
    });
    expect(res2.tdsTcsAmount).toBe(0);
    expect(res2.total).toBe(10000);
  });

  it("handles discount exceeding subtotal gracefully", () => {
    const res = calculateQuoteTotals({
      subTotal: 1000,
      discountValue: 1500,
      discountType: "amount",
      tdsTcsType: "TDS",
      tdsTcsRate: 2,
    });

    expect(res.discountAmount).toBe(1000);
    expect(res.taxableAmount).toBe(0);
    expect(res.tdsTcsAmount).toBe(0);
    expect(res.total).toBe(0);
  });

  it("handles negative adjustment exceeding total gracefully (clamped to 0)", () => {
    const res = calculateQuoteTotals({
      subTotal: 1000,
      adjustmentValue: -2000,
    });

    expect(res.total).toBe(0);
  });

  it("supports discountAmount passed directly (backend synchronization)", () => {
    const res = calculateQuoteTotals({
      subTotal: 20000,
      discountAmount: 1500,
      gstRate: 12,
      tdsTcsType: "TDS",
      tdsTcsRate: 2,
      adjustmentValue: 50,
    });

    expect(res.taxableAmount).toBe(18500);
    expect(res.gstAmount).toBe(2220); // 18500 * 12% = 2220
    expect(res.tdsTcsAmount).toBe(370); // 18500 * 2% = 370
    // Total = 18500 + 2220 - 370 + 50 = 20400
    expect(res.total).toBe(20400);
  });

  it("verifies default TDS and TCS presets are defined with statutory rates", () => {
    expect(DEFAULT_TDS_RATES.length).toBeGreaterThanOrEqual(8);
    const comm = DEFAULT_TDS_RATES.find((t) => t.name.includes("Commission"));
    expect(comm).toBeDefined();
    expect(comm?.rate).toBe(2);

    const div = DEFAULT_TDS_RATES.find((t) => t.name.includes("Dividend"));
    expect(div).toBeDefined();
    expect(div?.rate).toBe(10);

    const contractOther = DEFAULT_TDS_RATES.find((t) => t.name.includes("Others"));
    expect(contractOther).toBeDefined();
    expect(contractOther?.rate).toBe(2);

    expect(DEFAULT_TCS_RATES.length).toBeGreaterThanOrEqual(6);
    const tcsGoods = DEFAULT_TCS_RATES.find((t) => t.rate === 0.1);
    expect(tcsGoods).toBeDefined();

    const tcsScrap = DEFAULT_TCS_RATES.find((t) => t.name.includes("Scrap"));
    expect(tcsScrap).toBeDefined();
    expect(tcsScrap?.rate).toBe(1);
  });

  it("validates API schema accepts tdsTcs fields on quote creation", () => {
    const parsed = createSchema.safeParse({
      type: "Quote",
      customerId: "507f1f77bcf86cd799439011",
      number: "QT-TEST-01",
      subTotal: 10000,
      discount: 1000,
      taxType: "GST",
      taxRate: 18,
      taxAmount: 1620,
      tdsTcsType: "TDS",
      tdsTcsName: "Commission or Brokerage",
      tdsTcsRate: 2,
      tdsTcsAmount: 180,
      adjustment: 0,
      total: 10440,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success && "tdsTcsType" in parsed.data) {
      expect(parsed.data.tdsTcsType).toBe("TDS");
      expect(parsed.data.tdsTcsRate).toBe(2);
      expect(parsed.data.tdsTcsAmount).toBe(180);
    }
  });

  it("rejects invalid tdsTcsType values in schema", () => {
    const parsed = createSchema.safeParse({
      type: "Quote",
      customerId: "507f1f77bcf86cd799439011",
      tdsTcsType: "INVALID_TAX",
    });

    expect(parsed.success).toBe(false);
  });
});
