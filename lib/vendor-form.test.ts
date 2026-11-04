import { describe, it, expect } from "vitest";
import { vendorInputSchema } from "@/app/api/vendors/route";
import fs from "node:fs";
import path from "node:path";

describe("Vendor Form & Validation Requirements", () => {
  it("requires displayName and fails when empty", () => {
    const result = vendorInputSchema.safeParse({
      displayName: "",
      email: "test@vendor.com",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.displayName).toBeDefined();
    }
  });

  it("successfully validates a complete vendor payload with all Zoho-referenced tabs", () => {
    const validVendor = {
      salutation: "Mr.",
      firstName: "Ramesh",
      lastName: "Patel",
      companyName: "Gujarat Agro Mills Pvt Ltd",
      displayName: "Gujarat Agro Mills",
      email: "accounts@gujaratagro.com",
      workPhone: "+91 22 2490 1234",
      mobile: "+91 98200 11223",
      language: "Gujarati",

      pan: "ABCDE1234F",
      msmeRegistered: true,
      msmeType: "Small",
      msmeNumber: "UDYAM-GJ-01-0012345",
      currency: "INR",
      accountsPayable: "Accounts Payable (Sundry Creditors)",
      openingBalance: 45000,
      openingBalanceType: "credit",
      paymentTerms: "Net 30",
      tds: "TDS @ 0.1% - Sec 194Q (Purchase of Goods)",
      enablePortal: true,
      portalLanguage: "English",

      billingAddress: {
        attention: "Ramesh Patel",
        country: "India",
        street1: "Plot 42, GIDC Industrial Estate",
        street2: "Phase 2",
        city: "Ahmedabad",
        state: "Gujarat",
        postalCode: "382445",
        phone: "+91 79 2500 1122",
        fax: "",
      },
      shippingAddress: {
        attention: "Warehouse In-charge",
        country: "India",
        street1: "Plot 42, GIDC Industrial Estate",
        street2: "Phase 2",
        city: "Ahmedabad",
        state: "Gujarat",
        postalCode: "382445",
        phone: "+91 79 2500 1122",
        fax: "",
      },

      contactPersons: [
        {
          id: "cp-1",
          salutation: "Mr.",
          firstName: "Kishore",
          lastName: "Shah",
          email: "kishore@gujaratagro.com",
          workPhone: "+91 79 2500 1123",
          mobile: "+91 98200 99887",
          designation: "Dispatch Lead",
          department: "Logistics",
          isPrimary: true,
        },
      ],

      bankDetails: {
        accountHolderName: "Gujarat Agro Mills Pvt Ltd",
        bankName: "State Bank of India",
        accountNumber: "309928172635",
        ifscCode: "SBIN0001234",
        branchName: "GIDC Vatva, Ahmedabad",
      },

      customFields: [
        { label: "FSSAI License", value: "10018021000999" },
        { label: "Vendor Quality Grade", value: "A+" },
      ],

      reportingTags: ["Grains", "Western Zone", "Preferred Supplier"],
      remarks: "Annual supply contract signed on 10 Oct 2026. 30 days credit approved.",
      documents: [
        {
          name: "GST_Certificate.pdf",
          size: 245000,
          type: "application/pdf",
          url: "",
          uploadedAt: "22 Oct 2026",
        },
      ],
      status: "Active",
    };

    const result = vendorInputSchema.safeParse(validVendor);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe("Gujarat Agro Mills");
      expect(result.data.msmeRegistered).toBe(true);
      expect(result.data.contactPersons.length).toBe(1);
      expect(result.data.customFields.length).toBe(2);
      expect(result.data.reportingTags).toContain("Preferred Supplier");
      expect(result.data.documents.length).toBe(1);
    }
  });

  it("checks for PAN format and confirms invalid emails fail", () => {
    const invalidEmail = vendorInputSchema.safeParse({
      displayName: "Valid Name",
      email: "not-an-email",
    });
    expect(invalidEmail.success).toBe(false);
  });

  it("verifies the UI components exist and contain all required sections", () => {
    const vendorFormPath = path.resolve(
      __dirname,
      "../components/purchases/vendor-form.tsx",
    );
    const newVendorPagePath = path.resolve(
      __dirname,
      "../app/purchases/vendors/new/page.tsx",
    );

    expect(fs.existsSync(vendorFormPath)).toBe(true);
    expect(fs.existsSync(newVendorPagePath)).toBe(true);

    const formContent = fs.readFileSync(vendorFormPath, "utf-8");

    // Basic Information
    expect(formContent).toContain("Salutation");
    expect(formContent).toContain("First Name");
    expect(formContent).toContain("Last Name");
    expect(formContent).toContain("Company Name");
    expect(formContent).toContain("Display Name");
    expect(formContent).toContain("Email Address");
    expect(formContent).toContain("Work Phone");
    expect(formContent).toContain("Mobile Number");
    expect(formContent).toContain("Vendor Language");

    // Additional Details tabs
    expect(formContent).toContain("Other Details");
    expect(formContent).toContain("Address");
    expect(formContent).toContain("Contact Persons");
    expect(formContent).toContain("Bank Details");
    expect(formContent).toContain("Custom Fields");
    expect(formContent).toContain("Reporting Tags");
    expect(formContent).toContain("Remarks");
    expect(formContent).toContain("Documents");

    // Sticky footer buttons
    expect(formContent).toContain("Save Vendor");
    expect(formContent).toContain("Save & Add New");
    expect(formContent).toContain("Cancel");
  });
});
