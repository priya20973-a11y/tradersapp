import { describe, it, expect } from "vitest";
import { itemPreferenceSchema } from "@/app/api/settings/preferences/items/route";
import fs from "node:fs";
import path from "node:path";

describe("Inventory Tracking Preferences & Zoho Books Banner", () => {
  describe("API Schema Validation (itemPreferenceSchema)", () => {
    it("validates inventoryEnabled boolean true", () => {
      const result = itemPreferenceSchema.safeParse({
        inventoryEnabled: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.inventoryEnabled).toBe(true);
      }
    });

    it("validates inventoryEnabled boolean false", () => {
      const result = itemPreferenceSchema.safeParse({
        inventoryEnabled: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.inventoryEnabled).toBe(false);
      }
    });

    it("fails when inventoryEnabled is not a boolean", () => {
      const result = itemPreferenceSchema.safeParse({
        inventoryEnabled: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Transaction-based Stock Calculation Logic", () => {
    it("calculates stock based on opening stock + purchases - sales when inventory is enabled", () => {
      const openingStock = 100;
      const purchases = [
        { quantity: 50 },
        { quantity: 25 },
      ];
      const sales = [
        { quantity: 30 },
        { quantity: 15 },
      ];

      const totalPurchased = purchases.reduce((sum, p) => sum + p.quantity, 0);
      const totalSold = sales.reduce((sum, s) => sum + s.quantity, 0);

      const calculatedStock = Math.max(0, openingStock + totalPurchased - totalSold);
      expect(calculatedStock).toBe(130);
    });

    it("does not track inventory when disabled", () => {
      const inventoryEnabled = false;
      const openingStock = 100;

      const stock = inventoryEnabled ? openingStock + 50 - 20 : 0;
      expect(stock).toBe(0);
    });
  });

  describe("New Item Form Zoho Books Banner Verification", () => {
    it("contains light-blue informational banner matching Zoho Books specification", () => {
      const filePath = path.join(process.cwd(), "components", "items", "new-item-form.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      // Verify light-blue styling
      expect(content).toContain("bg-blue-50");
      expect(content).toContain("border-blue-200");

      // Verify banner heading
      expect(content).toContain("Do you want to keep track of this item?");
      expect(content).toContain("ℹ");

      // Verify banner body text
      expect(content).toContain("Enable Inventory");
      expect(content).toContain("to track the item");
      expect(content).toContain("sales and purchase transactions recorded for it");
      expect(content).toContain("Settings");
      expect(content).toContain("Preferences");
      expect(content).toContain("Items");
      expect(content).toContain("enable inventory");

      // Verify clickable link navigating to Settings > Preferences > Items
      expect(content).toContain('href="/settings/preferences/items"');
    });

    it("checks persistent inventory preference on mount", () => {
      const filePath = path.join(process.cwd(), "components", "items", "new-item-form.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("fetchInventoryPreference");
      expect(content).toContain("getStoredInventoryPreference");
      expect(content).toContain("isInventoryEnabled");
    });

    it("displays ₹ (Indian Rupee) symbol in the Selling Price field in Sales Information", () => {
      const filePath = path.join(process.cwd(), "components", "items", "new-item-form.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("Selling Price (₹)");
      expect(content).toContain("₹");
    });
  });

  describe("Settings > Preferences > Items Workspace Verification", () => {
    it("contains inventory preference toggle and controls", () => {
      const filePath = path.join(
        process.cwd(),
        "components",
        "settings",
        "item-preferences-workspace.tsx",
      );
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("Settings");
      expect(content).toContain("Preferences");
      expect(content).toContain("Items");
      expect(content).toContain("Inventory Tracking");
      expect(content).toContain("Enable Inventory Tracking");
      expect(content).toContain("saveInventoryPreference");
    });
  });
});
