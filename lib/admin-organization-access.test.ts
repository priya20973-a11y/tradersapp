import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Admin Organization Role-Based Access and Visibility", () => {
  const appShellPath = path.resolve(__dirname, "../components/layout/app-shell.tsx");
  const adminPagePath = path.resolve(__dirname, "../app/admin/organizations/page.tsx");
  const adminRoutePath = path.resolve(__dirname, "../app/api/admin/organizations/route.ts");
  const profileRoutePath = path.resolve(__dirname, "../app/api/profile/route.ts");

  const appShellContent = fs.readFileSync(appShellPath, "utf-8");
  const adminPageContent = fs.readFileSync(adminPagePath, "utf-8");
  const adminRouteContent = fs.readFileSync(adminRoutePath, "utf-8");
  const profileRouteContent = fs.readFileSync(profileRoutePath, "utf-8");

  describe("1. Sidebar Role-Based Visibility in AppShell", () => {
    it("preserves the static navigation definition for navigation compatibility", () => {
      const navMatch = appShellContent.match(/const navigation = \[([\s\S]*?)\];/);
      expect(navMatch).toBeTruthy();
      const navBlock = navMatch![1];
      expect(navBlock).toContain('{ href: "/admin/organizations", label: "Admin Organizations"');
    });

    it("initializes isAdmin state to false so non-admin users never see the link", () => {
      expect(appShellContent).toContain("const [isAdmin, setIsAdmin] = useState<boolean>(false);");
    });

    it("filters out /admin/organizations from visibleNavigation when not an admin", () => {
      expect(appShellContent).toContain("const visibleNavigation = navigation.filter");
      expect(appShellContent).toMatch(
        /item\.href === "\/admin\/organizations" && !isAdmin/,
      );
    });

    it("renders visibleNavigation in the sidebar rather than unfiltered navigation", () => {
      expect(appShellContent).toContain("{visibleNavigation.map(({ href, label, icon: Icon }) => {");
    });

    it("fetches profile and session to detect admin privileges dynamically", () => {
      expect(appShellContent).toContain('fetch("/api/profile")');
      expect(appShellContent).toContain('fetch("/api/auth/session")');
      expect(appShellContent).toContain('sessionData?.user?.id === "admin"');
      expect(appShellContent).toContain('sessionData?.user?.role === "Super Admin"');
    });

    it("keeps all other sidebar modules and dropdowns untouched", () => {
      expect(appShellContent).toContain('{ href: "/banking", label: "Banking"');
      expect(appShellContent).toContain('{ href: "/accountant", label: "Accountant"');
      expect(appShellContent).toContain('{ href: "/reports", label: "Reports"');
      expect(appShellContent).toContain("const marketplaceNavigation = [");
      expect(appShellContent).toContain("const purchasesNavigation = [");
      expect(appShellContent).toContain("const salesNavigation = [");
    });
  });

  describe("2. Route Authorization (/admin/organizations)", () => {
    it("redirects unauthorized and non-admin users to '/'", () => {
      expect(adminPageContent).toContain("getServerSession(authOptions)");
      expect(adminPageContent).toContain('redirect("/")');
      expect(adminPageContent).toMatch(
        /session\.user\.id !== "admin" && session\.user\.role !== "Super Admin"/,
      );
    });
  });

  describe("3. Backend API Authorization (/api/admin/organizations)", () => {
    it("enforces requireAdmin on GET, PATCH, and DELETE operations", () => {
      expect(adminRouteContent).toContain("export async function GET");
      expect(adminRouteContent).toContain("export async function PATCH");
      expect(adminRouteContent).toContain("export async function DELETE");

      // Verify requireAdmin implementation
      expect(adminRouteContent).toContain(
        'if (authUser.id !== "admin" && authUser.role !== "Super Admin")',
      );
      expect(adminRouteContent).toContain(
        'return NextResponse.json({ error: "Only the administrator can manage organizations." }, { status: 403 });',
      );
    });
  });

  describe("4. Profile API Role Indicator (/api/profile)", () => {
    it("returns isAdmin: true for Super Admin and isAdmin: false for non-admin accounts", () => {
      expect(profileRouteContent).toContain(
        'session?.user?.id === "admin" || session?.user?.role === "Super Admin"',
      );
      expect(profileRouteContent).toContain("isAdmin: true");
      expect(profileRouteContent).toContain("isAdmin: false");
    });
  });
});

