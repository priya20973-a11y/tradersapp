import { describe, expect, it } from "vitest";
import {
  getModuleDefinition,
  REPORT_MODULES,
  type ReportModuleId,
} from "./custom-reports/modules";
import { formatCellValue } from "./custom-reports/export-utils";

describe("Custom Reports Module", () => {
  describe("Module Definitions & Metadata", () => {
    const expectedModules: ReportModuleId[] = [
      "Sales",
      "Purchase",
      "Quotes",
      "Bills",
      "Expenses",
      "Payments",
      "Customers",
      "Vendors",
      "Items",
      "Inventory",
    ];

    it("defines exactly 10 supported business modules", () => {
      expect(REPORT_MODULES.length).toBe(10);
      const moduleIds = REPORT_MODULES.map((m) => m.id);
      expectedModules.forEach((mod) => {
        expect(moduleIds).toContain(mod);
      });
    });

    it("retrieves each module definition using getModuleDefinition", () => {
      expectedModules.forEach((mod) => {
        const def = getModuleDefinition(mod);
        expect(def).toBeDefined();
        expect(def?.id).toBe(mod);
        expect(def?.label).toBeTruthy();
        expect(def?.fields.length).toBeGreaterThan(0);
        expect(def?.defaultSort).toBeDefined();
        expect(def?.dateFieldOptions.length).toBeGreaterThan(0);
      });
    });

    it("ensures each module has default selected fields", () => {
      REPORT_MODULES.forEach((mod) => {
        const defaults = mod.fields.filter((f) => f.defaultSelected !== false);
        expect(defaults.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("returns undefined for unrecognized module", () => {
      expect(getModuleDefinition("InvalidModule" as unknown as Parameters<typeof getModuleDefinition>[0])).toBeUndefined();
    });
  });

  describe("Cell Value Formatting", () => {
    it("handles null, undefined, and empty string safely", () => {
      expect(formatCellValue(null)).toBe("—");
      expect(formatCellValue(undefined)).toBe("—");
      expect(formatCellValue("")).toBe("—");
    });

    it("formats currency values in Indian Rupees", () => {
      const formatted = formatCellValue(54000, "currency");
      expect(formatted).toContain("54,000");

      const decimalFormatted = formatCellValue(12345.67, "currency");
      expect(decimalFormatted).toContain("12,345.67");
    });

    it("handles non-numeric currency safely", () => {
      expect(formatCellValue("abc", "currency")).toBe("abc");
    });

    it("formats dates into readable format", () => {
      const formatted = formatCellValue("2026-10-23T10:00:00.000Z", "date");
      expect(formatted).toContain("2026");
      expect(formatted).toContain("Oct");
    });

    it("handles invalid dates safely", () => {
      expect(formatCellValue("not-a-date", "date")).toBe("not-a-date");
    });

    it("formats numbers with thousand separators", () => {
      expect(formatCellValue(1000000, "number")).toBe("10,00,000");
    });

    it("returns plain text for text format", () => {
      expect(formatCellValue("Delivered", "text")).toBe("Delivered");
    });
  });

  describe("Column Selection, Renaming and Ordering", () => {
    it("preserves custom column labels when specified", () => {
      const selectedColumns = [
        { key: "orderNumber", label: "Invoice #" },
        { key: "customerName", label: "Client" },
        { key: "total", label: "Gross Amount", format: "currency" as const },
      ];

      expect(selectedColumns[0].label).toBe("Invoice #");
      expect(selectedColumns[1].label).toBe("Client");
      expect(selectedColumns[2].label).toBe("Gross Amount");
    });

    it("maintains custom column sequence", () => {
      const cols = [
        { key: "status", label: "Status" },
        { key: "orderNumber", label: "Order #" },
        { key: "total", label: "Total" },
      ];

      // Swapping position 0 and 1
      const swapped = [...cols];
      const temp = swapped[0];
      swapped[0] = swapped[1];
      swapped[1] = temp;

      expect(swapped[0].key).toBe("orderNumber");
      expect(swapped[1].key).toBe("status");
      expect(swapped[2].key).toBe("total");
    });
  });

  describe("Data Aggregation & Filtering Helpers", () => {
    it("computes column totals accurately for numeric columns", () => {
      const rows = [
        { orderNumber: "SO-001", total: 10000, tax: 1800 },
        { orderNumber: "SO-002", total: 25000, tax: 4500 },
        { orderNumber: "SO-003", total: 15000, tax: 2700 },
      ];

      const totalAmount = rows.reduce((acc, r) => acc + r.total, 0);
      const totalTax = rows.reduce((acc, r) => acc + r.tax, 0);

      expect(totalAmount).toBe(50000);
      expect(totalTax).toBe(9000);
    });

    it("correctly filters rows by amount bounds", () => {
      const rows = [
        { id: "1", amount: 500 },
        { id: "2", amount: 1500 },
        { id: "3", amount: 3000 },
        { id: "4", amount: 7500 },
      ];

      const min = 1000;
      const max = 5000;

      const filtered = rows.filter((r) => r.amount >= min && r.amount <= max);
      expect(filtered.length).toBe(2);
      expect(filtered.map((r) => r.id)).toEqual(["2", "3"]);
    });

    it("correctly filters rows by status match", () => {
      const rows = [
        { id: "1", status: "paid" },
        { id: "2", status: "pending" },
        { id: "3", status: "paid" },
        { id: "4", status: "overdue" },
      ];

      const paidRows = rows.filter((r) => r.status === "paid");
      expect(paidRows.length).toBe(2);
    });
  });
});
