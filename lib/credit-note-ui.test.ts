import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { formatBillingAddressLines } from "../components/sales/credit-note-detail-view";

describe("Credit Note Detail View Address Rendering", () => {
  const detailViewPath = path.resolve(
    __dirname,
    "../components/sales/credit-note-detail-view.tsx",
  );
  const detailViewContent = fs.readFileSync(detailViewPath, "utf-8");

  it("does not render billingAddress directly as a raw React child", () => {
    // Should never have raw {creditNote.customerSnapshot.billingAddress} as a React child
    expect(detailViewContent).not.toMatch(
      /\{\s*creditNote\.customerSnapshot\.billingAddress\s*\}/,
    );
    expect(detailViewContent).toContain("formatBillingAddressLines");
  });

  it("formats structured object billing address into individual printable lines", () => {
    const addressObj = {
      attention: "Accounts Department",
      street: "123 Commercial Boulevard",
      city: "Ahmedabad",
      state: "Gujarat",
      postalCode: "380001",
      country: "India",
    };

    const lines = formatBillingAddressLines(addressObj, "John Doe");
    expect(lines).toEqual([
      "Attn: Accounts Department",
      "123 Commercial Boulevard",
      "Ahmedabad, Gujarat - 380001",
      "India",
    ]);
  });

  it("omits attention if it duplicates customerSnapshot.name", () => {
    const addressObj = {
      attention: "John Doe",
      street: "123 Commercial Boulevard",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400001",
      country: "India",
    };

    const lines = formatBillingAddressLines(addressObj, "John Doe");
    expect(lines).toEqual([
      "123 Commercial Boulevard",
      "Mumbai, Maharashtra - 400001",
      "India",
    ]);
  });

  it("handles string billing address gracefully", () => {
    const stringAddress = "Plot 42, GIDC Estate\nVapi, Gujarat\nIndia";
    const lines = formatBillingAddressLines(stringAddress);
    expect(lines).toEqual([
      "Plot 42, GIDC Estate",
      "Vapi, Gujarat",
      "India",
    ]);
  });

  it("returns empty array for null, undefined, or empty address", () => {
    expect(formatBillingAddressLines(null)).toEqual([]);
    expect(formatBillingAddressLines(undefined)).toEqual([]);
    expect(formatBillingAddressLines("")).toEqual([]);
    expect(formatBillingAddressLines({})).toEqual([]);
    expect(
      formatBillingAddressLines({ street: "", city: "", state: "", postalCode: "" }),
    ).toEqual([]);
  });
});

describe("Credit Note UI Totals Card Alignment", () => {
  const formPath = path.resolve(
    __dirname,
    "../components/sales/new-credit-note-form.tsx",
  );
  const formContent = fs.readFileSync(formPath, "utf-8");

  it("ensures the totals summary card has a fixed, responsive width preventing flex shrink collapse", () => {
    expect(formContent).toContain("w-full md:w-[420px] lg:w-[440px] shrink-0");
    expect(formContent).toContain("bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-slate-200/80");
  });

  it("aligns all 5 amount values (Subtotal, Discount, TDS/TCS, Adjustment, Total) inside the summary card with a uniform column width", () => {
    // Subtotal
    expect(formContent).toContain("{subTotal.toFixed(2)}");
    expect(formContent).toContain("font-mono font-bold text-slate-900 w-28 text-right shrink-0");

    // Discount
    expect(formContent).toContain("{discountAmount.toFixed(2)}");
    expect(formContent).toContain("font-mono text-slate-700 w-28 text-right shrink-0");

    // TDS / TCS
    expect(formContent).toContain("{taxMode === \"TDS\" ? `- ${taxAmount.toFixed(2)}` : `+ ${taxAmount.toFixed(2)}`}");
    expect(formContent).toContain("font-mono text-xs text-slate-700 w-28 text-right shrink-0");

    // Adjustment
    expect(formContent).toContain("{adjustment.toFixed(2)}");
    expect(formContent).toContain("font-mono text-slate-700 w-28 text-right shrink-0");

    // Total
    expect(formContent).toContain("{grandTotal.toFixed(2)}");
    expect(formContent).toContain("font-mono font-bold text-slate-900 text-lg w-28 text-right shrink-0");
  });

  it("keeps the Adjustment input and value properly nested inside the flex row without overflowing the card", () => {
    const adjustmentBlockMatch = formContent.match(
      /{\/\* Adjustment \*\/}[\s\S]*?{\/\* Total[\s\S]*?\*\/}/,
    );
    expect(adjustmentBlockMatch).toBeTruthy();
    const adjustmentBlock = adjustmentBlockMatch![0];

    // Contains Adjustment label
    expect(adjustmentBlock).toContain("Adjustment");
    // Contains the adjustment input
    expect(adjustmentBlock).toContain("value={adjustmentStr}");
    expect(adjustmentBlock).toContain('placeholder="0.00"');
    // Contains the adjustment amount properly aligned
    expect(adjustmentBlock).toContain("{adjustment.toFixed(2)}");
    expect(adjustmentBlock).toContain("w-28 text-right shrink-0");
  });

  it("maintains customer notes and terms column min-width protection", () => {
    expect(formContent).toContain("w-full flex-1 space-y-4 min-w-0");
  });
});
