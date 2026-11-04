import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { canAccessRole } from "./auth-roles";
import { isBuyerAdmin } from "./buying-access";
import { canSubmitOffer, canAcceptOffer, type BuyingRequestStatus } from "./buying-workflow";

describe("Marketplace Module & Submodules Navigation", () => {
  const appShellPath = path.resolve(__dirname, "../components/layout/app-shell.tsx");
  const marketplacePagePath = path.resolve(__dirname, "../app/marketplace/page.tsx");
  const tradersPagePath = path.resolve(__dirname, "../app/marketplace/traders/page.tsx");
  const findBuyersPagePath = path.resolve(__dirname, "../app/marketplace/find-buyers/page.tsx");
  const buyingRequestsPagePath = path.resolve(__dirname, "../app/marketplace/buying-requests/page.tsx");
  const buyingModelPath = path.resolve(__dirname, "../models/buying.ts");
  const buyingRequestsRoutePath = path.resolve(__dirname, "../app/api/buying-requests/route.ts");
  const buyersRoutePath = path.resolve(__dirname, "../app/api/buyers/route.ts");

  const appShellContent = fs.readFileSync(appShellPath, "utf-8");
  const buyingModelContent = fs.readFileSync(buyingModelPath, "utf-8");
  const buyingRequestsRouteContent = fs.readFileSync(buyingRequestsRoutePath, "utf-8");
  const buyersRouteContent = fs.readFileSync(buyersRoutePath, "utf-8");

  describe("1. Sidebar Marketplace Module Structure", () => {
    it("defines the marketplaceNavigation array with the three required submodules", () => {
      expect(appShellContent).toContain("const marketplaceNavigation = [");
      expect(appShellContent).toContain('{ href: "/marketplace/traders", label: "Trader" }');
      expect(appShellContent).toContain('{ href: "/marketplace/find-buyers", label: "Find Buyers" }');
      expect(appShellContent).toContain('{ href: "/marketplace/buying-requests", label: "Buying Request" }');
    });

    it("renders an expandable Marketplace module in the sidebar with Store icon and chevron toggle", () => {
      expect(appShellContent).toContain("Store");
      expect(appShellContent).toContain("<Store className=\"h-4 w-4\" />");
      expect(appShellContent).toContain("marketplaceExpanded");
      expect(appShellContent).toContain("setMarketplaceExpanded");
      expect(appShellContent).toContain("Marketplace");
    });

    it("supports active state highlighting for marketplace routes and legacy aliases", () => {
      expect(appShellContent).toContain('pathname.startsWith("/marketplace")');
      expect(appShellContent).toContain('href === "/marketplace/traders"');
      expect(appShellContent).toContain('href === "/marketplace/find-buyers"');
      expect(appShellContent).toContain('href === "/marketplace/buying-requests"');
    });

    it("removes duplicate flat items from the general navigation list", () => {
      const navMatch = appShellContent.match(/const navigation = \[([\s\S]*?)\];/);
      expect(navMatch).toBeTruthy();
      const navBlock = navMatch![1];
      expect(navBlock).not.toContain('{ href: "/find-buyers"');
      expect(navBlock).not.toContain('{ href: "/buying-requests"');
    });
  });

  describe("2. Marketplace Pages Integrity", () => {
    it("provides dedicated marketplace pages for all three submodules and root hub", () => {
      expect(fs.existsSync(marketplacePagePath)).toBe(true);
      expect(fs.existsSync(tradersPagePath)).toBe(true);
      expect(fs.existsSync(findBuyersPagePath)).toBe(true);
      expect(fs.existsSync(buyingRequestsPagePath)).toBe(true);

      const tradersContent = fs.readFileSync(tradersPagePath, "utf-8");
      const findBuyersContent = fs.readFileSync(findBuyersPagePath, "utf-8");
      const buyingRequestsContent = fs.readFileSync(buyingRequestsPagePath, "utf-8");

      expect(tradersContent).toContain("TraderDirectory");
      expect(findBuyersContent).toContain("BuyerDirectory");
      expect(buyingRequestsContent).toContain("BuyingRequestsWorkspace");
    });

    it("preserves legacy routes so existing bookmarks and links continue functioning", () => {
      const legacyTraders = path.resolve(__dirname, "../app/sales/traders/page.tsx");
      const legacyFindBuyers = path.resolve(__dirname, "../app/find-buyers/page.tsx");
      const legacyBuyingRequests = path.resolve(__dirname, "../app/buying-requests/page.tsx");

      expect(fs.existsSync(legacyTraders)).toBe(true);
      expect(fs.existsSync(legacyFindBuyers)).toBe(true);
      expect(fs.existsSync(legacyBuyingRequests)).toBe(true);
    });

    it("displays a clean, centered Coming Soon message for Marketplace -> Trader module", () => {
      const traderDirectoryPath = path.resolve(__dirname, "../components/trading/trader-directory.tsx");
      const traderDirectoryContent = fs.readFileSync(traderDirectoryPath, "utf-8");

      expect(traderDirectoryContent).toContain("Coming Soon");
      expect(traderDirectoryContent).toContain("items-center justify-center");
      expect(traderDirectoryContent).toContain("text-center");
      expect(traderDirectoryContent).toContain("Store");
      expect(traderDirectoryContent).toContain("Marketplace · Trader");
    });
  });

  describe("3. Buying Request Statuses (Open, In Progress, Closed)", () => {
    it("supports Open, In Progress, and Closed in buying request model and schema", () => {
      expect(buyingModelContent).toContain('"In Progress"');
      expect(buyingModelContent).toContain('"Closed"');
      expect(buyingModelContent).toContain('"Open"');
    });

    it("supports filtering by In Progress and Closed in the API", () => {
      expect(buyingRequestsRouteContent).toContain('status === "In Progress"');
      expect(buyingRequestsRouteContent).toContain('status === "Closed"');
    });

    it("supports workflow logic for In Progress requests", () => {
      const inProgressStatus: BuyingRequestStatus = "In Progress";
      expect(canSubmitOffer(inProgressStatus, false)).toEqual({ allowed: true });
      expect(canAcceptOffer(inProgressStatus, "Pending", true)).toEqual({ allowed: true });
    });
  });

  describe("4. Role-based Access Control", () => {
    it("enforces that only Admin can add buyers while others can view", () => {
      // Backend permission checks
      expect(canAccessRole("Super Admin", "manage-buyers")).toBe(true);
      expect(canAccessRole("Administrator", "manage-buyers")).toBe(true);
      expect(canAccessRole("Organization Owner", "manage-buyers")).toBe(true);

      // Non-admins cannot manage/add buyers
      expect(canAccessRole("User", "manage-buyers")).toBe(false);
      expect(canAccessRole("Buyer", "manage-buyers")).toBe(false);
      expect(canAccessRole("Seller", "manage-buyers")).toBe(false);

      // Non-admins CAN view buyers
      expect(canAccessRole("User", "view-buyers")).toBe(true);
      expect(canAccessRole("Buyer", "view-buyers")).toBe(true);
      expect(canAccessRole("Seller", "view-buyers")).toBe(true);

      // isBuyerAdmin helper check
      expect(isBuyerAdmin({ role: "Super Admin" })).toBe(true);
      expect(isBuyerAdmin({ role: "Administrator" })).toBe(true);
      expect(isBuyerAdmin({ role: "User" })).toBe(false);

      // Backend route checks
      expect(buyersRouteContent).toContain("if (!isAdmin)");
      expect(buyersRouteContent).toContain("Forbidden: Only administrators can add new buyers.");
      expect(buyersRouteContent).toContain("canAddBuyer: Boolean(isAdmin)");
    });
  });

  describe("5. Sidebar Module Dropdown Toggle Behavior", () => {
    it("ensures Marketplace module header row is a full-width clickable button that toggles expand/collapse", () => {
      // Must be a button element with w-full, cursor-pointer, and toggles marketplaceExpanded
      expect(appShellContent).toMatch(/<button[\s\S]*?onClick=\{\(\)\s*=>\s*setMarketplaceExpanded\(\(expanded\)\s*=>\s*!expanded\)\}/);
      expect(appShellContent).toContain("aria-expanded={marketplaceExpanded}");
      expect(appShellContent).toContain("cursor-pointer");
    });

    it("ensures Sales module header row is a full-width clickable button that toggles expand/collapse", () => {
      expect(appShellContent).toMatch(/<button[\s\S]*?onClick=\{\(\)\s*=>\s*setSalesExpanded\(\(expanded\)\s*=>\s*!expanded\)\}/);
      expect(appShellContent).toContain("aria-expanded={salesExpanded}");
    });

    it("ensures Purchases module header row is a full-width clickable button that toggles expand/collapse", () => {
      expect(appShellContent).toMatch(/<button[\s\S]*?onClick=\{\(\)\s*=>\s*setPurchasesExpanded\(\(expanded\)\s*=>\s*!expanded\)\}/);
      expect(appShellContent).toContain("aria-expanded={purchasesExpanded}");
    });

    it("ensures module headers are not wrapped in conflicting Link tags so clicking anywhere toggles the dropdown", () => {
      // Headers must not navigate away on click of the header row
      const marketplaceHeaderSnippet = appShellContent.substring(
        appShellContent.indexOf("{/* Marketplace Module */}"),
        appShellContent.indexOf("{marketplaceExpanded &&")
      );
      expect(marketplaceHeaderSnippet).not.toContain("<Link");
      expect(marketplaceHeaderSnippet).toContain("<button");

      const salesHeaderSnippet = appShellContent.substring(
        appShellContent.indexOf("{/* Sales Module */}"),
        appShellContent.indexOf("{salesExpanded &&")
      );
      expect(salesHeaderSnippet).not.toContain("<Link");
      expect(salesHeaderSnippet).toContain("<button");

      const purchasesHeaderSnippet = appShellContent.substring(
        appShellContent.indexOf("{/* Purchases Module */}"),
        appShellContent.indexOf("{purchasesExpanded &&")
      );
      expect(purchasesHeaderSnippet).not.toContain("<Link");
      expect(purchasesHeaderSnippet).toContain("<button");
    });
  });
});

