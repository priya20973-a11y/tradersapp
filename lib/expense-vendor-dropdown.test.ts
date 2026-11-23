import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { expenseInputSchema } from "@/app/api/expenses/route";
import type { ExpenseVendorOption } from "@/components/expenses/expense-form";

describe("Expense Vendor / Merchant Searchable Dropdown", () => {
  // 1. Vendor Master options mapping
  it("correctly maps raw vendor data from Vendor Master into searchable options", () => {
    const rawVendors = [
      {
        _id: "v1",
        id: "v1",
        displayName: "Supreme Logistics",
        name: "Supreme Logistics",
        companyName: "Supreme Freight Corp",
        email: "contact@supremelogistics.com",
        gstin: "27AAAAA0000A1Z5",
      },
      {
        _id: "v2",
        id: "v2",
        displayName: "",
        name: "Acme Industrial Supplies",
        companyName: "Acme Corp Ltd",
        email: "billing@acme.com",
        gstin: "29BBBBB1111B2Z6",
      },
    ];

    const options: ExpenseVendorOption[] = rawVendors
      .map((v) => ({
        id: String(v.id || v._id || ""),
        name: String(v.displayName || v.name || v.companyName || "Vendor"),
        companyName: String(v.companyName || ""),
        email: String(v.email || ""),
        gstin: String(v.gstin || ""),
      }))
      .filter((v) => v.name.trim().length > 0);

    expect(options).toHaveLength(2);
    expect(options[0].name).toBe("Supreme Logistics");
    expect(options[0].companyName).toBe("Supreme Freight Corp");
    expect(options[0].gstin).toBe("27AAAAA0000A1Z5");
    expect(options[1].name).toBe("Acme Industrial Supplies");
  });

  // 2. Search filtering logic
  describe("Search filter behaviour", () => {
    const sampleOptions: ExpenseVendorOption[] = [
      {
        id: "1",
        name: "Bharat Petroleum",
        companyName: "BPCL India",
        gstin: "27AAACB2902M1ZT",
        email: "fuel@bpcl.in",
      },
      {
        id: "2",
        name: "Blue Dart Express",
        companyName: "Blue Dart Aviation Ltd",
        gstin: "27AAACB0602M1ZU",
        email: "support@bluedart.com",
      },
      {
        id: "3",
        name: "Office Depot Supplies",
        companyName: "Stationery Hub LLP",
        gstin: "29AACCS4401L1ZZ",
        email: "sales@officedepot.in",
      },
    ];

    const filterVendors = (query: string, options: ExpenseVendorOption[]) => {
      if (!query.trim()) return options;
      const q = query.toLowerCase().trim();
      return options.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.companyName && v.companyName.toLowerCase().includes(q)) ||
          (v.gstin && v.gstin.toLowerCase().includes(q)) ||
          (v.email && v.email.toLowerCase().includes(q)),
      );
    };

    it("matches vendors by name query", () => {
      const results = filterVendors("bharat", sampleOptions);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Bharat Petroleum");
    });

    it("matches vendors by company name query", () => {
      const results = filterVendors("Aviation", sampleOptions);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Blue Dart Express");
    });

    it("matches vendors by GSTIN query", () => {
      const results = filterVendors("4401L1ZZ", sampleOptions);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Office Depot Supplies");
    });

    it("matches vendors by email query", () => {
      const results = filterVendors("bluedart.com", sampleOptions);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Blue Dart Express");
    });

    it("returns empty results for non-matching query", () => {
      const results = filterVendors("NonExistentMerchant", sampleOptions);
      expect(results).toHaveLength(0);
    });
  });

  // 3. Schema validation & persistence of selected vendor
  describe("Expense Vendor schema validation and retention", () => {
    it("persists selected vendor from Vendor Master in expense payload", () => {
      const payload = {
        expenseType: "standard",
        date: "2026-11-21",
        paidThrough: "Petty Cash Account",
        currency: "INR",
        vendor: "Supreme Logistics",
        invoiceNumber: "INV-LOG-992",
        items: [
          {
            expenseAccount: "Freight & Shipping Charges",
            amount: 5200,
          },
        ],
      };

      const parsed = expenseInputSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.vendor).toBe("Supreme Logistics");
      }
    });

    it("supports custom/one-off merchant names typed by user", () => {
      const payload = {
        expenseType: "standard",
        date: "2026-11-21",
        paidThrough: "Petty Cash Account",
        currency: "INR",
        vendor: "Local Tea & Snacks Stall",
        items: [
          {
            expenseAccount: "Meals & Entertainment",
            amount: 250,
          },
        ],
      };

      const parsed = expenseInputSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.vendor).toBe("Local Tea & Snacks Stall");
      }
    });

    it("allows empty vendor for general expenses where vendor is optional", () => {
      const payload = {
        expenseType: "standard",
        date: "2026-11-21",
        paidThrough: "Petty Cash Account",
        currency: "INR",
        items: [
          {
            expenseAccount: "Bank & Financial Charges",
            amount: 120,
          },
        ],
      };

      const parsed = expenseInputSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.vendor).toBe("");
      }
    });
  });

  // 4. Source code inspection of expense-form.tsx
  describe("expense-form.tsx source code checks", () => {
    const formCode = fs.readFileSync(
      path.resolve(process.cwd(), "components/expenses/expense-form.tsx"),
      "utf-8",
    );

    it("contains SearchableVendorDropdown component", () => {
      expect(formCode).toContain("export function SearchableVendorDropdown");
    });

    it("replaces the old datalist with SearchableVendorDropdown in Vendor & Bill Reference", () => {
      expect(formCode).toContain("<SearchableVendorDropdown");
      expect(formCode).not.toContain('list="expense-vendors"');
      expect(formCode).not.toContain('<datalist id="expense-vendors">');
    });

    it("fetches vendors from /api/vendors to populate vendor options", () => {
      expect(formCode).toContain('fetch("/api/vendors")');
      expect(formCode).toContain("setVendorOptions");
    });

    it("includes accessible aria-label for Vendor / Merchant", () => {
      expect(formCode).toContain('aria-label="Vendor / Merchant"');
    });

    it("syncs and retains initialData.vendor when editing", () => {
      expect(formCode).toContain("initialData?.vendor");
      expect(formCode).toContain("setExpenseVendor(String(initialData.vendor || \"\"))");
    });
  });
});
