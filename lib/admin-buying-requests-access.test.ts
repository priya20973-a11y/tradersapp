import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Admin Buying Requests Role-Based Access and Visibility", () => {
  const appShellPath = path.resolve(__dirname, "../components/layout/app-shell.tsx");
  const adminPagePath = path.resolve(__dirname, "../app/admin/buying-requests/page.tsx");
  const adminListRoutePath = path.resolve(__dirname, "../app/api/admin/buying-requests/route.ts");
  const adminApproveRoutePath = path.resolve(
    __dirname,
    "../app/api/admin/buying-requests/[id]/approve/route.ts",
  );
  const marketplaceBuyingRequestsPagePath = path.resolve(
    __dirname,
    "../app/marketplace/buying-requests/page.tsx",
  );
  const marketplaceBuyingRequestsApiRoutePath = path.resolve(
    __dirname,
    "../app/api/buying-requests/route.ts",
  );

  const appShellContent = fs.readFileSync(appShellPath, "utf-8");
  const adminPageContent = fs.readFileSync(adminPagePath, "utf-8");
  const adminListRouteContent = fs.readFileSync(adminListRoutePath, "utf-8");
  const adminApproveRouteContent = fs.readFileSync(adminApproveRoutePath, "utf-8");

  describe("1. Sidebar Role-Based Visibility in AppShell", () => {
    it("preserves Admin: Buying Requests in the static navigation list", () => {
      const navMatch = appShellContent.match(/const navigation = \[([\s\S]*?)\];/);
      expect(navMatch).toBeTruthy();
      const navBlock = navMatch![1];
      expect(navBlock).toContain(
        '{ href: "/admin/buying-requests", label: "Admin: Buying Requests"',
      );
    });

    it("filters out /admin/buying-requests from visibleNavigation when not an admin", () => {
      expect(appShellContent).toContain("const visibleNavigation = navigation.filter");
      expect(appShellContent).toMatch(
        /item\.href === "\/admin\/buying-requests" && !isAdmin/,
      );
    });

    it("renders visibleNavigation in sidebar navigation so non-admins never see admin modules", () => {
      expect(appShellContent).toContain(
        "{visibleNavigation.map(({ href, label, icon: Icon }) => {",
      );
    });

    it("keeps all other sidebar modules and submodules intact", () => {
      expect(appShellContent).toContain('{ href: "/banking", label: "Banking"');
      expect(appShellContent).toContain('{ href: "/accountant", label: "Accountant"');
      expect(appShellContent).toContain('{ href: "/reports", label: "Reports"');
      expect(appShellContent).toContain("const marketplaceNavigation = [");
      expect(appShellContent).toContain("const purchasesNavigation = [");
      expect(appShellContent).toContain("const salesNavigation = [");
    });
  });

  describe("2. Route Authorization (/admin/buying-requests)", () => {
    it("redirects unauthorized visitors and non-admin users to '/'", () => {
      expect(adminPageContent).toContain("getServerSession(authOptions)");
      expect(adminPageContent).toContain('redirect("/")');
      expect(adminPageContent).toMatch(
        /session\.user\.id !== "admin" && session\.user\.role !== "Super Admin"/,
      );
    });
  });

  describe("3. Admin Buying Requests List API Authorization (/api/admin/buying-requests)", () => {
    it("restricts list access exclusively to admin users", () => {
      expect(adminListRouteContent).toContain("export async function GET");
      expect(adminListRouteContent).toContain(
        'return token.id === "admin" || token.role === "Super Admin";',
      );
      expect(adminListRouteContent).toContain(
        'return NextResponse.json({ error: "Admin access required" }, { status: 403 });',
      );
    });
  });

  describe("4. Admin Buying Request Approve API Authorization (/api/admin/buying-requests/[id]/approve)", () => {
    it("restricts approve action exclusively to admin accounts with 403 response on failure", () => {
      expect(adminApproveRouteContent).toContain("export async function POST");
      expect(adminApproveRouteContent).toContain(
        'return token.id === "admin" || token.role === "Super Admin";',
      );
      expect(adminApproveRouteContent).toContain(
        'return NextResponse.json(\n        { error: "Admin access required. Only administrators can approve buying requests." },\n        { status: 403 },\n      );',
      );
    });
  });

  describe("5. Marketplace Buying Request Workflow Preservation", () => {
    it("preserves the user-facing Marketplace -> Buying Request page and API", () => {
      expect(fs.existsSync(marketplaceBuyingRequestsPagePath)).toBe(true);
      expect(fs.existsSync(marketplaceBuyingRequestsApiRoutePath)).toBe(true);

      const userApiContent = fs.readFileSync(
        marketplaceBuyingRequestsApiRoutePath,
        "utf-8",
      );
      expect(userApiContent).toContain("export async function GET");
      expect(userApiContent).toContain("export async function POST");
      expect(userApiContent).toContain("buyingRequestCreateSchema");
    });
  });
});

