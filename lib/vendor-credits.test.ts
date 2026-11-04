import { describe, expect, it } from "vitest";
import {
  calculateCreditTotals,
  TCS_RATES,
  vendorCreditAttachmentSchema,
  vendorCreditItemSchema,
  vendorCreditSchema,
} from "./vendor-credit-utils";

describe("Vendor Credits Module", () => {
  describe("Credit Calculations Engine", () => {
    it("calculates basic line subtotal correctly", () => {
      const result = calculateCreditTotals({
        items: [
          { quantity: 5, rate: 100 },
          { quantity: 2.5, rate: 200 },
        ],
        discount: 0,
      });

      expect(result.subTotal).toBe(1000);
      expect(result.discountAmount).toBe(0);
      expect(result.taxableAmount).toBe(1000);
      expect(result.total).toBe(1000);
    });

    it("applies percentage discount accurately", () => {
      const result = calculateCreditTotals({
        items: [{ quantity: 10, rate: 100 }], // 1000 subtotal
        discount: 10,
        discountType: "percent",
      });

      expect(result.subTotal).toBe(1000);
      expect(result.discountAmount).toBe(100);
      expect(result.taxableAmount).toBe(900);
      expect(result.total).toBe(900);
    });

    it("applies fixed amount discount accurately", () => {
      const result = calculateCreditTotals({
        items: [{ quantity: 4, rate: 250 }], // 1000 subtotal
        discount: 150,
        discountType: "amount",
      });

      expect(result.subTotal).toBe(1000);
      expect(result.discountAmount).toBe(150);
      expect(result.taxableAmount).toBe(850);
      expect(result.total).toBe(850);
    });

    it("caps discount amount to subtotal (never negative taxable amount)", () => {
      const result = calculateCreditTotals({
        items: [{ quantity: 2, rate: 100 }], // 200 subtotal
        discount: 500,
        discountType: "amount",
      });

      expect(result.discountAmount).toBe(200);
      expect(result.taxableAmount).toBe(0);
      expect(result.total).toBe(0);
    });

    it("calculates intra-state GST with 50/50 split (CGST + SGST)", () => {
      const result = calculateCreditTotals({
        items: [{ quantity: 10, rate: 100 }], // 1000
        discount: 0,
        taxType: "GST",
        taxRate: 18,
        isIntraState: true,
      });

      expect(result.taxableAmount).toBe(1000);
      expect(result.taxAmount).toBe(180);
      expect(result.cgst).toBe(90);
      expect(result.sgst).toBe(90);
      expect(result.igst).toBe(0);
      expect(result.total).toBe(1180);
    });

    it("calculates inter-state GST with 100% IGST", () => {
      const result = calculateCreditTotals({
        items: [{ quantity: 10, rate: 100 }], // 1000
        discount: 0,
        taxType: "GST",
        taxRate: 18,
        isIntraState: false,
      });

      expect(result.taxableAmount).toBe(1000);
      expect(result.taxAmount).toBe(180);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.igst).toBe(180);
      expect(result.total).toBe(1180);
    });

    it("applies TDS as a tax deduction (withholding reduces net credit)", () => {
      const result = calculateCreditTotals({
        items: [{ quantity: 10, rate: 1000 }], // 10,000 subtotal
        discount: 0,
        taxType: "TDS",
        taxRate: 2, // 2% TDS under Sec 194C
      });

      expect(result.taxableAmount).toBe(10000);
      expect(result.taxAmount).toBe(-200); // negative deduction
      expect(result.total).toBe(9800);
    });

    it("applies TCS as a tax addition (increases net credit)", () => {
      const result = calculateCreditTotals({
        items: [{ quantity: 10, rate: 1000 }], // 10,000 subtotal
        discount: 0,
        taxType: "TCS",
        taxRate: 0.1, // 0.1% TCS
      });

      expect(result.taxableAmount).toBe(10000);
      expect(result.taxAmount).toBe(10);
      expect(result.total).toBe(10010);
    });

    it("incorporates positive and negative adjustments correctly", () => {
      const resultPos = calculateCreditTotals({
        items: [{ quantity: 1, rate: 500 }],
        discount: 0,
        adjustment: 25.5,
      });
      expect(resultPos.total).toBe(525.5);

      const resultNeg = calculateCreditTotals({
        items: [{ quantity: 1, rate: 500 }],
        discount: 0,
        adjustment: -20,
      });
      expect(resultNeg.total).toBe(480);
    });

    it("guarantees total cannot fall below zero", () => {
      const result = calculateCreditTotals({
        items: [{ quantity: 1, rate: 100 }],
        discount: 0,
        adjustment: -250,
      });
      expect(result.total).toBe(0);
    });
  });

  describe("Validation & Constraints Schema", () => {
    const validPayload = {
      vendorId: "vendor_123",
      vendorName: "Acme Supplies Ltd",
      orderNumber: "PO-2026-004",
      vendorCreditDate: "2026-10-23",
      subject: "Credit for returned damaged stock",
      accountsPayable: "Accounts Payable",
      items: [
        {
          name: "Organic Wheat Seeds",
          description: "Batch #441 returns",
          account: "Cost of Goods Sold",
          quantity: 10,
          rate: 150,
        },
      ],
      discount: 5,
      discountType: "percent" as const,
      taxType: "GST" as const,
      taxRate: 18,
      adjustment: 0,
      notes: "Goods returned in original packaging.",
      status: "Open" as const,
      attachments: [],
    };

    it("validates a compliant vendor credit successfully", () => {
      const parseResult = vendorCreditSchema.safeParse(validPayload);
      expect(parseResult.success).toBe(true);
    });

    it("rejects missing vendor selection", () => {
      const invalid = { ...validPayload, vendorId: "", vendorName: "" };
      const parseResult = vendorCreditSchema.safeParse(invalid);
      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((i) => i.message);
        expect(errorMessages).toContain("Vendor selection is required");
      }
    });

    it("rejects missing vendor credit date", () => {
      const invalid = { ...validPayload, vendorCreditDate: "" };
      const parseResult = vendorCreditSchema.safeParse(invalid);
      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        expect(parseResult.error.issues[0].message).toContain("Vendor credit date is required");
      }
    });

    it("rejects empty line items array", () => {
      const invalid = { ...validPayload, items: [] };
      const parseResult = vendorCreditSchema.safeParse(invalid);
      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        expect(parseResult.error.issues[0].message).toContain("At least one item line is required");
      }
    });

    it("rejects line item with zero or negative quantity", () => {
      const invalidItem = {
        name: "Test Item",
        quantity: 0,
        rate: 100,
      };
      const parseResult = vendorCreditItemSchema.safeParse(invalidItem);
      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        expect(parseResult.error.issues[0].message).toContain("Quantity must be greater than 0");
      }
    });

    it("enforces maximum 250 characters for subject", () => {
      const longSubject = "A".repeat(251);
      const invalid = { ...validPayload, subject: longSubject };
      const parseResult = vendorCreditSchema.safeParse(invalid);
      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        expect(parseResult.error.issues[0].message).toContain("Subject cannot exceed 250 characters");
      }

      const validSubject = "A".repeat(250);
      const valid = { ...validPayload, subject: validSubject };
      expect(vendorCreditSchema.safeParse(valid).success).toBe(true);
    });

    it("enforces attachment constraints (max 5 attachments)", () => {
      const attachment = {
        name: "receipt.pdf",
        size: 1024 * 500, // 500 KB
        type: "application/pdf",
      };

      const validAttachments = Array(5).fill(attachment);
      const valid = { ...validPayload, attachments: validAttachments };
      expect(vendorCreditSchema.safeParse(valid).success).toBe(true);

      const tooManyAttachments = Array(6).fill(attachment);
      const invalid = { ...validPayload, attachments: tooManyAttachments };
      const parseResult = vendorCreditSchema.safeParse(invalid);
      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        expect(parseResult.error.issues[0].message).toContain("Maximum 5 attachments allowed");
      }
    });

    it("enforces maximum attachment size (10 MB per file)", () => {
      const oversizedAttachment = {
        name: "heavy-video.mp4",
        size: 11 * 1024 * 1024, // 11 MB > 10 MB
        type: "video/mp4",
      };
      const parseResult = vendorCreditAttachmentSchema.safeParse(oversizedAttachment);
      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        expect(parseResult.error.issues[0].message).toContain("File size cannot exceed 10 MB");
      }

      const validSizeAttachment = {
        name: "scanned_doc.pdf",
        size: 9.9 * 1024 * 1024, // 9.9 MB <= 10 MB
        type: "application/pdf",
      };
      expect(vendorCreditAttachmentSchema.safeParse(validSizeAttachment).success).toBe(true);
    });

    it("validates TCS rate options table", () => {
      expect(TCS_RATES.length).toBeGreaterThanOrEqual(4);
      const rates = TCS_RATES.map((r) => r.rate);
      expect(rates).toContain(0.075);
      expect(rates).toContain(0.1);
      expect(rates).toContain(1);
    });
  });
});
