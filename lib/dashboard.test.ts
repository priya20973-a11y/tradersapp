import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

import {
  calculatePercentageChange,
  calculateReceivablesAgeing,
  calculateSalesExpensesTrend,
  compileRecentTransactions,
  getDateRangeBoundaries,
  getDashboardData,
} from "./dashboard-service";
import * as models from "@/models";
import * as db from "@/lib/db";

describe("Dashboard Service & Financial Calculations", () => {
  describe("1. Date Range Boundaries & Comparisons", () => {
    const fixedNow = new Date("2026-10-15T12:00:00.000Z");

    it("calculates 'today' boundary accurately", () => {
      const b = getDateRangeBoundaries("today", undefined, undefined, fixedNow);
      expect(b.start).toBeDefined();
      expect(b.end).toBeDefined();
      expect(b.start?.getDate()).toBe(fixedNow.getDate());
      expect(b.start?.getHours()).toBe(0);
      expect(b.end?.getHours()).toBe(23);
      expect(b.previousStart?.getDate()).toBe(fixedNow.getDate() - 1);
    });

    it("calculates 'this_month' boundary accurately", () => {
      const b = getDateRangeBoundaries("this_month", undefined, undefined, fixedNow);
      expect(b.start?.getMonth()).toBe(9); // October (0-indexed)
      expect(b.start?.getDate()).toBe(1);
      expect(b.end?.getMonth()).toBe(9);
      expect(b.previousStart?.getMonth()).toBe(8); // September
    });

    it("calculates 'last_30_days' boundary accurately", () => {
      const b = getDateRangeBoundaries("last_30_days", undefined, undefined, fixedNow);
      expect(b.start).toBeDefined();
      expect(b.end).toBeDefined();
      const diffDays = Math.round((b.end!.getTime() - b.start!.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    });

    it("calculates 'all' boundary (unbounded start/end)", () => {
      const b = getDateRangeBoundaries("all", undefined, undefined, fixedNow);
      expect(b.start).toBeUndefined();
      expect(b.end).toBeUndefined();
      expect(b.previousStart).toBeDefined();
      expect(b.previousEnd).toBeDefined();
    });

    it("handles 'custom' range boundary correctly", () => {
      const b = getDateRangeBoundaries(
        "custom",
        "2026-05-01",
        "2026-05-15",
        fixedNow,
      );
      const toYmd = (d?: Date) =>
        d
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
          : "";
      expect(toYmd(b.start)).toBe("2026-05-01");
      expect(toYmd(b.end)).toBe("2026-05-15");
      expect(b.previousStart).toBeDefined();
      expect(b.previousEnd).toBeDefined();
    });
  });

  describe("2. Percentage Change Engine", () => {
    it("computes positive growth correctly", () => {
      const res = calculatePercentageChange(120, 100);
      expect(res.change).toBe("+20%");
      expect(res.trend).toBe("up");
    });

    it("computes negative contraction correctly", () => {
      const res = calculatePercentageChange(80, 100);
      expect(res.change).toBe("-20%");
      expect(res.trend).toBe("down");
    });

    it("handles zero prior period with positive current period", () => {
      const res = calculatePercentageChange(50000, 0);
      expect(res.change).toBe("+100%");
      expect(res.trend).toBe("up");
    });

    it("handles both periods zero gracefully", () => {
      const res = calculatePercentageChange(0, 0);
      expect(res.change).toBe("0%");
      expect(res.trend).toBe("neutral");
    });

    it("handles unchanged amounts", () => {
      const res = calculatePercentageChange(1000, 1000);
      expect(res.change).toBe("0%");
      expect(res.trend).toBe("neutral");
    });
  });

  describe("3. Receivables Ageing Bucketing", () => {
    const referenceDate = new Date("2026-10-31T00:00:00.000Z");

    it("returns zero amounts and percentages when no invoices exist", () => {
      const { buckets, totalReceivables } = calculateReceivablesAgeing([], referenceDate);
      expect(totalReceivables).toBe(0);
      expect(buckets).toHaveLength(4);
      expect(buckets.every((b) => b.value === 0 && b.amount === 0)).toBe(true);
    });

    it("ignores paid and void invoices", () => {
      const invoices = [
        { total: 50000, balanceRemaining: 0, status: "Paid", dueDate: "2026-10-01" },
        { total: 30000, balanceRemaining: 30000, status: "Void", dueDate: "2026-10-01" },
      ];
      const { totalReceivables } = calculateReceivablesAgeing(invoices, referenceDate);
      expect(totalReceivables).toBe(0);
    });

    it("correctly buckets invoices into 0-30, 31-60, 61-90, and 90+ days", () => {
      const invoices = [
        // 1. Due on 2026-10-15 (16 days overdue -> 0-30 bucket)
        { total: 40000, balanceRemaining: 40000, status: "Sent", dueDate: "2026-10-15" },
        // 2. Due on 2026-09-15 (46 days overdue -> 31-60 bucket)
        { total: 30000, balanceRemaining: 30000, status: "Partly paid", dueDate: "2026-09-15" },
        // 3. Due on 2026-08-15 (77 days overdue -> 61-90 bucket)
        { total: 20000, balanceRemaining: 20000, status: "Overdue", dueDate: "2026-08-15" },
        // 4. Due on 2026-06-01 (152 days overdue -> 90+ bucket)
        { total: 10000, balanceRemaining: 10000, status: "Overdue", dueDate: "2026-06-01" },
      ];

      const { buckets, totalReceivables } = calculateReceivablesAgeing(invoices, referenceDate);
      expect(totalReceivables).toBe(100000);

      const b0 = buckets.find((b) => b.name === "0-30");
      const b31 = buckets.find((b) => b.name === "31-60");
      const b61 = buckets.find((b) => b.name === "61-90");
      const b90 = buckets.find((b) => b.name === "90+");

      expect(b0?.amount).toBe(40000);
      expect(b0?.value).toBe(40);

      expect(b31?.amount).toBe(30000);
      expect(b31?.value).toBe(30);

      expect(b61?.amount).toBe(20000);
      expect(b61?.value).toBe(20);

      expect(b90?.amount).toBe(10000);
      expect(b90?.value).toBe(10);
    });
  });

  describe("4. Monthly Income vs Expenses Trend", () => {
    const referenceDate = new Date("2026-10-15T00:00:00.000Z");

    it("generates requested number of chronological month slots", () => {
      const trend = calculateSalesExpensesTrend([], [], [], 6, referenceDate);
      expect(trend).toHaveLength(6);
      expect(trend[5].month).toBe("Oct");
      expect(trend[4].month).toBe("Sep");
      expect(trend[3].month).toBe("Aug");
      expect(trend[2].month).toBe("Jul");
      expect(trend[1].month).toBe("Jun");
      expect(trend[0].month).toBe("May");
      expect(trend.every((t) => t.sales === 0 && t.expenses === 0)).toBe(true);
    });

    it("correctly aggregates sales and expenses into appropriate month slots", () => {
      const invoices = [
        { total: 150000, issueDate: "2026-10-05T00:00:00.000Z", status: "Sent" },
        { total: 50000, issueDate: "2026-10-10T00:00:00.000Z", status: "Paid" },
        { total: 80000, issueDate: "2026-09-15T00:00:00.000Z", status: "Paid" },
        // Void invoice should be ignored
        { total: 99000, issueDate: "2026-10-01T00:00:00.000Z", status: "Void" },
      ];

      const bills = [
        { total: 60000, billDate: "2026-10-02T00:00:00.000Z", status: "Pending" },
        { total: 40000, billDate: "2026-09-20T00:00:00.000Z", status: "Paid" },
      ];

      const expenses = [
        { amount: 15000, date: "2026-10-08", status: "Paid" },
        // Draft expense should be ignored
        { amount: 5000, date: "2026-10-09", status: "Draft" },
      ];

      const trend = calculateSalesExpensesTrend(invoices, bills, expenses, 6, referenceDate);
      const octSlot = trend.find((t) => t.month === "Oct");
      const sepSlot = trend.find((t) => t.month === "Sep");

      // Oct sales = 150000 + 50000 = 200000
      expect(octSlot?.sales).toBe(200000);
      // Oct expenses = 60000 (bill) + 15000 (expense) = 75000
      expect(octSlot?.expenses).toBe(75000);

      // Sep sales = 80000
      expect(sepSlot?.sales).toBe(80000);
      // Sep expenses = 40000
      expect(sepSlot?.expenses).toBe(40000);
    });
  });

  describe("5. Recent Transactions Aggregation", () => {
    it("handles empty arrays and returns an empty list", () => {
      const list = compileRecentTransactions([], [], [], [], []);
      expect(list).toEqual([]);
    });

    it("merges diverse transaction types and sorts chronologically descending", () => {
      const invoices = [
        {
          _id: "inv-1",
          number: "INV-001",
          customerSnapshot: { name: "Customer Alpha" },
          total: 45000,
          issueDate: "2026-10-10",
          status: "Sent",
        },
      ];

      const bills = [
        {
          _id: "bill-1",
          billNumber: "BILL-101",
          vendorName: "Vendor Beta",
          total: 25000,
          billDate: "2026-10-12",
          status: "Pending",
        },
      ];

      const paymentsReceived = [
        {
          _id: "pay-1",
          number: "PAY-501",
          customerSnapshot: { name: "Customer Alpha" },
          amountPaid: 20000,
          paymentDate: "2026-10-14",
          status: "Cleared",
        },
      ];

      const vendorPayments = [
        {
          _id: "vpay-1",
          paymentNumber: "VPAY-701",
          vendorName: "Vendor Beta",
          amount: 15000,
          paymentDate: "2026-10-15",
          status: "Cleared",
        },
      ];

      const expenses = [
        {
          _id: "exp-1",
          referenceNumber: "EXP-901",
          vendor: "Fuel Station",
          amount: 3200,
          date: "2026-10-16",
          status: "Paid",
        },
      ];

      const list = compileRecentTransactions(
        invoices,
        bills,
        paymentsReceived,
        vendorPayments,
        expenses,
        "INR",
        5,
      );

      expect(list).toHaveLength(5);
      // Most recent should be EXP-901 (Oct 16)
      expect(list[0].id).toBe("EXP-901");
      expect(list[0].type).toBe("Expense");
      expect(list[0].party).toBe("Fuel Station");

      // Second most recent: VPAY-701 (Oct 15)
      expect(list[1].id).toBe("VPAY-701");
      expect(list[1].type).toBe("Payment");

      // Third: PAY-501 (Oct 14)
      expect(list[2].id).toBe("PAY-501");
      expect(list[2].type).toBe("Receipt");

      // Fourth: BILL-101 (Oct 12)
      expect(list[3].id).toBe("BILL-101");
      expect(list[3].type).toBe("Bill");

      // Fifth: INV-001 (Oct 10)
      expect(list[4].id).toBe("INV-001");
      expect(list[4].type).toBe("Invoice");
    });
  });

  describe("6. Complete getDashboardData Pipeline", () => {
    const mockOrgId = "507f1f77bcf86cd799439011";

    beforeEach(() => {
      vi.spyOn(db, "connectToDatabase").mockResolvedValue({} as never);

      vi.spyOn(models.Organization, "findById").mockReturnValue({
        select: () => ({
          lean: async () => ({
            _id: mockOrgId,
            name: "Test Trading Co.",
            currency: "INR",
            status: "active",
          }),
        }),
      } as never);
    });

    it("returns zero metrics and empty state when database has no records", async () => {
      vi.spyOn(models.SalesDocument, "find").mockReturnValue({
        select: () => ({ lean: async () => [] }),
      } as never);

      vi.spyOn(models.PurchaseBill, "find").mockReturnValue({
        select: () => ({ lean: async () => [] }),
      } as never);

      vi.spyOn(models.VendorPayment, "find").mockReturnValue({
        select: () => ({ lean: async () => [] }),
      } as never);

      vi.spyOn(models.Expense, "find").mockReturnValue({
        select: () => ({ lean: async () => [] }),
      } as never);

      vi.spyOn(models.StockLevel, "find").mockReturnValue({
        select: () => ({ lean: async () => [] }),
      } as never);

      vi.spyOn(models.StockLot, "find").mockReturnValue({
        select: () => ({ lean: async () => [] }),
      } as never);

      vi.spyOn(models.Item, "find").mockReturnValue({
        select: () => ({ lean: async () => [] }),
      } as never);

      const res = await getDashboardData({
        organizationId: mockOrgId,
        range: "all",
      });

      expect(res.organization.name).toBe("Test Trading Co.");
      expect(res.hasData).toBe(false);

      // Verify all 4 primary metric cards display 0
      const salesMetric = res.metrics.find((m) => m.label === "Total sales");
      const purchasesMetric = res.metrics.find((m) => m.label === "Total purchases");
      const receivablesMetric = res.metrics.find((m) => m.label === "Receivables");
      const payablesMetric = res.metrics.find((m) => m.label === "Payables");

      expect(salesMetric?.rawValue).toBe(0);
      expect(purchasesMetric?.rawValue).toBe(0);
      expect(receivablesMetric?.rawValue).toBe(0);
      expect(payablesMetric?.rawValue).toBe(0);

      // Verify snapshot values are 0
      expect(res.snapshot.netProfit).toBe(0);
      expect(res.snapshot.cashBalance).toBe(0);
      expect(res.snapshot.overdueInvoices).toBe(0);
      expect(res.snapshot.inventoryValue).toBe(0);

      // Verify transactions list is empty
      expect(res.recentTransactions).toHaveLength(0);
    });

    it("dynamically calculates sales, purchases, net profit, overdue invoices, and cash balance", async () => {
      const fixedRefDate = new Date("2026-10-25T12:00:00.000Z");

      // Invoices
      vi.spyOn(models.SalesDocument, "find").mockImplementation(((query: { type?: string }) => {
        if (query.type === "Invoice") {
          return {
            select: () => ({
              lean: async () => [
                {
                  _id: "inv-1",
                  number: "INV-1001",
                  total: 100000,
                  amountPaid: 60000,
                  balanceRemaining: 40000,
                  issueDate: new Date("2026-10-05"),
                  dueDate: new Date("2026-10-20"), // Past due -> Overdue!
                  status: "Partly paid",
                  customerSnapshot: { name: "Astra Foods" },
                },
                {
                  _id: "inv-2",
                  number: "INV-1002",
                  total: 50000,
                  amountPaid: 50000,
                  balanceRemaining: 0,
                  issueDate: new Date("2026-10-10"),
                  dueDate: new Date("2026-10-30"),
                  status: "Paid",
                  customerSnapshot: { name: "City Retail" },
                },
              ],
            }),
          } as never;
        }
        if (query.type === "Payment Received") {
          return {
            select: () => ({
              lean: async () => [
                {
                  _id: "pay-1",
                  number: "PAY-001",
                  amountPaid: 60000,
                  paymentDate: new Date("2026-10-06"),
                  status: "Cleared",
                },
                {
                  _id: "pay-2",
                  number: "PAY-002",
                  amountPaid: 50000,
                  paymentDate: new Date("2026-10-12"),
                  status: "Cleared",
                },
              ],
            }),
          } as never;
        }
        return { select: () => ({ lean: async () => [] }) } as never;
      }) as never);

      // Bills
      vi.spyOn(models.PurchaseBill, "find").mockReturnValue({
        select: () => ({
          lean: async () => [
            {
              _id: "bill-1",
              billNumber: "BILL-2001",
              total: 70000,
              amountPaid: 30000,
              balanceDue: 40000,
              billDate: new Date("2026-10-08"),
              status: "Partially Paid",
              vendorName: "Mohan Traders",
            },
          ],
        }),
      } as never);

      // Vendor payments
      vi.spyOn(models.VendorPayment, "find").mockReturnValue({
        select: () => ({
          lean: async () => [
            {
              _id: "vpay-1",
              paymentNumber: "VPAY-3001",
              amount: 30000,
              paymentDate: new Date("2026-10-09"),
              status: "Cleared",
            },
          ],
        }),
      } as never);

      // Expenses
      vi.spyOn(models.Expense, "find").mockReturnValue({
        select: () => ({
          lean: async () => [
            {
              _id: "exp-1",
              referenceNumber: "EXP-4001",
              amount: 10000,
              date: "2026-10-11",
              status: "Paid",
              vendor: "Apex Logistics",
            },
          ],
        }),
      } as never);

      // Stock Level
      vi.spyOn(models.StockLevel, "find").mockReturnValue({
        select: () => ({
          lean: async () => [
            {
              stockValue: 185000,
              onHandQuantity: 100,
              averageCost: 1850,
            },
          ],
        }),
      } as never);

      vi.spyOn(models.StockLot, "find").mockReturnValue({
        select: () => ({ lean: async () => [] }),
      } as never);

      vi.spyOn(models.Item, "find").mockReturnValue({
        select: () => ({ lean: async () => [] }),
      } as never);

      const res = await getDashboardData({
        organizationId: mockOrgId,
        range: "this_month",
        referenceDate: fixedRefDate,
      });

      expect(res.hasData).toBe(true);

      // Total Sales: 100000 + 50000 = 150000
      const salesMetric = res.metrics.find((m) => m.label === "Total sales");
      expect(salesMetric?.rawValue).toBe(150000);

      // Total Purchases: 70000
      const purchasesMetric = res.metrics.find((m) => m.label === "Total purchases");
      expect(purchasesMetric?.rawValue).toBe(70000);

      // Receivables: INV-1 balanceRemaining = 40000
      const receivablesMetric = res.metrics.find((m) => m.label === "Receivables");
      expect(receivablesMetric?.rawValue).toBe(40000);

      // Payables: BILL-1 balanceDue = 40000
      const payablesMetric = res.metrics.find((m) => m.label === "Payables");
      expect(payablesMetric?.rawValue).toBe(40000);

      // Net Profit: Sales (150,000) - Purchases (70,000) - Expenses (10,000) = 70,000
      expect(res.snapshot.netProfit).toBe(70000);

      // Cash Balance: Customer payments received (60,000 + 50,000 = 110,000)
      //               - Vendor payments made (30,000) - Paid expenses (10,000) = 70,000
      expect(res.snapshot.cashBalance).toBe(70000);

      // Overdue invoices: INV-1 is past dueDate (Oct 20 < Oct 25) -> 40,000
      expect(res.snapshot.overdueInvoices).toBe(40000);

      // Inventory valuation: 185,000
      expect(res.snapshot.inventoryValue).toBe(185000);

      // Recent transactions should include Invoices, Bills, Receipts, Payments, Expenses
      expect(res.recentTransactions.length).toBeGreaterThan(0);
      expect(res.recentTransactions.some((t) => t.type === "Invoice")).toBe(true);
      expect(res.recentTransactions.some((t) => t.type === "Bill")).toBe(true);
      expect(res.recentTransactions.some((t) => t.type === "Receipt")).toBe(true);
      expect(res.recentTransactions.some((t) => t.type === "Payment")).toBe(true);
      expect(res.recentTransactions.some((t) => t.type === "Expense")).toBe(true);
    });
  });

  describe("7. Dashboard API Route & Tenant Security (/api/dashboard)", () => {
    const mockOrgId = "507f1f77bcf86cd799439011";
    const otherOrgId = "507f1f77bcf86cd799439022";

    it("returns 401 Unauthorized when session is missing", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { GET } = await import("@/app/api/dashboard/route");
      const req = new Request("http://localhost:3000/api/dashboard");
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Authentication required");
    });

    it("returns 403 Forbidden when a non-admin tries to access another tenant's organization", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "user-123",
          role: "Administrator",
          organizationId: mockOrgId,
        },
      });

      vi.spyOn(db, "connectToDatabase").mockResolvedValue({} as never);

      const { GET } = await import("@/app/api/dashboard/route");
      const req = new Request(`http://localhost:3000/api/dashboard?organizationId=${otherOrgId}`);
      const res = await GET(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("You can only access your own organization");
    });

    it("returns 403 when user organization is inactive", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "user-123",
          role: "Administrator",
          organizationId: mockOrgId,
        },
      });

      vi.spyOn(db, "connectToDatabase").mockResolvedValue({} as never);

      vi.spyOn(models.Organization, "findById").mockReturnValue({
        select: () => ({
          lean: async () => ({
            _id: mockOrgId,
            name: "Inactive Corp",
            status: "inactive",
          }),
        }),
      } as never);

      const { GET } = await import("@/app/api/dashboard/route");
      const req = new Request(`http://localhost:3000/api/dashboard?organizationId=${mockOrgId}`);
      const res = await GET(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("inactive");
    });
  });

  describe("8. UI Contract & Dummy Data Elimination (app/page.tsx)", () => {
    it("ensures app/page.tsx does NOT import from demo-data or use mock data", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const pagePath = path.resolve(__dirname, "../app/page.tsx");
      const pageContent = fs.readFileSync(pagePath, "utf-8");

      expect(pageContent).not.toContain("@/lib/demo-data");
      expect(pageContent).not.toContain("seedDemoData");
      expect(pageContent).not.toContain("Load demo data");
      expect(pageContent).not.toContain("24,80,000");
      expect(pageContent).not.toContain("18,25,000");
      expect(pageContent).not.toContain("5,40,000");

      // Verify dynamic integration
      expect(pageContent).toContain('fetch(`/api/dashboard?');
      expect(pageContent).toContain("fetchDashboard");
      expect(pageContent).toContain("setDateRange");
      expect(pageContent).toContain("handleExport");
      expect(pageContent).toContain("data?.snapshot.formattedNetProfit");
      expect(pageContent).toContain("data?.snapshot.formattedCashBalance");
      expect(pageContent).toContain("data?.snapshot.formattedOverdueInvoices");
      expect(pageContent).toContain("data?.snapshot.formattedInventoryValue");

      // Quick action functional links
      expect(pageContent).toContain('href="/sales/invoices/new"');
      expect(pageContent).toContain('href="/sales/payments"');
      expect(pageContent).toContain('href="/purchases/bills/new"');
      expect(pageContent).toContain('href="/reports"');

      // Auto update event listeners
      expect(pageContent).toContain('"focus"');
      expect(pageContent).toContain('"visibilitychange"');
      expect(pageContent).toContain('"storage"');
      expect(pageContent).toContain('"records-updated"');
    });
  });
});
