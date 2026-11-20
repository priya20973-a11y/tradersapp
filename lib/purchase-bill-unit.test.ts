import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { calculateBillTotals, type BillItemInput } from "./bill-utils";
import { PurchaseBill } from "@/models/purchase-bill";

describe("Purchase Bill Item Table Unit Column", () => {
  const billFormPath = path.resolve(__dirname, "../components/purchases/bill-form.tsx");
  const billDetailViewPath = path.resolve(__dirname, "../components/purchases/bill-detail-view.tsx");
  const billApiPath = path.resolve(__dirname, "../app/api/purchases/bills/route.ts");
  const billIdApiPath = path.resolve(__dirname, "../app/api/purchases/bills/[id]/route.ts");
  const purchaseBillModelPath = path.resolve(__dirname, "../models/purchase-bill.ts");

  describe("1. Bill Form (Item Table)", () => {
    const content = fs.readFileSync(billFormPath, "utf-8");

    it("displays Unit column directly after Quantity column in table header", () => {
      // Find the thead header order
      const qtyHeaderMatch = content.indexOf(">Quantity</th>");
      const unitHeaderMatch = content.indexOf(">Unit</th>");
      const rateHeaderMatch = content.indexOf(">Rate (₹)</th>");

      expect(qtyHeaderMatch).toBeGreaterThan(0);
      expect(unitHeaderMatch).toBeGreaterThan(0);
      expect(rateHeaderMatch).toBeGreaterThan(0);

      // Verify Unit immediately follows Quantity
      expect(unitHeaderMatch).toBeGreaterThan(qtyHeaderMatch);
      expect(rateHeaderMatch).toBeGreaterThan(unitHeaderMatch);
    });

    it("renders Unit input directly after Quantity input in table rows", () => {
      const qtyInputMatch = content.indexOf('value={row.quantity}');
      const unitInputMatch = content.indexOf('value={row.unit || ""}');
      const rateInputMatch = content.indexOf('value={row.rate}');

      expect(qtyInputMatch).toBeGreaterThan(0);
      expect(unitInputMatch).toBeGreaterThan(0);
      expect(rateInputMatch).toBeGreaterThan(0);

      expect(unitInputMatch).toBeGreaterThan(qtyInputMatch);
      expect(rateInputMatch).toBeGreaterThan(unitInputMatch);
    });

    it("populates unit automatically when an item is selected from catalog", () => {
      expect(content).toContain("handleSelectItem");
      expect(content).toContain("unit: selected.unit || \"\"");
    });

    it("preserves unit when loading bill in edit mode", () => {
      expect(content).toContain("unit: it.unit ||");
    });
  });

  describe("2. Bill Detail View (Line Items Table)", () => {
    const content = fs.readFileSync(billDetailViewPath, "utf-8");

    it("displays Unit column directly after Quantity/Qty column in table header", () => {
      const qtyHeaderMatch = content.indexOf(">Qty</th>");
      const unitHeaderMatch = content.indexOf(">Unit</th>");
      const rateHeaderMatch = content.indexOf(">Rate</th>");

      expect(qtyHeaderMatch).toBeGreaterThan(0);
      expect(unitHeaderMatch).toBeGreaterThan(0);
      expect(rateHeaderMatch).toBeGreaterThan(0);

      expect(unitHeaderMatch).toBeGreaterThan(qtyHeaderMatch);
      expect(rateHeaderMatch).toBeGreaterThan(unitHeaderMatch);
    });

    it("renders line item unit directly after quantity in table body", () => {
      const qtyRowMatch = content.indexOf("{item.quantity}");
      const unitRowMatch = content.indexOf('{item.unit || "—"}');
      const rateRowMatch = content.indexOf("{formatINR(item.rate)}");

      expect(qtyRowMatch).toBeGreaterThan(0);
      expect(unitRowMatch).toBeGreaterThan(0);
      expect(rateRowMatch).toBeGreaterThan(0);

      expect(unitRowMatch).toBeGreaterThan(qtyRowMatch);
      expect(rateRowMatch).toBeGreaterThan(unitRowMatch);
    });

    it("defines unit property on BillItem interface", () => {
      expect(content).toMatch(/interface\s+BillItem\s*\{[\s\S]*?unit\?: string;[\s\S]*?\}/);
    });
  });

  describe("3. Schema & API handling", () => {
    it("PurchaseBill model schema and TypeScript interface contain unit", () => {
      const content = fs.readFileSync(purchaseBillModelPath, "utf-8");
      expect(content).toMatch(/export interface PurchaseBillItemRecord\s*\{[\s\S]*?unit\?: string;[\s\S]*?\}/);
      expect(content).toMatch(/unit:\s*\{\s*type:\s*String,\s*default:\s*""\s*\}/);
    });

    it("GET and POST in bills API support unit from Item Master", () => {
      const content = fs.readFileSync(billApiPath, "utf-8");
      expect(content).toContain("unit: String(it.unit || \"\")");
      expect(content).toContain("unit: resolvedUnit");
    });

    it("GET and PUT in bill [id] API resolve unit from Item Master and line items", () => {
      const content = fs.readFileSync(billIdApiPath, "utf-8");
      expect(content).toContain("missingUnitItemIds");
      expect(content).toContain("unit: resolvedUnit");
    });
  });

  describe("4. Calculation Preservation with Various Units", () => {
    it("supports various units like pcs, kg, MT, bags without altering calculations", () => {
      const testItems: BillItemInput[] = [
        {
          name: "Standard Widgets",
          account: "Cost of Goods Sold",
          quantity: 50,
          unit: "pcs",
          rate: 120,
          taxRate: 18,
        },
        {
          name: "Bulk Sugar",
          account: "Cost of Goods Sold",
          quantity: 250.75,
          unit: "kg",
          rate: 42,
          taxRate: 5,
        },
        {
          name: "Industrial Steel Coils",
          account: "Cost of Goods Sold",
          quantity: 12.8,
          unit: "MT",
          rate: 65000,
          taxRate: 18,
        },
        {
          name: "Coffee Beans 60kg",
          account: "Cost of Goods Sold",
          quantity: 80,
          unit: "bags",
          rate: 3400,
          taxRate: 5,
        },
      ];

      const totals = calculateBillTotals({
        items: testItems,
        discount: 5000,
        discountType: "amount",
        taxType: "GST",
        isIntraState: true,
        adjustment: 15.5,
      });

      expect(totals.items[0].unit).toBe("pcs");
      expect(totals.items[1].unit).toBe("kg");
      expect(totals.items[2].unit).toBe("MT");
      expect(totals.items[3].unit).toBe("bags");

      expect(totals.items[0].amount).toBe(6000); // 50 * 120
      expect(totals.items[1].amount).toBe(10531.5); // 250.75 * 42
      expect(totals.items[2].amount).toBe(832000); // 12.8 * 65000
      expect(totals.items[3].amount).toBe(272000); // 80 * 3400

      const expectedSubtotal = 6000 + 10531.5 + 832000 + 272000; // 1120531.5
      expect(totals.subTotal).toBe(expectedSubtotal);
      expect(totals.discountAmount).toBe(5000);
      expect(totals.adjustment).toBe(15.5);
    });
  });

  describe("5. Manual Bill Number Entry & Removed Auto-Generation", () => {
    const formContent = fs.readFileSync(billFormPath, "utf-8");
    const routeContent = fs.readFileSync(billApiPath, "utf-8");

    it("does not render Auto-Generated badge or helper text in BillForm", () => {
      expect(formContent).not.toContain("Auto-Generated");
      expect(formContent).not.toContain("Sequential bill number is auto-generated");
      expect(formContent).not.toContain("Auto-generated (e.g. BILL-0001)");
    });

    it("does not auto-populate billNumber from nextBillNumber in BillForm", () => {
      expect(formContent).not.toContain("data.nextBillNumber");
    });

    it("validates that billNumber is manually provided on submission", () => {
      expect(formContent).toContain('if (!billNumber.trim())');
      expect(formContent).toContain('setError("Please enter a bill number.")');
    });

    it("requires billNumber in the POST /api/purchases/bills route without auto-generation", () => {
      expect(routeContent).toContain('if (!billNumber)');
      expect(routeContent).toContain('respondError("Bill number is required.", 400)');
      expect(routeContent).not.toContain("allocateNextBillNumber");
      expect(routeContent).not.toContain("peekNextBillNumber");
    });
  });
});
