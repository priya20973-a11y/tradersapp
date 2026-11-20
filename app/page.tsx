"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CircleDollarSign,
  Download,
  Inbox,
  Loader2,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import type {
  DashboardData,
  DateRangePreset,
} from "@/lib/dashboard-service";

const pieColors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date Range state
  const [dateRange, setDateRange] = useState<DateRangePreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const fetchDashboard = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        if (!data) setLoading(true);
        else setRefreshing(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("range", dateRange);
        if (dateRange === "custom") {
          if (customStart) params.set("startDate", customStart);
          if (customEnd) params.set("endDate", customEnd);
        }

        const res = await fetch(`/api/dashboard?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load dashboard data");
        }

        const json: DashboardData = await res.json();
        setData(json);
        setLastRefreshedAt(new Date());
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error loading dashboard";
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateRange, customStart, customEnd, data],
  );

  // Fetch data on date range change
  useEffect(() => {
    void Promise.resolve().then(() => fetchDashboard());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customStart, customEnd]);

  // Automatic updates:
  // 1. When returning to tab (focus / visibility)
  // 2. Cross-tab record change events (storage)
  // 3. Custom record change events
  // 4. Polling interval every 30 seconds
  useEffect(() => {
    const onFocus = () => {
      fetchDashboard(true);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchDashboard(true);
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (
        e.key?.includes("dashboard") ||
        e.key?.includes("invoice") ||
        e.key?.includes("bill") ||
        e.key?.includes("payment") ||
        e.key?.includes("record")
      ) {
        fetchDashboard(true);
      }
    };

    const onRecordChange = () => {
      fetchDashboard(true);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("records-updated", onRecordChange);
    window.addEventListener("dashboard-refresh", onRecordChange);

    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchDashboard(true);
      }
    }, 30000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("records-updated", onRecordChange);
      window.removeEventListener("dashboard-refresh", onRecordChange);
      clearInterval(intervalId);
    };
  }, [fetchDashboard]);

  // Export Dashboard to CSV
  const handleExport = () => {
    if (!data) return;

    const rows: string[][] = [
      ["TRADER APP FINANCIAL DASHBOARD REPORT"],
      ["Organization", data.organization.name],
      ["Currency", data.organization.currency],
      ["Period Filter", dateRange],
      ...(dateRange === "custom" ? [["Custom Range", `${customStart} to ${customEnd}`]] : []),
      ["Exported At", new Date().toLocaleString()],
      [],
      ["--- KEY FINANCIAL METRICS ---"],
      ["Metric", "Value", "Period Change"],
      ...data.metrics.map((m) => [m.label, m.value, m.change]),
      [],
      ["--- ORGANIZATION SNAPSHOT ---"],
      ["Net Profit", data.snapshot.formattedNetProfit],
      ["Cash Balance", data.snapshot.formattedCashBalance],
      ["Overdue Invoices", data.snapshot.formattedOverdueInvoices],
      ["Inventory Valuation", data.snapshot.formattedInventoryValue],
      [],
      ["--- RECEIVABLES AGEING BREAKDOWN ---"],
      ["Bucket (Days)", "Percentage Share", "Outstanding Amount"],
      ...data.ageingData.map((a) => [a.name, `${a.value}%`, a.formattedAmount]),
      [],
      ["--- RECENT TRANSACTIONS ---"],
      ["Document / ID", "Party", "Type", "Date", "Amount", "Status"],
      ...data.recentTransactions.map((t) => [t.id, t.party, t.type, t.date, t.amount, t.status]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows
        .map((row) =>
          row.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(","),
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const orgSlug = data.organization.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dashboard-report-${orgSlug}-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Has non-zero data in monthly trend
  const hasTrendData = data?.salesTrend.some((t) => t.sales > 0 || t.expenses > 0);
  const totalReceivables = data?.ageingData.reduce((acc, a) => acc + a.amount, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Overview</p>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-semibold text-slate-900">Financial dashboard</h2>
            {refreshing && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating
              </span>
            )}
          </div>
          {lastRefreshedAt && (
            <p className="mt-1 text-xs text-slate-400">
              Live data from database · Last updated {lastRefreshedAt.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Filter & Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Selector */}
          <div className="relative inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
            <Calendar className="mr-2 h-4 w-4 text-slate-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
              className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
              aria-label="Select date range"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Pickers */}
          {dateRange === "custom" && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-transparent text-xs text-slate-700 focus:outline-none"
                placeholder="Start date"
                aria-label="Start date"
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-transparent text-xs text-slate-700 focus:outline-none"
                placeholder="End date"
                aria-label="End date"
              />
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchDashboard()}
            disabled={loading || refreshing}
            title="Refresh dashboard metrics"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-blue-600" : "text-slate-500"}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export Report Button */}
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || !data}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-slate-600" />
            Export
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboard()}
            className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          // Loading Skeletons
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="h-8 w-8 rounded-lg bg-slate-100" />
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div className="h-8 w-32 rounded bg-slate-200" />
                <div className="h-5 w-14 rounded-full bg-slate-100" />
              </div>
            </div>
          ))
        ) : (
          data?.metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{metric.label}</p>
                <div
                  className={`rounded-lg p-2 ${
                    metric.accent === "emerald"
                      ? "bg-emerald-50 text-emerald-600"
                      : metric.accent === "blue"
                        ? "bg-blue-50 text-blue-600"
                        : metric.accent === "amber"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-rose-50 text-rose-600"
                  }`}
                >
                  {metric.accent === "rose" ? (
                    <ReceiptText className="h-4 w-4" />
                  ) : (
                    <CircleDollarSign className="h-4 w-4" />
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <h3 className="text-2xl font-semibold text-slate-900">{metric.value}</h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                    metric.trend === "up"
                      ? "bg-emerald-50 text-emerald-700"
                      : metric.trend === "down"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {metric.trend === "up" ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : metric.trend === "down" ? (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  ) : null}
                  {metric.change}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Middle Row: Income vs Expenses & Receivables Ageing */}
      <div className="grid gap-4 xl:grid-cols-[1.7fr_0.9fr]">
        {/* Income vs Expenses Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Income vs expenses</h3>
              <p className="text-xs text-slate-500">Monthly actuals from sales invoices and expenses/bills</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 font-medium">Monthly</span>
          </div>

          <div className="h-72">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              </div>
            ) : !hasTrendData ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                <Inbox className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-700">No income or expense data</p>
                <p className="text-xs text-slate-400">
                  Data will appear dynamically when invoices and purchase bills or expenses are recorded.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.salesTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis
                    stroke="#64748b"
                    tickFormatter={(val) => {
                      if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
                      if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
                      if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
                      return `₹${val}`;
                    }}
                  />
                  <Tooltip
                    formatter={(val) => [
                      new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: data?.organization.currency || "INR",
                        maximumFractionDigits: 0,
                      }).format(Number(val) || 0),
                      "",
                    ]}
                  />
                  <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses & Purchases" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Receivables Ageing Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Receivables ageing</h3>
              <p className="text-xs text-slate-500">Outstanding invoice balances by overdue age</p>
            </div>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>

          <div className="h-72">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              </div>
            ) : totalReceivables <= 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                <PackageCheck className="mb-2 h-8 w-8 text-emerald-400" />
                <p className="text-sm font-medium text-slate-700">No outstanding receivables</p>
                <p className="text-xs text-slate-400">All customer invoices are settled or none created yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.ageingData || []}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={84}
                    paddingAngle={2}
                  >
                    {(data?.ageingData || []).map((entry, index) => (
                      <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name, item) => [
                      `${item.payload?.formattedAmount || "₹0"} (${val}%)`,
                      `Overdue ${name} days`,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-2 text-sm text-slate-600">
            {(data?.ageingData || []).map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: pieColors[index % pieColors.length] }}
                  />
                  <span>{item.name} days</span>
                  <span className="text-xs text-slate-400">({item.formattedAmount})</span>
                </div>
                <span className="font-medium text-slate-800">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Transactions & Quick Actions */}
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        {/* Recent Transactions List */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Recent transactions</h3>
            <span className="text-sm text-slate-500">Real-time database activity</span>
          </div>

          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="animate-pulse flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <div className="space-y-1">
                    <div className="h-4 w-32 rounded bg-slate-200" />
                    <div className="h-3 w-20 rounded bg-slate-100" />
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="h-4 w-16 rounded bg-slate-200" />
                    <div className="h-3 w-12 rounded bg-slate-100" />
                  </div>
                </div>
              ))
            ) : data?.recentTransactions && data.recentTransactions.length > 0 ? (
              data.recentTransactions.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.link || "#"}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 transition hover:bg-slate-50"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">{item.party}</p>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {item.id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {item.type} · {item.date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-800">{item.amount}</p>
                    <p
                      className={`text-xs font-medium ${
                        item.status === "Paid" || item.status === "Cleared"
                          ? "text-emerald-600"
                          : item.status === "Overdue"
                            ? "text-rose-600"
                            : item.status === "Partially Paid"
                              ? "text-blue-600"
                              : "text-amber-600"
                      }`}
                    >
                      {item.status}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
                <ReceiptText className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-700">No recent transactions</p>
                <p className="text-xs text-slate-400">
                  Transactions will appear dynamically as invoices, bills, and payments are recorded.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Quick actions</h3>
            <PackageCheck className="h-4 w-4 text-slate-500" />
          </div>
          <div className="space-y-3 text-sm text-slate-700">
            <Link
              href="/sales/invoices/new"
              className="block w-full rounded-xl bg-slate-900 px-3 py-2 text-left font-medium text-white hover:bg-slate-800 transition"
            >
              Create invoice
            </Link>
            <Link
              href="/sales/payments"
              className="block w-full rounded-xl bg-emerald-50 px-3 py-2 text-left font-medium text-emerald-700 hover:bg-emerald-100 transition"
            >
              Record payment
            </Link>
            <Link
              href="/purchases/bills/new"
              className="block w-full rounded-xl bg-blue-50 px-3 py-2 text-left font-medium text-blue-700 hover:bg-blue-100 transition"
            >
              Add vendor bill
            </Link>
            <Link
              href="/reports"
              className="block w-full rounded-xl bg-amber-50 px-3 py-2 text-left font-medium text-amber-700 hover:bg-amber-100 transition"
            >
              Run report
            </Link>
          </div>
        </div>
      </div>

      {/* Organization Snapshot */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Organization snapshot</h3>
          <span className="text-sm font-medium text-slate-600">
            {loading ? "Loading..." : data?.organization.name || "My Organization"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Net profit</p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                (data?.snapshot.netProfit || 0) >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {loading ? "₹0" : data?.snapshot.formattedNetProfit || "₹0"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cash balance</p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                (data?.snapshot.cashBalance || 0) >= 0 ? "text-slate-900" : "text-rose-700"
              }`}
            >
              {loading ? "₹0" : data?.snapshot.formattedCashBalance || "₹0"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Overdue invoices</p>
            <p className="mt-2 text-2xl font-semibold text-amber-700">
              {loading ? "₹0" : data?.snapshot.formattedOverdueInvoices || "₹0"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Inventory valuation</p>
            <p className="mt-2 text-2xl font-semibold text-blue-700">
              {loading ? "₹0" : data?.snapshot.formattedInventoryValue || "₹0"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
