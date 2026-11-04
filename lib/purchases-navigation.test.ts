import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Purchases Sidebar Navigation", () => {
  const appShellPath = path.resolve(__dirname, "../components/layout/app-shell.tsx");
  const appShellContent = fs.readFileSync(appShellPath, "utf-8");

  const expectedSubmenuItems = [
    "Vendors",
    "Vendor Ledger",
    "Payment",
    "Expenses",
    "Recurring Expenses",
    "Purchase Orders",
    "Bills",
    "Recurring Bills",
    "Vendor Credits",
  ];

  it("includes ShoppingBag icon in the imports and sidebar", () => {
    expect(appShellContent).toContain("ShoppingBag");
    expect(appShellContent).toContain("<ShoppingBag className=\"h-4 w-4\" />");
  });

  it("defines all 8 submenu items in the exact required order", () => {
    // Check that purchasesNavigation array exists
    expect(appShellContent).toContain("const purchasesNavigation = [");

    // Extract the items in order
    const purchasesBlockMatch = appShellContent.match(
      /const purchasesNavigation = \[([\s\S]*?)\];/,
    );
    expect(purchasesBlockMatch).toBeTruthy();

    const block = purchasesBlockMatch![1];
    const labelMatches = [...block.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);

    expect(labelMatches).toEqual(expectedSubmenuItems);
  });

  it("renders a collapsible Purchases section with expand/collapse chevron arrow", () => {
    expect(appShellContent).toContain("purchasesExpanded");
    expect(appShellContent).toContain("setPurchasesExpanded");
    expect(appShellContent).toContain("rotate-180");
  });

  it("highlights the active submenu item in blue with white text and plus icon on the right", () => {
    // Check for blue highlight class: bg-blue-600, font-medium, text-white
    expect(appShellContent).toContain("bg-blue-600 font-medium text-white shadow-sm");
    // Check that Plus icon is rendered on the right when active
    expect(appShellContent).toContain("<Plus className=\"h-3.5 w-3.5\" />");
    expect(appShellContent).toContain("hover:bg-blue-500");
  });

  it("does not duplicate Vendors in the general navigation list", () => {
    const navMatch = appShellContent.match(/const navigation = \[([\s\S]*?)\];/);
    expect(navMatch).toBeTruthy();
    const navBlock = navMatch![1];
    expect(navBlock).not.toContain('{ href: "/vendors", label: "Vendors"');
  });

  it("ensures purchases pages and routes exist for navigation", () => {
    const purchasesPagePath = path.resolve(__dirname, "../app/purchases/page.tsx");
    const purchasesSectionPagePath = path.resolve(
      __dirname,
      "../app/purchases/[section]/page.tsx",
    );
    const vendorsDirectoryPath = path.resolve(
      __dirname,
      "../components/purchases/vendors-directory.tsx",
    );
    const purchasesWorkspacePath = path.resolve(
      __dirname,
      "../components/purchases/purchases-workspace.tsx",
    );

    expect(fs.existsSync(purchasesPagePath)).toBe(true);
    expect(fs.existsSync(purchasesSectionPagePath)).toBe(true);
    expect(fs.existsSync(vendorsDirectoryPath)).toBe(true);
    expect(fs.existsSync(purchasesWorkspacePath)).toBe(true);
  });
});
