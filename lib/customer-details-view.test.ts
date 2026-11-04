import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  calculateCustomerReceivable,
  type Customer,
  type SalesDocument,
} from "@/components/sales/customer/customer-types";

describe("Customer Details Zoho Books Master-Detail Layout", () => {
  const mockCustomer: Customer = {
    id: "cust-101",
    name: "Astra Foods Ltd",
    customerType: "Business",
    companyName: "Astra Foods Enterprises",
    email: "billing@astrafoods.in",
    phone: "+91 98200 11223",
    mobile: "+91 98200 99887",
    openingBalance: 15000,
    creditLimit: 200000,
    unusedCredits: 5000,
    status: "Active",
    gstin: "27AABCA1234F1Z8",
    pan: "AABCA1234F",
    state: "Maharashtra",
    paymentTerms: "Net 30",
    currency: "INR",
    customerLanguage: "English",
    billingAddress: {
      attention: "Accounts Department",
      street: "Plot 42, MIDC Industrial Area",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400093",
      country: "India",
    },
    shippingAddress: {
      attention: "Central Warehouse",
      street: "Gate 3, Logistics Hub",
      city: "Bhiwandi",
      state: "Maharashtra",
      postalCode: "421302",
      country: "India",
    },
    contactPersons: [{ name: "Rajesh Kumar", email: "rajesh@astrafoods.in" }],
    createdAt: "2026-10-01T09:00:00.000Z",
  };

  const mockDocuments: SalesDocument[] = [
    {
      id: "inv-1",
      type: "Invoice",
      number: "INV-1025",
      customerId: "cust-101",
      total: 50000,
      amountPaid: 20000,
      creditedAmount: 0,
      status: "Partly Paid",
      issueDate: "2026-10-05T10:00:00.000Z",
    },
    {
      id: "inv-2",
      type: "Invoice",
      number: "INV-1028",
      customerId: "cust-101",
      total: 42500,
      amountPaid: 42500,
      creditedAmount: 0,
      status: "Paid",
      issueDate: "2026-10-12T10:00:00.000Z",
    },
    {
      id: "pmt-1",
      type: "Payment Received",
      number: "REC-201",
      customerId: "cust-101",
      total: 20000,
      amountPaid: 0,
      creditedAmount: 0,
      status: "Paid",
      paymentDate: "2026-10-08T14:30:00.000Z",
      method: "Bank Transfer",
      referenceNumber: "NEFT884920",
    },
    {
      id: "qt-1",
      type: "Quote",
      number: "QT-501",
      customerId: "cust-101",
      total: 65000,
      amountPaid: 0,
      creditedAmount: 0,
      status: "Accepted",
      issueDate: "2026-10-02T11:00:00.000Z",
    },
  ];

  describe("Financial Calculations & Data Integrity", () => {
    it("accurately calculates customer receivables reusing calculateCustomerReceivable", () => {
      // Opening balance: 15,000
      // inv-1: 50,000 total - 20,000 paid = 30,000 due
      // inv-2: 42,500 total - 42,500 paid = 0 due
      // Total receivable: 15,000 + 30,000 = 45,000
      const receivable = calculateCustomerReceivable(mockCustomer, mockDocuments);
      expect(receivable).toBe(45000);
    });

    it("handles zero invoices and relies solely on opening balance", () => {
      const emptyReceivable = calculateCustomerReceivable(mockCustomer, []);
      expect(emptyReceivable).toBe(15000);
    });
  });

  describe("File & Component Code Integrity", () => {
    it("verifies CustomerDetailView component contains all required Zoho Books sections", () => {
      const filePath = path.join(
        process.cwd(),
        "components",
        "sales",
        "customer",
        "customer-detail-view.tsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      // Left panel with customer list, search/filter, and Add Customer button
      expect(content).toContain("Search customers...");
      expect(content).toContain("All Customers");
      expect(content).toContain("onNewCustomer");

      // Customer details header actions: Edit, Attachments, New Transaction, More, Close
      expect(content).toContain("Edit");
      expect(content).toContain("Attachments");
      expect(content).toContain("New Transaction");
      expect(content).toContain("More actions");
      expect(content).toContain("onClose");

      // Navigation tabs: Overview, Comments, Transactions, Mails, Statement
      expect(content).toContain('"Overview"');
      expect(content).toContain('"Comments"');
      expect(content).toContain('"Transactions"');
      expect(content).toContain('"Mails"');
      expect(content).toContain('"Statement"');

      // Overview layout: Contact info, addresses, details in left-side panel
      expect(content).toContain("Contact Details");
      expect(content).toContain("Billing Address");
      expect(content).toContain("Shipping Address");
      expect(content).toContain("GSTIN");
      expect(content).toContain("PAN");

      // Right-side content: payment due period, receivables, unused credits, income chart, activity timeline
      expect(content).toContain("Payment Due Period");
      expect(content).toContain("Outstanding Receivables");
      expect(content).toContain("Unused Credits");
      expect(content).toContain("Income Analysis");
      expect(content).toContain("Activity Timeline");
      expect(content).toContain("BarChart");
    });

    it("verifies CustomerEditModal exists with full customer fields", () => {
      const filePath = path.join(
        process.cwd(),
        "components",
        "sales",
        "customer",
        "customer-edit-modal.tsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("Edit Customer Profile");
      expect(content).toContain("billingAddress");
      expect(content).toContain("shippingAddress");
      expect(content).toContain("Copy Billing to Shipping");
      expect(content).toContain("/api/sales/customers");
    });

    it("verifies CustomerDirectory renders CustomerDetailView when customer is selected", () => {
      const filePath = path.join(
        process.cwd(),
        "components",
        "sales",
        "customer-directory.tsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("CustomerDetailView");
      expect(content).toContain("selectedCustomer");
      expect(content).toContain("handleSelectCustomer");
      expect(content).toContain("handleCloseDetail");
    });

    it("verifies direct URL routing for customer detail page", () => {
      const filePath = path.join(
        process.cwd(),
        "app",
        "sales",
        "customers",
        "[id]",
        "page.tsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("CustomerDirectory");
      expect(content).toContain("initialCustomerId={id}");
    });

    it("verifies customer [id] API route supports GET and PATCH with comment addition", () => {
      const filePath = path.join(
        process.cwd(),
        "app",
        "api",
        "sales",
        "customers",
        "[id]",
        "route.ts"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("export async function GET");
      expect(content).toContain("export async function PATCH");
      expect(content).toContain("add-comment");
    });

    it("verifies New Transaction dropdown matches Zoho Books design with grouped options and customer context", () => {
      const filePath = path.join(
        process.cwd(),
        "components",
        "sales",
        "customer",
        "customer-detail-view.tsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      // Button and Dropdown container
      expect(content).toContain("new-transaction-btn");
      expect(content).toContain("new-transaction-menu");
      expect(content).toContain("New Transaction");
      expect(content).toContain("max-h-[350px]");
      expect(content).toContain("overflow-y-auto");

      // Group headers
      expect(content).toContain("SALES");
      expect(content).toContain("OTHER TRANSACTIONS");

      // Sales options
      expect(content).toContain('"Invoice"');
      expect(content).toContain('"Customer Payment"');
      expect(content).toContain('"Quote"');
      expect(content).toContain('"Sales Order"');
      expect(content).toContain('"Delivery Challan"');
      expect(content).toContain('"Recurring Invoice"');

      // Other Transaction options
      expect(content).toContain('"Expense"');
      expect(content).toContain('"Recurring Expense"');
      expect(content).toContain('"Journal"');
      expect(content).toContain('"Credit Note"');
      expect(content).toContain('"Project"');

      // Blue highlight styling
      expect(content).toContain("bg-blue-600 text-white font-medium");

      // Outside click and keyboard dismissal
      expect(content).toContain("handleClickOutside");
      expect(content).toContain("Escape");
      expect(content).toContain("handleDropdownKeyDown");

      // Customer context preservation in URLs
      expect(content).toContain("/sales/invoices/new?customerId=");
      expect(content).toContain("/sales/payments?action=new&customerId=");
      expect(content).toContain("/sales/quotes/new?customerId=");
      expect(content).toContain("/sales/orders/new?customerId=");
      expect(content).toContain("/sales/delivery-challans?action=new&customerId=");
      expect(content).toContain("/sales/recurring-invoices?action=new&customerId=");
      expect(content).toContain("/expenses/new?customerId=");
      expect(content).toContain("/purchases/recurring-expenses/new?customerId=");
      expect(content).toContain("/accountant?action=new-journal&customerId=");
      expect(content).toContain("/sales/credit-notes?action=new&customerId=");
      expect(content).toContain("/sales?section=projects&customerId=");
    });
  });
});
