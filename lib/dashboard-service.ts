import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import {
  Customer,
  Expense,
  Item,
  Organization,
  PurchaseBill,
  SalesDocument,
  StockLevel,
  StockLot,
  Vendor,
  VendorPayment,
} from "@/models";
import { formatCurrency } from "@/lib/invoice-utils";

export type DateRangePreset =
  | "all"
  | "today"
  | "this_week"
  | "this_month"
  | "last_30_days"
  | "this_quarter"
  | "this_year"
  | "custom";

export interface DateRangeBoundaries {
  start?: Date;
  end?: Date;
  previousStart?: Date;
  previousEnd?: Date;
}

export interface MetricItem {
  label: string;
  value: string;
  rawValue: number;
  change: string;
  trend: "up" | "down" | "neutral";
  accent: "emerald" | "blue" | "amber" | "rose";
}

export interface SnapshotMetrics {
  netProfit: number;
  formattedNetProfit: string;
  cashBalance: number;
  formattedCashBalance: string;
  overdueInvoices: number;
  formattedOverdueInvoices: string;
  inventoryValue: number;
  formattedInventoryValue: string;
}

export interface TrendMonth {
  month: string;
  fullLabel?: string;
  sales: number;
  expenses: number;
}

export interface AgeingBucket {
  name: string;
  value: number; // percentage (0-100)
  amount: number;
  formattedAmount: string;
}

export interface DashboardTransaction {
  id: string;
  party: string;
  type: "Invoice" | "Bill" | "Receipt" | "Payment" | "Expense";
  amount: string;
  rawAmount: number;
  date: string;
  rawDate: Date;
  status: string;
  link?: string;
}

export interface DashboardData {
  organization: {
    id: string;
    name: string;
    currency: string;
  };
  metrics: MetricItem[];
  snapshot: SnapshotMetrics;
  salesTrend: TrendMonth[];
  ageingData: AgeingBucket[];
  recentTransactions: DashboardTransaction[];
  hasData: boolean;
  dateRange: {
    preset: DateRangePreset;
    startDate?: string;
    endDate?: string;
  };
}

/**
 * Parses date string safely in local time.
 */
function parseLocalDate(dateStr: string, isEndOfDay = false): Date {
  const parts = dateStr.split("-").map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return isEndOfDay
      ? new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999)
      : new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  const d = new Date(dateStr);
  if (isEndOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculates start and end boundaries for preset and custom date ranges,
 * as well as preceding period of equal length for percentage-change comparisons.
 */
export function getDateRangeBoundaries(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date(),
): DateRangeBoundaries {
  const now = new Date(referenceDate);

  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 1);
    const prevEnd = new Date(end);
    prevEnd.setDate(prevEnd.getDate() - 1);
    return { start, end, previousStart: prevStart, previousEnd: prevEnd };
  }

  if (preset === "this_week") {
    // Current week starting Monday
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(end);
    prevEnd.setDate(prevEnd.getDate() - 7);
    return { start, end, previousStart: prevStart, previousEnd: prevEnd };
  }

  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end, previousStart: prevStart, previousEnd: prevEnd };
  }

  if (preset === "last_30_days") {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);

    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 29);
    prevStart.setHours(0, 0, 0, 0);
    return { start, end, previousStart: prevStart, previousEnd: prevEnd };
  }

  if (preset === "this_quarter") {
    const currentMonth = now.getMonth();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    const start = new Date(now.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);

    const prevStart = new Date(now.getFullYear(), quarterStartMonth - 3, 1, 0, 0, 0, 0);
    const prevEnd = new Date(now.getFullYear(), quarterStartMonth, 0, 23, 59, 59, 999);
    return { start, end, previousStart: prevStart, previousEnd: prevEnd };
  }

  if (preset === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    const prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return { start, end, previousStart: prevStart, previousEnd: prevEnd };
  }

  if (preset === "custom" && (customStart || customEnd)) {
    const start = customStart ? parseLocalDate(customStart, false) : new Date(0);
    const end = customEnd ? parseLocalDate(customEnd, true) : new Date(now);

    const duration = Math.max(86400000, end.getTime() - start.getTime());
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return { start, end, previousStart: prevStart, previousEnd: prevEnd };
  }

  // "all" preset: no date boundaries on current totals
  // For comparison, use current 30-day window vs prior 30-day window
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 29);
  prevStart.setHours(0, 0, 0, 0);

  return {
    start: undefined,
    end: undefined,
    previousStart: prevStart,
    previousEnd: prevEnd,
  };
}

