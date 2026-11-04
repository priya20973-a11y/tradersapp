import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Centralized Global Primary Button Theme (#155DFC)", () => {
  const globalsCssPath = path.resolve(__dirname, "../app/globals.css");
  const globalsCssContent = fs.readFileSync(globalsCssPath, "utf-8");

  describe("1. Global CSS Design Tokens & Palette", () => {
    it("defines --primary and --color-blue-600 as #155DFC", () => {
      expect(globalsCssContent).toContain("--primary: #155DFC;");
      expect(globalsCssContent).toContain("--color-primary: #155DFC;");
      expect(globalsCssContent).toContain("--color-blue-600: #155DFC;");
    });

    it("defines hover, active, and focus states matching the blue reference", () => {
      // Hover: #0D47C9
      expect(globalsCssContent).toContain("--primary-hover: #0D47C9;");
      expect(globalsCssContent).toContain("--color-blue-700: #0D47C9;");
      expect(globalsCssContent).toContain("background-color: #0D47C9 !important;");

      // Active: #0A379E
      expect(globalsCssContent).toContain("--primary-active: #0A379E;");
      expect(globalsCssContent).toContain("--color-blue-800: #0A379E;");
      expect(globalsCssContent).toContain("background-color: #0A379E !important;");

      // Focus ring: rgba(21, 93, 252, 0.4)
      expect(globalsCssContent).toContain("rgba(21, 93, 252, 0.4)");
    });

    it("applies white text and white icons to all primary action buttons", () => {
      expect(globalsCssContent).toContain("color: #ffffff !important;");
      expect(globalsCssContent).toContain("button.bg-blue-600 svg");
      expect(globalsCssContent).toContain(".btn-primary svg");
    });

    it("applies consistent disabled state with opacity and not-allowed cursor", () => {
      expect(globalsCssContent).toContain("button.bg-blue-600:disabled");
      expect(globalsCssContent).toContain(".btn-primary:disabled");
      expect(globalsCssContent).toContain("cursor: not-allowed !important;");
    });
  });

  describe("2. Module Primary Action Button Alignment", () => {
    it("verifies Buyers directory uses the blue primary action button theme", () => {
      const buyerDir = fs.readFileSync(
        path.resolve(__dirname, "../components/buyers/buyer-directory.tsx"),
        "utf-8",
      );
      expect(buyerDir).toContain('id="add-buyer-button"');
      expect(buyerDir).toContain("bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700");
    });

    it("verifies Buying Requests workspace uses the blue primary action button theme", () => {
      const buyingReq = fs.readFileSync(
        path.resolve(__dirname, "../components/buying-requests/buying-requests-workspace.tsx"),
        "utf-8",
      );
      expect(buyingReq).toContain("Create Buying Request");
      expect(buyingReq).toContain("bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700");
    });

    it("verifies Invoices and Credit Notes use the primary button theme", () => {
      const invoiceForm = fs.readFileSync(
        path.resolve(__dirname, "../components/invoices/invoice-form.tsx"),
        "utf-8",
      );
      expect(invoiceForm).toContain("bg-blue-600");

      const creditNoteForm = fs.readFileSync(
        path.resolve(__dirname, "../components/sales/new-credit-note-form.tsx"),
        "utf-8",
      );
      expect(creditNoteForm).toContain("bg-blue-600");
    });

    it("verifies Auth page primary button uses the blue button theme", () => {
      const authForm = fs.readFileSync(
        path.resolve(__dirname, "../components/auth/auth-form.tsx"),
        "utf-8",
      );
      expect(authForm).toContain("bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700");
    });

    it("verifies Commodity – Add New Item uses global blue-600 theme", () => {
      const itemsPage = fs.readFileSync(
        path.resolve(__dirname, "../app/items/page.tsx"),
        "utf-8",
      );
      expect(itemsPage).toContain("Add New Item");
      expect(itemsPage).toMatch(/bg-blue-600[^"]*hover:bg-blue-700[^"]*[\s\S]*?Add New Item/);
      expect(itemsPage).not.toContain("from-emerald-600 to-teal-600");
    });

    it("verifies Customer – New Customer uses global blue-600 theme", () => {
      const customerDir = fs.readFileSync(
        path.resolve(__dirname, "../components/sales/customer-directory.tsx"),
        "utf-8",
      );
      expect(customerDir).toContain("New Customer");
      expect(customerDir).toMatch(/bg-blue-600[^"]*hover:bg-blue-700[^"]*[\s\S]*?New Customer/);
      expect(customerDir).not.toContain("from-emerald-600 to-teal-600");
      expect(customerDir).not.toContain("bg-emerald-600 hover:bg-emerald-700");

      const newCustomerForm = fs.readFileSync(
        path.resolve(__dirname, "../components/sales/new-customer-form.tsx"),
        "utf-8",
      );
      expect(newCustomerForm).toContain("bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700");
      expect(newCustomerForm).not.toContain("from-emerald-600 to-teal-600");
    });

    it("verifies Recurring Invoice – New Recurring Invoice button uses global blue-600 theme", () => {
      const salesWorkspace = fs.readFileSync(
        path.resolve(__dirname, "../components/sales/sales-workspace.tsx"),
        "utf-8",
      );
      expect(salesWorkspace).toContain("bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700");
      expect(salesWorkspace).not.toContain("bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700");
    });

    it("verifies Vendor – Add Vendor uses global blue-600 theme", () => {
      const vendorsDir = fs.readFileSync(
        path.resolve(__dirname, "../components/purchases/vendors-directory.tsx"),
        "utf-8",
      );
      expect(vendorsDir).toContain("Add vendor");
      expect(vendorsDir).toContain("bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700");
      expect(vendorsDir).not.toContain("bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800");

      const vendorForm = fs.readFileSync(
        path.resolve(__dirname, "../components/purchases/vendor-form.tsx"),
        "utf-8",
      );
      expect(vendorForm).toContain("bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700");
    });

    it("verifies Expense – Record Expense uses global blue-600 theme", () => {
      const expensesDir = fs.readFileSync(
        path.resolve(__dirname, "../components/expenses/expenses-directory.tsx"),
        "utf-8",
      );
      expect(expensesDir).toContain("Record Expense");
      expect(expensesDir).toContain("bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700");
      expect(expensesDir).not.toContain("bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800");

      const expenseForm = fs.readFileSync(
        path.resolve(__dirname, "../components/expenses/expense-form.tsx"),
        "utf-8",
      );
      expect(expenseForm).toContain("bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700");
    });

    it("verifies Purchase Order – New Purchase Order uses global blue-600 theme", () => {
      const poDir = fs.readFileSync(
        path.resolve(__dirname, "../components/purchases/purchase-orders-directory.tsx"),
        "utf-8",
      );
      expect(poDir).toContain("New Purchase Order");
      expect(poDir).toContain("bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700");
      expect(poDir).not.toContain("bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800");

      const poForm = fs.readFileSync(
        path.resolve(__dirname, "../components/purchases/purchase-order-form.tsx"),
        "utf-8",
      );
      expect(poForm).toContain("bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700");
    });
  });

  describe("3. Preservation of Semantic & Distinct Button Styles", () => {
    it("preserves Cancel / Close secondary button styling with white background and slate border", () => {
      const buyerDir = fs.readFileSync(
        path.resolve(__dirname, "../components/buyers/buyer-directory.tsx"),
        "utf-8",
      );
      expect(buyerDir).toContain("border border-slate-300");
      expect(buyerDir).toContain("text-slate-700 hover:bg-slate-50");
    });

    it("preserves Delete / Void buttons in rose styling", () => {
      const creditNoteDetail = fs.readFileSync(
        path.resolve(__dirname, "../components/sales/credit-note-detail-view.tsx"),
        "utf-8",
      );
      expect(creditNoteDetail).toContain("border-rose-200 bg-rose-50");
      expect(creditNoteDetail).toContain("text-rose-700 hover:bg-rose-100");
    });

    it("preserves Sidebar active item styling in orange #FF8C00", () => {
      const appShell = fs.readFileSync(
        path.resolve(__dirname, "../components/layout/app-shell.tsx"),
        "utf-8",
      );
      expect(appShell).toContain("bg-[#FF8C00] font-medium text-white shadow-sm");
    });
  });
});

