import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { formatCommodityNameWithUnit } from "./commodity-utils";

describe("Commodity Unit Display in Shop Stock and Warehouse Stock", () => {
  it("formats commodity name with unit in uppercase alongside name", () => {
    expect(formatCommodityNameWithUnit("Basmati Rice", "KG")).toBe("Basmati Rice (KG)");
    expect(formatCommodityNameWithUnit("Wheat", "MT")).toBe("Wheat (MT)");
  });

  it("normalizes lowercase units to uppercase in display", () => {
    expect(formatCommodityNameWithUnit("Basmati Rice", "kg")).toBe("Basmati Rice (KG)");
    expect(formatCommodityNameWithUnit("Wheat", "mt")).toBe("Wheat (MT)");
    expect(formatCommodityNameWithUnit("Toor Dal", "qtl")).toBe("Toor Dal (QTL)");
    expect(formatCommodityNameWithUnit("Refined Oil", "l")).toBe("Refined Oil (L)");
    expect(formatCommodityNameWithUnit("Sugar", "bag")).toBe("Sugar (BAG)");
  });

  it("prevents double-parentheses if commodity name already includes the unit", () => {
    expect(formatCommodityNameWithUnit("Basmati Rice (KG)", "KG")).toBe("Basmati Rice (KG)");
    expect(formatCommodityNameWithUnit("Wheat (MT)", "mt")).toBe("Wheat (MT)");
  });

  it("handles missing or empty unit gracefully", () => {
    expect(formatCommodityNameWithUnit("Organic Millet", "")).toBe("Organic Millet");
    expect(formatCommodityNameWithUnit("Organic Millet", undefined)).toBe("Organic Millet");
    expect(formatCommodityNameWithUnit("", "KG")).toBe("Commodity (KG)");
  });

  it("verifies ShopDashboard renders formatCommodityNameWithUnit in table and modals", () => {
    const shopDashboardPath = path.join(process.cwd(), "components/inventory/shop-dashboard.tsx");
    const content = fs.readFileSync(shopDashboardPath, "utf-8");

    expect(content).toContain("formatCommodityNameWithUnit");
    expect(content).toContain("formatCommodityNameWithUnit(stock.commodityName, stock.unit)");
    expect(content).toContain("formatCommodityNameWithUnit(ledgerCommodity.commodityName, ledgerCommodity.unit)");
    expect(content).toContain("formatCommodityNameWithUnit(writeOffCommodity.commodityName, writeOffCommodity.unit)");
  });

  it("verifies WarehouseDashboard renders formatCommodityNameWithUnit consistently", () => {
    const whDashboardPath = path.join(process.cwd(), "components/inventory/warehouse-dashboard.tsx");
    const content = fs.readFileSync(whDashboardPath, "utf-8");

    expect(content).toContain("formatCommodityNameWithUnit");
    expect(content).toContain("formatCommodityNameWithUnit(stock.commodityName, stock.unit)");
    expect(content).toContain("formatCommodityNameWithUnit(ledgerCommodity.commodityName, ledgerCommodity.unit)");
    expect(content).toContain("formatCommodityNameWithUnit(writeOffCommodity.commodityName, writeOffCommodity.unit)");
  });

  it("verifies /api/inventory/stock-levels prioritizes unit from commodity/item master", () => {
    const routePath = path.join(process.cwd(), "app/api/inventory/stock-levels/route.ts");
    const content = fs.readFileSync(routePath, "utf-8");

    expect(content).toContain("comm?.unit || unpop?.unit || lvl.unit || \"unit\"");
  });
});
