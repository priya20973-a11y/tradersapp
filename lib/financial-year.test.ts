import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getFinancialYear } from "./financial-year";

describe("Dynamic Financial Year Calculation", () => {
  it("calculates and displays 2025–2027 when current year is 2027", () => {
    // Testing with year number
    expect(getFinancialYear(2027)).toBe("2025–2027");

    // Testing with Date object
    const date2027 = new Date(2027, 5, 15);
    expect(getFinancialYear(date2027)).toBe("2025–2027");

    // Testing with ISO date string
    expect(getFinancialYear("2027-04-01")).toBe("2025–2027");
  });

  it("calculates and displays 2024–2026 when current year is 2026", () => {
    expect(getFinancialYear(2026)).toBe("2024–2026");
    expect(getFinancialYear(new Date(2026, 9, 29))).toBe("2024–2026");
  });

  it("updates automatically for future years without manual code changes", () => {
    expect(getFinancialYear(2028)).toBe("2026–2028");
    expect(getFinancialYear(2029)).toBe("2027–2029");
    expect(getFinancialYear(2030)).toBe("2028–2030");
  });

  it("supports hyphen separator when requested", () => {
    expect(getFinancialYear(2027, { separator: "-" })).toBe("2025-2027");
  });

  it("defaults dynamically to the current year when no argument is supplied", () => {
    const currentYear = new Date().getFullYear();
    const expected = `${currentYear - 2}–${currentYear}`;
    expect(getFinancialYear()).toBe(expected);
  });

  it("ensures app-shell uses dynamic financial year calculation and displays in sidebar and header", () => {
    const appShellPath = path.resolve(__dirname, "../components/layout/app-shell.tsx");
    const appShellContent = fs.readFileSync(appShellPath, "utf-8");

    // Verify import
    expect(appShellContent).toContain('import { getFinancialYear } from "@/lib/financial-year"');

    // Verify usage in component
    expect(appShellContent).toContain("financialYear");
    expect(appShellContent).toContain("getFinancialYear()");
  });
});

