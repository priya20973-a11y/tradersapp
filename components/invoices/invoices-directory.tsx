"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  Download,
  Grid,
  List,
  Plus,
  RefreshCw,
  Search,
  Settings,
  X,
} from "lucide-react";
import {
  type InvoiceKpiStats,
  type InvoiceRecord,
  type InvoiceSettingsData,
  type PaymentRecordData,
} from "./invoice-types";
import { InvoiceKpiCards } from "./invoice-kpi-cards";
import { InvoiceTableView } from "./invoice-table-view";
import { InvoiceGridView } from "./invoice-grid-view";
import { RecordPaymentModal } from "./record-payment-modal";
import { SendEmailModal } from "./send-email-modal";
import { PaymentReceiptModal } from "./payment-receipt-modal";
import { ApplyCreditNotesModal } from "./apply-credit-notes-modal";
import { generateInvoicePdf } from "./invoice-pdf-generator";

export function InvoicesDirectory() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [profileLogo, setProfileLogo] = useState<string>("");
  const [settings, setSettings] = useState<InvoiceSettingsData | null>(null);
  const [stats, setStats] = useState<InvoiceKpiStats>({
    totalInvoiced: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    totalOverdue: 0,
    counts: {
      total: 0,
      draft: 0,
      sent: 0,
      partlyPaid: 0,
      paid: 0,
      overdue: 0,
      void: 0,
    },
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

  // Action modals state
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceRecord | null>(null);
  const [creditInvoice, setCreditInvoice] = useState<InvoiceRecord | null>(null);
  const [emailInvoice, setEmailInvoice] = useState<InvoiceRecord | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<PaymentRecordData | null>(null);
  const [receiptInvoice, setReceiptInvoice] = useState<InvoiceRecord | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const loadInvoices = useCallback(() => {
    setLoading(true);
    setRefreshIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchInvoices() {
      try {
        const queryParams = new URLSearchParams();
        if (statusFilter !== "all") queryParams.set("status", statusFilter);
        if (searchTerm) queryParams.set("search", searchTerm);

        // Date ranges
        const now = new Date();
        if (dateFilter === "month") {
          const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          queryParams.set("startDate", start);
        } else if (dateFilter === "last_month") {
          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
          const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
          queryParams.set("startDate", start);
          queryParams.set("endDate", end);
        } else if (dateFilter === "quarter") {
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const start = new Date(now.getFullYear(), currentQuarter * 3, 1).toISOString();
          queryParams.set("startDate", start);
        }

        const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";
        const res = await fetch(`/api/sales/invoices${qs}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load invoices");
        }

        if (!active) return;
        setInvoices(data.invoices || []);
        if (data.stats) setStats(data.stats);
        if (data.settings) setSettings(data.settings);
        setError(null);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load invoices.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchInvoices();

    return () => {
      active = false;
    };
  }, [statusFilter, searchTerm, dateFilter, refreshIndex]);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile?.logo) {
          setProfileLogo(data.profile.logo);
        }
      })
      .catch(() => {});
  }, []);

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedInvoices.length === invoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(invoices.map((i) => i.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  // Actions
  const handleDownloadPdf = async (invoice: InvoiceRecord) => {
    const logoToUse = profileLogo || settings?.companyDetails?.logoUrl || null;
    const doc = await generateInvoicePdf(invoice, settings, logoToUse);
    doc.save(`${invoice.number}.pdf`);
  };

  const handleStatusChange = async (invoiceId: string, status: string) => {
    try {
      const res = await fetch(`/api/sales/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setNotice("Invoice status updated.");
        loadInvoices();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (invoiceId: string, number: string) => {
    if (!confirm(`Delete draft invoice ${number}?`)) return;
    try {
      const res = await fetch(`/api/sales/invoices/${invoiceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotice(`Invoice ${number} deleted.`);
        loadInvoices();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Export Selected to CSV
  const handleExportSelectedCsv = () => {
    const targets = invoices.filter((i) => selectedInvoices.includes(i.id));
    if (targets.length === 0) return;

    const headers = [
      "Invoice Number",
      "Date",
      "Due Date",
      "Customer",
      "Status",
      "Subtotal",
      "Tax Amount",
      "Total",
      "Amount Paid",
      "Balance Due",
    ];

    const rows = targets.map((inv) => [
      inv.number,
      inv.issueDate ? new Date(inv.issueDate).toLocaleDateString("en-IN") : "",
      inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "",
      `"${inv.customerName.replace(/"/g, '""')}"`,
      inv.status,
      inv.subTotal,
      inv.taxAmount,
      inv.total,
      inv.amountPaid,
      inv.balanceDue,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `invoices_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* 1. Top Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            <span>Sales & Accounts</span>
            <span className="text-slate-300">/</span>
            <span className="text-blue-600 font-bold">Invoices</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Invoices
            </h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
              {stats.counts.total} Total
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage sales invoices, track partial and complete payments, and generate commercial PDF receipts.
          </p>
        </div>

        {/* Top Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadInvoices()}
            title="Refresh invoices"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin text-blue-600" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            href="/sales/invoices/reports"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
            <span className="hidden sm:inline">Reports</span>
          </Link>

          <Link
            href="/sales/invoices/settings"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Settings</span>
          </Link>

          <Link
            href="/sales/invoices/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer active:scale-98"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </Link>
        </div>
      </div>

      {/* Action Notification */}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium flex items-center justify-between shadow-xs">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-700 hover:text-rose-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. KPI Summary Cards */}
      <InvoiceKpiCards
        stats={stats}
        onFilterClick={(status) => setStatusFilter(status)}
      />

      {/* 3. Filter & Controls Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {[
            { id: "all", label: "All", count: stats.counts.total },
            { id: "draft", label: "Draft", count: stats.counts.draft },
            { id: "sent", label: "Sent", count: stats.counts.sent },
            { id: "partially paid", label: "Partially Paid", count: stats.counts.partlyPaid },
            { id: "paid", label: "Paid", count: stats.counts.paid },
            { id: "overdue", label: "Overdue", count: stats.counts.overdue },
            { id: "void", label: "Void", count: stats.counts.void },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isActive
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Search, Date Filter & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Selector */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-slate-700 outline-none hover:bg-white transition cursor-pointer"
          >
            <option value="all">All Dates</option>
            <option value="month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="quarter">This Quarter</option>
          </select>

          {/* Search Input */}
          <div className="flex flex-1 sm:flex-initial items-center gap-2 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50/70 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition">
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search invoice#, customer, ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-56 text-xs bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/70 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Card Grid View"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Multi-select Batch Actions Bar */}
      {selectedInvoices.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-bold">{selectedInvoices.length}</span>
            <span>invoices selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportSelectedCsv}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold text-blue-700 border border-blue-200 shadow-xs hover:bg-blue-50 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setSelectedInvoices([])}
              className="font-medium text-slate-500 hover:text-slate-800 underline ml-2 cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* 4. Main List: Table or Grid */}
      {viewMode === "table" ? (
        <InvoiceTableView
          invoices={invoices}
          loading={loading}
          selectedInvoices={selectedInvoices}
          onToggleSelectAll={handleToggleSelectAll}
          onToggleSelect={handleToggleSelect}
          onRecordPayment={(inv) => setPaymentInvoice(inv)}
          onApplyCredit={(inv) => setCreditInvoice(inv)}
          onSendEmail={(inv) => setEmailInvoice(inv)}
          onDownloadPdf={handleDownloadPdf}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      ) : (
        <InvoiceGridView
          invoices={invoices}
          onRecordPayment={(inv) => setPaymentInvoice(inv)}
          onSendEmail={(inv) => setEmailInvoice(inv)}
          onDownloadPdf={handleDownloadPdf}
        />
      )}

      {/* Integrated Record Payment Modal */}
      {paymentInvoice && (
        <RecordPaymentModal
          isOpen={Boolean(paymentInvoice)}
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSuccess={(payment) => {
            setReceiptPayment(payment);
            setReceiptInvoice(paymentInvoice);
            setNotice(`Payment of ₹${payment.amount} recorded.`);
            loadInvoices();
          }}
        />
      )}

      {/* Integrated Email Modal */}
      {emailInvoice && (
        <SendEmailModal
          isOpen={Boolean(emailInvoice)}
          invoice={emailInvoice}
          onClose={() => setEmailInvoice(null)}
          onSuccess={(email) => {
            setNotice(`Invoice sent to ${email.to}`);
            loadInvoices();
          }}
        />
      )}

      {/* Integrated Payment Receipt Modal */}
      {receiptPayment && receiptInvoice && (
        <PaymentReceiptModal
          isOpen={Boolean(receiptPayment)}
          payment={receiptPayment}
          invoice={receiptInvoice}
          onClose={() => {
            setReceiptPayment(null);
            setReceiptInvoice(null);
          }}
        />
      )}

      {/* Integrated Apply Credit Notes Modal */}
      {creditInvoice && (
        <ApplyCreditNotesModal
          isOpen={Boolean(creditInvoice)}
          invoiceId={creditInvoice.id}
          invoiceNumber={creditInvoice.number}
          customerName={creditInvoice.customerName}
          balanceDue={creditInvoice.balanceDue}
          onClose={() => setCreditInvoice(null)}
          onSuccess={() => {
            setCreditInvoice(null);
            setNotice(`Credit note applied to Invoice #${creditInvoice.number} successfully.`);
            loadInvoices();
          }}
        />
      )}
    </div>
  );
}
