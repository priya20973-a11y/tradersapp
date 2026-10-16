export type DashboardMetric = {
  label: string;
  value: string;
  change: string;
  accent: "emerald" | "blue" | "amber" | "rose";
};

export const dashboardMetrics: DashboardMetric[] = [
  { label: "Total sales", value: "₹1,48,50,000", change: "+12.4%", accent: "emerald" },
  { label: "Total purchases", value: "₹92,20,000", change: "+7.3%", accent: "blue" },
  { label: "Receivables", value: "₹18,75,000", change: "-3.6%", accent: "amber" },
  { label: "Payables", value: "₹11,10,000", change: "+2.1%", accent: "rose" },
];

export const recentTransactions = [
  { id: "INV-1028", party: "Astra Foods", type: "Invoice", amount: "₹42,500", date: "2026-10-11", status: "Paid" },
  { id: "BILL-4421", party: "Mohan Traders", type: "Bill", amount: "₹18,200", date: "2026-10-10", status: "Pending" },
  { id: "PAY-780", party: "City Retail", type: "Receipt", amount: "₹9,800", date: "2026-10-09", status: "Cleared" },
  { id: "JOURNAL-221", party: "GST Reconciliation", type: "Journal", amount: "₹7,440", date: "2026-10-08", status: "Posted" },
];

export const salesTrend = [
  { month: "Jan", sales: 38, expenses: 28 },
  { month: "Feb", sales: 40, expenses: 30 },
  { month: "Mar", sales: 42, expenses: 31 },
  { month: "Apr", sales: 46, expenses: 34 },
  { month: "May", sales: 52, expenses: 38 },
  { month: "Jun", sales: 49, expenses: 35 },
  { month: "Jul", sales: 55, expenses: 39 },
  { month: "Aug", sales: 58, expenses: 42 },
  { month: "Sep", sales: 62, expenses: 44 },
  { month: "Oct", sales: 67, expenses: 46 },
];

export const ageingData = [
  { name: "0-30", value: 46 },
  { name: "31-60", value: 27 },
  { name: "61-90", value: 18 },
  { name: "90+", value: 9 },
];

export const customers = [
  { id: "C-101", name: "Astra Foods", email: "billing@astrafoods.in", balance: 45000, status: "Active" },
  { id: "C-102", name: "City Retail", email: "accounts@cityretail.in", balance: 17800, status: "Active" },
  { id: "C-103", name: "Ganga Stores", email: "ap@gangastores.in", balance: 23900, status: "Review" },
];

export const vendors = [
  { id: "V-401", name: "Mohan Traders", email: "mohan@traders.in", balance: 18200, status: "Active" },
  { id: "V-402", name: "Shree Packaging", email: "finance@shreepack.in", balance: 9600, status: "Active" },
  { id: "V-403", name: "Metro Logistics", email: "payables@metrologistics.in", balance: 12000, status: "Pending" },
];

export const items = [
  { sku: "SKU-1001", name: "Rice 25kg", stock: 120, unit: "Bag", rate: 2200 },
  { sku: "SKU-1002", name: "Wheat 10kg", stock: 85, unit: "Bag", rate: 1280 },
  { sku: "SKU-1201", name: "Packaging Service", stock: 0, unit: "Service", rate: 350 },
];

export const invoiceRows = [
  { invoice: "INV-1028", customer: "Astra Foods", date: "2026-10-11", total: "₹42,500", status: "Paid" },
  { invoice: "INV-1027", customer: "City Retail", date: "2026-10-10", total: "₹31,800", status: "Partly paid" },
  { invoice: "INV-1026", customer: "Ganga Stores", date: "2026-10-08", total: "₹24,300", status: "Overdue" },
  { invoice: "INV-1025", customer: "Astra Foods", date: "2026-10-07", total: "₹58,250", status: "Draft" },
];

export const organizations = [
  { name: "BharatGodam Foods", region: "Mumbai", currency: "INR" },
  { name: "North Hub Warehousing", region: "Delhi", currency: "INR" },
];

export function seedDemoData() {
  return {
    metrics: dashboardMetrics,
    customers,
    vendors,
    items,
    invoices: invoiceRows,
    organizations,
  };
}
