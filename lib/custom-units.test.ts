import { describe, it, expect } from "vitest";
import { unitInputSchema } from "@/app/api/units/route";
import { getAllUnitsList, type UnitOption } from "@/components/items/unit-storage";
import { standardUnits } from "@/components/items/item-constants";
import fs from "node:fs";
import path from "node:path";

describe("Custom Measurement Units Feature", () => {
  describe("API Schema Validation (unitInputSchema)", () => {
    it("validates valid unit name with code", () => {
      const result = unitInputSchema.safeParse({
        name: "Crate",
        code: "crt",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Crate");
        expect(result.data.code).toBe("crt");
      }
    });

    it("rejects empty unit name", () => {
      const result = unitInputSchema.safeParse({
        name: "   ",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toBeDefined();
      }
    });

    it("accepts custom label and value overrides", () => {
      const result = unitInputSchema.safeParse({
        name: "Metric Bale",
        code: "bale",
        value: "bale_custom",
        label: "bale (Metric Bales)",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe("bale_custom");
        expect(result.data.label).toBe("bale (Metric Bales)");
      }
    });
  });

  describe("Unit Storage and Deduplication Logic", () => {
    it("includes standard units by default", () => {
      const units = getAllUnitsList([]);
      expect(units.length).toBeGreaterThanOrEqual(standardUnits.length);
      expect(units.some((u) => u.value === "pcs")).toBe(true);
      expect(units.some((u) => u.value === "kg")).toBe(true);
      expect(units.some((u) => u.value === "bag")).toBe(true);
    });

    it("merges custom units and deduplicates case-insensitively", () => {
      const custom: UnitOption[] = [
        { value: "crate", label: "crate (Crates)" },
        { value: "PCS", label: "Pieces Duplicate" }, // duplicate of pcs
        { value: "bale", label: "bale (Bales)" },
      ];
      const merged = getAllUnitsList(custom);
      expect(merged.some((u) => u.value === "crate")).toBe(true);
      expect(merged.some((u) => u.value === "bale")).toBe(true);

      // Verify "pcs" is not duplicated
      const pcsUnits = merged.filter((u) => u.value.toLowerCase() === "pcs");
      expect(pcsUnits.length).toBe(1);
    });
  });

  describe("Commodity Form Code Integrity", () => {
    it("contains 'Add New Unit' option in the Unit of Measurement field in NewItemForm", () => {
      const filePath = path.join(process.cwd(), "components", "items", "new-item-form.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("Unit of Measurement");
      expect(content).toContain("Add New Unit");
      expect(content).toContain("ADD_NEW_UNIT");
      expect(content).toContain("<AddUnitModal");
    });

    it("contains AddUnitModal with proper fields and accessible controls", () => {
      const filePath = path.join(process.cwd(), "components", "items", "add-unit-modal.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("Add New Unit");
      expect(content).toContain("Unit Name");
      expect(content).toContain("Unit Symbol / Abbreviation");
      expect(content).toContain("/api/units");
      expect(content).toContain("saveStoredCustomUnit");
    });
  });
});
