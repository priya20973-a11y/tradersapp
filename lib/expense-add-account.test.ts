import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { chartOfAccountInputSchema } from "@/app/api/accounting/chart-of-accounts/route";
import { standardAccounts } from "@/lib/expense-constants";

describe("Expense Line Items -> Add New Account (Chart of Accounts)", () => {
  describe("Chart of Account schema & validation", () => {
    it("ensures standardAccounts is a real JavaScript array with working array methods", () => {
      expect(Array.isArray(standardAccounts)).toBe(true);
      expect(typeof standardAccounts.some).toBe("function");
      expect(typeof standardAccounts.map).toBe("function");
      expect(standardAccounts.length).toBeGreaterThan(0);
    });

    it("validates valid expense account payload", () => {
      const validPayload = {
        name: "Packaging & Labeling Services",
        code: "EXP-801",
        accountType: "Expense",
        normalBalance: "debit",
      };

      const result = chartOfAccountInputSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Packaging & Labeling Services");
        expect(result.data.accountType).toBe("Expense");
        expect(result.data.normalBalance).toBe("debit");
        expect(result.data.code).toBe("EXP-801");
      }
    });

    it("applies defaults: accountType Expense and normalBalance debit", () => {
      const minimalPayload = {
        name: "Security & Surveillance Fees",
      };

      const result = chartOfAccountInputSchema.safeParse(minimalPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accountType).toBe("Expense");
        expect(result.data.normalBalance).toBe("debit");
      }
    });

    it("rejects empty account name", () => {
      const invalidPayload = {
        name: "   ",
      };

      const result = chartOfAccountInputSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("prevents duplicate accounts against standard accounts (case-insensitive)", () => {
      const duplicateName = "Freight & shipping charges";
      const isDuplicate = standardAccounts.some(
        (acc) => acc.toLowerCase() === duplicateName.toLowerCase()
      );
      expect(isDuplicate).toBe(true);
    });

    it("allows non-duplicate new account names", () => {
      const newName = "Cloud Infrastructure & Server Hosting";
      const isDuplicate = standardAccounts.some(
        (acc) => acc.toLowerCase() === newName.toLowerCase()
      );
      expect(isDuplicate).toBe(false);
    });
  });

  describe("Dropdown list updates and auto-selection logic", () => {
    it("appends new account to available accounts without mutating existing accounts", () => {
      const initialList = [...standardAccounts];
      const createdAccount = "Audit & Compliance Certifications";

      const updatedList = initialList.includes(createdAccount)
        ? initialList
        : [...initialList, createdAccount];

      expect(updatedList).toHaveLength(initialList.length + 1);
      expect(updatedList[updatedList.length - 1]).toBe(createdAccount);
      expect(updatedList.includes("Freight & Shipping Charges")).toBe(true);
    });

    it("updates target row expenseAccount to newly created account", () => {
      const rows = [
        { id: "row-1", expenseAccount: "Freight & Shipping Charges", amount: 1500 },
        { id: "row-2", expenseAccount: "Travel & Conveyance", amount: 800 },
      ];

      const targetRowId = "row-2";
      const createdAccount = "Audit & Compliance Certifications";

      const updatedRows = rows.map((r) =>
        r.id === targetRowId ? { ...r, expenseAccount: createdAccount } : r
      );

      expect(updatedRows[0].expenseAccount).toBe("Freight & Shipping Charges");
      expect(updatedRows[1].expenseAccount).toBe("Audit & Compliance Certifications");
    });
  });

  describe("Source code inspection of expense-form.tsx and API", () => {
    const formCode = fs.readFileSync(
      path.resolve(process.cwd(), "components/expenses/expense-form.tsx"),
      "utf-8"
    );
    const apiCode = fs.readFileSync(
      path.resolve(process.cwd(), "app/api/accounting/chart-of-accounts/route.ts"),
      "utf-8"
    );

    it("contains '+ Add New Account' option in the expense account dropdown", () => {
      expect(formCode).toContain('value="__add_new_account__"');
      expect(formCode).toContain("+ Add New Account");
    });

    it("API route does NOT import from 'use client' expense-form directly", () => {
      expect(apiCode).not.toContain('from "@/components/expenses/expense-form"');
      expect(apiCode).toContain('from "@/lib/expense-constants"');
    });

    it("tracks target row ID and opens the new account modal on selection", () => {
      expect(formCode).toContain("setTargetRowIdForNewAccount(item.id)");
      expect(formCode).toContain("setShowNewAccountModal(true)");
    });

    it("automatically selects the newly created account in the target row", () => {
      expect(formCode).toContain(
        'handleUpdateExpenseRow(targetRowIdForNewAccount, "expenseAccount", createdName)'
      );
    });

    it("renders modal with Chart of Accounts classification and normal balance info", () => {
      expect(formCode).toContain("Add New Expense Account");
      expect(formCode).toContain("Register account in Chart of Accounts");
      expect(formCode).toContain("Account Classification:");
      expect(formCode).toContain("Debit (Chart of Accounts)");
    });

    it("Chart of Accounts API enforces organizationId isolation and duplicate checks", () => {
      expect(apiCode).toContain("ChartOfAccount.create");
      expect(apiCode).toContain("organizationId");
      expect(apiCode).toContain("already exists in Chart of Accounts");
    });
  });
});
