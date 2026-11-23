import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Sidebar Independent Scrolling & Scroll Isolation", () => {
  const appShellPath = path.resolve(
    process.cwd(),
    "components/layout/app-shell.tsx",
  );
  const appShellContent = fs.readFileSync(appShellPath, "utf-8");

  const globalsCssPath = path.resolve(process.cwd(), "app/globals.css");
  const globalsCssContent = fs.readFileSync(globalsCssPath, "utf-8");

  it("1. should ensure <aside> is pinned to viewport height with sticky, h-screen, overflow-hidden, and overscroll-contain", () => {
    // aside must have sticky top-0, h-screen, max-h-screen, overflow-hidden, and overscroll-contain
    expect(appShellContent).toContain("sticky top-0 h-screen max-h-screen");
    expect(appShellContent).toContain("overflow-hidden");
    expect(appShellContent).toContain("overscroll-contain");
  });

  it("2. should ensure the top logo header has shrink-0 to remain stationary", () => {
    expect(appShellContent).toContain('className="mb-4 shrink-0"');
  });

  it("3. should ensure the navigation menu has flex-1, min-h-0, overflow-y-auto, and overscroll-contain", () => {
    expect(appShellContent).toContain("flex-1 min-h-0 overflow-y-auto overscroll-contain");
    expect(appShellContent).toContain("sidebar-scrollbar");
  });

  it("4. should ensure the finance year footer has shrink-0 to remain stationary at the bottom", () => {
    expect(appShellContent).toContain("mt-3 shrink-0 rounded-2xl");
  });

  it("5. should handle wheel events over the sidebar and scroll only the menu", () => {
    expect(appShellContent).toContain("handleSidebarWheel");
    expect(appShellContent).toContain("onWheel={handleSidebarWheel}");
    expect(appShellContent).toContain("menuRef.current.scrollTop += e.deltaY");
  });

  it("6. should have custom sleek scrollbar and overscroll-behavior: contain in globals.css", () => {
    expect(globalsCssContent).toContain(".sidebar-scrollbar");
    expect(globalsCssContent).toContain("overscroll-behavior: contain;");
    expect(globalsCssContent).toContain("scrollbar-width: thin;");
  });
});
