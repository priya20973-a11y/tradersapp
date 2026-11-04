import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("SA Profile Avatar Clickable Navigation", () => {
  const appShellPath = path.resolve(__dirname, "../components/layout/app-shell.tsx");
  const profilePagePath = path.resolve(__dirname, "../app/profile/page.tsx");
  const profileRoutePath = path.resolve(__dirname, "../app/api/profile/route.ts");
  const profileWorkspacePath = path.resolve(__dirname, "../components/profile/profile-workspace.tsx");

  const appShellContent = fs.readFileSync(appShellPath, "utf-8");
  const profilePageContent = fs.readFileSync(profilePagePath, "utf-8");
  const profileRouteContent = fs.readFileSync(profileRoutePath, "utf-8");
  const profileWorkspaceContent = fs.readFileSync(profileWorkspacePath, "utf-8");

  it("renders the SA avatar as a clickable Link component navigating to /profile", () => {
    // Check that the avatar is a Link pointing to /profile
    expect(appShellContent).toMatch(/<Link[\s\S]*?href="\/profile"[\s\S]*?>[\s\S]*?SA[\s\S]*?<\/Link>/);
  });

  it("preserves the original avatar design and styling classes", () => {
    // Check that the avatar retains the round styling, slate-900 background, and white SA initials
    expect(appShellContent).toContain("h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white");
    expect(appShellContent).toContain("SA");
  });

  it("keeps the header layout and Sign Out functionality unchanged", () => {
    // Verify Sign Out button is intact right after the avatar
    expect(appShellContent).toContain('onClick={() => signOut({ callbackUrl: "/signin" })}');
    expect(appShellContent).toContain("<LogOut className=\"h-4 w-4\" />");
    expect(appShellContent).toContain("Sign out");

    // Verify FY indicator and Search input remain in header
    expect(appShellContent).toContain("FY 2026-27");
    expect(appShellContent).toContain("ReceiptText");
    expect(appShellContent).toContain("Search transactions, customers...");
  });

  it("connects to the existing profile page that displays ProfileWorkspace", () => {
    expect(fs.existsSync(profilePagePath)).toBe(true);
    expect(profilePageContent).toContain("ProfileWorkspace");
    expect(profilePageContent).toContain('from "@/components/profile/profile-workspace"');
  });

  it("uses the existing authentication context in profile management", () => {
    // Verify Profile API uses getServerSession with authOptions
    expect(profileRouteContent).toContain("getServerSession(authOptions)");
    expect(profileRouteContent).toContain("DEMO_FALLBACK_PROFILE");

    // Verify Profile Workspace fetches and updates profile data
    expect(profileWorkspaceContent).toContain('fetch("/api/profile")');
    expect(profileWorkspaceContent).toContain('method: "PUT"');
  });

  it("removes profile from the sidebar so profile access is streamlined through the header avatar", () => {
    // Ensure Profile is not a sidebar navigation link
    expect(appShellContent).not.toMatch(/<aside[\s\S]*?>[\s\S]*?>\s*Profile\s*<\/Link>[\s\S]*?<\/aside>/);
  });

  it("dynamically fetches organization profile to display organization initial in profile avatar circle", () => {
    // Verify fetching /api/profile and extracting organizationName
    expect(appShellContent).toContain('fetch("/api/profile")');
    expect(appShellContent).toContain("data?.profile?.organizationName");
    expect(appShellContent).toContain("orgName.trim().charAt(0).toUpperCase()");
    expect(appShellContent).toContain('{orgInitial || "SA"}');
  });

  it("falls back to default SA initials if organization name is missing", () => {
    // Verify fallback to SA
    expect(appShellContent).toMatch(/\{\s*orgInitial\s*\|\|\s*"SA"\s*\}/);
  });
});
