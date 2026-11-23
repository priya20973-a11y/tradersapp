import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Bills Directory Horizontal Scrolling", () => {
  const billsDirectoryPath = path.resolve(
    process.cwd(),
    "components/purchases/bills-directory.tsx"
  );
  const fileContent = fs.readFileSync(billsDirectoryPath, "utf-8");

  it("should have an outer card container with rounded-2xl, border, and overflow-hidden", () => {
    expect(fileContent).toContain(
      'className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"'
    );
  });

  it("should wrap the bills table with an overflow-x-auto container for horizontal scrolling", () => {
    // Verifies that overflow-x-auto is present between the outer card and the table
    const tableIndex = fileContent.indexOf("<table");
    const overflowAutoIndex = fileContent.indexOf('className="overflow-x-auto"');
    expect(overflowAutoIndex).toBeGreaterThan(-1);
    expect(overflowAutoIndex).toBeLessThan(tableIndex);
  });

  it("should preserve all 9 table columns without removing or hiding any", () => {
    const requiredColumns = [
      "Date",
      "Bill #",
      "Vendor Name",
      "Order #",
      "Due Date",
      "Status",
      "Amount",
      "Balance Due",
      "Actions",
    ];

    for (const column of requiredColumns) {
      expect(fileContent).toContain(`>${column}</th>`);
    }
  });

  it("should apply whitespace-nowrap to the header to prevent awkward column folding", () => {
    expect(fileContent).toMatch(
      /<thead[^>]*whitespace-nowrap[^>]*>/
    );
  });

  it("should preserve all cell data fields and action buttons for all 9 columns", () => {
    // 1. Date
    expect(fileContent).toContain("formatDate(b.billDate)");
    // 2. Bill #
    expect(fileContent).toContain("b.billNumber");
    // 3. Vendor Name
    expect(fileContent).toContain("b.vendorName");
    // 4. Order #
    expect(fileContent).toContain("b.orderNumber");
    // 5. Due Date
    expect(fileContent).toContain("formatDate(b.dueDate)");
    // 6. Status
    expect(fileContent).toContain("b.status");
    // 7. Amount
    expect(fileContent).toContain("formatINR(b.total)");
    // 8. Balance Due
    expect(fileContent).toContain("formatINR(b.balanceDue)");
    // 9. Actions (View, Edit, Apply Vendor Credit, Record Payment, Delete)
    expect(fileContent).toContain("View Bill Details");
    expect(fileContent).toContain("Edit Bill");
    expect(fileContent).toContain("Apply Vendor Credit");
    expect(fileContent).toContain("Record Payment");
    expect(fileContent).toContain("Delete Bill");
  });

  it("should verify purchases-workspace fallback table also wraps with overflow-x-auto", () => {
    const workspacePath = path.resolve(
      process.cwd(),
      "components/purchases/purchases-workspace.tsx"
    );
    const workspaceContent = fs.readFileSync(workspacePath, "utf-8");
    expect(workspaceContent).toContain('className="overflow-x-auto"');
    const tableIndex = workspaceContent.indexOf("<table");
    const overflowAutoIndex = workspaceContent.indexOf('className="overflow-x-auto"');
    expect(overflowAutoIndex).toBeGreaterThan(-1);
    expect(overflowAutoIndex).toBeLessThan(tableIndex);
  });
});
