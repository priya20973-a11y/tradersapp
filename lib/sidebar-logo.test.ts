import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Sidebar BharatGodam Logo Feature", () => {
  const appShellPath = path.resolve(__dirname, "../components/layout/app-shell.tsx");
  const logoAssetPath = path.resolve(__dirname, "../public/bharatgodam-logo.jpg");
  const appShellContent = fs.readFileSync(appShellPath, "utf-8");

  it("ensures the uploaded logo image asset exists in public folder", () => {
    expect(fs.existsSync(logoAssetPath)).toBe(true);
    const stats = fs.statSync(logoAssetPath);
    expect(stats.size).toBeGreaterThan(1000);
  });

  it("places the BharatGodam logo at the very top of the sidebar above all modules and navigation", () => {
    // Top of aside element must precede navigation items
    const asideIndex = appShellContent.indexOf("<aside");
    const logoIndex = appShellContent.indexOf('src="/bharatgodam-logo.jpg"');
    const dashboardIndex = appShellContent.indexOf("{/* Dashboard */}");
    const marketplaceIndex = appShellContent.indexOf("{/* Marketplace Module */}");

    expect(asideIndex).toBeGreaterThan(-1);
    expect(logoIndex).toBeGreaterThan(asideIndex);
    expect(logoIndex).toBeLessThan(dashboardIndex);
    expect(logoIndex).toBeLessThan(marketplaceIndex);
  });

  it("displays the complete logo with proper aspect ratio and object-fit: contain", () => {
    expect(appShellContent).toContain('src="/bharatgodam-logo.jpg"');
    expect(appShellContent).toContain('alt="BharatGodam Logo"');
    expect(appShellContent).toContain("object-contain");
    expect(appShellContent).toContain('objectFit: "contain"');
    expect(appShellContent).toMatch(/aspectRatio:\s*"1024\s*\/\s*458"/);
    expect(appShellContent).toContain("w-full");
    expect(appShellContent).toContain("px-2");
  });

  it("handles responsive expanded and collapsed sidebar states without distortion", () => {
    // Both expanded and collapsed versions exist and preserve object-fit contain
    expect(appShellContent).toContain("sidebarCollapsed");
    expect(appShellContent).toContain("setSidebarCollapsed");
    expect(appShellContent).toContain("ChevronLeft");
    expect(appShellContent).toContain("ChevronRight");

    // In collapsed mode, compact version is rendered
    expect(appShellContent).toContain("h-12 w-12");
  });

  it("preserves the existing sidebar background, navigation layout, icons, and dropdowns", () => {
    expect(appShellContent).toContain("bg-slate-950");
    expect(appShellContent).toContain("marketplaceExpanded");
    expect(appShellContent).toContain("salesExpanded");
    expect(appShellContent).toContain("purchasesExpanded");
    expect(appShellContent).toContain("<LayoutDashboard className=\"h-4 w-4 shrink-0\" />");
    expect(appShellContent).toContain("<Store className=\"h-4 w-4\" />");
    expect(appShellContent).toContain("<ShoppingCart className=\"h-4 w-4\" />");
    expect(appShellContent).toContain("<ShoppingBag className=\"h-4 w-4\" />");
  });
});

