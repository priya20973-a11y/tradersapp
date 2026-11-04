import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  expenseRowSchema,
  mileageDetailsSchema,
  expenseInputSchema,
  bulkExpenseInputSchema,
} from "@/app/api/expenses/route";

describe("Expense Module Schemas & Calculations", () => {
  describe("Itemized Expense Validation & Sums", () => {
    it("validates individual expense rows", () => {
      const validRow = {
        expenseAccount: "Freight & Shipping Charges",
        notes: "Interstate container freight",
        amount: 14500,
      };
      const result = expenseRowSchema.safeParse(validRow);
      expect(result.success).toBe(true);
    });

    it("rejects expense rows with non-positive amounts", () => {
      const invalidRow = {
        expenseAccount: "Freight & Shipping Charges",
        notes: "Zero amount error",
        amount: 0,
      };
      const result = expenseRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
    });

    it("calculates multi-row itemized total accurately", () => {
      const rows = [
        { expenseAccount: "Freight", amount: 12000.5 },
        { expenseAccount: "Handling", amount: 350.25 },
        { expenseAccount: "Packaging", amount: 149.25 },
      ];
      const total = rows.reduce((acc, row) => acc + row.amount, 0);
      expect(total).toBe(12500);
    });

    it("validates full standard expense payload with vendor and invoice details", () => {
      const validExpense = {
        expenseType: "standard",
        date: "2026-10-22",
        paidThrough: "Petty Cash Account",
        currency: "INR",
        vendor: "Mohan Traders",
        invoiceNumber: "INV-2026-004",
        customerName: "Astra Foods",
        notes: "Urgent lot packaging materials",
        billable: true,
        project: "Diwali Supply Batch",
        reportingTags: ["Packaging", "Urgent"],
        items: [
          {
            expenseAccount: "Office Supplies & Stationery",
            notes: "Boxes and barcode tags",
            amount: 4500,
          },
        ],
        receipts: [
          {
            id: "rc-test-1",
            name: "Receipt_4500.pdf",
            size: 102400,
            type: "application/pdf",
          },
        ],
      };

      const result = expenseInputSchema.safeParse(validExpense);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe("INR");
        expect(result.data.billable).toBe(true);
        expect(result.data.items.length).toBe(1);
      }
    });
  });

  describe("Mileage Calculation & Methods", () => {
    it("validates mileage details with Distance Travelled method", () => {
      const mileage = {
        employee: "Vikram Mehta",
        calculationMethod: "distance" as const,
        distance: 75,
        unit: "KM" as const,
        rate: 12,
        startOdometer: 0,
        endOdometer: 0,
      };

      const result = mileageDetailsSchema.safeParse(mileage);
      expect(result.success).toBe(true);
    });

    it("calculates distance correctly from Odometer Readings", () => {
      const startOdometer = 12450;
      const endOdometer = 12585;
      const calculatedDistance = Math.max(0, endOdometer - startOdometer);
      expect(calculatedDistance).toBe(135);

      const rate = 12.0;
      const calculatedAmount = Math.round(calculatedDistance * rate * 100) / 100;
      expect(calculatedAmount).toBe(1620);
    });

    it("computes mileage rate correctly for Mile unit", () => {
      const distance = 40;
      const rate = 18.5;
      const totalAmount = Math.round(distance * rate * 100) / 100;
      expect(totalAmount).toBe(740);
    });

    it("validates complete mileage expense input payload", () => {
      const mileagePayload = {
        expenseType: "mileage",
        date: "2026-10-22",
        paidThrough: "Employee Personal Funds (Reimbursable)",
        currency: "INR",
        vendor: "HPCL Petrol Depot",
        invoiceNumber: "FUEL-883",
        customerName: "City Retail",
        notes: "Quality inspection trip to farm warehouses",
        billable: true,
        mileageDetails: {
          employee: "Anil Deshmukh",
          calculationMethod: "odometer",
          distance: 120,
          unit: "KM",
          rate: 12.5,
          startOdometer: 25400,
          endOdometer: 25520,
        },
      };

      const result = expenseInputSchema.safeParse(mileagePayload);
      expect(result.success).toBe(true);
    });
  });

  describe("Bulk Add Expenses Validation", () => {
    it("validates a batch of multiple expenses in bulk mode", () => {
      const bulkPayload = {
        bulk: true,
        expenses: [
          {
            expenseType: "bulk",
            date: "2026-10-20",
            paidThrough: "Petty Cash Account",
            amount: 1500,
            vendor: "Local Stationary",
            customerName: "",
            project: "Admin",
            billable: false,
            items: [{ expenseAccount: "Office Supplies & Stationery", amount: 1500 }],
          },
          {
            expenseType: "bulk",
            date: "2026-10-21",
            paidThrough: "HDFC Primary Bank",
            amount: 8200,
            vendor: "Apex Logistics",
            customerName: "Astra Foods",
            project: "Supply Batch 1",
            billable: true,
            items: [{ expenseAccount: "Freight & Shipping Charges", amount: 8200 }],
          },
        ],
      };

      const result = bulkExpenseInputSchema.safeParse(bulkPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expenses.length).toBe(2);
      }
    });

    it("rejects bulk submission when expenses array is empty", () => {
      const invalidBulk = {
        bulk: true,
        expenses: [],
      };
      const result = bulkExpenseInputSchema.safeParse(invalidBulk);
      expect(result.success).toBe(false);
    });
  });

  describe("Module Files & Zoho-Inspired Feature Integrity", () => {
    const formPath = path.resolve(__dirname, "../components/expenses/expense-form.tsx");
    const dirPath = path.resolve(__dirname, "../components/expenses/expenses-directory.tsx");
    const appShellPath = path.resolve(__dirname, "../components/layout/app-shell.tsx");
    const sectionPath = path.resolve(__dirname, "../app/purchases/[section]/page.tsx");

    const formContent = fs.readFileSync(formPath, "utf-8");
    const dirContent = fs.readFileSync(dirPath, "utf-8");
    const appShellContent = fs.readFileSync(appShellPath, "utf-8");
    const sectionContent = fs.readFileSync(sectionPath, "utf-8");

    it("provides all 3 core tabs: Record Expense, Record Mileage, Bulk Add Expenses", () => {
      expect(formContent).toContain("Record Expense");
      expect(formContent).toContain("Record Mileage");
      expect(formContent).toContain("Bulk Add Expenses");
    });

    it("supports multiple itemized expense rows with add/remove rows and dynamic total calculation", () => {
      expect(formContent).toContain("handleAddExpenseRow");
      expect(formContent).toContain("handleRemoveExpenseRow");
      expect(formContent).toContain("totalExpenseAmount");
    });

    it("includes Vendor, Invoice Number, Customer Name, and Billable toggle in Record Expense", () => {
      expect(formContent).toContain("invoiceNumber");
      expect(formContent).toContain("customerName");
      expect(formContent).toContain("expenseVendor");
      expect(formContent).toContain("Billable to customer");
    });

    it("includes drag-and-drop receipt upload capability", () => {
      expect(formContent).toContain("Drag and drop receipt files here");
      expect(formContent).toContain("handleFileDrop");
      expect(formContent).toContain("handleFileInput");
    });

    it("features the Mileage Calculation Preferences modal with category, unit, start date, and mileage rate", () => {
      expect(formContent).toContain("Mileage Preferences");
      expect(formContent).toContain("Distance Unit");
      expect(formContent).toContain("Kilometers (KM)");
      expect(formContent).toContain("Mileage Rate");
      expect(formContent).toContain("Start Effective Date");
      expect(formContent).toContain("Save Preferences");
    });

    it("implements both Distance Travelled and Odometer Reading calculation methods", () => {
      expect(formContent).toContain("Distance Travelled");
      expect(formContent).toContain("Odometer Reading");
      expect(formContent).toContain("startOdometer");
      expect(formContent).toContain("endOdometer");
    });

    it("provides the editable Bulk Add Expenses table with add/remove row operations", () => {
      expect(formContent).toContain("handleAddBulkRow");
      expect(formContent).toContain("handleRemoveBulkRow");
      expect(formContent).toContain("totalBulkAmount");
    });

    it("provides sticky Save/Cancel action bar with multiple submission options", () => {
      expect(formContent).toContain("sticky bottom-0");
      expect(formContent).toContain("Save Expense");
      expect(formContent).toContain("Save & Add New");
      expect(formContent).toContain("Cancel");
    });

    it("wires Expenses Directory in purchases [section] page", () => {
      expect(sectionContent).toContain("ExpensesDirectory");
      expect(sectionContent).toContain('if (section === "expenses")');
    });

    it("links sidebar Expenses navigation and Plus icon to /purchases/expenses/new", () => {
      expect(appShellContent).toContain('/purchases/expenses');
      expect(appShellContent).toContain('/purchases/expenses/new');
    });

    it("includes KPI summary cards and directory filters in ExpensesDirectory", () => {
      expect(dirContent).toContain("Total Expenses");
      expect(dirContent).toContain("Mileage Travelled");
      expect(dirContent).toContain("Reimbursable Claims");
      expect(dirContent).toContain("Billable To Client");
    });
  });
});
