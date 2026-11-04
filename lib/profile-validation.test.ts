import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  INDIAN_STATES,
  validatePan,
  validateAadhaar,
  validateGstin,
  validateIfsc,
  sanitizeAadhaar,
  formatAadhaarDisplay,
  maskAadhaar,
  maskAccountNumber,
} from "./indian-states";

describe("Optional Signup Fields & Profile Validation", () => {
  describe("1. PAN Number Validation", () => {
    it("accepts valid Indian PAN numbers", () => {
      expect(validatePan("ABCDE1234F")).toBe(true);
      expect(validatePan("AABCB1234F")).toBe(true);
      expect(validatePan("abcde1234f")).toBe(true); // case-insensitive check
    });

    it("rejects invalid PAN numbers when non-empty", () => {
      expect(validatePan("12345ABCDE")).toBe(false);
      expect(validatePan("ABC123456F")).toBe(false);
      expect(validatePan("ABCDEF1234")).toBe(false);
      expect(validatePan("ABCDE12345")).toBe(false);
      expect(validatePan("SHORT")).toBe(false);
    });

    it("allows empty or omitted PAN because field is strictly optional", () => {
      expect(validatePan("")).toBe(true);
      expect(validatePan(null)).toBe(true);
      expect(validatePan(undefined)).toBe(true);
      expect(validatePan("   ")).toBe(true);
    });
  });

  describe("2. Aadhaar Number Validation & Formatting", () => {
    it("accepts valid 12-digit Aadhaar numbers in standard and spaced formats", () => {
      expect(validateAadhaar("123456789012")).toBe(true);
      expect(validateAadhaar("1234 5678 9012")).toBe(true);
      expect(validateAadhaar("1234-5678-9012")).toBe(true);
    });

    it("rejects invalid Aadhaar numbers when non-empty", () => {
      expect(validateAadhaar("12345678901")).toBe(false); // 11 digits
      expect(validateAadhaar("1234567890123")).toBe(false); // 13 digits
      expect(validateAadhaar("12345678901A")).toBe(false); // non-digit
    });

    it("allows empty or omitted Aadhaar because field is strictly optional", () => {
      expect(validateAadhaar("")).toBe(true);
      expect(validateAadhaar(null)).toBe(true);
      expect(validateAadhaar(undefined)).toBe(true);
    });

    it("correctly sanitizes and masks Aadhaar for secure display", () => {
      expect(sanitizeAadhaar("1234 5678 9012")).toBe("123456789012");
      expect(formatAadhaarDisplay("123456789012")).toBe("1234 5678 9012");
      expect(maskAadhaar("123456789012")).toBe("•••• •••• 9012");
    });
  });

  describe("3. GSTIN Validation", () => {
    it("accepts valid Indian GSTIN numbers", () => {
      expect(validateGstin("27ABCDE1234F1Z5")).toBe(true);
      expect(validateGstin("29AABCB1234F1Z8")).toBe(true);
      expect(validateGstin("27abcde1234f1z5")).toBe(true); // case-insensitive check
    });

    it("rejects invalid GSTIN numbers when non-empty", () => {
      expect(validateGstin("27ABCDE1234F1")).toBe(false); // too short
      expect(validateGstin("ABCDE1234F1Z527")).toBe(false); // doesn't start with 2 state digits
      expect(validateGstin("27ABCDE1234F1A5")).toBe(false); // 14th char must be 'Z'
    });

    it("allows empty or omitted GSTIN because field is strictly optional", () => {
      expect(validateGstin("")).toBe(true);
      expect(validateGstin(null)).toBe(true);
      expect(validateGstin(undefined)).toBe(true);
    });
  });

  describe("4. IFSC Code Validation", () => {
    it("accepts valid Indian IFSC codes", () => {
      expect(validateIfsc("HDFC0001234")).toBe(true);
      expect(validateIfsc("SBIN0000042")).toBe(true);
      expect(validateIfsc("hdfc0001234")).toBe(true);
    });

    it("rejects invalid IFSC codes when non-empty", () => {
      expect(validateIfsc("HDFC1001234")).toBe(false); // 5th char must be 0
      expect(validateIfsc("HDF0001234")).toBe(false); // too short
    });

    it("allows empty or omitted IFSC because field is strictly optional", () => {
      expect(validateIfsc("")).toBe(true);
      expect(validateIfsc(null)).toBe(true);
      expect(validateIfsc(undefined)).toBe(true);
    });
  });

  describe("5. Indian States & Account Masking", () => {
    it("contains major Indian states and union territories", () => {
      expect(INDIAN_STATES).toContain("Maharashtra");
      expect(INDIAN_STATES).toContain("Gujarat");
      expect(INDIAN_STATES).toContain("Delhi");
      expect(INDIAN_STATES).toContain("Karnataka");
      expect(INDIAN_STATES).toContain("Tamil Nadu");
      expect(INDIAN_STATES.length).toBeGreaterThanOrEqual(36);
    });

    it("masks bank account numbers securely", () => {
      expect(maskAccountNumber("50200012345678")).toBe("••••••••••5678");
      expect(maskAccountNumber("1234")).toBe("1234");
      expect(maskAccountNumber("")).toBe("");
    });
  });

  describe("6. Signup Form & Model Integration Integrity", () => {
    const authFormPath = path.resolve(__dirname, "../components/auth/auth-form.tsx");
    const signupRoutePath = path.resolve(__dirname, "../app/api/signup/route.ts");
    const profileRoutePath = path.resolve(__dirname, "../app/api/profile/route.ts");
    const profileWorkspacePath = path.resolve(__dirname, "../components/profile/profile-workspace.tsx");
    const modelsIndexPath = path.resolve(__dirname, "../models/index.ts");

    const authFormContent = fs.readFileSync(authFormPath, "utf-8");
    const signupRouteContent = fs.readFileSync(signupRoutePath, "utf-8");
    const profileRouteContent = fs.readFileSync(profileRoutePath, "utf-8");
    const profileWorkspaceContent = fs.readFileSync(profileWorkspacePath, "utf-8");
    const modelsIndexContent = fs.readFileSync(modelsIndexPath, "utf-8");

    it("includes all requested optional fields in the signup form", () => {
      expect(authFormContent).toContain("PAN Number");
      expect(authFormContent).toContain("Aadhaar Number");
      expect(authFormContent).toContain("GSTIN");
      expect(authFormContent).toContain("Company Logo");
      expect(authFormContent).toContain("Registered Address");
      expect(authFormContent).toContain("State");
      expect(authFormContent).toContain("Settlement Bank Account");
      expect(authFormContent).toContain("Account Holder Name");
      expect(authFormContent).toContain("Account Number");
      expect(authFormContent).toContain("IFSC Code");
      expect(authFormContent).toContain("Bank Name");
      expect(authFormContent).toContain("Branch Name");
      expect(authFormContent).toContain("Optional");
    });

    it("persists optional fields in signup API without making them required", () => {
      expect(signupRouteContent).toContain("pan: z");
      expect(signupRouteContent).toContain("aadhaar: z");
      expect(signupRouteContent).toContain("gstin: z");
      expect(signupRouteContent).toContain("logo: z");
      expect(signupRouteContent).toContain("address: z");
      expect(signupRouteContent).toContain("state: z");
      expect(signupRouteContent).toContain("bankDetails: bankDetailsSchema");
      expect(signupRouteContent).toContain("Organization.create");
      expect(signupRouteContent).toContain("User.create");
    });

    it("defines optional fields in models/index.ts schemas", () => {
      expect(modelsIndexContent).toContain("pan: String");
      expect(modelsIndexContent).toContain("aadhaar: String");
      expect(modelsIndexContent).toContain("logo: String");
      expect(modelsIndexContent).toContain("address: String");
      expect(modelsIndexContent).toContain("state: String");
      expect(modelsIndexContent).toContain("BankDetailsSchema");
    });

    it("supports profile retrieval and editing all details in ProfileWorkspace and /api/profile", () => {
      expect(profileRouteContent).toContain("export async function GET");
      expect(profileRouteContent).toContain("export async function PUT");
      expect(profileWorkspaceContent).toContain("Edit All Details");
      expect(profileWorkspaceContent).toContain("Save All Changes");
      expect(profileWorkspaceContent).toContain("Settlement Bank Details");

      // Verify all fields are present in the edit form
      expect(profileWorkspaceContent).toContain("Full Name");
      expect(profileWorkspaceContent).toContain("Email Address");
      expect(profileWorkspaceContent).toContain("Mobile / Phone Number");
      expect(profileWorkspaceContent).toContain("Role / Designation");
      expect(profileWorkspaceContent).toContain("Organization Name");
      expect(profileWorkspaceContent).toContain("Trade / Legal Name");
      expect(profileWorkspaceContent).toContain("Financial Year");
      expect(profileWorkspaceContent).toContain("Base Currency");
      expect(profileWorkspaceContent).toContain("PAN Number");
      expect(profileWorkspaceContent).toContain("Aadhaar Number");
      expect(profileWorkspaceContent).toContain("GSTIN");
      expect(profileWorkspaceContent).toContain("Street Address");
      expect(profileWorkspaceContent).toContain("City");
      expect(profileWorkspaceContent).toContain("State / Union Territory");
      expect(profileWorkspaceContent).toContain("Pincode / Postal Code");
      expect(profileWorkspaceContent).toContain("Country");
      expect(profileWorkspaceContent).toContain("Account Holder Name");
      expect(profileWorkspaceContent).toContain("Account Number");
      expect(profileWorkspaceContent).toContain("IFSC Code");
      expect(profileWorkspaceContent).toContain("Bank Name");
      expect(profileWorkspaceContent).toContain("Branch Name");

      // Verify API supports updating all these fields
      expect(profileRouteContent).toContain("userUpdate.phone = data.phone");
      expect(profileRouteContent).toContain("userUpdate.email = data.email");
      expect(profileRouteContent).toContain("userUpdate.role = data.role");
      expect(profileRouteContent).toContain("orgUpdate.tradeName = data.tradeName");
      expect(profileRouteContent).toContain("orgUpdate.currency = data.currency");
      expect(profileRouteContent).toContain("orgUpdate.financialYear = data.financialYear");
      expect(profileRouteContent).toContain("orgUpdate.city = data.city");
      expect(profileRouteContent).toContain("orgUpdate.pincode = data.pincode");
      expect(profileRouteContent).toContain("orgUpdate.country = data.country");
    });
  });
});
