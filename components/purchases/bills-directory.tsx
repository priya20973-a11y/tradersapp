"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Edit,
  Eye,
  FileText,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

interface BillSummary {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  orderNumber?: string;
  billDate: string;
  dueDate: string;
  paymentTerms?: string;
  accountsPayable?: string;
  subject?: string;
  subTotal: number;
  discount: number;
  discountType: string;
  discountAmount: number;
  taxType: string;
  taxRate: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  adjustment: number;
  total: number;
  amountPaid: number;
  vendorCreditApplied?: number;
  balanceDue: number;
  status: string;
  attachmentsCount?: number;
  createdAt?: string;
}

interface VendorOption {
  id: string;
  name: string;
}

interface Metrics {
  totalBills: number;
  totalBillsValue: number;
  totalPaid: number;
  totalDue: number;
  totalOverdue: number;
  countDue: number;
  countOverdue: number;
  statusCounts: {
    total: number;
    draft: number;
    pending: number;
    partiallyPaid: number;
    paid: number;
    overdue: number;
    void: number;
  };
}

function formatINR(val: number): string {
  return `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function BillsDirectory() {
  const [bills, setBills] = useState<BillSummary[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalBills: 0,
    totalBillsValue: 0,
    totalPaid: 0,
    totalDue: 0,
    totalOverdue: 0,
    countDue: 0,
    countOverdue: 0,
    statusCounts: {
      total: 0,
      draft: 0,
      pending: 0,
      partiallyPaid: 0,
      paid: 0,
      overdue: 0,
      void: 0,
    },
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedVendorId, setSelectedVendorId] = useState("all");
  const [unpaidOnly, setUnpaidOnly] = useState(false);

  // Quick Payment Modal state
  const [paymentModalBill, setPaymentModalBill] = useState<BillSummary | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("Bank Transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paidThrough, setPaidThrough] = useState("HDFC Operational Bank");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Delete modal state
  const [billToDelete, setBillToDelete] = useState<BillSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    const loadBills = async () => {
      try {
        const res = await fetch("/api/purchases/bills");
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          throw new Error(data.error || "Failed to load purchase bills.");
        }
        setBills(data.bills || []);
        if (data.metrics) {
          const m = data.metrics as Record<string, unknown>;
          const counts = (m.statusCounts || m.counts || {}) as Record<string, unknown>;
          const safeCounts = {
            total: Number(counts.total ?? m.totalBills ?? (data.bills || []).length ?? 0),
            draft: Number(counts.draft ?? 0),
            pending: Number(counts.pending ?? 0),
            partiallyPaid: Number(counts.partiallyPaid ?? 0),
            paid: Number(counts.paid ?? 0),
            overdue: Number(counts.overdue ?? m.countOverdue ?? 0),
            void: Number(counts.void ?? 0),
          };
          setMetrics({
            totalBills: Number(m.totalBills ?? safeCounts.total),
            totalBillsValue: Number(m.totalBillsValue ?? m.totalAmount ?? 0),
            totalPaid: Number(m.totalPaid ?? 0),
            totalDue: Number(m.totalDue ?? 0),
            totalOverdue: Number(m.totalOverdue ?? 0),
            countDue: Number(
              m.countDue ??
                (data.bills as BillSummary[] || []).filter((b) => Number(b.balanceDue || 0) > 0).length,
            ),
            countOverdue: Number(m.countOverdue ?? safeCounts.overdue),
            statusCounts: safeCounts,
          });
        }
        if (data.vendors) setVendors(data.vendors);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error fetching bills.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadBills();
    return () => {
      active = false;
    };
  }, [refreshIndex]);

  const fetchBills = () => {
    setLoading(true);
    setRefreshIndex((prev) => prev + 1);
  };

  // Filtered bills list
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      // Vendor filter
      if (selectedVendorId !== "all" && b.vendorId !== selectedVendorId) {
        return false;
      }

      // Unpaid filter
      if (unpaidOnly && b.balanceDue <= 0) {
        return false;
      }

      // Status filter
      if (statusFilter !== "ALL") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isOverdue =
          b.dueDate && new Date(b.dueDate) < today && b.balanceDue > 0 && b.status !== "Draft";

        if (statusFilter === "Overdue") {
          if (!isOverdue) return false;
        } else if (b.status.toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matches =
          b.billNumber.toLowerCase().includes(q) ||
          b.vendorName.toLowerCase().includes(q) ||
          (b.orderNumber && b.orderNumber.toLowerCase().includes(q)) ||
          (b.subject && b.subject.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [bills, selectedVendorId, unpaidOnly, statusFilter, search]);

  // Open Payment modal
  const handleOpenPayment = (bill: BillSummary) => {
    setPaymentModalBill(bill);
    setPaymentAmount(bill.balanceDue > 0 ? String(bill.balanceDue) : "");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMode("Bank Transfer");
    setPaymentReference("");
    setPaymentNotes(`Payment for Bill #${bill.billNumber}`);
  };

  // Submit quick payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalBill) return;

    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setError("Please enter a valid payment amount greater than zero.");
      return;
    }

    if (amt > paymentModalBill.balanceDue) {
      setError(`Payment amount cannot exceed the balance due of ${formatINR(paymentModalBill.balanceDue)}.`);
      return;
    }

    setSubmittingPayment(true);
    setError(null);

    try {
      const res = await fetch("/api/purchases/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: paymentModalBill.vendorId,
          billId: paymentModalBill.id,
          amount: amt,
          paymentDate,
          paymentMode,
          referenceNumber: paymentReference.trim(),
          paidThrough,
          notes: paymentNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record payment.");
      }

      setNotice(
        `Payment of ${formatINR(amt)} recorded against Bill #${paymentModalBill.billNumber}.`,
      );
      setPaymentModalBill(null);
      fetchBills();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error processing payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Confirm delete
  const handleDeleteBill = async () => {
    if (!billToDelete) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/purchases/bills/${billToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete bill.");
      }

      setNotice(`Bill #${billToDelete.billNumber} has been deleted.`);
      setBillToDelete(null);
      fetchBills();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting bill.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
            Purchases
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bills</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage vendor invoices, payment obligations, and accounts payable
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void fetchBills()}
            disabled={loading}
            title="Refresh bills list"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/purchases/bills/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            New Bill
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="rounded p-1 hover:bg-rose-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded p-1 hover:bg-emerald-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Payables */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Payables
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {metrics.totalBills ?? 0} Bills
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatINR(metrics.totalBillsValue ?? 0)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Lifetime recorded purchase value</p>
        </div>

        {/* Paid to Date */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Paid
            </p>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {metrics.statusCounts?.paid ?? 0} Settled
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-emerald-600">
              {formatINR(metrics.totalPaid ?? 0)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Disbursed to suppliers</p>
        </div>

        {/* Outstanding / Balance Due */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Balance Due
            </p>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              {metrics.countDue ?? 0} Unpaid
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-amber-600">
              {formatINR(metrics.totalDue ?? 0)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Current accounts payable</p>
        </div>

        {/* Overdue */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Overdue
            </p>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
              {metrics.countOverdue ?? 0} Overdue
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-rose-600">
              {formatINR(metrics.totalOverdue ?? 0)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Past agreed payment due dates</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "ALL", label: `All (${metrics.totalBills ?? 0})` },
            { id: "Draft", label: `Draft (${metrics.statusCounts?.draft ?? 0})` },
            { id: "Pending", label: `Pending (${metrics.statusCounts?.pending ?? 0})` },
            { id: "Partially Paid", label: `Partially Paid (${metrics.statusCounts?.partiallyPaid ?? 0})` },
            { id: "Paid", label: `Paid (${metrics.statusCounts?.paid ?? 0})` },
            { id: "Overdue", label: `Overdue (${metrics.countOverdue ?? metrics.statusCounts?.overdue ?? 0})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Vendor Filter */}
          <select
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="all">All Vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          {/* Unpaid Checkbox */}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unpaidOnly}
              onChange={(e) => setUnpaidOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Unpaid Only
          </label>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bill#, vendor, PO#..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-6 py-3.5">Date</th>
              <th className="px-6 py-3.5">Bill #</th>
              <th className="px-6 py-3.5">Vendor Name</th>
              <th className="px-6 py-3.5">Order #</th>
              <th className="px-6 py-3.5">Due Date</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Amount</th>
              <th className="px-6 py-3.5 text-right">Balance Due</th>
              <th className="px-6 py-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <span>Loading purchase bills…</span>
                  </div>
                </td>
              </tr>
            ) : filteredBills.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">No bills found</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {bills.length === 0
                          ? "You haven't created any purchase bills yet."
                          : "No bills match your current filters."}
                      </p>
                    </div>
                    {bills.length === 0 && (
                      <Link
                        href="/purchases/bills/new"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition mt-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create First Bill
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredBills.map((b) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isOverdue =
                  b.dueDate &&
                  new Date(b.dueDate) < today &&
                  b.balanceDue > 0 &&
                  b.status !== "Draft";

                return (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition">
                    {/* Bill Date */}
                    <td className="px-6 py-4 font-mono text-slate-500 whitespace-nowrap">
                      {formatDate(b.billDate)}
                    </td>

                    {/* Bill # */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/purchases/bills/${b.id}`}
                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5"
                      >
                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                        <span>{b.billNumber}</span>
                      </Link>
                      {b.subject && (
                        <p className="text-[11px] text-slate-400 truncate max-w-[180px]">
                          {b.subject}
                        </p>
                      )}
                    </td>

                    {/* Vendor Name */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-900">{b.vendorName}</span>
                    </td>

                    {/* Order Number */}
                    <td className="px-6 py-4 font-mono text-slate-500 whitespace-nowrap">
                      {b.orderNumber || "-"}
                    </td>

                    {/* Due Date */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`font-mono ${
                          isOverdue ? "font-semibold text-rose-600" : "text-slate-500"
                        }`}
                      >
                        {formatDate(b.dueDate)}
                      </span>
                      {isOverdue && (
                        <span className="ml-1.5 inline-block rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                          OVERDUE
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          b.status === "Paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : b.status === "Partially Paid"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : b.status === "Draft"
                            ? "bg-slate-100 text-slate-700 border border-slate-200"
                            : isOverdue
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {b.status === "Paid" && <CheckCircle2 className="h-3 w-3" />}
                        {b.status}
                      </span>
                    </td>

                    {/* Total Amount */}
                    <td className="px-6 py-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                      {formatINR(b.total)}
                    </td>

                    {/* Balance Due */}
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span
                        className={`font-bold block ${
                          b.balanceDue > 0 ? "text-amber-600" : "text-emerald-600"
                        }`}
                      >
                        {formatINR(b.balanceDue)}
                      </span>
                      {b.vendorCreditApplied && b.vendorCreditApplied > 0 ? (
                        <span className="text-[10px] text-purple-600 font-medium block">
                          Credit: {formatINR(b.vendorCreditApplied)}
                        </span>
                      ) : null}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {/* View */}
                        <Link
                          href={`/purchases/bills/${b.id}`}
                          title="View Bill Details"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>

                        {/* Edit */}
                        <Link
                          href={`/purchases/bills/${b.id}/edit`}
                          title="Edit Bill"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Link>

                        {/* Apply Vendor Credit (if balance due) */}
                        {b.balanceDue > 0 && b.status !== "Draft" && b.status !== "Void" && (
                          <Link
                            href={`/purchases/bills/${b.id}?action=apply-credit`}
                            title="Apply Vendor Credit"
                            className="rounded-lg p-1.5 text-purple-600 hover:bg-purple-50 hover:text-purple-800 transition"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </Link>
                        )}

                        {/* Record Payment (if unpaid) */}
                        {b.balanceDue > 0 && b.status !== "Draft" && (
                          <button
                            type="button"
                            onClick={() => handleOpenPayment(b)}
                            title="Record Payment"
                            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setBillToDelete(b)}
                          title="Delete Bill"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Record Payment Modal */}
      {paymentModalBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Record Vendor Payment</h3>
                <p className="text-xs text-slate-500">
                  Bill #{paymentModalBill.billNumber} • {paymentModalBill.vendorName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalBill(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 flex justify-between items-center">
                <div>
                  <span className="text-slate-500">Total Bill Amount:</span>
                  <p className="text-sm font-bold text-slate-900">
                    {formatINR(paymentModalBill.total)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Current Balance Due:</span>
                  <p className="text-sm font-bold text-amber-600">
                    {formatINR(paymentModalBill.balanceDue)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Amount Paid (₹) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={paymentModalBill.balanceDue}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Reference / UTR #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-98214"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Paid Through Account
                </label>
                <select
                  value={paidThrough}
                  onChange={(e) => setPaidThrough(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="HDFC Operational Bank">HDFC Operational Bank</option>
                  <option value="ICICI Current Account">ICICI Current Account</option>
                  <option value="SBI Corporate Account">SBI Corporate Account</option>
                  <option value="Petty Cash">Petty Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalBill(null)}
                  disabled={submittingPayment}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {submittingPayment && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {billToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Purchase Bill</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to delete Bill #{billToDelete.billNumber}?
                </p>
              </div>
            </div>

            {billToDelete.amountPaid > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-semibold">Warning: Payment Recorded</p>
                <p className="mt-0.5">
                  This bill already has payments of {formatINR(billToDelete.amountPaid)} recorded
                  against it. You must delete the recorded payments first before deleting this bill.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBillToDelete(null)}
                disabled={deleting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBill}
                disabled={deleting || billToDelete.amountPaid > 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
