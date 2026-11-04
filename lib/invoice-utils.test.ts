import { describe, expect, it } from "vitest";
import {
  calculateInvoiceTotals,
  generateUpiQrString,
  numberToIndianWords,
} from "./invoice-utils";

describe("Invoice Utilities", () => {
  it("converts numbers to Indian words accurately", () => {
    expect(numberToIndianWords(0)).toBe("Zero Rupees Only");
    expect(numberToIndianWords(50)).toBe("Fifty Rupees Only");
    expect(numberToIndianWords(1500)).toBe("One Thousand Five Hundred Rupees Only");
    expect(numberToIndianWords(45250)).toBe(
      "Forty-Five Thousand Two Hundred Fifty Rupees Only",
    );
    expect(numberToIndianWords(1250000)).toBe(
      "Twelve Lakh Fifty Thousand Rupees Only",
    );
    expect(numberToIndianWords(100.5)).toBe(
      "One Hundred Rupees and Fifty Paise Only",
    );
  });

  it("calculates invoice totals with intra-state GST (CGST + SGST)", () => {
    const result = calculateInvoiceTotals({
      items: [
        {
          quantity: 10,
          rate: 1000,
          discount: 10,
          discountType: "percent",
          taxRate: 18,
        },
      ],
      placeOfSupply: "Maharashtra",
      organizationState: "Maharashtra",
      autoRoundOff: true,
    });

    // 10 * 1000 = 10000
    // 10% disc = 1000 -> Taxable = 9000
    // 18% GST on 9000 = 1620 -> Intra-state: CGST 810, SGST 810, IGST 0
    // Total = 9000 + 1620 = 10620
    expect(result.subTotal).toBe(10000);
    expect(result.totalDiscount).toBe(1000);
    expect(result.taxableSubtotal).toBe(9000);
    expect(result.totalTax).toBe(1620);
    expect(result.cgst).toBe(810);
    expect(result.sgst).toBe(810);
    expect(result.igst).toBe(0);
    expect(result.isIntraState).toBe(true);
    expect(result.grandTotal).toBe(10620);
    expect(result.balanceDue).toBe(10620);
  });

  it("calculates invoice totals with inter-state GST (IGST only)", () => {
    const result = calculateInvoiceTotals({
      items: [
        {
          quantity: 5,
          rate: 200,
          taxRate: 5,
        },
      ],
      placeOfSupply: "Gujarat",
      organizationState: "Maharashtra",
      shippingCharges: 100,
      amountPaid: 500,
    });

    // 5 * 200 = 1000
    // 5% tax = 50 -> IGST 50
    // Grand Total = 1000 + 50 + 100 (shipping) = 1150
    // Amount paid = 500 -> Balance due = 650
    expect(result.subTotal).toBe(1000);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.igst).toBe(50);
    expect(result.isIntraState).toBe(false);
    expect(result.shippingCharges).toBe(100);
    expect(result.grandTotal).toBe(1150);
    expect(result.balanceDue).toBe(650);
  });

  it("generates valid UPI payment URL", () => {
    const url = generateUpiQrString({
      upiId: "trader@okaxis",
      payeeName: "Trader Co",
      amount: 1500,
      transactionRef: "INV-001",
    });

    expect(url).toContain("upi://pay?");
    expect(url).toContain("pa=trader%40okaxis");
    expect(url).toContain("am=1500.00");
    expect(url).toContain("tr=INV-001");
  });
});
