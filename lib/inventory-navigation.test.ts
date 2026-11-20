import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Inventory Parent Module & Submodules Navigation", () => {
  const appShellPath = path.resolve(__dirname, "../components/layout/app-shell.tsx");
  const itemsPagePath = path.resolve(__dirname, "../app/items/page.tsx");
  const warehousesPagePath = path.resolve(__dirname, "../app/sales/warehouses/page.tsx");

  const appShellContent = fs.readFileSync(appShellPath, "utf-8");

  describe("1. Sidebar Inventory Module Structure & Submodules", () => {
    it("defines the inventoryNavigation array with Commodity and Warehouse", () => {
      expect(appShellContent).toContain("const inventoryNavigation = [");
      expect(appShellContent).toContain('{ href: "/items", label: "Commodity" }');
      expect(appShellContent).toContain('{ href: "/sales/warehouses", label: "Warehouse" }');
    });

    it("positions Stock Transfers below Inventory Report in the inventory sidebar menu", () => {
      const inventoryReportIndex = appShellContent.indexOf('{ href: "/inventory/reports"');
      const stockTransfersIndex = appShellContent.indexOf('{ href: "/inventory/transfers"');
      expect(inventoryReportIndex).toBeGreaterThan(-1);
      expect(stockTransfersIndex).toBeGreaterThan(-1);
      expect(stockTransfersIndex).toBeGreaterThan(inventoryReportIndex);
    });

    it("moves Warehouse out of salesNavigation", () => {
      const salesBlockMatch = appShellContent.match(
        /const salesNavigation = \[([\s\S]*?)\];/,
      );
      expect(salesBlockMatch).toBeTruthy();
      const salesBlock = salesBlockMatch![1];
      expect(salesBlock).not.toContain('{ href: "/sales/warehouses"');
    });

    it("renders an expandable Inventory module in the sidebar with Boxes icon and chevron toggle", () => {
      expect(appShellContent).toContain("<Boxes className=\"h-4 w-4\" />");
      expect(appShellContent).toContain("inventoryExpanded");
      expect(appShellContent).toContain("setInventoryExpanded");
      expect(appShellContent).toContain("<span>Inventory</span>");
    });

    it("has chevron rotation when inventory is expanded", () => {
      expect(appShellContent).toContain('inventoryExpanded ? "rotate-180" : ""');
    });
  });

  describe("2. Active State Highlighting and Route Isolation", () => {
    it("activates Inventory parent module for /items and /sales/warehouses routes", () => {
      expect(appShellContent).toContain('pathname.startsWith("/inventory")');
      expect(appShellContent).toContain('pathname === "/items"');
      expect(appShellContent).toContain('pathname.startsWith("/items")');
      expect(appShellContent).toContain('pathname.startsWith("/sales/warehouses")');
    });

    it("highlights active submodules with orange (#FF8C00)", () => {
      expect(appShellContent).toContain('bg-[#FF8C00] font-medium text-white shadow-sm');
    });

    it("ensures Sales parent menu does not stay active when on /sales/warehouses", () => {
      expect(appShellContent).toContain('!pathname.startsWith("/sales/warehouses")');
    });
  });

  describe("3. Collapsed Sidebar Responsiveness", () => {
    it("supports sidebar collapsed state with tooltip and icon", () => {
      expect(appShellContent).toContain('title={sidebarCollapsed ? "Inventory" : undefined}');
      expect(appShellContent).toContain('inventoryExpanded && !sidebarCollapsed');
    });
  });

  describe("4. Preserves Existing Pages and Routes", () => {
    it("preserves /items page and functionality", () => {
      expect(fs.existsSync(itemsPagePath)).toBe(true);
      const content = fs.readFileSync(itemsPagePath, "utf-8");
      expect(content).toContain("ItemsPage");
    });

    it("preserves /sales/warehouses page and functionality", () => {
      expect(fs.existsSync(warehousesPagePath)).toBe(true);
      const content = fs.readFileSync(warehousesPagePath, "utf-8");
      expect(content).toContain("WarehousesPage");
    });
  });
});
