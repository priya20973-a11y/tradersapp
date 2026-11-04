import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Sidebar Orange (#FF8C00) Active-State Styling", () => {
  const appShellPath = path.resolve(__dirname, "../components/layout/app-shell.tsx");
  const appShellContent = fs.readFileSync(appShellPath, "utf-8");

  it("applies orange (#FF8C00) rounded background and white text to active Dashboard", () => {
    expect(appShellContent).toContain('pathname === "/"');
    expect(appShellContent).toContain('? "bg-[#FF8C00] text-white shadow-sm"');
    expect(appShellContent).toContain('<LayoutDashboard className="h-4 w-4 shrink-0" />');
  });

  it("applies orange (#FF8C00) styling to Commodity (Items)", () => {
    expect(appShellContent).toContain('pathname === "/items" || pathname.startsWith("/items")');
    expect(appShellContent).toContain('? "bg-[#FF8C00] text-white shadow-sm"');
    expect(appShellContent).toContain('<Package className="h-4 w-4 shrink-0" />');
  });

  it("keeps module headers, parent menus, and section headings unchanged (no orange background)", () => {
    // Marketplace parent menu button retains bg-slate-800, no orange
    const marketplaceBlock = appShellContent.substring(
      appShellContent.indexOf("{/* Marketplace Module */}"),
      appShellContent.indexOf("{/* Items */}"),
    );
    expect(marketplaceBlock).toContain("bg-slate-800 text-white");
    expect(marketplaceBlock).toContain('<Store className="h-4 w-4" />');
    // Ensure the parent button itself has no orange
    const marketplaceBtnClass = marketplaceBlock.match(/<button[\s\S]*?className=\{`([\s\S]*?)`\}/);
    expect(marketplaceBtnClass).toBeTruthy();
    expect(marketplaceBtnClass![1]).not.toContain("bg-[#FF8C00]");

    // Sales parent menu button retains bg-slate-800, no orange
    const salesBlock = appShellContent.substring(
      appShellContent.indexOf("{/* Sales Module */}"),
      appShellContent.indexOf("{/* Purchases Module */}"),
    );
    expect(salesBlock).toContain("bg-slate-800 text-white");
    expect(salesBlock).toContain('<ShoppingCart className="h-4 w-4" />');
    const salesBtnClass = salesBlock.match(/<button[\s\S]*?className=\{`([\s\S]*?)`\}/);
    expect(salesBtnClass).toBeTruthy();
    expect(salesBtnClass![1]).not.toContain("bg-[#FF8C00]");

    // Purchases parent menu button retains bg-slate-800, no orange
    const purchasesBlock = appShellContent.substring(
      appShellContent.indexOf("{/* Purchases Module */}"),
      appShellContent.indexOf("{/* Other Navigation */}"),
    );
    expect(purchasesBlock).toContain("bg-slate-800 text-white");
    expect(purchasesBlock).toContain('<ShoppingBag className="h-4 w-4" />');
    const purchasesBtnClass = purchasesBlock.match(/<button[\s\S]*?className=\{`([\s\S]*?)`\}/);
    expect(purchasesBtnClass).toBeTruthy();
    expect(purchasesBtnClass![1]).not.toContain("bg-[#FF8C00]");
  });

  it("highlights only the active child/submodule in orange (#FF8C00)", () => {
    expect(appShellContent).toContain('bg-[#FF8C00] font-medium text-white shadow-sm');
  });

  it("applies orange (#FF8C00) active-state styling to other navigation items (Banking, Accountant, Reports, Admin)", () => {
    expect(appShellContent).toContain('{visibleNavigation.map(({ href, label, icon: Icon }) => {');
    expect(appShellContent).toContain('<Icon className="h-4 w-4 shrink-0" />');
    expect(appShellContent).toContain('isActive\n                      ? "bg-[#FF8C00] text-white shadow-sm"');
  });

  it("ensures inactive modules retain existing styling", () => {
    expect(appShellContent).toContain('text-slate-300 hover:bg-slate-800 hover:text-white');
  });

  it("preserves navigation permissions, collapsed mode responsiveness, icons, and logos", () => {
    expect(appShellContent).toContain('visibleNavigation = navigation.filter');
    expect(appShellContent).toContain('sidebarCollapsed');
    expect(appShellContent).toContain('src="/bharatgodam-logo.jpg"');
    expect(appShellContent).toContain('<Store className="h-4 w-4" />');
    expect(appShellContent).toContain('<ShoppingCart className="h-4 w-4" />');
    expect(appShellContent).toContain('<ShoppingBag className="h-4 w-4" />');
  });
});
