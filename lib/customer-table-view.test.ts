import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Customer Directory Table View - Customer Profile Column UI", () => {
  const filePath = path.join(process.cwd(), "components/sales/customer/customer-table-view.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  it("does not include the colored initials/avatar in the Customer Profile column", () => {
    // getAvatarColor and getInitials should no longer be used in the table view
    expect(content).not.toContain("getAvatarColor");
    expect(content).not.toContain("getInitials");
    expect(content).not.toContain("flex h-9 w-9 shrink-0");
  });

  it("renders customer name with slightly larger font size (text-sm) for enhanced readability", () => {
    expect(content).toContain("text-sm font-semibold text-slate-900");
    expect(content).toContain("onQuickView(customer)");
  });

  it("keeps the Business / Customer Type badge below the customer name", () => {
    expect(content).toContain('customer.customerType || "Business"');
    expect(content).toContain("mt-1 flex items-center gap-1.5");
  });

  it("maintains layout alignment, truncation, and table structure", () => {
    expect(content).toContain('<th className="px-4 py-3.5">Customer Profile</th>');
    expect(content).toContain("block truncate text-left");
  });
});
