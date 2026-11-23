import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { vendorCreditItemSchema } from "./vendor-credit-utils";
import { standardUnits } from "@/components/items/item-constants";
import { getAllUnitsList } from "@/components/items/unit-storage";

describe("Vendor Credit Line Items UI & Unit / Catalog Integration", () => {
  const formPath = path.resolve(
    process.cwd(),
    "components/purchases/vendor-credit-form.tsx",
  );
  const formContent = fs.readFileSync(formPath, "utf-8");

  const modelPath = path.resolve(process.cwd(), "models/vendor-credit.ts");
  const modelContent = fs.readFileSync(modelPath, "utf-8");

  const apiRoutePath = path.resolve(
    process.cwd(),
    "app/api/purchases/vendor-credits/route.ts",
  );
  const apiRouteContent = fs.readFileSync(apiRoutePath, "utf-8");

  const apiIdRoutePath = path.resolve(
    process.cwd(),
    "app/api/purchases/vendor-credits/[id]/route.ts",
  );
  const apiIdRouteContent = fs.readFileSync(apiIdRoutePath, "utf-8");

  it("1. should validate that vendorCreditItemSchema includes unit with default pcs", () => {
    const parsedDefault = vendorCreditItemSchema.parse({
      name: "Wheat Sharbati",
      quantity: 5,
      rate: 2200,
    });
    expect(parsedDefault.unit).toBe("pcs");

    const parsedCustom = vendorCreditItemSchema.parse({
      name: "Soybean High Protein",
      quantity: 10,
      unit: "MT",
      rate: 45000,
    });
    expect(parsedCustom.unit).toBe("MT");
  });

  it("2. should verify that the separate Catalog dropdown is removed from the row UI", () => {
    // There must be no separate <option value="">Catalog</option> dropdown in the item row
    expect(formContent).not.toContain('<option value="">Catalog</option>');
    expect(formContent).not.toContain('title="Pick item from catalog"');
  });

  it("3. should verify that SearchableItemCombobox is integrated into the Item name field", () => {
    expect(formContent).toContain("SearchableItemCombobox");
    expect(formContent).toContain("onSelectCatalogItem");
    expect(formContent).toContain("placeholder=\"Item name or commodity details…\"");
  });

  it("4. should verify that a Unit column with SearchableUnitDropdown is positioned next to Quantity", () => {
    // Header check
    expect(formContent).toMatch(
      /<th[^>]*>Quantity<\/th>\s*<th[^>]*>Unit<\/th>/,
    );

    // Body check: SearchableUnitDropdown used for row.unit
    expect(formContent).toContain("<SearchableUnitDropdown");
    expect(formContent).toContain('value={row.unit || "pcs"}');
    expect(formContent).toContain('handleItemChange(row.id, "unit"');
  });

  it("5. should populate Unit options using system units (kg, MT, pcs, box, bag, etc.)", () => {
    expect(formContent).toContain("getAllUnitsList");
    expect(formContent).toContain("getStoredCustomUnits");

    const allUnits = getAllUnitsList([]);
    const unitValues = allUnits.map((u) => u.value);
    expect(unitValues).toContain("pcs");
    expect(unitValues).toContain("kg");
    expect(unitValues).toContain("MT");
    expect(unitValues).toContain("box");
    expect(unitValues).toContain("bag");
    expect(unitValues).toContain("tonne");
    expect(unitValues).toContain("qtl");
  });

  it("6. should retain selected item, catalog, and unit when editing Vendor Credits", () => {
    // Edit mode mapping includes unit
    expect(formContent).toContain('unit: String(it.unit || "pcs")');
    // Bulk add maps item unit
    expect(formContent).toContain('unit: it.unit || "pcs"');
    // Selecting catalog item populates unit
    expect(formContent).toContain('unit: matched.unit || row.unit || "pcs"');
  });

  it("7. should persist unit to database via POST and PUT API endpoints", () => {
    // Model schema includes unit
    expect(modelContent).toContain('unit: { type: String, default: "pcs" }');

    // POST route maps unit
    expect(apiRouteContent).toContain('unit: it.unit || "pcs"');

    // PUT route maps unit
    expect(apiIdRouteContent).toContain('unit: it.unit || "pcs"');
  });
});
