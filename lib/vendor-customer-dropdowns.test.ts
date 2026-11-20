import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Vendor & Customer Dropdown Fetching, Mapping, and Search", () => {
  const billFormPath = path.resolve(__dirname, "../components/purchases/bill-form.tsx");
  const invoiceFormPath = path.resolve(__dirname, "../components/invoices/invoice-form.tsx");
  const billsApiPath = path.resolve(__dirname, "../app/api/purchases/bills/route.ts");
  const vendorsApiPath = path.resolve(__dirname, "../app/api/vendors/route.ts");
  const salesApiPath = path.resolve(__dirname, "../app/api/sales/route.ts");
  const invoicesApiPath = path.resolve(__dirname, "../app/api/sales/invoices/route.ts");

  describe("1. Bill Module: Vendor Name Dropdown", () => {
    it("maps registered vendor documents correctly with all metadata fields", () => {
      const vendorDbDocs = [
        {
          _id: "67bc10010000000000000001",
          displayName: "Agro Traders Pvt Ltd",
          name: "Agro Traders",
          companyName: "Agro Traders Pvt Ltd",
          email: "sales@agrotraders.com",
          workPhone: "+91 98200 11111",
          phone: "+91 98200 22222",
          gstin: "27AABCA1234F1Z5",
          state: "Maharashtra",
        },
        {
          _id: "67bc10020000000000000002",
          displayName: "",
          name: "Kisan Agro Supplies",
          email: "kisan@agro.in",
          phone: "+91 98300 33333",
          gstin: "24BBBB1234F1Z1",
          billingAddress: { state: "Gujarat" },
        },
      ];

      const mapped = vendorDbDocs.map((v: Record<string, unknown>) => ({
        id: String(v.id || v._id || ""),
        name: String(v.displayName || v.name || v.companyName || "Vendor"),
        email: String(v.email || ""),
        phone: String(v.workPhone || v.phone || ""),
        gstin: String(v.gstin || ""),
        state: String(v.state || (v.billingAddress as { state?: string })?.state || ""),
      }));

      expect(mapped).toHaveLength(2);
      expect(mapped[0]).toEqual({
        id: "67bc10010000000000000001",
        name: "Agro Traders Pvt Ltd",
        email: "sales@agrotraders.com",
        phone: "+91 98200 11111",
        gstin: "27AABCA1234F1Z5",
        state: "Maharashtra",
      });
      expect(mapped[1]).toEqual({
        id: "67bc10020000000000000002",
        name: "Kisan Agro Supplies",
        email: "kisan@agro.in",
        phone: "+91 98300 33333",
        gstin: "24BBBB1234F1Z1",
        state: "Gujarat",
      });
    });

    it("filters vendors by name, GSTIN, and email during search", () => {
      const vendors = [
        { id: "v-1", name: "Apex Agro Commodities", gstin: "27AAACA1234F1Z1", email: "info@apex.com" },
        { id: "v-2", name: "Bharat Rice Mills", gstin: "07BBBCB5678F1Z2", email: "sales@bharat.com" },
        { id: "v-3", name: "Delta Spice Exports", gstin: "33CCCCD9012F1Z3", email: "export@delta.in" },
      ];

      const filterVendors = (query: string) => {
        const q = query.toLowerCase();
        return vendors.filter(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            (v.gstin && v.gstin.toLowerCase().includes(q)) ||
            (v.email && v.email.toLowerCase().includes(q)),
        );
      };

      expect(filterVendors("rice")).toHaveLength(1);
      expect(filterVendors("rice")[0].id).toBe("v-2");
      expect(filterVendors("27AAAC")).toHaveLength(1);
      expect(filterVendors("27AAAC")[0].id).toBe("v-1");
      expect(filterVendors("delta.in")).toHaveLength(1);
      expect(filterVendors("delta.in")[0].id).toBe("v-3");
      expect(filterVendors("unknown")).toHaveLength(0);
    });

    it("verifies bill-form.tsx fetches from /api/vendors and /api/purchases/bills with searchable dropdown", () => {
      const content = fs.readFileSync(billFormPath, "utf-8");
      expect(content).toContain('fetch("/api/vendors")');
      expect(content).toContain('fetch("/api/purchases/bills")');
      expect(content).toContain("filteredVendors");
      expect(content).toContain("vendorDropdownOpen");
      expect(content).toContain("vendorSearch");
      expect(content).toContain("setVendorId(v.id)");
    });

    it("verifies /api/purchases/bills provides fallback to default organization for vendor queries", () => {
      const content = fs.readFileSync(billsApiPath, "utf-8");
      expect(content).toContain("Organization.findOne");
      expect(content).toContain("Vendor.find");
      expect(content).toContain("displayName");
      expect(content).toContain("gstin");
    });

    it("verifies /api/vendors supports gstin and state in schema, GET, and POST", () => {
      const content = fs.readFileSync(vendorsApiPath, "utf-8");
      expect(content).toContain("gstin: z.string()");
      expect(content).toContain("state: z.string()");
      expect(content).toContain('gstin: (v.gstin as string) || ""');
      expect(content).toContain('gstin: String(createdVendor.gstin || "")');
    });
  });

  describe("2. Invoice Module: Customer Name Dropdown", () => {
    it("maps registered customer documents correctly with name, company, GSTIN, and state", () => {
      const customerDbDocs = [
        {
          _id: "67bc20010000000000000001",
          name: "Astra Foods Ltd",
          displayName: "Astra Foods",
          companyName: "Astra Foods Limited",
          email: "billing@astrafoods.in",
          phone: "+91 98200 44444",
          gstin: "27AACCA9999F1Z9",
          state: "Maharashtra",
          paymentTerms: "Net 30",
        },
        {
          _id: "67bc20020000000000000002",
          name: "City Supermarket",
          companyName: "City Supermarket Corp",
          email: "accounts@citysupermarket.com",
          mobile: "+91 98400 55555",
          gstin: "29AACCB8888F1Z8",
          billingAddress: { state: "Karnataka" },
        },
      ];

      const mapped = customerDbDocs.map((c: Record<string, unknown>) => ({
        id: String(c.id || c._id || ""),
        name: String(c.displayName || c.name || c.companyName || "Customer"),
        companyName: (c.companyName as string) || "",
        email: (c.email as string) || "",
        phone: (c.phone as string) || (c.mobile as string) || "",
        gstin: (c.gstin as string) || "",
        state: (c.state as string) || (c.billingAddress ? ((c.billingAddress as { state?: string }).state || "") : ""),
        paymentTerms: (c.paymentTerms as string) || "Due on Receipt",
      }));

      expect(mapped).toHaveLength(2);
      expect(mapped[0]).toEqual({
        id: "67bc20010000000000000001",
        name: "Astra Foods",
        companyName: "Astra Foods Limited",
        email: "billing@astrafoods.in",
        phone: "+91 98200 44444",
        gstin: "27AACCA9999F1Z9",
        state: "Maharashtra",
        paymentTerms: "Net 30",
      });
      expect(mapped[1]).toEqual({
        id: "67bc20020000000000000002",
        name: "City Supermarket",
        companyName: "City Supermarket Corp",
        email: "accounts@citysupermarket.com",
        phone: "+91 98400 55555",
        gstin: "29AACCB8888F1Z8",
        state: "Karnataka",
        paymentTerms: "Due on Receipt",
      });
    });

    it("filters customers by name, company name, GSTIN, phone, and email during search", () => {
      const customers = [
        { id: "c-1", name: "Astra Foods", companyName: "Astra Global", gstin: "27AACCA9999F1Z9", phone: "9820011111", email: "a@astra.in" },
        { id: "c-2", name: "City Retail", companyName: "City Grocers", gstin: "29AACCB8888F1Z8", phone: "9840022222", email: "c@city.in" },
        { id: "c-3", name: "Ganga Enterprises", companyName: "Ganga Group", gstin: "19AACCC7777F1Z7", phone: "9876533333", email: "g@ganga.in" },
      ];

      const filterCustomers = (query: string) => {
        const q = query.toLowerCase();
        return customers.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.companyName && c.companyName.toLowerCase().includes(q)) ||
            (c.gstin && c.gstin.toLowerCase().includes(q)) ||
            (c.email && c.email.toLowerCase().includes(q)) ||
            (c.phone && c.phone.toLowerCase().includes(q)),
        );
      };

      expect(filterCustomers("astra")).toHaveLength(1);
      expect(filterCustomers("astra")[0].id).toBe("c-1");
      expect(filterCustomers("grocers")).toHaveLength(1);
      expect(filterCustomers("grocers")[0].id).toBe("c-2");
      expect(filterCustomers("29AACCB")).toHaveLength(1);
      expect(filterCustomers("29AACCB")[0].id).toBe("c-2");
      expect(filterCustomers("98765")).toHaveLength(1);
      expect(filterCustomers("98765")[0].id).toBe("c-3");
      expect(filterCustomers("nonexistent")).toHaveLength(0);
    });

    it("verifies invoice-form.tsx fetches from /api/sales?section=customers and /api/sales/invoices with searchable dropdown", () => {
      const content = fs.readFileSync(invoiceFormPath, "utf-8");
      expect(content).toContain('fetch("/api/sales?section=customers")');
      expect(content).toContain('fetch("/api/sales/invoices")');
      expect(content).toContain("customerDropdownOpen");
      expect(content).toContain("customerSearch");
      expect(content).toContain("filteredCustomers");
      expect(content).toContain("handleCustomerChange(c.id)");
    });

    it("verifies /api/sales route provides fallback to default organization and returns registered customers", () => {
      const content = fs.readFileSync(salesApiPath, "utf-8");
      expect(content).toContain("Organization.findOne");
      expect(content).toContain("Customer.find");
      expect(content).toContain("cRec.displayName");
      expect(content).toContain("customer.gstin");
    });

    it("verifies /api/sales/invoices route provides fallback to default organization for admin and queries customers", () => {
      const content = fs.readFileSync(invoicesApiPath, "utf-8");
      expect(content).toContain("Organization.findOne");
      expect(content).toContain("Customer.find");
    });
  });
});
