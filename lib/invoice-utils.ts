/**
 * lib/invoice-utils.ts
 *
 * Core invoice calculations, Indian currency number-to-words converter,
 * currency formatters, and UPI payment URI generator.
 */

import { roundMoney } from "./accounting";

export interface CalculateItemInput {
  quantity: number;
  rate: number;
  discount?: number;
  discountType?: "percent" | "amount";
  taxRate?: number;
}

export interface CalculatedItemRow {
  quantity: number;
  rate: number;
  discountAmount: number;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
}

export interface CalculateInvoiceInput {
  items: CalculateItemInput[];
  invoiceDiscount?: number;
  invoiceDiscountType?: "percent" | "amount";
  shippingCharges?: number;
  adjustment?: number;
  autoRoundOff?: boolean;
  placeOfSupply?: string;
  organizationState?: string;
  amountPaid?: number;
}

export interface CalculatedInvoiceTotals {
  items: CalculatedItemRow[];
  subTotal: number;
  totalDiscount: number;
  taxableSubtotal: number;
  totalTax: number;
  cgst: number;
  sgst: number;
  igst: number;
  isIntraState: boolean;
  shippingCharges: number;
  adjustment: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  amountInWords: string;
}

/**
 * Calculates item totals, discounts, taxes (CGST/SGST vs IGST), shipping, roundoff, and balance due.
 */
export function calculateInvoiceTotals({
  items,
  invoiceDiscount = 0,
  invoiceDiscountType = "percent",
  shippingCharges = 0,
  adjustment = 0,
  autoRoundOff = true,
  placeOfSupply = "",
  organizationState = "",
  amountPaid = 0,
}: CalculateInvoiceInput): CalculatedInvoiceTotals {
  let subTotal = 0;
  let itemsDiscountTotal = 0;
  let totalTax = 0;

  const isIntraState =
    !placeOfSupply ||
    !organizationState ||
    placeOfSupply.trim().toLowerCase() === organizationState.trim().toLowerCase();

  const calculatedItems: CalculatedItemRow[] = items.map((item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const rate = Math.max(0, Number(item.rate) || 0);
    const rawLine = roundMoney(qty * rate);

    const discValue = Math.max(0, Number(item.discount) || 0);
    let lineDiscount = 0;
    if (item.discountType === "amount") {
      lineDiscount = Math.min(rawLine, roundMoney(discValue));
    } else {
      lineDiscount = roundMoney((rawLine * Math.min(100, discValue)) / 100);
    }

    const taxable = roundMoney(Math.max(0, rawLine - lineDiscount));
    const taxRate = Math.max(0, Number(item.taxRate) || 0);
    const taxAmount = roundMoney((taxable * taxRate) / 100);
    const amount = roundMoney(taxable + taxAmount);

    subTotal += rawLine;
    itemsDiscountTotal += lineDiscount;
    totalTax += taxAmount;

    return {
      quantity: qty,
      rate,
      discountAmount: lineDiscount,
      taxableAmount: taxable,
      taxRate,
      taxAmount,
      amount,
    };
  });

  subTotal = roundMoney(subTotal);
  itemsDiscountTotal = roundMoney(itemsDiscountTotal);

  // Overall invoice level discount
  const invDiscVal = Math.max(0, Number(invoiceDiscount) || 0);
  let overallDiscount = 0;
  const taxableBase = roundMoney(Math.max(0, subTotal - itemsDiscountTotal));

  if (invoiceDiscountType === "amount") {
    overallDiscount = Math.min(taxableBase, roundMoney(invDiscVal));
  } else {
    overallDiscount = roundMoney((taxableBase * Math.min(100, invDiscVal)) / 100);
  }

  const taxableSubtotal = roundMoney(Math.max(0, taxableBase - overallDiscount));
  totalTax = roundMoney(totalTax);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (totalTax > 0) {
    if (isIntraState) {
      cgst = roundMoney(totalTax / 2);
      sgst = roundMoney(totalTax - cgst);
    } else {
      igst = totalTax;
    }
  }

  const safeShipping = roundMoney(Math.max(0, Number(shippingCharges) || 0));
  const safeAdjustment = roundMoney(Number(adjustment) || 0);

  const rawGrandTotal = roundMoney(
    taxableSubtotal + totalTax + safeShipping + safeAdjustment,
  );

  let roundOff = 0;
  let finalGrandTotal = rawGrandTotal;

  if (autoRoundOff) {
    finalGrandTotal = Math.round(rawGrandTotal);
    roundOff = roundMoney(finalGrandTotal - rawGrandTotal);
  }

  const safeAmountPaid = roundMoney(Math.max(0, Number(amountPaid) || 0));
  const balanceDue = roundMoney(Math.max(0, finalGrandTotal - safeAmountPaid));

  return {
    items: calculatedItems,
    subTotal,
    totalDiscount: roundMoney(itemsDiscountTotal + overallDiscount),
    taxableSubtotal,
    totalTax,
    cgst,
    sgst,
    igst,
    isIntraState,
    shippingCharges: safeShipping,
    adjustment: safeAdjustment,
    roundOff,
    grandTotal: finalGrandTotal,
    amountPaid: safeAmountPaid,
    balanceDue,
    amountInWords: numberToIndianWords(finalGrandTotal),
  };
}

