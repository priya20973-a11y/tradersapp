import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { standardUnits } from "@/components/items/item-constants";
import { getAllUnitsList, type UnitOption } from "@/components/items/unit-storage";
import { purchaseOrderItemSchema, purchaseOrderInputSchema } from "@/app/api/purchases/purchase-orders/route";

describe("Purchase Order Procurement Items Unit Dropdown Feature", () => {
  describe("1. Standard and Configured System Units", () => {
    it("includes MT (Metric Tonnes) in standard units configuration", () => {
      const mtUnit = standardUnits.find((u) => u.value === "MT");
      expect(mtUnit).toBeDefined();
      expect(mtUnit?.label).toContain("Metric Tonnes");
    });

    it("includes standard agricultural and commodity trading units (pcs, kg, MT, box, bag, tonne, qtl)", () => {
      const unitValues = standardUnits.map((u) => u.value.toLowerCase());
      expect(unitValues).toContain("pcs");
      expect(unitValues).toContain("kg");
      expect(unitValues).toContain("mt");
      expect(unitValues).toContain("box");
      expect(unitValues).toContain("bag");
      expect(unitValues).toContain("tonne");
      expect(unitValues).toContain("qtl");
    });

    it("getAllUnitsList includes standard units and merges custom units without duplicates", () => {
      const customUnits: UnitOption[] = [
        { value: "crate", label: "crate (Crates)" },
        { value: "MT", label: "MT Duplicate" },
      ];
      const merged = getAllUnitsList(customUnits);

      expect(merged.some((u) => u.value === "MT")).toBe(true);
      expect(merged.some((u) => u.value === "crate")).toBe(true);
      expect(merged.some((u) => u.value === "kg")).toBe(true);
      expect(merged.some((u) => u.value === "box")).toBe(true);
      expect(merged.some((u) => u.value === "pcs")).toBe(true);

      // Verify no duplicate MT
      const mtEntries = merged.filter((u) => u.value.toLowerCase() === "mt");
      expect(mtEntries).toHaveLength(1);
    });
  });

  describe("2. Purchase Order Schema & Unit Persistence Contract", () => {
    it("accepts and validates line items with units such as MT, kg, box, pcs", () => {
      const unitsToTest = ["MT", "kg", "box", "pcs", "bag", "tonne", "qtl", "bundle"];

      for (const unit of unitsToTest) {
        const item = {
          name: "Test Commodity",
          quantity: 10,
          unit,
          rate: 1000,
        };
        const parsed = purchaseOrderItemSchema.safeParse(item);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.unit).toBe(unit);
        }
      }
    });

    it("validates full PO payload with MT unit and preserves unit in data", () => {
      const poPayload = {
        purchaseOrderNumber: "PO-2026-0888",
        vendorName: "Maharashtra Agro Mandi",
        orderDate: "2026-11-21",
        items: [
          {
            name: "Milling Wheat Sharbati",
            quantity: 25,
            unit: "MT",
            rate: 28000,
            account: "Cost of Goods Sold",
          },
          {
            name: "Cotton Seed Cake",
            quantity: 100,
            unit: "bag",
            rate: 2200,
            account: "Cost of Goods Sold",
          },
          {
            name: "Refined Soy Oil",
            quantity: 50,
            unit: "box",
            rate: 1800,
            account: "Cost of Goods Sold",
          },
        ],
      };

      const parsed = purchaseOrderInputSchema.safeParse(poPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.items[0].unit).toBe("MT");
        expect(parsed.data.items[1].unit).toBe("bag");
        expect(parsed.data.items[2].unit).toBe("box");
      }
    });
  });

  describe("3. PurchaseOrderForm UI Component Integrity", () => {
    const formPath = path.resolve(process.cwd(), "components/purchases/purchase-order-form.tsx");
    const formContent = fs.readFileSync(formPath, "utf-8");

    it("replaces manual unit text input with SearchableUnitDropdown in Procurement Items table", () => {
      // Must NOT contain the old manual text input for unit
      expect(formContent).not.toContain('<input type="text" placeholder="Unit"');

      // Must contain SearchableUnitDropdown
      expect(formContent).toContain("<SearchableUnitDropdown");
      expect(formContent).toContain("SearchableUnitDropdown");
      expect(formContent).toContain('updateItemRow(idx, "unit",');
    });

    it("implements searchable dropdown with search input and unit list", () => {
      expect(formContent).toContain("Search unit (kg, MT, pcs)...");
      expect(formContent).toContain("allAvailableUnits");
      expect(formContent).toContain("filteredUnits");
      expect(formContent).toContain("role=\"combobox\"");
      expect(formContent).toContain("role=\"listbox\"");
      expect(formContent).toContain("role=\"option\"");
    });

    it("retains existing unit when editing a Purchase Order", () => {
      // In SearchableUnitDropdown, allAvailableUnits includes any custom/existing value not in unitsList
      expect(formContent).toContain("if (value && value.trim())");
      expect(formContent).toContain("map.set(key, { value: value.trim(), label:");
      expect(formContent).toContain("displayUnit = value || \"pcs\"");
    });

    it("fetches units dynamically from /api/units and listens for custom units updates", () => {
      expect(formContent).toContain('fetch("/api/units")');
      expect(formContent).toContain("custom_units_updated");
      expect(formContent).toContain("getAllUnitsList");
    });
  });
});
