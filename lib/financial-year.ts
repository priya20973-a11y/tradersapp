/**
 * lib/financial-year.ts
 *
 * Dynamic financial year calculation and formatting utilities.
 * Automatically calculates and displays the financial year based on the current date/year
 * without requiring manual code changes as calendar years advance.
 */

export interface FinancialYearOptions {
  /** Separator between start year and end year (default: "–" [en-dash]) */
  separator?: "–" | "-";
}

/**
 * Calculates and returns the dynamic financial year string based on current date/year.
 * 
 * Example:
 * If the current year is 2027, displays "2025–2027".
 * If the current year is 2026, displays "2024–2026".
 * If the current year is 2028, displays "2026–2028".
 * 
 * @param date Optional date, year number, or date string (defaults to current system date)
 * @param options Formatting options (e.g. separator)
 * @returns Formatted financial year string (e.g. "2025–2027")
 */
export function getFinancialYear(
  date: Date | string | number = new Date(),
  options?: FinancialYearOptions,
): string {
  let currentYear: number;

  if (typeof date === "number" && date >= 1000 && date <= 9999) {
    currentYear = date;
  } else {
    const d = date instanceof Date ? date : new Date(date);
    currentYear = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
  }

  const separator = options?.separator ?? "–";
  const startYear = currentYear - 2;
  const endYear = currentYear;

  return `${startYear}${separator}${endYear}`;
}