/**
 * Calculates percentage change between current and previous period.
 */
export function calculatePercentageChange(
  current: number,
  previous: number,
): { change: string; trend: "up" | "down" | "neutral" } {
  const safeCurr = Number(current) || 0;
  const safePrev = Number(previous) || 0;

  if (safePrev === 0) {
    if (safeCurr === 0) return { change: "0%", trend: "neutral" };
    return { change: "+100%", trend: "up" };
  }

  const diff = safeCurr - safePrev;
  const pct = (diff / Math.abs(safePrev)) * 100;
  const rounded = Math.round(pct * 10) / 10;

  if (rounded > 0) return { change: `+${rounded}%`, trend: "up" };
  if (rounded < 0) return { change: `${rounded}%`, trend: "down" };
  return { change: "0%", trend: "neutral" };
}

/**
 * Categorizes unpaid / partially paid customer invoices into standard ageing buckets.
 */
export function calculateReceivablesAgeing(
  invoices: Array<{
    balanceRemaining?: number;
    total?: number;
    amountPaid?: number;
    creditedAmount?: number;
    dueDate?: Date | string | null;
    issueDate?: Date | string | null;
    status?: string;
  }>,
  asOfDate: Date = new Date(),
  currency = "INR",
): { buckets: AgeingBucket[]; totalReceivables: number } {
  let bucket0to30 = 0;
  let bucket31to60 = 0;
  let bucket61to90 = 0;
  let bucket90Plus = 0;
  let totalReceivables = 0;

  const asOfTime = asOfDate.getTime();

  for (const inv of invoices) {
    if (inv.status === "Void" || inv.status === "Paid") continue;

    let balance = Number(inv.balanceRemaining);
    if (isNaN(balance) || balance <= 0) {
      const tot = Number(inv.total || 0);
      const paid = Number(inv.amountPaid || 0);
      const cred = Number(inv.creditedAmount || 0);
      balance = Math.max(0, tot - paid - cred);
    }

    if (balance <= 0) continue;

    totalReceivables += balance;

    // Ageing is based on due date if available, otherwise issue date
    const targetDate = inv.dueDate ? new Date(inv.dueDate) : inv.issueDate ? new Date(inv.issueDate) : asOfDate;
    const diffMs = asOfTime - targetDate.getTime();
    const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysOverdue <= 30) {
      bucket0to30 += balance;
    } else if (daysOverdue <= 60) {
      bucket31to60 += balance;
    } else if (daysOverdue <= 90) {
      bucket61to90 += balance;
    } else {
      bucket90Plus += balance;
    }
  }

  const roundPct = (amount: number) => {
    if (totalReceivables <= 0) return 0;
    return Math.round((amount / totalReceivables) * 100);
  };

  const buckets: AgeingBucket[] = [
    {
      name: "0-30",
      value: roundPct(bucket0to30),
      amount: Math.round(bucket0to30),
      formattedAmount: formatCurrency(bucket0to30, currency, false),
    },
    {
      name: "31-60",
      value: roundPct(bucket31to60),
      amount: Math.round(bucket31to60),
      formattedAmount: formatCurrency(bucket31to60, currency, false),
    },
    {
      name: "61-90",
      value: roundPct(bucket61to90),
      amount: Math.round(bucket61to90),
      formattedAmount: formatCurrency(bucket61to90, currency, false),
    },
    {
      name: "90+",
      value: roundPct(bucket90Plus),
      amount: Math.round(bucket90Plus),
      formattedAmount: formatCurrency(bucket90Plus, currency, false),
    },
  ];

  return { buckets, totalReceivables: Math.round(totalReceivables) };
}

