import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Sign In & Sign Up Pages BharatGodam Branding", () => {
  const authFormPath = path.resolve(__dirname, "../components/auth/auth-form.tsx");
  const logoAssetPath = path.resolve(__dirname, "../public/bharatgodam-logo.jpg");
  const authFormContent = fs.readFileSync(authFormPath, "utf-8");

  it("verifies the BharatGodam logo asset exists in public directory", () => {
    expect(fs.existsSync(logoAssetPath)).toBe(true);
    const stats = fs.statSync(logoAssetPath);
    expect(stats.size).toBeGreaterThan(1000);
  });

  it("displays the BharatGodam logo at top-left of the auth card above heading", () => {
    const cardIndex = authFormContent.indexOf("<section");
    const logoIndex = authFormContent.indexOf('src="/bharatgodam-logo.jpg"');
    const headingIndex = authFormContent.indexOf("<h1");

    expect(cardIndex).toBeGreaterThan(-1);
    expect(logoIndex).toBeGreaterThan(cardIndex);
    expect(headingIndex).toBeGreaterThan(logoIndex);
  });

  it("ensures correct aspect ratio, object-fit contain, and responsive dimensions", () => {
    expect(authFormContent).toContain('src="/bharatgodam-logo.jpg"');
    expect(authFormContent).toContain('alt="BharatGodam Logo"');
    expect(authFormContent).toContain("object-contain");
    expect(authFormContent).toContain('objectFit: "contain"');
    expect(authFormContent).toMatch(/aspectRatio:\s*"1024\s*\/\s*458"/);
    expect(authFormContent).toContain("h-12 sm:h-14");
  });

  it("replaces all LedgerFlow branding on auth pages with BharatGodam", () => {
    expect(authFormContent).not.toContain("LedgerFlow");
    expect(authFormContent).toContain("BharatGodam");
    expect(authFormContent).toContain("New to BharatGodam?");
  });
});

