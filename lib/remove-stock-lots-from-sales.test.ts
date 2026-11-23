import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Remove Stock Lots Module Totally From Sales", () => {
  const appShellPath = path.resolve(process.cwd(), "components/layout/app-shell.tsx");
  const salesStockRoutePath = path.resolve(process.cwd(), "app/sales/stock");

  it("ensures stock lots is completely removed from salesNavigation in app-shell", () => {
    const appShellContent = fs.readFileSync(appShellPath, "utf-8");
    const salesBlockMatch = appShellContent.match(/const salesNavigation = \[([\s\S]*?)\];/);

    expect(salesBlockMatch).toBeTruthy();
    const salesBlock = salesBlockMatch![1];
    expect(salesBlock).not.toContain("Stock Lots");
    expect(salesBlock).not.toContain("/sales/stock");
  });

  it("ensures the /sales/stock route directory no longer exists", () => {
    expect(fs.existsSync(salesStockRoutePath)).toBe(false);
  });

  it("ensures sales order items table no longer mentions stock lots", () => {
    const itemsTablePath = path.resolve(
      process.cwd(),
      "components/sales/sales-order/sales-order-items-table.tsx",
    );
    const content = fs.readFileSync(itemsTablePath, "utf-8");
    expect(content.toLowerCase()).not.toContain("stock lots");
  });
});