/**
 * Calculates monthly sales vs expenses for a given number of recent months.
 */
export function calculateSalesExpensesTrend(
  invoices: Array<{ total?: number; issueDate?: Date | string | null; status?: string }>,
  bills: Array<{ total?: number; billDate?: Date | string | null; status?: string }>,
  expenses: Array<{ amount?: number; date?: string | null; status?: string }>,
  monthCount = 6,
  referenceDate: Date = new Date(),
): TrendMonth[] {
  const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trend: TrendMonth[] = [];

  const ref = new Date(referenceDate);

  // Generate recent month slots in chronological order
  for (let i = monthCount - 1; i >= 0; i--) {
    const target = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    trend.push({
      month: shortMonths[target.getMonth()],
      fullLabel: `${shortMonths[target.getMonth()]} ${target.getFullYear()}`,
      sales: 0,
      expenses: 0,
    });
  }

  // Map to index by year-month
  const getSlotIndex = (dateObj: Date) => {
    for (let i = 0; i < monthCount; i++) {
      const target = new Date(ref.getFullYear(), ref.getMonth() - (monthCount - 1 - i), 1);
      if (dateObj.getFullYear() === target.getFullYear() && dateObj.getMonth() === target.getMonth()) {
        return i;
      }
    }
    return -1;
  };

  // Aggregate Sales (Invoices)
  for (const inv of invoices) {
    if (inv.status === "Void") continue;
    if (!inv.issueDate) continue;
    const d = new Date(inv.issueDate);
    if (isNaN(d.getTime())) continue;
    const idx = getSlotIndex(d);
    if (idx !== -1) {
      trend[idx].sales += Number(inv.total || 0);
    }
  }

  // Aggregate Purchases (Bills)
  for (const bill of bills) {
    if (bill.status === "Void") continue;
    if (!bill.billDate) continue;
    const d = new Date(bill.billDate);
    if (isNaN(d.getTime())) continue;
    const idx = getSlotIndex(d);
    if (idx !== -1) {
      trend[idx].expenses += Number(bill.total || 0);
    }
  }

  // Aggregate Operational Expenses
  for (const exp of expenses) {
    if (exp.status === "Draft") continue;
    if (!exp.date) continue;
    const d = new Date(exp.date);
    if (isNaN(d.getTime())) continue;
    const idx = getSlotIndex(d);
    if (idx !== -1) {
      trend[idx].expenses += Number(exp.amount || 0);
    }
  }

  // Round values
  return trend.map((t) => ({
    ...t,
    sales: Math.round(t.sales),
    expenses: Math.round(t.expenses),
  }));
}

/**
 * Combines invoices, bills, customer payments, vendor payments, and expenses into a recent transactions list.
 */
