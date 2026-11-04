"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Download,
  Printer,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/invoice-utils";

interface CustomerOutstandingRow {
  customerId: string;
  customerName: string;
  companyName: string;
  creditLimit: number;
  invoiceCount: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
  oldestInvoiceDate?: string;
}

interface OverdueInvoiceRow {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  issueDate: string;
  dueDate: string;
  daysOverdue: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
}

interface PaymentHistoryRow {
  id: string;
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  method: string;
  referenceNumber: string;
  notes: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
}

export function InvoiceReportsView() {
  const [activeTab, setActiveTab] = useState<"outstanding" | "overdue" | "payments">(
    "outstanding",
  );
  const [customerOutstanding, setCustomerOutstanding] = useState<CustomerOutstandingRow[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoiceRow[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryRow[]>([]);
  const [summary, setSummary] = useState({
    totalOutstanding: 0,
    totalOverdue: 0,
    totalCollected: 0,
  });

  const [dateRange, setDateRange] = useState("all");

  useEffect(() => {
    let active = true;

    async function fetchReports() {
      try {
        const q = new URLSearchParams();
        const now = new Date();
        if (dateRange === "month") {
          q.set("startDate", new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
        } else if (dateRange === "last_month") {
          q.set("startDate", new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString());
          q.set("endDate", new Date(now.getFullYear(), now.getMonth(), 0).toISOString());
        } else if (dateRange === "quarter") {
          const qtr = Math.floor(now.getMonth() / 3);
          q.set("startDate", new Date(now.getFullYear(), qtr * 3, 1).toISOString());
        }

        const res = await fetch(`/api/sales/invoices/reports?${q.toString()}`);
        const data = await res.json();
        if (res.ok && active) {
          setCustomerOutstanding(data.customerOutstanding || []);
          setOverdueInvoices(data.overdueInvoices || []);
          setPaymentHistory(data.paymentHistory || []);
          if (data.summary) setSummary(data.summary);
        }
      } catch (e) {
        console.error(e);
      }
    }

    void fetchReports();

    return () => {
      active = false;
    };
  }, [dateRange]);

  const handleExportCsv = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = "report.csv";

    if (activeTab === "outstanding") {
      filename = `customer_outstanding_${Date.now()}.csv`;
      headers = [
        "Customer Name",
        "Company",
        "Invoices Count",
        "Total Invoiced (INR)",
        "Total Paid (INR)",
        "Outstanding Balance (INR)",
        "Overdue Amount (INR)",
        "Oldest Unpaid Invoice",
      ];
      rows = customerOutstanding.map((c) => [
        `"${c.customerName.replace(/"/g, '""')}"`,
        `"${c.companyName.replace(/"/g, '""')}"`,
        c.invoiceCount,
        c.totalInvoiced,
        c.totalPaid,
        c.totalOutstanding,
        c.totalOverdue,
        c.oldestInvoiceDate || "-",
      ]);
    } else if (activeTab === "overdue") {
      filename = `overdue_invoices_${Date.now()}.csv`;
      headers = [
        "Invoice Number",
        "Customer Name",
        "Invoice Date",
        "Due Date",
        "Days Overdue",
        "Total (INR)",
        "Paid (INR)",
        "Balance Due (INR)",
      ];
      rows = overdueInvoices.map((i) => [
        i.number,
        `"${i.customerName.replace(/"/g, '""')}"`,
        i.issueDate ? new Date(i.issueDate).toLocaleDateString("en-IN") : "",
        i.dueDate ? new Date(i.dueDate).toLocaleDateString("en-IN") : "",
        i.daysOverdue,
        i.total,
        i.amountPaid,
        i.balanceDue,
      ]);
    } else {
      filename = `payment_collections_${Date.now()}.csv`;
      headers = [
        "Receipt Number",
        "Date",
        "Customer",
        "Invoice Number",
        "Payment Mode",
        "Reference Number",
        "Amount (INR)",
      ];
      rows = paymentHistory.map((p) => [
        p.receiptNumber,
        p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-IN") : "",
        `"${p.customerName.replace(/"/g, '""')}"`,
        p.invoiceNumber,
        p.method,
        `"${(p.referenceNumber || "").replace(/"/g, '""')}"`,
        p.amount,
      ]);
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/sales/invoices"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-xs hover:bg-slate-50 hover:text-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Invoice & Accounts Reports
            </h1>
            <p className="text-xs text-slate-500">
              Receivables analytics, aging overdue invoices, and payment collection tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none shadow-xs cursor-pointer"
          >
            <option value="all">All Dates</option>
            <option value="month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="quarter">This Quarter</option>
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            Print
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Outstanding
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-4.5 w-4.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
            {formatCurrency(summary.totalOutstanding)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Across {customerOutstanding.length} active customer accounts
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Overdue Amount
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
            {formatCurrency(summary.totalOverdue)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            In {overdueInvoices.length} invoices past payment due date
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Collections
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="h-4.5 w-4.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            {formatCurrency(summary.totalCollected)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            From {paymentHistory.length} recorded payments
          </p>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("outstanding")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === "outstanding"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>Customer Outstanding</span>
          <span className="rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] text-slate-800 font-semibold">
            {customerOutstanding.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("overdue")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === "overdue"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>Overdue Aging Invoices</span>
          <span className="rounded-full bg-rose-100 px-1.5 py-0.2 text-[10px] text-rose-700 font-bold">
            {overdueInvoices.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === "payments"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>Payment Collections</span>
          <span className="rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] text-slate-800 font-semibold">
            {paymentHistory.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Customer-Wise Outstanding Table */}
      {activeTab === "outstanding" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase text-[11px]">
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-3 text-center">Invoices</th>
                  <th className="py-3 px-3 text-right">Total Invoiced</th>
                  <th className="py-3 px-3 text-right">Total Paid</th>
                  <th className="py-3 px-3 text-right">Outstanding Balance</th>
                  <th className="py-3 px-3 text-right">Overdue Amount</th>
                  <th className="py-3 px-4 text-center">Oldest Unpaid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerOutstanding.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No customer balances found.
                    </td>
                  </tr>
                ) : (
                  customerOutstanding.map((c) => (
                    <tr key={c.customerId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{c.customerName}</p>
                        {c.companyName && (
                          <p className="text-[11px] text-slate-500">{c.companyName}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-semibold text-slate-700">
                        {c.invoiceCount}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(c.totalInvoiced)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-emerald-600 font-medium">
                        {formatCurrency(c.totalPaid)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-600">
                        {formatCurrency(c.totalOutstanding)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-rose-600">
                        {c.totalOverdue > 0 ? formatCurrency(c.totalOverdue) : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-500">
                        {c.oldestInvoiceDate || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Overdue Invoices Aging Table */}
      {activeTab === "overdue" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase text-[11px]">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Invoice Date</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3 text-center">Days Overdue</th>
                  <th className="py-3 px-3 text-right">Invoice Total</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overdueInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Great news! There are currently no overdue invoices.
                    </td>
                  </tr>
                ) : (
                  overdueInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold">
                        <Link
                          href={`/sales/invoices/${inv.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {inv.number}
                        </Link>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-semibold text-slate-900">{inv.customerName}</p>
                        {inv.customerCompany && (
                          <p className="text-[11px] text-slate-500">{inv.customerCompany}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {inv.issueDate
                          ? new Date(inv.issueDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {inv.dueDate
                          ? new Date(inv.dueDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                          {inv.daysOverdue} days
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600">
                        {formatCurrency(inv.balanceDue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Payment Collections History Table */}
      {activeTab === "payments" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase text-[11px]">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-3">Payment Date</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Against Invoice</th>
                  <th className="py-3 px-3">Payment Mode</th>
                  <th className="py-3 px-3">Reference / UTR</th>
                  <th className="py-3 px-4 text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  paymentHistory.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {p.receiptNumber}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {p.paymentDate
                          ? new Date(p.paymentDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-900">
                        {p.customerName}
                      </td>
                      <td className="py-3.5 px-3">
                        {p.invoiceId ? (
                          <Link
                            href={`/sales/invoices/${p.invoiceId}`}
                            className="font-mono text-blue-600 hover:underline"
                          >
                            {p.invoiceNumber}
                          </Link>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-slate-700 font-medium">
                          {p.method}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-600">
                        {p.referenceNumber || "-"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
