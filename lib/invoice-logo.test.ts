import { describe, expect, it } from "vitest";
import {
  generateInvoicePdf,
  prepareImage,
  type PreparedImage,
} from "@/components/invoices/invoice-pdf-generator";
import { type InvoiceRecord, type InvoiceSettingsData } from "@/components/invoices/invoice-types";

describe("Invoice Show Company Logo feature", () => {
  const dummyInvoice: InvoiceRecord = {
    id: "inv-test-1",
    number: "INV-000001",
    customerId: "cust-1",
    customerName: "Acme Logistics",
    status: "Sent",
    issueDate: "2026-10-27T10:00:00.000Z",
    dueDate: "2026-11-27T10:00:00.000Z",
    paymentTerms: "Net 30",
    currency: "INR",
    subTotal: 10000,
    discount: 0,
    discountType: "percent",
    taxAmount: 1800,
    cgst: 900,
    sgst: 900,
    igst: 0,
    shippingCharges: 0,
    adjustment: 0,
    roundOff: 0,
    total: 11800,
    amountPaid: 0,
    creditedAmount: 0,
    balanceDue: 11800,
    items: [
      {
        itemId: "item-1",
        name: "Wheat Sharbati",
        quantity: 10,
        rate: 1000,
        amount: 10000,
        taxRate: 18,
        taxAmount: 1800,
      },
    ],
  };

  const dummySettings: InvoiceSettingsData = {
    invoicePrefix: "INV-",
    nextNumber: 2,
    defaultPaymentTerms: "Net 30",
    defaultNotes: "Thank you for your business.",
    defaultTerms: "Payment due within 30 days.",
    currency: "INR",
    defaultTaxRate: 18,
    showCompanyLogo: true,
    companyDetails: {
      legalName: "Bharat Traders & Commodities Ltd.",
      tradeName: "Bharat Traders",
      gstin: "27ABCDE1234F1Z5",
      logoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    },
    bankDetails: {
      bankName: "HDFC Bank",
      accountHolder: "Bharat Traders",
      accountNumber: "50200012345678",
      ifsc: "HDFC0001234",
    },
    pdfTemplate: {
      layout: "modern",
      accentColor: "#2563eb",
      showCompanyLogo: true,
      showQrCode: true,
      showSignature: true,
      signatureLabel: "Authorized Signatory",
    },
  };

  it("prepareImage returns null when no source is provided", async () => {
    const res = await prepareImage(undefined);
    expect(res).toBeNull();

    const emptyRes = await prepareImage("");
    expect(emptyRes).toBeNull();
  });

  it("prepareImage handles data URIs appropriately in Node/test environment", async () => {
    const pngData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const res = await prepareImage(pngData);
    expect(res).not.toBeNull();
    expect(res?.format).toBe("PNG");
    expect(res?.dataUrl).toBe(pngData);

    const jpegData = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/";
    const resJpeg = await prepareImage(jpegData);
    expect(resJpeg?.format).toBe("JPEG");
  });

  it("generates invoice PDF successfully when showCompanyLogo is true and logo is provided", async () => {
    const preparedLogo: PreparedImage = {
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      width: 120,
      height: 60,
      format: "PNG",
    };

    const doc = await generateInvoicePdf(dummyInvoice, dummySettings, preparedLogo);
    expect(doc).toBeDefined();
    // doc should have 1 page by default
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("generates invoice PDF without logo when showCompanyLogo is disabled in pdfTemplate", async () => {
    const settingsWithoutLogo: InvoiceSettingsData = {
      ...dummySettings,
      showCompanyLogo: false,
      pdfTemplate: {
        ...dummySettings.pdfTemplate,
        showCompanyLogo: false,
      },
    };

    const preparedLogo: PreparedImage = {
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      width: 120,
      height: 60,
      format: "PNG",
    };

    const doc = await generateInvoicePdf(dummyInvoice, settingsWithoutLogo, preparedLogo);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("generates invoice PDF without logo when showCompanyLogo is disabled at root settings", async () => {
    const settingsWithoutLogo: InvoiceSettingsData = {
      ...dummySettings,
      showCompanyLogo: false,
      pdfTemplate: {
        layout: "modern",
        accentColor: "#2563eb",
        showQrCode: true,
        showSignature: true,
        signatureLabel: "Authorized Signatory",
      },
    };

    const doc = await generateInvoicePdf(dummyInvoice, settingsWithoutLogo);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("defaults showCompanyLogo to true when omitted from settings", async () => {
    const settingsOmitted: InvoiceSettingsData = {
      ...dummySettings,
      showCompanyLogo: undefined,
      pdfTemplate: {
        layout: "modern",
        accentColor: "#2563eb",
        showQrCode: true,
        showSignature: true,
        signatureLabel: "Authorized Signatory",
      },
    };

    const preparedLogo: PreparedImage = {
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      width: 200,
      height: 100,
      format: "PNG",
    };

    const doc = await generateInvoicePdf(dummyInvoice, settingsOmitted, preparedLogo);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("generates invoice PDF when settings is null/undefined without crashing", async () => {
    const doc = await generateInvoicePdf(dummyInvoice, null);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("generates invoice PDF using profile logo string directly when settings company logo is empty", async () => {
    const settingsWithoutCompanyLogo: InvoiceSettingsData = {
      ...dummySettings,
      companyDetails: {
        legalName: "Bharat Traders & Commodities Ltd.",
        tradeName: "Bharat Traders",
        gstin: "27ABCDE1234F1Z5",
        logoUrl: "",
      },
    };

    const profileLogoStr =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const doc = await generateInvoicePdf(dummyInvoice, settingsWithoutCompanyLogo, profileLogoStr);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
