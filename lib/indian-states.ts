/**
 * Indian States and Union Territories & Validation Utilities
 */

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

// PAN: 5 uppercase letters, 4 digits, 1 uppercase letter
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// Aadhaar: 12 numeric digits (allowing optional space/hyphen separators: "1234 5678 9012" or "1234-5678-9012" or "123456789012")
export const AADHAAR_REGEX = /^(\d{12}|\d{4}\s\d{4}\s\d{4}|\d{4}-\d{4}-\d{4})$/;

// GSTIN: 2-digit state code, 10-char PAN, 1-char entity number, 'Z', 1-char checksum
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// IFSC: 4 uppercase letters, 0, 6 alphanumeric characters
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * Validates PAN number (only when value is non-empty)
 */
export function validatePan(val?: string | null): boolean {
  if (!val || !val.trim()) return true;
  return PAN_REGEX.test(val.trim().toUpperCase());
}

/**
 * Validates Aadhaar number (only when value is non-empty)
 */
export function validateAadhaar(val?: string | null): boolean {
  if (!val || !val.trim()) return true;
  return AADHAAR_REGEX.test(val.trim());
}

/**
 * Validates GSTIN number (only when value is non-empty)
 */
export function validateGstin(val?: string | null): boolean {
  if (!val || !val.trim()) return true;
  return GSTIN_REGEX.test(val.trim().toUpperCase());
}

/**
 * Validates IFSC Code (only when value is non-empty)
 */
export function validateIfsc(val?: string | null): boolean {
  if (!val || !val.trim()) return true;
  return IFSC_REGEX.test(val.trim().toUpperCase());
}

/**
 * Clean Aadhaar string to 12 digits
 */
export function sanitizeAadhaar(val?: string | null): string {
  if (!val) return "";
  return val.replace(/\D/g, "");
}

/**
 * Format Aadhaar with spaces (XXXX XXXX XXXX)
 */
export function formatAadhaarDisplay(val?: string | null): string {
  const digits = sanitizeAadhaar(val);
  if (!digits) return "";
  const parts: string[] = [];
  for (let i = 0; i < digits.length && i < 12; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(" ");
}

/**
 * Mask Aadhaar number for secure display (e.g., •••• •••• 1234)
 */
export function maskAadhaar(val?: string | null): string {
  const digits = sanitizeAadhaar(val);
  if (digits.length < 4) return digits;
  const last4 = digits.slice(-4);
  return `•••• •••• ${last4}`;
}

/**
 * Mask Bank Account Number for secure display (e.g., ••••••••1234)
 */
export function maskAccountNumber(val?: string | null): string {
  if (!val) return "";
  const clean = val.trim();
  if (clean.length <= 4) return clean;
  return "•".repeat(Math.max(0, clean.length - 4)) + clean.slice(-4);
}
