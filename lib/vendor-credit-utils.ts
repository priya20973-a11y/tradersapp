import { z } from "zod";

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_ATTACHMENTS_COUNT = 5;

export const TCS_RATES = [
  { label: "0.075% TCS (Sale of Goods Sec 206C(1H))", rate: 0.075 },
  { label: "0.1% TCS (Standard Sec 206C(1H))", rate: 0.1 },
  { label: "1% TCS (Scrap / Minerals)", rate: 1 },
  { label: "5% TCS (Remittance under LRS)", rate: 5 },
];

export const vendorCreditItemSchema = z.object({
  itemId: z.string().optional(),
  name: z.string().trim().min(1, "Item details name is required"),
  description: z.string().default(""),
  account: z.string().default("Cost of Goods Sold"),
  quantity: z.coerce.number().min(0.001, "Quantity must be greater than 0").default(1),
  rate: z.coerce.number().min(0, "Rate must be 0 or positive").default(0),
  taxRate: z.coerce.number().default(0),
  amount: z.coerce.number().default(0),
});

export const vendorCreditAttachmentSchema = z.object({
  name: z.string().min(1, "Attachment name is required"),
  size: z.number().max(MAX_ATTACHMENT_SIZE, "File size cannot exceed 10 MB"),
  type: z.string().default(""),
  dataUrl: z.string().optional().default(""),
  uploadedAt: z.coerce.date().optional(),
});

export const vendorCreditSchema = z.object({
  creditNoteNumber: z.string().trim().optional().default(""),
  vendorId: z.string().trim().min(1, "Vendor selection is required"),
  vendorName: z.string().trim().min(1, "Vendor name is required"),
  orderNumber: z.string().trim().default(""),
  vendorCreditDate: z.string().min(1, "Vendor credit date is required"),
  subject: z.string().trim().max(250, "Subject cannot exceed 250 characters").default(""),
  accountsPayable: z.string().default("Accounts Payable"),
  items: z.array(vendorCreditItemSchema).min(1, "At least one item line is required"),
  discount: z.coerce.number().min(0, "Discount cannot be negative").default(0),
  discountType: z.enum(["percent", "amount"]).default("percent"),
  taxType: z.enum(["GST", "TDS", "TCS", "None"]).default("GST"),
  taxRate: z.coerce.number().default(0),
  adjustment: z.coerce.number().default(0),
  notes: z.string().default(""),
  status: z.enum(["Draft", "Open", "Partially Applied", "Closed", "Void"]).default("Open"),
  attachments: z.array(vendorCreditAttachmentSchema).max(MAX_ATTACHMENTS_COUNT, "Maximum 5 attachments allowed").default([]),
});

export type VendorCreditInput = z.infer<typeof vendorCreditSchema>;

export interface CreditCalculationOutput {
  subTotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  adjustment: number;
  total: number;
}

/**
 * Calculates subtotal, discount, taxes (GST, TDS, TCS), adjustment, and total for vendor credits.
 */
export function calculateCreditTotals({
  items,
  discount,
  discountType = "percent",
  taxType = "GST",
  taxRate = 0,
  isIntraState = true,
  adjustment = 0,
}: {
  items: { quantity: number; rate: number; taxRate?: number }[];
  discount: number;
  discountType?: "percent" | "amount";
  taxType?: "GST" | "TDS" | "TCS" | "None";
  taxRate?: number;
  isIntraState?: boolean;
  adjustment?: number;
}): CreditCalculationOutput {
  // 1. Subtotal
  let rawSubTotal = 0;
  for (const it of items) {
    const qty = Math.max(0, Number(it.quantity) || 0);
    const rt = Math.max(0, Number(it.rate) || 0);
    rawSubTotal += qty * rt;
  }
  const subTotal = Math.round(rawSubTotal * 100) / 100;

  // 2. Discount
  let discountAmount = 0;
  if (discountType === "percent") {
    discountAmount = Math.round(((subTotal * (Number(discount) || 0)) / 100) * 100) / 100;
  } else {
    discountAmount = Math.round((Number(discount) || 0) * 100) / 100;
  }
  discountAmount = Math.min(discountAmount, subTotal);

  // 3. Taxable Amount
  const taxableAmount = Math.max(0, Math.round((subTotal - discountAmount) * 100) / 100);

  // 4. Tax
  let taxAmount = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (taxType === "GST" && taxRate > 0) {
    taxAmount = Math.round(((taxableAmount * taxRate) / 100) * 100) / 100;
    if (isIntraState) {
      cgst = Math.round((taxAmount / 2) * 100) / 100;
      sgst = Math.round((taxAmount - cgst) * 100) / 100;
      igst = 0;
    } else {
      igst = taxAmount;
      cgst = 0;
      sgst = 0;
    }
  } else if (taxType === "TCS" && taxRate > 0) {
    // TCS is added to total invoice/credit amount
    taxAmount = Math.round(((taxableAmount * taxRate) / 100) * 100) / 100;
  } else if (taxType === "TDS" && taxRate > 0) {
    // TDS is a withholding deduction
    taxAmount = -Math.round(((taxableAmount * taxRate) / 100) * 100) / 100;
  }

  // 5. Total
  const adj = Math.round((Number(adjustment) || 0) * 100) / 100;
  const rawTotal = taxableAmount + taxAmount + adj;
  const total = Math.max(0, Math.round(rawTotal * 100) / 100);

  return {
    subTotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    cgst,
    sgst,
    igst,
    adjustment: adj,
    total,
  };
}

