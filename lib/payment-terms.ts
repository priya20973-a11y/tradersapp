/**
 * lib/payment-terms.ts
 *
 * Core payment terms definitions, due date calculations for standard and custom terms,
 * duplicate detection, and date formatting helpers.
 */

export interface PaymentTermItem {
  id?: string;
  name: string;
  days: number;
  isCustom?: boolean;
}

export const STANDARD_PAYMENT_TERMS: readonly PaymentTermItem[] = [
  { id: "standard-receipt", name: "Due on Receipt", days: 0, isCustom: false },
  { id: "standard-15", name: "Net 15", days: 15, isCustom: false },
  { id: "standard-30", name: "Net 30", days: 30, isCustom: false },
  { id: "standard-45", name: "Net 45", days: 45, isCustom: false },
  { id: "standard-60", name: "Net 60", days: 60, isCustom: false },
  { id: "standard-eom", name: "Due End of the Month", days: -1, isCustom: false },
];

export function formatDateOnly(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }
  if (typeof dateInput === "string") {
    const cleanStr = dateInput.split("T")[0];
    const parts = cleanStr.split("-").map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }
  return new Date();
}

/**
 * Calculates due date string (YYYY-MM-DD) based on issue date and payment terms.
 * Supports:
 *  - Custom payment terms (looked up by name from customTerms list)
 *  - Standard terms (Due on Receipt, Net 15/30/45/60, Due End of the Month)
 *  - Regex extraction for patterns like "Net 45", "45 Days", etc.
 */
export function calculateDueDateFromPaymentTerms(
  issueDateInput: string | Date,
  termName?: string,
  customTerms?: PaymentTermItem[]
): string {
  if (!issueDateInput) return "";

  const baseDate = parseDateOnly(issueDateInput);
  if (isNaN(baseDate.getTime())) {
    return typeof issueDateInput === "string" ? issueDateInput : "";
  }

  const trimmedTerm = (termName || "Due on Receipt").trim();
  const termLower = trimmedTerm.toLowerCase();

  // 1. Look in customTerms if provided
  if (customTerms && customTerms.length > 0) {
    const matched = customTerms.find((t) => t.name.trim().toLowerCase() === termLower);
    if (matched && typeof matched.days === "number") {
      if (matched.days === -1) {
        const endOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
        return formatDateOnly(endOfMonth);
      }
      const due = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + matched.days);
      return formatDateOnly(due);
    }
  }

  // 2. Look in standard terms
  const standard = STANDARD_PAYMENT_TERMS.find((t) => t.name.toLowerCase() === termLower);
  if (standard) {
    if (standard.days === -1) {
      const endOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
      return formatDateOnly(endOfMonth);
    }
    const due = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + standard.days);
    return formatDateOnly(due);
  }

  // 3. Regex fallback: "Net 45", "45 Days", "Custom (45 days)", etc.
  const regexMatch =
    trimmedTerm.match(/Net\s*(\d+)/i) ||
    trimmedTerm.match(/(\d+)\s*days?/i) ||
    trimmedTerm.match(/\b(\d+)\b/);

  if (regexMatch) {
    const days = parseInt(regexMatch[1], 10);
    if (!isNaN(days) && days >= 0) {
      const due = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + days);
      return formatDateOnly(due);
    }
  }

  // Fallback: Due on receipt (same date)
  return formatDateOnly(baseDate);
}

/**
 * Checks if a proposed payment term name is duplicate against standard or existing custom terms.
 */
export function isDuplicatePaymentTerm(
  name: string,
  existingTerms: Array<{ name: string }> = []
): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;

  const isStandard = STANDARD_PAYMENT_TERMS.some(
    (t) => t.name.toLowerCase() === normalized
  );
  if (isStandard) return true;

  return existingTerms.some((t) => t.name.trim().toLowerCase() === normalized);
}
