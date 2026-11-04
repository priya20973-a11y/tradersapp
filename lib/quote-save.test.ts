import { describe, expect, it } from "vitest";
import { isValidObjectId } from "mongoose";
import { createSchema } from "@/app/api/sales/schemas";
import { calculateQuoteTotals } from "@/lib/quote-tax-utils";

describe("Quote Creation & Saving Validation Suite", () => {
  const validMongoId = "507f1f77bcf86cd799439011";
  const validCustId = "671e2b4c1234567890abcdef";
  const validOrgId = "671e2b4c1234567890fedcba";

  it("validates successful quote creation payload with organizationId", () => {
    const payload = {
      type: "Quote",
      organizationId: validOrgId,
      customerId: validCustId,
      number: "QUO-0001",
      referenceNumber: "REF-2026-001",
      issueDate: "2026-10-27",
      expiryDate: "2026-11-27",
      subject: "Annual Software License Estimate",
      customerNotes: "Thanks for your business.",
      termsAndConditions: "Payment due within 30 days.",
      subTotal: 10000,
      discount: 1000,
      discountType: "percent",
      taxType: "GST",
      taxName: "GST 18%",
      taxRate: 18,
      taxAmount: 1620,
      tdsTcsType: "TDS",
      tdsTcsName: "Commission or Brokerage",
      tdsTcsRate: 2,
      tdsTcsAmount: 180,
      adjustment: 0,
      total: 10440,
      status: "Draft",
      items: [
        {
          itemId: validMongoId,
          name: "Enterprise ERP License",
          description: "Full suite license",
          quantity: 1,
          rate: 10000,
          amount: 10000,
        },
      ],
      notes: "Internal notes",
    };

    const parsed = createSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "Quote") {
      expect(parsed.data.type).toBe("Quote");
      expect(parsed.data.customerId).toBe(validCustId);
      expect(parsed.data.organizationId).toBe(validOrgId);
      expect(parsed.data.total).toBe(10440);
      expect(parsed.data.items).toHaveLength(1);
      expect(parsed.data.items?.[0].itemId).toBe(validMongoId);
    }
  });

  it("allows quote creation without explicit organizationId in payload (server resolves it)", () => {
    const payload = {
      type: "Quote",
      customerId: validCustId,
      number: "QUO-0002",
      total: 5000,
      subTotal: 5000,
      items: [
        {
          name: "Consulting Hour",
          quantity: 2,
          rate: 2500,
          amount: 5000,
        },
      ],
    };

    const parsed = createSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "Quote") {
      expect(parsed.data.customerId).toBe(validCustId);
      expect(parsed.data.total).toBe(5000);
    }
  });

  it("sanitizes demo item IDs and non-ObjectId SKUs to prevent Mongoose CastError", () => {
    const rawItems = [
      { itemId: "demo-1", name: "Wheat 10kg", quantity: 2, rate: 1280, amount: 2560 },
      { itemId: "SKU-1001", name: "Rice 25kg", quantity: 1, rate: 2200, amount: 2200 },
      { itemId: "", name: "Custom Service", quantity: 1, rate: 500, amount: 500 },
      { itemId: validMongoId, name: "Database Item", quantity: 3, rate: 1000, amount: 3000 },
      { itemId: undefined, name: "Ad-hoc Item", quantity: 1, rate: 100, amount: 100 },
    ];

    // Sanitization logic used in route.ts and new-quote-form.tsx
    const sanitized = rawItems.map((it) => ({
      ...it,
      itemId: it.itemId && isValidObjectId(it.itemId) ? it.itemId : undefined,
    }));

    expect(sanitized[0].itemId).toBeUndefined();
    expect(sanitized[1].itemId).toBeUndefined();
    expect(sanitized[2].itemId).toBeUndefined();
    expect(sanitized[3].itemId).toBe(validMongoId);
    expect(sanitized[4].itemId).toBeUndefined();

    // Verify all sanitized items conform to Mongoose subdocument expectations
    sanitized.forEach((it) => {
      if (it.itemId) {
        expect(isValidObjectId(it.itemId)).toBe(true);
      } else {
        expect(it.itemId).toBeUndefined();
      }
    });
  });

  it("recomputes and verifies financial totals accurately before quote saving", () => {
    const verified = calculateQuoteTotals({
      subTotal: 20000,
      discountAmount: 2000,
      gstRate: 18,
      tdsTcsType: "TDS",
      tdsTcsRate: 2,
      adjustmentValue: 15,
    });

    // Subtotal: 20,000 - Discount 2,000 = Taxable: 18,000
    // GST 18% of 18,000 = 3,240
    // TDS 2% of 18,000 = 360 (deducted)
    // Adjustment = +15
    // Total = 18,000 + 3,240 - 360 + 15 = 20,895
    expect(verified.taxableAmount).toBe(18000);
    expect(verified.gstAmount).toBe(3240);
    expect(verified.tdsTcsAmount).toBe(360);
    expect(verified.total).toBe(20895);
  });

  it("rejects invalid customerId that is not a valid ObjectId", () => {
    const invalidPayload = {
      type: "Quote",
      customerId: "not-a-valid-object-id",
      total: 1000,
    };

    const parsed = createSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });

  it("rejects quote with negative total", () => {
    const invalidPayload = {
      type: "Quote",
      customerId: validCustId,
      total: -50,
    };

    const parsed = createSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });
});
