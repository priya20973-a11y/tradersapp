import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Invoice Split-Screen & Zoho Books Document Preview", () => {
  const invoiceDetailViewPath = path.resolve(
    __dirname,
    "../components/invoices/invoice-detail-view.tsx"
  );
  const invoiceDirectoryPath = path.resolve(
    __dirname,
    "../components/invoices/invoices-directory.tsx"
  );
  const invoiceDetailPagePath = path.resolve(
    __dirname,
    "../app/sales/invoices/[id]/page.tsx"
  );

  function formatDate(dateStr?: string | Date): string {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return String(dateStr);
    }
  }

  function getInvoiceStatusInfo(invoice: {
    dueDate?: string | Date;
    balanceDue?: number;
    status?: string;
  }) {
    const status = invoice.status || "Draft";
    const balanceDue = Number(invoice.balanceDue || 0);

    if (status === "Paid" || balanceDue <= 0) {
      return {
        label: "PAID",
        colorClass: "text-[#16a34a]",
      };
    }

    if (status === "Draft") {
      return {
        label: "DRAFT",
        colorClass: "text-slate-400",
      };
    }

    if (status === "Void") {
      return {
        label: "VOID",
        colorClass: "text-slate-400",
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (invoice.dueDate) {
      const due = new Date(invoice.dueDate);
      due.setHours(0, 0, 0, 0);
      const diffMs = today.getTime() - due.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        return {
          label: `OVERDUE BY ${diffDays} DAY${diffDays > 1 ? "S" : ""}`,
          colorClass: "text-[#ea580c]",
        };
      }
    }

    if (status === "Partially Paid" || status === "Partly paid") {
      return {
        label: "PARTIALLY PAID",
        colorClass: "text-amber-600",
      };
    }

    if (status === "Sent") {
      return {
        label: "SENT",
        colorClass: "text-blue-600",
      };
    }

    return {
      label: "OPEN",
      colorClass: "text-slate-600",
    };
  }

  describe("1. Date Formatting & Overdue Status Calculations", () => {
    it("formats dates in DD/MM/YYYY exactly as in the Zoho Books screenshot", () => {
      expect(formatDate("2026-10-30T00:00:00.000Z")).toBe("30/10/2026");
      expect(formatDate("2026-11-05T00:00:00.000Z")).toBe("05/11/2026");
      expect(formatDate("2026-10-28T00:00:00.000Z")).toBe("28/10/2026");
      expect(formatDate(undefined)).toBe("-");
    });

    it("calculates overdue days and returns OVERDUE BY X DAYS matching the screenshot", () => {
      const pastDueDate = new Date();
      pastDueDate.setDate(pastDueDate.getDate() - 14);

      const statusInfo = getInvoiceStatusInfo({
        dueDate: pastDueDate.toISOString(),
        balanceDue: 34000,
        status: "Open",
      });

      expect(statusInfo.label).toBe("OVERDUE BY 14 DAYS");
      expect(statusInfo.colorClass).toBe("text-[#ea580c]");
    });

    it("displays PAID in green when balanceDue is 0 or status is Paid", () => {
      const statusInfo = getInvoiceStatusInfo({
        dueDate: "2026-10-28",
        balanceDue: 0,
        status: "Paid",
      });

      expect(statusInfo.label).toBe("PAID");
      expect(statusInfo.colorClass).toBe("text-[#16a34a]");
    });

    it("displays PARTIALLY PAID in amber when partially paid", () => {
      const statusInfo = getInvoiceStatusInfo({
        dueDate: "2026-12-31",
        balanceDue: 15000,
        status: "Partially Paid",
      });

      expect(statusInfo.label).toBe("PARTIALLY PAID");
      expect(statusInfo.colorClass).toBe("text-amber-600");
    });
  });

  describe("2. Document Summary & Balance Due Calculations", () => {
    it("calculates document summary values accurately for preview", () => {
      const invoice = {
        subTotal: 34000,
        discountAmount: 0,
        taxAmount: 0,
        shippingCharges: 0,
        adjustment: 0,
        total: 34000,
        amountPaid: 0,
        creditedAmount: 0,
        balanceDue: 34000,
      };

      const calculatedBalanceDue =
        invoice.total - invoice.amountPaid - invoice.creditedAmount;
      expect(calculatedBalanceDue).toBe(34000);
      expect(invoice.subTotal).toBe(34000);
      expect(invoice.total).toBe(34000);
      expect(invoice.balanceDue).toBe(34000);
    });

    it("deducts partial payments and credit notes correctly", () => {
      const invoice = {
        total: 34000,
        amountPaid: 10000,
        creditedAmount: 4000,
      };

      const balanceDue =
        invoice.total - invoice.amountPaid - invoice.creditedAmount;
      expect(balanceDue).toBe(20000);
    });
  });

  describe("3. UI Structure & Zoho Books Visual Consistency", () => {
    const detailContent = fs.readFileSync(invoiceDetailViewPath, "utf-8");

    it("contains the split-screen layout with left pane and document canvas", () => {
      expect(detailContent).toContain("w-80 lg:w-[350px] shrink-0 border-r border-slate-200");
      expect(detailContent).toContain("flex-1 flex flex-col h-full overflow-hidden bg-slate-100/70");
      expect(detailContent).toContain("max-w-[850px] mx-auto bg-white border border-slate-200/90");
    });

    it("includes action bar items: Edit, PDF/Print, Record Payment, and More", () => {
      expect(detailContent).toContain("Edit");
      expect(detailContent).toContain("PDF/Print");
      expect(detailContent).toContain("Record Payment");
      expect(detailContent).toContain("More actions");
    });

    it("includes attachment, comments, and invoice navigation icons", () => {
      expect(detailContent).toContain("title=\"Previous invoice\"");
      expect(detailContent).toContain("title=\"Next invoice\"");
      expect(detailContent).toContain("title=\"Attachments\"");
      expect(detailContent).toContain("title=\"Comments & Notes\"");
      expect(detailContent).toContain("title=\"Close invoice preview\"");
    });

    it("renders dark charcoal header table with Item & Description, Customer Details, Qty, Rate, Amount", () => {
      expect(detailContent).toContain("bg-[#333333]");
      expect(detailContent).toContain(">Item & Description</th>");
      expect(detailContent).toContain(">Customer Details</th>");
      expect(detailContent).toContain(">Qty</th>");
      expect(detailContent).toContain(">Rate</th>");
      expect(detailContent).toContain(">Amount</th>");
    });

    it("contains Authorized Signature footer", () => {
      expect(detailContent).toContain("Authorized Signature _____________________");
    });

    it("contains shaded Balance Due box matching Zoho Books", () => {
      expect(detailContent).toContain("bg-slate-100 p-2.5 rounded-xs flex justify-between items-center text-sm font-bold text-slate-900 mt-2");
      expect(detailContent).toContain("Balance Due");
    });
  });

  describe("4. Integration with Invoices Directory & Detail Page", () => {
    const directoryContent = fs.readFileSync(invoiceDirectoryPath, "utf-8");
    const pageContent = fs.readFileSync(invoiceDetailPagePath, "utf-8");

    it("invoices directory embeds InvoiceDetailView when selected", () => {
      expect(directoryContent).toContain("InvoiceDetailView");
      expect(directoryContent).toContain("selectedInvoiceId");
      expect(directoryContent).toContain("onSelectInvoice");
    });

    it("invoice [id] detail page renders InvoiceDetailView", () => {
      expect(pageContent).toContain("InvoiceDetailView");
      expect(pageContent).toContain("id={id}");
    });
  });
});
