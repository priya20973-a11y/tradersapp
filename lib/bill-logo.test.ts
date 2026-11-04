import { describe, expect, it } from "vitest";
import {
  generateBillPdf,
  prepareImage,
  type PreparedImage,
  type CompanyProfileInfo,
} from "@/components/purchases/bill-pdf-generator";
import type { BillDetail } from "@/components/purchases/bill-detail-view";

describe("Bill Profile Logo and PDF Generation feature", () => {
  const dummyBill: BillDetail = {
    id: "bill-test-1",
    billNumber: "BILL-2026-0001",
    vendorId: "vend-1",
    vendorName: "Maharashtra Agro Traders Ltd",
    orderNumber: "PO-2026-0042",
    billDate: "2026-10-27T10:00:00.000Z",
    dueDate: "2026-11-27T10:00:00.000Z",
    paymentTerms: "Net 30",
    accountsPayable: "Accounts Payable",
    subject: "Procurement of grade A wheat grain",
    subTotal: 50000,
    discount: 5,
    discountType: "percent",
    discountAmount: 2500,
    taxType: "GST",
    taxRate: 5,
    taxAmount: 2375,
    cgst: 1187.5,
    sgst: 1187.5,
    igst: 0,
    adjustment: 0,
    total: 49875,
    amountPaid: 10000,
    balanceDue: 39875,
    status: "Partially Paid",
    items: [
      {
        itemId: "item-wheat-1",
        name: "Sharbati Wheat (Grade A)",
        description: "50kg jute bags moisture < 12%",
        account: "Cost of Goods Sold",
        quantity: 50,
        rate: 1000,
        taxRate: 5,
        taxAmount: 2375,
        amount: 50000,
      },
    ],
    notes: "Please deliver directly to Warehouse Shed 4.",
    termsAndConditions: "Standard 30 days credit terms apply.",
  };

  const sampleLogoPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  it("prepareImage returns null when source is null or empty", async () => {
    expect(await prepareImage(undefined)).toBeNull();
    expect(await prepareImage("")).toBeNull();
  });

  it("prepareImage handles data URIs appropriately in test environment", async () => {
    const res = await prepareImage(sampleLogoPng);
    expect(res).not.toBeNull();
    expect(res?.format).toBe("PNG");
    expect(res?.dataUrl).toBe(sampleLogoPng);
  });

  it("generates bill PDF successfully with uploaded profile logo string", async () => {
    const doc = await generateBillPdf(dummyBill, sampleLogoPng);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("generates bill PDF successfully with PreparedImage object", async () => {
    const preparedLogo: PreparedImage = {
      dataUrl: sampleLogoPng,
      width: 150,
      height: 75,
      format: "PNG",
    };

    const doc = await generateBillPdf(dummyBill, preparedLogo);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("generates bill PDF successfully with CompanyProfileInfo containing logo", async () => {
    const companyProfile: CompanyProfileInfo = {
      companyName: "Bharat Agro Commodities",
      email: "accounts@bharatagro.com",
      phone: "+91 98765 43210",
      address: "APMC Yard, Vashi, Navi Mumbai",
      gstin: "27ABCDE1234F1Z5",
      logo: sampleLogoPng,
    };

    const doc = await generateBillPdf(dummyBill, companyProfile);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("generates bill PDF cleanly when no logo is uploaded (layout unchanged fallback)", async () => {
    const companyProfileWithoutLogo: CompanyProfileInfo = {
      companyName: "Bharat Agro Commodities",
      email: "accounts@bharatagro.com",
      phone: "+91 98765 43210",
      address: "APMC Yard, Vashi, Navi Mumbai",
      gstin: "27ABCDE1234F1Z5",
      logo: undefined,
    };

    const doc = await generateBillPdf(dummyBill, companyProfileWithoutLogo);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("generates bill PDF cleanly when logo parameter is null/empty", async () => {
    const doc = await generateBillPdf(dummyBill, null);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});