export function compileRecentTransactions(
  invoices: Array<{
    _id?: unknown;
    number?: string;
    customerSnapshot?: { name?: string };
    total?: number;
    issueDate?: Date | string;
    status?: string;
  }> = [],
  bills: Array<{
    _id?: unknown;
    billNumber?: string;
    vendorName?: string;
    total?: number;
    billDate?: Date | string;
    status?: string;
  }> = [],
  paymentsReceived: Array<{
    _id?: unknown;
    number?: string;
    receiptNumber?: string;
    customerSnapshot?: { name?: string };
    amountPaid?: number;
    total?: number;
    paymentDate?: Date | string;
    issueDate?: Date | string;
    status?: string;
  }> = [],
  vendorPayments: Array<{
    _id?: unknown;
    paymentNumber?: string;
    vendorName?: string;
    amount?: number;
    paymentDate?: Date | string;
    status?: string;
  }> = [],
  expenses: Array<{
    _id?: unknown;
    referenceNumber?: string;
    vendor?: string;
    customerName?: string;
    amount?: number;
    date?: string;
    status?: string;
  }> = [],
  currency = "INR",
  limit = 7,
): DashboardTransaction[] {
  const combined: DashboardTransaction[] = [];

  const formatDate = (date: Date | string | undefined | null): { str: string; obj: Date } => {
    if (!date) return { str: "", obj: new Date(0) };
    const obj = new Date(date);
    if (isNaN(obj.getTime())) return { str: "", obj: new Date(0) };
    const yyyy = obj.getFullYear();
    const mm = String(obj.getMonth() + 1).padStart(2, "0");
    const dd = String(obj.getDate()).padStart(2, "0");
    return { str: `${yyyy}-${mm}-${dd}`, obj };
  };

  for (const inv of invoices) {
    const { str, obj } = formatDate(inv.issueDate);
    const amt = Number(inv.total || 0);
    combined.push({
      id: inv.number || `INV-${String(inv._id || "").slice(-4)}`,
      party: inv.customerSnapshot?.name || "Customer",
      type: "Invoice",
      amount: formatCurrency(amt, currency, false),
      rawAmount: amt,
      date: str,
      rawDate: obj,
      status: inv.status || "Draft",
      link: inv._id ? `/sales/invoices/${inv._id}` : "/sales/invoices",
    });
  }

  for (const b of bills) {
    const { str, obj } = formatDate(b.billDate);
    const amt = Number(b.total || 0);
    combined.push({
      id: b.billNumber || `BILL-${String(b._id || "").slice(-4)}`,
      party: b.vendorName || "Vendor",
      type: "Bill",
      amount: formatCurrency(amt, currency, false),
      rawAmount: amt,
      date: str,
      rawDate: obj,
      status: b.status || "Pending",
      link: b._id ? `/purchases/bills/${b._id}` : "/purchases/bills",
    });
  }

  for (const p of paymentsReceived) {
    const { str, obj } = formatDate(p.paymentDate || p.issueDate);
    const amt = Number(p.amountPaid || p.total || 0);
    combined.push({
      id: p.receiptNumber || p.number || `PAY-${String(p._id || "").slice(-4)}`,
      party: p.customerSnapshot?.name || "Customer",
      type: "Receipt",
      amount: formatCurrency(amt, currency, false),
      rawAmount: amt,
      date: str,
      rawDate: obj,
      status: p.status || "Cleared",
      link: "/sales/payments",
    });
  }

  for (const vp of vendorPayments) {
    const { str, obj } = formatDate(vp.paymentDate);
    const amt = Number(vp.amount || 0);
    combined.push({
      id: vp.paymentNumber || `VPAY-${String(vp._id || "").slice(-4)}`,
      party: vp.vendorName || "Vendor",
      type: "Payment",
      amount: formatCurrency(amt, currency, false),
      rawAmount: amt,
      date: str,
      rawDate: obj,
      status: vp.status || "Cleared",
      link: "/purchases/payments",
    });
  }

  for (const exp of expenses) {
    const { str, obj } = formatDate(exp.date);
    const amt = Number(exp.amount || 0);
    combined.push({
      id: exp.referenceNumber || `EXP-${String(exp._id || "").slice(-4)}`,
      party: exp.vendor || exp.customerName || "Expense Payee",
      type: "Expense",
      amount: formatCurrency(amt, currency, false),
      rawAmount: amt,
      date: str,
      rawDate: obj,
      status: exp.status || "Paid",
      link: "/expenses",
    });
  }

  // Sort descending by rawDate
  combined.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

  return combined.slice(0, limit);
}

/**
 * Main service function to fetch and compute all dashboard data dynamically.
 */
