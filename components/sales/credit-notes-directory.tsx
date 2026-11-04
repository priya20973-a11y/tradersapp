"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  FileEdit,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { ApplyCreditToInvoiceModal } from "./apply-credit-to-invoice-modal";

interface CreditNoteListItem {
  id: string;
  creditNoteNumber: string;
  customerId: string;
  customerName: string;
  referenceNumber: string;
  creditNoteDate: string;
  status: "Draft" | "Open" | "Partially Applied" | "Closed" | "Void";
  total: number;
  appliedAmount: number;
  balanceRemaining: number;
  subject?: string;
}

interface Metrics {
  totalCreditNotes: number;
  totalCreditAmount: number;
  totalApplied: number;
  totalAvailable: number;
  statusCounts: {
    total: number;
    draft: number;
    open: number;
    partiallyApplied: number;
    closed: number;
    void: number;
  };
}

export function CreditNotesDirectory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState<CreditNoteListItem[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customerFilter, setCustomerFilter] = useState("ALL");

  // Apply Modal state
  const [selectedForApply, setSelectedForApply] = useState<CreditNoteListItem | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (customerFilter !== "ALL") params.set("customerId", customerFilter);

        const res = await fetch(`/api/sales/credit-notes?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load credit notes.");
        if (!active) return;
        setError(null);
        setNotes(data.creditNotes || []);
        setCustomers(data.customers || []);
        setMetrics(data.metrics || null);
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load credit notes.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [statusFilter, customerFilter, search, refreshIndex]);

  const loadData = () => {
    setLoading(true);
    setRefreshIndex((prev) => prev + 1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleDelete = async (id: string, number: string) => {
    if (!window.confirm(`Are you sure you want to delete Credit Note #${number}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/sales/credit-notes/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete credit note.");
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete credit note.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            Open
          </span>
        );
      case "Partially Applied":
        return (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
            Partially Applied
          </span>
        );
      case "Closed":
        return (
          <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
            Closed
          </span>
        );
      case "Draft":
        return (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            Draft
          </span>
        );
      case "Void":
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
            Void
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Apply to Invoices Modal */}
      {selectedForApply && (
        <ApplyCreditToInvoiceModal
          isOpen={Boolean(selectedForApply)}
          onClose={() => setSelectedForApply(null)}
          creditNoteId={selectedForApply.id}
          creditNoteNumber={selectedForApply.creditNoteNumber}
          customerName={selectedForApply.customerName}
          availableBalance={selectedForApply.balanceRemaining}
          onSuccess={() => {
            setSelectedForApply(null);
            loadData();
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Credit Notes
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Manage customer credit notes, track adjustments, and apply credits against unpaid invoices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
          <Link
            href="/sales/credit-notes/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            New Credit Note
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Notes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Credit Notes
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {metrics?.totalCreditNotes ?? 0}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
            <span>{metrics?.statusCounts.open ?? 0} Open</span>
            <span>•</span>
            <span>{metrics?.statusCounts.draft ?? 0} Draft</span>
          </div>
        </div>

        {/* Card 2: Total Amount */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Credits Issued
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CreditCard className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            ₹{(metrics?.totalCreditAmount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Gross credit adjustments issued</p>
        </div>

        {/* Card 3: Total Applied */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Credits Applied
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-700 font-mono">
            ₹{(metrics?.totalApplied ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Applied against customer invoices</p>
        </div>

        {/* Card 4: Available Balance */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Available Credits
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 font-mono">
            ₹{(metrics?.totalAvailable ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Ready to apply to outstanding invoices</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Credit Note#, customer, reference#, or subject…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </form>

          {/* Customer Filter */}
          <div className="w-full sm:w-60">
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="ALL">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          {[
            { id: "ALL", label: "All" },
            { id: "open", label: "Open" },
            { id: "partially_applied", label: "Partially Applied" },
            { id: "draft", label: "Draft" },
            { id: "closed", label: "Closed" },
            { id: "void", label: "Void" },
          ].map((tab) => {
            const active = statusFilter.toLowerCase() === tab.id.toLowerCase();
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  active
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Credit Notes Table Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-xs">Loading credit notes…</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Credit Notes Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Create credit notes to manage returns, order cancellations, rate differences, or store credits.
            </p>
            <Link
              href="/sales/credit-notes/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              Create First Credit Note
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Credit Note#</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Reference#</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-right">Credit Applied</th>
                  <th className="px-4 py-3 text-right">Available Balance</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notes.map((n) => {
                  const canApply =
                    (n.status === "Open" || n.status === "Partially Applied") &&
                    n.balanceRemaining > 0;

                  return (
                    <tr key={n.id} className="hover:bg-slate-50/70 transition">
                      {/* Date */}
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                        {n.creditNoteDate ? new Date(n.creditNoteDate).toLocaleDateString() : "—"}
                      </td>

                      {/* CN# */}
                      <td className="px-4 py-3.5 font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                        <Link href={`/sales/credit-notes/${n.id}`}>{n.creditNoteNumber}</Link>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        {n.customerName}
                      </td>

                      {/* Reference# */}
                      <td className="px-4 py-3.5 text-slate-500 font-mono">
                        {n.referenceNumber || "—"}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getStatusBadge(n.status)}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 text-right font-mono font-medium text-slate-900">
                        ₹{n.total.toFixed(2)}
                      </td>

                      {/* Applied */}
                      <td className="px-4 py-3.5 text-right font-mono text-purple-700">
                        ₹{n.appliedAmount.toFixed(2)}
                      </td>

                      {/* Available Balance */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600">
                        ₹{n.balanceRemaining.toFixed(2)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canApply && (
                            <button
                              type="button"
                              onClick={() => setSelectedForApply(n)}
                              className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                              title="Apply credit to open invoice"
                            >
                              Apply to Invoice
                            </button>
                          )}

                          <Link
                            href={`/sales/credit-notes/${n.id}`}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                            title="View Credit Note"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {n.status === "Draft" && (
                            <>
                              <Link
                                href={`/sales/credit-notes/${n.id}/edit`}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition"
                                title="Edit Draft"
                              >
                                <FileEdit className="h-4 w-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDelete(n.id, n.creditNoteNumber)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                                title="Delete Draft"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
