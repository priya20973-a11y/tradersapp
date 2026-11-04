/**
 * lib/credit-note-numbering.ts
 *
 * Client-safe pure functions for Credit Note numbering,
 * zero-padding formatters, and collision avoidance utilities.
 * Completely free of Node/database imports so it can be safely used
 * in both Client Components and Server Components.
 */

/**
 * Returns the Indian financial year string (April 1 to March 31).
 * For example:
 * - 2026-10-29 -> "2026-27"
 * - 2027-02-15 -> "2026-27"
 * - 2027-04-01 -> "2027-28"
 */
export function getFiscalYear(date: Date = new Date()): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan, 3 = Apr, 9 = Oct
  const startYear = month >= 3 ? year : year - 1;
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${String(endYear).padStart(2, "0")}`;
}

/**
 * Parses user input for Next Number (e.g. "00002" or 2).
 * Preserves the leading zero-padding length based on the entered string.
 */
export function parseNextNumberInput(input: string | number): {
  nextNumber: number;
  padding: number;
  formattedString: string;
} {
  const str = String(input ?? "").trim();
  const digitsOnly = str.replace(/[^0-9]/g, "");

  if (!digitsOnly) {
    return {
      nextNumber: 2,
      padding: 5,
      formattedString: "00002",
    };
  }

  const numeric = parseInt(digitsOnly, 10) || 1;
  const padding = Math.max(1, digitsOnly.length);
  const formattedString = String(numeric).padStart(padding, "0");

  return {
    nextNumber: numeric,
    padding,
    formattedString,
  };
}

/**
 * Formats a credit note number using prefix, sequential integer, and zero-padding.
 * Example: formatCreditNoteNumber("CN-", 2, 5) -> "CN-00002"
 */
export function formatCreditNoteNumber(
  prefix: string,
  nextNumber: number,
  padding: number = 5,
): string {
  const cleanPrefix = String(prefix ?? "CN-");
  const cleanNum = Math.max(1, Number(nextNumber) || 1);
  const cleanPad = Math.max(1, Number(padding) || 5);
  const padded = String(cleanNum).padStart(cleanPad, "0");
  return `${cleanPrefix}${padded}`;
}

/**
 * Extracts the numeric sequence from a CN number if it begins with the given prefix.
 * Example: extractNumberPart("CN-00002", "CN-") -> 2
 */
export function extractNumberPart(cnNumber: string, prefix: string): number | null {
  const num = (cnNumber || "").trim();
  const pfx = (prefix || "").trim();
  if (!num.startsWith(pfx)) return null;

  const remainder = num.slice(pfx.length);
  if (!/^\d+$/.test(remainder)) return null;

  const parsed = parseInt(remainder, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Finds the next available non-colliding CN number starting from `startingNumber`.
 * Guaranteed to never produce duplicates against existing records.
 */
export function findNextAvailableCreditNoteNumber(
  prefix: string,
  startingNumber: number,
  padding: number,
  existingNumbers: Set<string>,
): {
  creditNoteNumber: string;
  allocatedNumber: number;
} {
  let candidate = Math.max(1, startingNumber);
  const maxAttempts = 100000;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const formatted = formatCreditNoteNumber(prefix, candidate, padding);
    if (!existingNumbers.has(formatted)) {
      return {
        creditNoteNumber: formatted,
        allocatedNumber: candidate,
      };
    }
    candidate += 1;
    attempts += 1;
  }

  // Emergency fallback timestamp
  const timestampNumber = Date.now() % 100000;
  return {
    creditNoteNumber: formatCreditNoteNumber(prefix, timestampNumber, padding),
    allocatedNumber: timestampNumber,
  };
}