/**
 * Format currency in Indian numbering system format (₹1,23,456.78)
 */
export function formatCurrency(
  value: number,
  currencyCode = "INR",
  includeDecimals = true,
): string {
  const safe = Number(value) || 0;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: includeDecimals ? 2 : 0,
      maximumFractionDigits: includeDecimals ? 2 : 0,
    }).format(safe);
  } catch {
    return `₹${safe.toFixed(2)}`;
  }
}

/**
 * Converts a positive number to Indian Words (Lakhs & Crores)
 * e.g., 125000 -> "One Lakh Twenty-Five Thousand Rupees Only"
 */
export function numberToIndianWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  if (rounded === 0) return "Zero Rupees Only";
  if (rounded < 0) return `Minus ${numberToIndianWords(Math.abs(rounded))}`;

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertTwoDigits(n: number): string {
    if (n < 20) return ones[n];
    const ten = Math.floor(n / 10);
    const rest = n % 10;
    return rest > 0 ? `${tens[ten]}-${ones[rest]}` : tens[ten];
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    if (hundred > 0 && rest > 0) {
      return `${ones[hundred]} Hundred ${convertTwoDigits(rest)}`;
    }
    if (hundred > 0) {
      return `${ones[hundred]} Hundred`;
    }
    return convertTwoDigits(rest);
  }

  const integerPart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - integerPart) * 100);

  let num = integerPart;
  const parts: string[] = [];

  // Crores: 10,000,000
  const crore = Math.floor(num / 10000000);
  if (crore > 0) {
    parts.push(`${convertTwoDigits(crore)} Crore`);
    num %= 10000000;
  }

  // Lakhs: 100,000
  const lakh = Math.floor(num / 100000);
  if (lakh > 0) {
    parts.push(`${convertTwoDigits(lakh)} Lakh`);
    num %= 100000;
  }

  // Thousands: 1,000
  const thousand = Math.floor(num / 1000);
  if (thousand > 0) {
    parts.push(`${convertTwoDigits(thousand)} Thousand`);
    num %= 1000;
  }

  // Hundreds & rest
  if (num > 0) {
    parts.push(convertThreeDigits(num));
  }

  let result = parts.filter(Boolean).join(" ");
  result = result ? `${result} Rupees` : "";

  if (decimalPart > 0) {
    const paiseText = convertTwoDigits(decimalPart);
    result = result ? `${result} and ${paiseText} Paise` : `${paiseText} Paise`;
  }

  return `${result} Only`;
}

/**
 * Generates UPI intent URL for generating QR code and direct pay links
 */
export function generateUpiQrString({
  upiId,
  payeeName,
  amount,
  transactionRef,
  note,
}: {
  upiId: string;
  payeeName: string;
  amount: number;
  transactionRef: string;
  note?: string;
}): string {
  const cleanUpi = upiId.trim();
  const cleanName = payeeName.trim();
  const cleanAmount = (Math.max(0, amount) || 0).toFixed(2);
  const cleanRef = transactionRef.trim();
  const cleanNote = (note || `Invoice ${cleanRef}`).trim();

  const params = new URLSearchParams({
    pa: cleanUpi,
    pn: cleanName,
    am: cleanAmount,
    cu: "INR",
    tn: cleanNote,
    tr: cleanRef,
  });

  return `upi://pay?${params.toString()}`;
}
