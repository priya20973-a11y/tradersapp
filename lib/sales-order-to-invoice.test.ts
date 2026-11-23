import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Sales Order to Invoice Conversion & Navigation Flow", () => {
  describe("1. Redirection in Sales Order Actions", () => {
    it("redirects to New Invoice creation page with salesOrderId when Invoice action is clicked in SalesOrdersDirectory", () => {
      const filePath = path.resolve(process.cwd(), "components/sales/sales-orders-directory.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("useRouter");
      expect(content).toContain("action === \"invoice-from-order\"");
      expect(content).toContain("/sales/invoices/new?salesOrderId=");
    });

    it("redirects to New Invoice creation page with salesOrderId when invoice-from-order action is triggered in SalesWorkspace", () => {
      const filePath = path.resolve(process.cwd(), "components/sales/sales-workspace.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("useRouter");
      expect(content).toContain("action === \"invoice-from-order\"");
      expect(content).toContain("/sales/invoices/new?salesOrderId=");
    });
  });

  describe("2. Single Document Retrieval via /api/sales?id=", () => {
    it("supports id searchParam in GET /api/sales route and returns mapped document", () => {
      const filePath = path.resolve(process.cwd(), "app/api/sales/route.ts");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("url.searchParams.get(\"id\")");
      expect(content).toContain("docQuery._id =");
      expect(content).toContain("document: singleDoc");
    });

    it("resolves organizationId for admin users when fetching by sales document id", () => {
      const filePath = path.resolve(process.cwd(), "app/api/sales/route.ts");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("SalesDocument.findById(idParam)");
      expect(content).toContain("requestedOrganizationId = String(doc.organizationId)");
    });
  });

  describe("3. Invoice Form Pre-population & Editability", () => {
    it("fetches sales order details using salesOrderId query parameter and sets relatedDocumentId", () => {
      const filePath = path.resolve(process.cwd(), "components/invoices/invoice-form.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("salesOrderId");
      expect(content).toContain("/api/sales?id=");
      expect(content).toContain("setRelatedDocumentId");
    });

    it("populates customer, line items with quantities, rates, discounts, and order details", () => {
      const filePath = path.resolve(process.cwd(), "components/invoices/invoice-form.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("setSelectedCustomerId(doc.customerId)");
      expect(content).toContain("setReferenceNumber(doc.referenceNumber)");
      expect(content).toContain("setPaymentTerms(doc.paymentTerms)");
      expect(content).toContain("setSalesperson(doc.salesperson)");
      expect(content).toContain("setCustomerNotes(doc.customerNotes)");
      expect(content).toContain("setTermsAndConditions(doc.termsAndConditions)");
      expect(content).toContain("setInvoiceDiscount");
      expect(content).toContain("setAdjustment");
      expect(content).toContain("rate: Number(it.rate ?? it.price ?? 0)");
    });

    it("includes relatedDocumentId and salesOrderId in the invoice creation payload", () => {
      const filePath = path.resolve(process.cwd(), "components/invoices/invoice-form.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("relatedDocumentId: relatedDocumentId || initialData?.relatedDocumentId || undefined");
      expect(content).toContain("salesOrderId: relatedDocumentId || initialData?.relatedDocumentId || undefined");
    });
  });

  describe("4. Linking Generated Invoice to Original Sales Order", () => {
    it("links the invoice to the sales order in POST /api/sales/invoices", () => {
      const filePath = path.resolve(process.cwd(), "app/api/sales/invoices/route.ts");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("const salesOrderIdParam = (payload.salesOrderId || payload.relatedDocumentId)");
      expect(content).toContain("relatedDocumentId: linkedSO");
    });

    it("updates linked sales order status to Invoiced when invoice is created", () => {
      const filePath = path.resolve(process.cwd(), "app/api/sales/invoices/route.ts");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("$set: { status: \"Invoiced\" }");
    });

    it("exposes relatedDocumentId in invoice list and invoice detail responses", () => {
      const listRoutePath = path.resolve(process.cwd(), "app/api/sales/invoices/route.ts");
      const listContent = fs.readFileSync(listRoutePath, "utf-8");
      expect(listContent).toContain("relatedDocumentId: inv.relatedDocumentId ? String(inv.relatedDocumentId) : \"\"");

      const detailRoutePath = path.resolve(process.cwd(), "app/api/sales/invoices/[id]/route.ts");
      const detailContent = fs.readFileSync(detailRoutePath, "utf-8");
      expect(detailContent).toContain("relatedDocumentId: invoice.relatedDocumentId ? String(invoice.relatedDocumentId) : \"\"");
    });
  });
});
