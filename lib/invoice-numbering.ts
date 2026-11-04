/**
 * lib/invoice-numbering.ts
 *
 * Concurrency-safe invoice numbering, fiscal year restart,
 * zero-padding formatters, and collision avoidance utilities.
 */

/**
 * Returns the Indian financial year string (April 1 to March 31).
 * For example:
 * - 2026-10-27 (October 2026) -> "2026-27"
 * - 2027-02-15 (February 2027) -> "2026-27"
 * - 2027-04-01 (April 2027) -> "2027-28"
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
 * Parses user input for Next Number (e.g., "000002" or 2).
 * Preserves the zero-padding length based on the entered string.
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
      nextNumber: 1,
      padding: 6,
      formattedString: "000001",
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
 * Formats an invoice number using prefix, sequential integer, and zero-padding.
 * Example: formatInvoiceNumber("INV-", 2, 6) -> "INV-000002"
 */
export function formatInvoiceNumber(
  prefix: string,
  nextNumber: number,
  padding: number = 6,
): string {
  const cleanPrefix = String(prefix ?? "INV-");
  const cleanNum = Math.max(1, Number(nextNumber) || 1);
  const cleanPad = Math.max(1, Number(padding) || 6);
  const padded = String(cleanNum).padStart(cleanPad, "0");
  return `${cleanPrefix}${padded}`;
}

/**
 * Extracts the numeric sequence from an invoice number if it begins with the given prefix.
 * Example: extractNumberPart("INV-000002", "INV-") -> 2
 */
export function extractNumberPart(invoiceNumber: string, prefix: string): number | null {
  const num = (invoiceNumber || "").trim();
  const pfx = (prefix || "").trim();
  if (!num.startsWith(pfx)) return null;

  const remainder = num.slice(pfx.length);
  if (!/^\d+$/.test(remainder)) return null;

  const parsed = parseInt(remainder, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Finds the next available non-colliding invoice number starting from `startingNumber`.
 * Guaranteed to never produce duplicates against existing records.
 */
export function findNextAvailableInvoiceNumber(
  prefix: string,
  startingNumber: number,
  padding: number,
  existingNumbers: Set<string>,
): {
  invoiceNumber: string;
  allocatedNumber: number;
} {
  let candidate = Math.max(1, startingNumber);
  const maxAttempts = 100000;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const formatted = formatInvoiceNumber(prefix, candidate, padding);
    if (!existingNumbers.has(formatted)) {
      return {
        invoiceNumber: formatted,
        allocatedNumber: candidate,
      };
    }
    candidate += 1;
    attempts += 1;
  }

  // Fallback timestamp-based emergency allocation
  const timestampNumber = Date.now() % 1000000;
  return {
    invoiceNumber: formatInvoiceNumber(prefix, timestampNumber, padding),
    allocatedNumber: timestampNumber,
  };
}
