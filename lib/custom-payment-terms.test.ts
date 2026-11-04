import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  calculateDueDateFromPaymentTerms,
  isDuplicatePaymentTerm,
  type PaymentTermItem,
} from "./payment-terms";
import { createPaymentTermSchema } from "../app/api/payment-terms/route";

describe("Custom Payment Terms Feature", () => {
  describe("1. Due Date Calculation with Standard & Custom Terms", () => {
    const baseDate = "2026-10-10";

    it("calculates due date for standard terms accurately", () => {
      expect(calculateDueDateFromPaymentTerms(baseDate, "Due on Receipt")).toBe("2026-10-10");
      expect(calculateDueDateFromPaymentTerms(baseDate, "Net 15")).toBe("2026-10-25");
      expect(calculateDueDateFromPaymentTerms(baseDate, "Net 30")).toBe("2026-11-09");
      expect(calculateDueDateFromPaymentTerms(baseDate, "Net 45")).toBe("2026-11-24");
      expect(calculateDueDateFromPaymentTerms(baseDate, "Net 60")).toBe("2026-12-09");
    });

    it("calculates due date for Due End of the Month correctly", () => {
      expect(calculateDueDateFromPaymentTerms("2026-10-10", "Due End of the Month")).toBe("2026-10-31");
      expect(calculateDueDateFromPaymentTerms("2026-02-15", "Due End of the Month")).toBe("2026-02-28");
      // Leap year check
      expect(calculateDueDateFromPaymentTerms("2024-02-10", "Due End of the Month")).toBe("2024-02-29");
    });

    it("calculates due date using custom payment terms with custom due days", () => {
      const customTerms: PaymentTermItem[] = [
        { name: "VIP 20 Days", days: 20, isCustom: true },
        { name: "Partner 40 Days", days: 40, isCustom: true },
        { name: "Net 90 Extended", days: 90, isCustom: true },
        { name: "Cash on Spot", days: 0, isCustom: true },
      ];

      expect(calculateDueDateFromPaymentTerms(baseDate, "VIP 20 Days", customTerms)).toBe("2026-10-30");
      expect(calculateDueDateFromPaymentTerms(baseDate, "Partner 40 Days", customTerms)).toBe("2026-11-19");
      expect(calculateDueDateFromPaymentTerms(baseDate, "Net 90 Extended", customTerms)).toBe("2027-01-08");
      expect(calculateDueDateFromPaymentTerms(baseDate, "Cash on Spot", customTerms)).toBe("2026-10-10");
    });

    it("is case-insensitive when matching terms", () => {
      expect(calculateDueDateFromPaymentTerms(baseDate, "net 15")).toBe("2026-10-25");
      expect(calculateDueDateFromPaymentTerms(baseDate, "NET 30")).toBe("2026-11-09");
      expect(calculateDueDateFromPaymentTerms(baseDate, "due on receipt")).toBe("2026-10-10");

      const customTerms: PaymentTermItem[] = [
        { name: "Special Term", days: 25, isCustom: true },
      ];
      expect(calculateDueDateFromPaymentTerms(baseDate, "special term", customTerms)).toBe("2026-11-04");
      expect(calculateDueDateFromPaymentTerms(baseDate, "SPECIAL TERM", customTerms)).toBe("2026-11-04");
    });

    it("falls back to regex extraction for numeric terms if custom terms list is not loaded", () => {
      expect(calculateDueDateFromPaymentTerms(baseDate, "Net 75")).toBe("2026-12-24");
      expect(calculateDueDateFromPaymentTerms(baseDate, "50 Days")).toBe("2026-11-29");
    });
  });

  describe("2. Duplicate Term Detection", () => {
    it("flags standard terms as duplicates case-insensitively", () => {
      expect(isDuplicatePaymentTerm("Net 30")).toBe(true);
      expect(isDuplicatePaymentTerm("net 30")).toBe(true);
      expect(isDuplicatePaymentTerm("NET 15")).toBe(true);
      expect(isDuplicatePaymentTerm("Due on Receipt")).toBe(true);
      expect(isDuplicatePaymentTerm("due end of the month")).toBe(true);
    });

    it("flags existing custom terms as duplicates case-insensitively", () => {
      const existing = [
        { name: "Custom 45" },
        { name: "Vendor Net 10" },
      ];
      expect(isDuplicatePaymentTerm("Custom 45", existing)).toBe(true);
      expect(isDuplicatePaymentTerm("custom 45", existing)).toBe(true);
      expect(isDuplicatePaymentTerm("VENDOR NET 10", existing)).toBe(true);
      expect(isDuplicatePaymentTerm("Brand New Term", existing)).toBe(false);
    });
  });

  describe("3. API Validation Schema", () => {
    it("validates valid payment term inputs", () => {
      const valid = createPaymentTermSchema.safeParse({
        name: "Custom 75 Days",
        days: 75,
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.name).toBe("Custom 75 Days");
        expect(valid.data.days).toBe(75);
      }
    });

    it("rejects empty names and invalid days", () => {
      const emptyName = createPaymentTermSchema.safeParse({ name: "   ", days: 30 });
      expect(emptyName.success).toBe(false);

      const negativeDays = createPaymentTermSchema.safeParse({ name: "Negative", days: -5 });
      expect(negativeDays.success).toBe(false);

      const tooManyDays = createPaymentTermSchema.safeParse({ name: "Huge", days: 500 });
      expect(tooManyDays.success).toBe(false);
    });
  });

  describe("4. Component & Integration Wiring", () => {
    const customerTabsPath = path.resolve(__dirname, "../components/sales/customer/customer-form-tabs.tsx");
    const customerEditModalPath = path.resolve(__dirname, "../components/sales/customer/customer-edit-modal.tsx");
    const addTermModalPath = path.resolve(__dirname, "../components/sales/customer/add-payment-term-modal.tsx");
    const invoiceFormPath = path.resolve(__dirname, "../components/invoices/invoice-form.tsx");
    const modelsIndexPath = path.resolve(__dirname, "../models/index.ts");
    const apiInvoicesPath = path.resolve(__dirname, "../app/api/sales/invoices/route.ts");

    it("ensures PaymentTerm model is exported from models/index.ts", () => {
      const modelsContent = fs.readFileSync(modelsIndexPath, "utf-8");
      expect(modelsContent).toContain('export * from "./payment-term"');
    });

    it("ensures CustomerFormTabs includes Add New Payment Term option and modal", () => {
      const tabsContent = fs.readFileSync(customerTabsPath, "utf-8");
      expect(tabsContent).toContain("+ Add New Payment Term");
      expect(tabsContent).toContain("AddPaymentTermModal");
      expect(tabsContent).toContain("/api/payment-terms");
    });

    it("ensures CustomerEditModal includes Add New Payment Term option and modal", () => {
      const editContent = fs.readFileSync(customerEditModalPath, "utf-8");
      expect(editContent).toContain("+ Add New Payment Term");
      expect(editContent).toContain("AddPaymentTermModal");
      expect(editContent).toContain("/api/payment-terms");
    });

    it("ensures AddPaymentTermModal captures term name and due days", () => {
      const modalContent = fs.readFileSync(addTermModalPath, "utf-8");
      expect(modalContent).toContain("Term Name");
      expect(modalContent).toContain("Number of Due Days");
      expect(modalContent).toContain("/api/payment-terms");
    });

    it("ensures InvoiceForm dynamically includes custom payment terms and updates due dates", () => {
      const invFormContent = fs.readFileSync(invoiceFormPath, "utf-8");
      expect(invFormContent).toContain("/api/payment-terms");
      expect(invFormContent).toContain("calculateDueDateFromPaymentTerms");
      expect(invFormContent).toContain("allPaymentTermsOptions");
    });

    it("ensures Invoice creation API handles payment terms and computes due dates with custom terms", () => {
      const apiInvContent = fs.readFileSync(apiInvoicesPath, "utf-8");
      expect(apiInvContent).toContain("PaymentTerm");
      expect(apiInvContent).toContain("calculateDueDateFromPaymentTerms");
    });
  });
});
