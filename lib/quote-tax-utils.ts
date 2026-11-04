/**
 * Calculations and utilities for Quote taxes including Subtotal, Discount, GST, TDS, and TCS.
 */

export interface QuoteTotalsParams {
  subTotal: number;
  discountValue?: number | string;
  discountAmount?: number;
  discountType?: "percent" | "amount";
  gstRate?: number | string;
  tdsTcsType?: "TDS" | "TCS" | "None";
  tdsTcsRate?: number | string;
  adjustmentValue?: number | string;
}

export interface QuoteTotalsCalculation {
  subTotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  tdsTcsType: "TDS" | "TCS" | "None";
  tdsTcsRate: number;
  tdsTcsAmount: number;
  adjustment: number;
  total: number;
}

export function calculateQuoteTotals(params: QuoteTotalsParams): QuoteTotalsCalculation {
  const subTotal = Math.max(0, Number(params.subTotal) || 0);

  // Discount
  let discountAmount = 0;
  if (params.discountAmount !== undefined) {
    discountAmount = Math.min(subTotal, Math.max(0, Number(params.discountAmount) || 0));
  } else {
    const discVal = Math.max(0, Number(params.discountValue) || 0);
    const discountType = params.discountType || "percent";
    if (discountType === "percent") {
      discountAmount = Math.round(((subTotal * discVal) / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(subTotal, discVal);
    }
  }

  // Taxable base
  const taxableAmount = Math.max(0, Math.round((subTotal - discountAmount) * 100) / 100);

  // GST
  const gstRate = Math.max(0, Number(params.gstRate) || 0);
  const gstAmount = Math.round(((taxableAmount * gstRate) / 100) * 100) / 100;

  // TDS / TCS
  const tdsTcsType = params.tdsTcsType === "TDS" || params.tdsTcsType === "TCS" ? params.tdsTcsType : "None";
  const tdsTcsRate = Math.max(0, Number(params.tdsTcsRate) || 0);
  let tdsTcsAmount = 0;
  if (tdsTcsType !== "None" && tdsTcsRate > 0) {
    tdsTcsAmount = Math.round(((taxableAmount * tdsTcsRate) / 100) * 100) / 100;
  }

  // Adjustment
  const adjustment = Number(params.adjustmentValue) || 0;

  // Final Total
  // TDS is deducted from total (- tdsTcsAmount)
  // TCS is collected and added to total (+ tdsTcsAmount)
  let rawTotal = taxableAmount + gstAmount + adjustment;
  if (tdsTcsType === "TDS") {
    rawTotal -= tdsTcsAmount;
  } else if (tdsTcsType === "TCS") {
    rawTotal += tdsTcsAmount;
  }

  const total = Math.max(0, Math.round(rawTotal * 100) / 100);

  return {
    subTotal,
    discountAmount,
    taxableAmount,
    gstRate,
    gstAmount,
    tdsTcsType,
    tdsTcsRate,
    tdsTcsAmount,
    adjustment,
    total,
  };
}