export async function getDashboardData(options: {
  organizationId: string;
  range?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  referenceDate?: Date;
}): Promise<DashboardData> {
  const { organizationId, range = "all", startDate, endDate, referenceDate = new Date() } = options;

  await connectToDatabase();

  const orgObjId = isValidObjectId(organizationId) ? new Types.ObjectId(organizationId) : organizationId;

  // 1. Fetch organization details
  const orgDoc = await Organization.findById(orgObjId).select("name currency status").lean().catch(() => null);
  const orgName = String(orgDoc?.name || "Organization");
  const currency = String(orgDoc?.currency || "INR");

  // 2. Compute date boundaries
  const boundaries = getDateRangeBoundaries(range, startDate, endDate, referenceDate);
  const now = referenceDate;

  // 3. Query all relevant collections in parallel
  const [
    allInvoicesRaw,
    allBillsRaw,
    paymentsReceivedRaw,
    vendorPaymentsRaw,
    expensesRaw,
    stockLevelsRaw,
    stockLotsRaw,
    itemsRaw,
  ] = await Promise.all([
    SalesDocument.find({
      organizationId: orgObjId,
      type: "Invoice",
    })
      .select("_id number customerId customerSnapshot status issueDate dueDate total amountPaid creditedAmount balanceRemaining")
      .lean()
      .catch(() => []),

    PurchaseBill.find({
      organizationId: orgObjId,
    })
      .select("_id billNumber vendorId vendorName billDate dueDate status total amountPaid vendorCreditApplied balanceDue")
      .lean()
      .catch(() => []),

    SalesDocument.find({
      organizationId: orgObjId,
      type: "Payment Received",
    })
      .select("_id number receiptNumber customerSnapshot total amountPaid paymentDate issueDate status")
      .lean()
      .catch(() => []),

    VendorPayment.find({
      organizationId: orgObjId,
    })
      .select("_id paymentNumber vendorName amount paymentDate status")
      .lean()
      .catch(() => []),

    Expense.find({
      organizationId: orgObjId,
    })
      .select("_id referenceNumber vendor customerName amount date status")
      .lean()
      .catch(() => []),

    StockLevel.find({
      organizationId: orgObjId,
    })
      .select("stockValue onHandQuantity averageCost")
      .lean()
      .catch(() => []),

    StockLot.find({
      organizationId: orgObjId,
      status: { $ne: "Dispatched" },
    })
      .select("physicalQuantity dispatchedQuantity purchaseCost")
      .lean()
      .catch(() => []),

    Item.find({
      organizationId: orgObjId,
      active: true,
    })
      .select("openingStock purchasePrice salesPrice")
      .lean()
      .catch(() => []),
  ]);

  // Helper date checker
  const isInRange = (d?: Date | string | null, start?: Date, end?: Date) => {
    if (!start && !end) return true;
    if (!d) return false;
    const time = new Date(d).getTime();
    if (isNaN(time)) return false;
    if (start && time < start.getTime()) return false;
    if (end && time > end.getTime()) return false;
    return true;
  };

  // Helper date checker for string dates (YYYY-MM-DD)
  const isStringDateInRange = (dateStr?: string | null, start?: Date, end?: Date) => {
    if (!start && !end) return true;
    if (!dateStr) return false;
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return false;
    if (start && time < start.getTime()) return false;
    if (end && time > end.getTime()) return false;
    return true;
  };

  // Filter for current period
  const invoicesInPeriod = allInvoicesRaw.filter((inv) =>
    isInRange(inv.issueDate, boundaries.start, boundaries.end),
  );
  const billsInPeriod = allBillsRaw.filter((b) =>
    isInRange(b.billDate, boundaries.start, boundaries.end),
  );
  const expensesList = expensesRaw as Array<{
    _id?: unknown;
    referenceNumber?: string;
    vendor?: string;
    customerName?: string;
    amount?: number;
    date?: string;
    status?: string;
  }>;
  const expensesInPeriod = expensesList.filter((exp) =>
    isStringDateInRange(exp.date, boundaries.start, boundaries.end),
  );

  // Filter for previous period (for trend calculation)
  const invoicesInPrev = allInvoicesRaw.filter((inv) =>
    isInRange(inv.issueDate, boundaries.previousStart, boundaries.previousEnd),
  );
  const billsInPrev = allBillsRaw.filter((b) =>
    isInRange(b.billDate, boundaries.previousStart, boundaries.previousEnd),
  );

  // --- Calculate Metrics ---

  // 1. Total Sales
  const currentSalesTotal = invoicesInPeriod
    .filter((inv) => inv.status !== "Void")
    .reduce((sum, inv) => sum + Number(inv.total || 0), 0);

  const prevSalesTotal = invoicesInPrev
    .filter((inv) => inv.status !== "Void")
    .reduce((sum, inv) => sum + Number(inv.total || 0), 0);

  const salesChange = calculatePercentageChange(currentSalesTotal, prevSalesTotal);

  // 2. Total Purchases
  const currentPurchasesTotal = billsInPeriod
    .filter((b) => b.status !== "Void")
    .reduce((sum, b) => sum + Number(b.total || 0), 0);

  const prevPurchasesTotal = billsInPrev
    .filter((b) => b.status !== "Void")
    .reduce((sum, b) => sum + Number(b.total || 0), 0);

  const purchasesChange = calculatePercentageChange(currentPurchasesTotal, prevPurchasesTotal);

  // 3. Receivables (Customer Invoices Unpaid)
  // For receivables and payables: calculate outstanding balances
  const targetInvoicesForReceivables = boundaries.start ? invoicesInPeriod : allInvoicesRaw;
  let totalReceivables = 0;
  let overdueInvoicesTotal = 0;

  for (const inv of targetInvoicesForReceivables) {
    if (inv.status === "Void" || inv.status === "Paid") continue;
    let bal = Number(inv.balanceRemaining);
    if (isNaN(bal) || bal <= 0) {
      bal = Math.max(0, Number(inv.total || 0) - Number(inv.amountPaid || 0) - Number(inv.creditedAmount || 0));
    }
    if (bal > 0) {
      totalReceivables += bal;
      if (inv.dueDate && new Date(inv.dueDate).getTime() < now.getTime()) {
        overdueInvoicesTotal += bal;
      }
    }
  }

  // Receivables prior period comparison
  const prevInvoicesForReceivables = allInvoicesRaw.filter((inv) =>
    isInRange(inv.issueDate, boundaries.previousStart, boundaries.previousEnd),
  );
  const prevReceivables = prevInvoicesForReceivables
    .filter((inv) => inv.status !== "Void" && inv.status !== "Paid")
    .reduce((sum, inv) => {
      const bal = Number(inv.balanceRemaining ?? Math.max(0, Number(inv.total || 0) - Number(inv.amountPaid || 0)));
      return sum + (bal > 0 ? bal : 0);
    }, 0);

  const receivablesChange = calculatePercentageChange(totalReceivables, prevReceivables);

  // 4. Payables (Vendor Bills Unpaid)
  const targetBillsForPayables = boundaries.start ? billsInPeriod : allBillsRaw;
  let totalPayables = 0;

  for (const b of targetBillsForPayables) {
    if (b.status === "Void" || b.status === "Paid") continue;
    let bal = Number(b.balanceDue);
    if (isNaN(bal) || bal <= 0) {
      bal = Math.max(0, Number(b.total || 0) - Number(b.amountPaid || 0) - Number(b.vendorCreditApplied || 0));
    }
    if (bal > 0) {
      totalPayables += bal;
    }
  }

  const prevBillsForPayables = allBillsRaw.filter((b) =>
    isInRange(b.billDate, boundaries.previousStart, boundaries.previousEnd),
  );
  const prevPayables = prevBillsForPayables
    .filter((b) => b.status !== "Void" && b.status !== "Paid")
    .reduce((sum, b) => {
      const bal = Number(b.balanceDue ?? Math.max(0, Number(b.total || 0) - Number(b.amountPaid || 0)));
      return sum + (bal > 0 ? bal : 0);
    }, 0);

  const payablesChange = calculatePercentageChange(totalPayables, prevPayables);

  // 5. Total Expenses
  const currentExpensesTotal = expensesInPeriod
    .filter((e) => e.status !== "Draft")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  // 6. Net Profit
  const netProfit = currentSalesTotal - currentPurchasesTotal - currentExpensesTotal;

  // 7. Cash Balance (Inflows - Outflows)
  // Inflows: Customer payments received in period + cash invoices
  const customerPaymentsTotal = paymentsReceivedRaw
    .filter((p) => isInRange(p.paymentDate || p.issueDate, boundaries.start, boundaries.end))
    .reduce((sum, p) => sum + Number(p.amountPaid || p.total || 0), 0);

  // Outflows: Vendor payments in period + paid expenses in period
  const vendorPaymentsTotal = vendorPaymentsRaw
    .filter((vp) => isInRange(vp.paymentDate, boundaries.start, boundaries.end))
    .reduce((sum, vp) => sum + Number(vp.amount || 0), 0);

  const directExpensesPaid = expensesInPeriod
    .filter((e) => e.status === "Paid")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const cashBalance = customerPaymentsTotal - vendorPaymentsTotal - directExpensesPaid;

  // 8. Total Inventory Value
  let inventoryValue = 0;
  if (stockLevelsRaw.length > 0) {
    inventoryValue = stockLevelsRaw.reduce((sum, lvl) => {
      const val = Number(lvl.stockValue || Number(lvl.onHandQuantity || 0) * Number(lvl.averageCost || 0));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  } else if (stockLotsRaw.length > 0) {
    inventoryValue = stockLotsRaw.reduce((sum, lot) => {
      const qty = Math.max(0, Number(lot.physicalQuantity || 0) - Number(lot.dispatchedQuantity || 0));
      return sum + qty * Number(lot.purchaseCost || 0);
    }, 0);
  } else if (itemsRaw.length > 0) {
    inventoryValue = itemsRaw.reduce((sum, item) => {
      return sum + Number(item.openingStock || 0) * Number(item.purchasePrice || item.salesPrice || 0);
    }, 0);
  }

  // --- Receivables Ageing ---
  const { buckets: ageingData } = calculateReceivablesAgeing(allInvoicesRaw, now, currency);

  // --- Monthly Income vs Expenses Trend ---
  const salesTrend = calculateSalesExpensesTrend(allInvoicesRaw, allBillsRaw, expensesList, 6, now);

  // --- Recent Transactions ---
  const recentTransactions = compileRecentTransactions(
    allInvoicesRaw,
    allBillsRaw,
    paymentsReceivedRaw,
    vendorPaymentsRaw,
    expensesList,
    currency,
    7,
  );

  const hasData =
    currentSalesTotal > 0 ||
    currentPurchasesTotal > 0 ||
    totalReceivables > 0 ||
    totalPayables > 0 ||
    currentExpensesTotal > 0 ||
    inventoryValue > 0 ||
    recentTransactions.length > 0;

  return {
    organization: {
      id: String(orgDoc?._id || organizationId),
      name: orgName,
      currency,
    },
    metrics: [
      {
        label: "Total sales",
        value: formatCurrency(currentSalesTotal, currency, false),
        rawValue: Math.round(currentSalesTotal),
        change: salesChange.change,
        trend: salesChange.trend,
        accent: "emerald",
      },
      {
        label: "Total purchases",
        value: formatCurrency(currentPurchasesTotal, currency, false),
        rawValue: Math.round(currentPurchasesTotal),
        change: purchasesChange.change,
        trend: purchasesChange.trend,
        accent: "blue",
      },
      {
        label: "Receivables",
        value: formatCurrency(totalReceivables, currency, false),
        rawValue: Math.round(totalReceivables),
        change: receivablesChange.change,
        trend: receivablesChange.trend,
        accent: "amber",
      },
      {
        label: "Payables",
        value: formatCurrency(totalPayables, currency, false),
        rawValue: Math.round(totalPayables),
        change: payablesChange.change,
        trend: payablesChange.trend,
        accent: "rose",
      },
    ],
    snapshot: {
      netProfit: Math.round(netProfit),
      formattedNetProfit: formatCurrency(netProfit, currency, false),
      cashBalance: Math.round(cashBalance),
      formattedCashBalance: formatCurrency(cashBalance, currency, false),
      overdueInvoices: Math.round(overdueInvoicesTotal),
      formattedOverdueInvoices: formatCurrency(overdueInvoicesTotal, currency, false),
      inventoryValue: Math.round(inventoryValue),
      formattedInventoryValue: formatCurrency(inventoryValue, currency, false),
    },
    salesTrend,
    ageingData,
    recentTransactions,
    hasData,
    dateRange: {
      preset: range,
      startDate,
      endDate,
    },
  };
}
