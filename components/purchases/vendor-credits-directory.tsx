"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Edit,
  Eye,
  FileCheck2,
  FileText,
  History,
  Layers,
  Loader2,
  Paperclip,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";

interface AppliedBillRecord {
  billId: string;
  billNumber: string;
  amountApplied: number;
  appliedDate?: string;
  appliedAt?: string;
}

interface VendorCreditItem {
  itemId?: string;
  name: string;
  description?: string;
  account: string;
  quantity: number;
  rate: number;
  taxRate?: number;
  amount: number;
}

interface VendorCreditAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

interface VendorCreditRecord {
  id: string;
  _id: string;
  creditNoteNumber: string;
  vendorId: string;
  vendorName: string;
  orderNumber?: string;
  vendorCreditDate: string;
  subject?: string;
  accountsPayable: string;
  items: VendorCreditItem[];
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
  balanceRemaining: number;
  appliedAmount: number;
  currency: string;
  notes?: string;
  status: "Draft" | "Open" | "Partially Applied" | "Closed";
  attachments?: VendorCreditAttachment[];
  attachmentsCount?: number;
  billsApplied?: AppliedBillRecord[];
  billsAppliedCount?: number;
  createdAt?: string;
}

interface OpenBillItem {
  id: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  subject?: string;
}

interface DirectoryMetrics {
  totalCredits: number;
  totalCreditValue: number;
  totalAvailableBalance: number;
  totalAppliedAmount: number;
  statusCounts: {
    total: number;
    draft: number;
    open: number;
    partiallyApplied: number;
    closed: number;
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

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VendorCreditsDirectory() {
  const [credits, setCredits] = useState<VendorCreditRecord[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [metrics, setMetrics] = useState<DirectoryMetrics>({
    totalCredits: 0,
    totalCreditValue: 0,
    totalAvailableBalance: 0,
    totalAppliedAmount: 0,
    statusCounts: { total: 0, draft: 0, open: 0, partiallyApplied: 0, closed: 0 },
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedVendorId, setSelectedVendorId] = useState("all");

  // Apply to Bills Modal State
  const [creditToApply, setCreditToApply] = useState<VendorCreditRecord | null>(null);
  const [fetchingBills, setFetchingBills] = useState(false);
  const [openBills, setOpenBills] = useState<OpenBillItem[]>([]);
  const [billAllocations, setBillAllocations] = useState<{ [billId: string]: number }>({});
  const [applyingCredits, setApplyingCredits] = useState(false);
  const [applyModalError, setApplyModalError] = useState<string | null>(null);

  // View Details Modal State
  const [viewingCredit, setViewingCredit] = useState<VendorCreditRecord | null>(null);

  // Delete State
  const [creditToDelete, setCreditToDelete] = useState<VendorCreditRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch list of credits
  useEffect(() => {
    let active = true;
    const loadCredits = async () => {
      try {
        const res = await fetch("/api/purchases/vendor-credits");
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          throw new Error(data.error || "Failed to load vendor credits.");
        }
        setCredits(data.credits || []);
        if (data.metrics) setMetrics(data.metrics);
        if (data.vendors) setVendors(data.vendors);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error fetching vendor credits.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadCredits();
    return () => {
      active = false;
    };
  }, [refreshIndex]);

  const fetchCredits = () => {
    setLoading(true);
    setRefreshIndex((prev) => prev + 1);
  };

  // Filtered list
  const filteredCredits = useMemo(() => {
    return credits.filter((c) => {
      if (selectedVendorId !== "all" && c.vendorId !== selectedVendorId) {
        return false;
      }
      if (statusFilter !== "ALL") {
        const sf = statusFilter.toLowerCase();
        const cs = c.status.toLowerCase();
        if (sf === "open" && cs !== "open") return false;
        if (sf === "draft" && cs !== "draft") return false;
        if (sf === "partially applied" && cs !== "partially applied") return false;
        if (sf === "closed" && cs !== "closed") return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matches =
          c.creditNoteNumber.toLowerCase().includes(q) ||
          c.vendorName.toLowerCase().includes(q) ||
          (c.orderNumber && c.orderNumber.toLowerCase().includes(q)) ||
          (c.subject && c.subject.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [credits, selectedVendorId, statusFilter, search]);

  // Open "Apply to Bills" modal
  const handleOpenApplyModal = async (credit: VendorCreditRecord) => {
    setCreditToApply(credit);
    setApplyModalError(null);
    setBillAllocations({});
    setOpenBills([]);
    setFetchingBills(true);

    try {
      const res = await fetch(`/api/purchases/vendor-credits/${credit.id}/bills`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load vendor bills.");
      }
      setOpenBills(data.openBills || []);
    } catch (err: unknown) {
      setApplyModalError(err instanceof Error ? err.message : "Failed to load open bills.");
    } finally {
      setFetchingBills(false);
    }
  };

  // Auto-allocate from oldest bills
  const handleAutoAllocate = () => {
    if (!creditToApply || openBills.length === 0) return;
    let remainingCredit = creditToApply.balanceRemaining;
    const newAllocations: { [billId: string]: number } = {};

    for (const b of openBills) {
      if (remainingCredit <= 0) {
        newAllocations[b.id] = 0;
        continue;
      }
      const canApply = Math.min(b.balanceDue, remainingCredit);
      newAllocations[b.id] = Math.round(canApply * 100) / 100;
      remainingCredit = Math.max(0, Math.round((remainingCredit - canApply) * 100) / 100);
    }

    setBillAllocations(newAllocations);
  };

  // Clear allocations
  const handleClearAllocations = () => {
    setBillAllocations({});
  };

  // Change allocation for a single bill
  const handleAllocationChange = (billId: string, val: number, maxAllowed: number) => {
    const safeVal = Math.max(0, Math.min(val, maxAllowed));
    setBillAllocations((prev) => ({
      ...prev,
      [billId]: Math.round(safeVal * 100) / 100,
    }));
  };

  // Compute total allocation across all bills in modal
  const totalAllocated = useMemo(() => {
    return Object.values(billAllocations).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  }, [billAllocations]);

  // Submit credit application
  const handleConfirmApply = async () => {
    if (!creditToApply) return;
    if (totalAllocated <= 0) {
      setApplyModalError("Please specify an amount to apply to at least one bill.");
      return;
    }
    if (totalAllocated > creditToApply.balanceRemaining + 0.01) {
      setApplyModalError(
        `Total allocated (${formatINR(totalAllocated)}) exceeds available credit (${formatINR(creditToApply.balanceRemaining)}).`
      );
      return;
    }

    const applications = Object.entries(billAllocations)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([billId, amount]) => ({
        billId,
        amount: Number(amount),
      }));

    if (applications.length === 0) {
      setApplyModalError("Please specify a valid credit amount to apply.");
      return;
    }

    setApplyingCredits(true);
    setApplyModalError(null);

    try {
      const res = await fetch(`/api/purchases/vendor-credits/${creditToApply.id}/apply-to-bills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applications }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to apply vendor credit.");
      }

      setNotice(data.message || `Credit applied successfully to ${applications.length} bills.`);
      setCreditToApply(null);
      fetchCredits();
    } catch (err: unknown) {
      setApplyModalError(err instanceof Error ? err.message : "Failed to apply vendor credit.");
    } finally {
      setApplyingCredits(false);
    }
  };

  // Delete vendor credit
  const handleDeleteCredit = async () => {
    if (!creditToDelete) return;
    setDeleting(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/purchases/vendor-credits/${creditToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete vendor credit.");
      }

      setNotice(`Vendor Credit "${creditToDelete.creditNoteNumber}" deleted successfully.`);
      setCreditToDelete(null);
      fetchCredits();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete vendor credit.");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Draft":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3" /> Draft
          </span>
        );
      case "Open":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200">
            <Coins className="h-3 w-3" /> Open
          </span>
        );
      case "Partially Applied":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 border border-purple-200">
            <Layers className="h-3 w-3" /> Partially Applied
          </span>
        );
      case "Closed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="h-2.5 w-2.5" /> Supplier Debits & Returns
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vendor Credits</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage credit notes from suppliers, adjust purchase accounts, and offset pending bills seamlessly.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void fetchCredits()}
            disabled={loading}
            title="Refresh list"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <Link
            href="/purchases/vendor-credits/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            New Vendor Credit
          </Link>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="rounded p-1 hover:bg-rose-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="rounded p-1 hover:bg-emerald-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Credit Value */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Credit Notes
            </p>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              {metrics.totalCredits} Notes
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatINR(metrics.totalCreditValue)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Cumulative supplier credits recorded</p>
        </div>

        {/* Available Balance */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Available Credit
            </p>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {metrics.statusCounts?.open + metrics.statusCounts?.partiallyApplied} Usable
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-emerald-600">
              {formatINR(metrics.totalAvailableBalance)}
            </span>
            <span className="text-xs text-slate-400">
              {metrics.totalCreditValue > 0
                ? `${Math.round((metrics.totalAvailableBalance / metrics.totalCreditValue) * 100)}% unapplied`
                : "100%"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Ready to offset against upcoming purchase bills</p>
        </div>

        {/* Total Applied */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Credits Applied
            </p>
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
              {metrics.statusCounts?.partiallyApplied + metrics.statusCounts?.closed} Active
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-purple-700">
              {formatINR(metrics.totalAppliedAmount)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Offsets already allocated to purchase bills</p>
        </div>

        {/* Status Distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Status Breakdown
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              {metrics.statusCounts?.closed} Closed
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {metrics.statusCounts?.open} Open
            </span>
            <span className="text-xs text-slate-400">
              {metrics.statusCounts?.draft} draft, {metrics.statusCounts?.partiallyApplied} partial
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Workflow distribution of credit notes</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "ALL", label: `All (${metrics.totalCredits})` },
            { id: "Open", label: `Open (${metrics.statusCounts?.open || 0})` },
            { id: "Partially Applied", label: `Partial (${metrics.statusCounts?.partiallyApplied || 0})` },
            { id: "Draft", label: `Draft (${metrics.statusCounts?.draft || 0})` },
            { id: "Closed", label: `Closed (${metrics.statusCounts?.closed || 0})` },
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

        {/* Search & Vendor Filter */}
        <div className="flex flex-wrap items-center gap-3">
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

          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search note #, vendor, order, subject…"
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Vendor Credits Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : filteredCredits.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
              <Receipt className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Vendor Credits Found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              {search || statusFilter !== "ALL" || selectedVendorId !== "all"
                ? "No vendor credits match your current search or status filter. Try clearing filters."
                : "Record returns, adjustments, or volume rebates from suppliers to offset your purchase bills."}
            </p>
            <Link
              href="/purchases/vendor-credits/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Vendor Credit
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 pl-5 pr-3">Credit Note #</th>
                  <th className="py-3.5 px-3">Vendor</th>
                  <th className="py-3.5 px-3">Date</th>
                  <th className="py-3.5 px-3">Subject / Order</th>
                  <th className="py-3.5 px-3 text-right">Amount</th>
                  <th className="py-3.5 px-3 text-right">Balance Remaining</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 pl-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCredits.map((credit) => {
                  const hasUsableBalance = credit.balanceRemaining > 0 && credit.status !== "Draft";
                  return (
                    <tr
                      key={credit.id}
                      className="transition-colors hover:bg-slate-50/70 group"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewingCredit(credit)}
                            className="font-bold text-blue-600 hover:text-blue-800 hover:underline text-xs"
                          >
                            {credit.creditNoteNumber}
                          </button>
                          {credit.attachmentsCount ? (
                            <span
                              title={`${credit.attachmentsCount} attachment(s)`}
                              className="inline-flex items-center text-[10px] text-slate-400"
                            >
                              <Paperclip className="h-3 w-3" />
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{credit.vendorName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{formatDate(credit.vendorCreditDate)}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-slate-600">
                        <div className="max-w-[200px]">
                          {credit.subject ? (
                            <p className="truncate font-medium text-slate-700">{credit.subject}</p>
                          ) : credit.orderNumber ? (
                            <p className="truncate text-slate-600">Ref: {credit.orderNumber}</p>
                          ) : (
                            <span className="text-slate-400 italic">No reference</span>
                          )}
                          {credit.orderNumber && credit.subject ? (
                            <p className="truncate text-[10px] text-slate-400">PO: {credit.orderNumber}</p>
                          ) : null}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatINR(credit.total)}
                      </td>

                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {credit.balanceRemaining > 0 ? (
                          <div>
                            <span className="font-bold text-emerald-600">
                              {formatINR(credit.balanceRemaining)}
                            </span>
                            {credit.appliedAmount > 0 ? (
                              <p className="text-[10px] text-slate-400">
                                {formatINR(credit.appliedAmount)} applied
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="font-medium text-slate-400">₹0.00</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {getStatusBadge(credit.status)}
                      </td>

                      <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Apply to Bills button */}
                          {hasUsableBalance ? (
                            <button
                              type="button"
                              onClick={() => handleOpenApplyModal(credit)}
                              title="Apply credit to purchase bills"
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition shadow-xs"
                            >
                              <Coins className="h-3 w-3" />
                              Apply to Bills
                            </button>
                          ) : null}

                          {/* Quick view button */}
                          <button
                            type="button"
                            onClick={() => setViewingCredit(credit)}
                            title="View Credit Details"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit button */}
                          <Link
                            href={`/purchases/vendor-credits/${credit.id}`}
                            title="Edit Credit"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Link>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => setCreditToDelete(credit)}
                            title="Delete Credit"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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

      {/* =========================================================================
          APPLY TO BILLS MODAL
         ========================================================================= */}
      {creditToApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/75">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Apply Credit Note: {creditToApply.creditNoteNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Vendor: <strong className="text-slate-800">{creditToApply.vendorName}</strong> | Total:{" "}
                    <strong>{formatINR(creditToApply.total)}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCreditToApply(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Balances Highlight Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                <div>
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                    Available Credit Balance
                  </span>
                  <p className="text-lg font-bold text-emerald-600 mt-0.5">
                    {formatINR(creditToApply.balanceRemaining)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                    Total Amount Being Applied
                  </span>
                  <p className="text-lg font-bold text-blue-600 mt-0.5">
                    {formatINR(totalAllocated)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                    Balance Left After Apply
                  </span>
                  <p
                    className={`text-lg font-bold mt-0.5 ${
                      creditToApply.balanceRemaining - totalAllocated < -0.01
                        ? "text-rose-600"
                        : "text-slate-700"
                    }`}
                  >
                    {formatINR(Math.max(0, creditToApply.balanceRemaining - totalAllocated))}
                  </p>
                </div>
              </div>

              {applyModalError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{applyModalError}</span>
                </div>
              )}

              {/* Bills List / Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Open Bills for {creditToApply.vendorName}
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoAllocate}
                      disabled={openBills.length === 0}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
                    >
                      <Zap className="h-3 w-3" />
                      Auto-Apply (Oldest First)
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllocations}
                      disabled={totalAllocated === 0}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {fetchingBills ? (
                  <div className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <span className="ml-2 text-xs text-slate-500">Loading open bills…</span>
                  </div>
                ) : openBills.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center bg-slate-50">
                    <FileCheck2 className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-xs font-bold text-slate-700">No Open Bills Available</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                      All purchase bills for this vendor are already settled or have no outstanding balance due.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-3">Bill Number</th>
                          <th className="py-3 px-3">Date</th>
                          <th className="py-3 px-3">Due Date</th>
                          <th className="py-3 px-3 text-right">Bill Total</th>
                          <th className="py-3 px-3 text-right">Balance Due</th>
                          <th className="py-3 px-3 text-right w-44">Amount to Apply</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {openBills.map((bill) => {
                          const allocation = billAllocations[bill.id] || 0;
                          return (
                            <tr key={bill.id} className="hover:bg-slate-50/70">
                              <td className="py-3 px-3 font-semibold text-slate-900">
                                <div>{bill.billNumber}</div>
                                {bill.subject ? (
                                  <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                    {bill.subject}
                                  </div>
                                ) : null}
                              </td>

                              <td className="py-3 px-3 text-slate-600">
                                {formatDate(bill.billDate)}
                              </td>

                              <td className="py-3 px-3 text-slate-600">
                                {formatDate(bill.dueDate)}
                              </td>

                              <td className="py-3 px-3 text-right font-medium text-slate-700">
                                {formatINR(bill.total)}
                              </td>

                              <td className="py-3 px-3 text-right font-bold text-amber-700">
                                {formatINR(bill.balanceDue)}
                              </td>

                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">
                                      ₹
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min={0}
                                      max={bill.balanceDue}
                                      value={allocation === 0 ? "" : allocation}
                                      placeholder="0.00"
                                      onChange={(e) => {
                                        const num = parseFloat(e.target.value) || 0;
                                        handleAllocationChange(bill.id, num, bill.balanceDue);
                                      }}
                                      className="w-28 rounded-lg border border-slate-300 py-1 pl-6 pr-2 text-right text-xs font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    title="Apply maximum possible for this bill"
                                    onClick={() => {
                                      const remainingAllowance = Math.max(
                                        0,
                                        creditToApply.balanceRemaining -
                                          (totalAllocated - (billAllocations[bill.id] || 0))
                                      );
                                      const maxForThis = Math.min(bill.balanceDue, remainingAllowance);
                                      handleAllocationChange(bill.id, maxForThis, bill.balanceDue);
                                    }}
                                    className="rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                                  >
                                    Max
                                  </button>
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

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50/75">
              <div className="text-xs text-slate-500">
                {totalAllocated > 0 ? (
                  <span>
                    Ready to apply <strong>{formatINR(totalAllocated)}</strong> across{" "}
                    <strong>{Object.values(billAllocations).filter((v) => Number(v) > 0).length}</strong> bills.
                  </span>
                ) : (
                  <span>Allocate credit amounts to the bills above to proceed.</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreditToApply(null)}
                  disabled={applyingCredits}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApply}
                  disabled={
                    applyingCredits ||
                    totalAllocated <= 0 ||
                    totalAllocated > creditToApply.balanceRemaining + 0.01 ||
                    openBills.length === 0
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {applyingCredits ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Apply Credit ({formatINR(totalAllocated)})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW CREDIT DETAILS & APPLICATION HISTORY MODAL
         ========================================================================= */}
      {viewingCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {viewingCredit.creditNoteNumber}
                    </h3>
                    {getStatusBadge(viewingCredit.status)}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Vendor: <strong className="text-slate-800">{viewingCredit.vendorName}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingCredit(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs">
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">Credit Date</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {formatDate(viewingCredit.vendorCreditDate)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">Order / PO Ref</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {viewingCredit.orderNumber || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">AP Account</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {viewingCredit.accountsPayable}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">Remaining Balance</span>
                  <p className="font-bold text-emerald-600 mt-0.5">
                    {formatINR(viewingCredit.balanceRemaining)}
                  </p>
                </div>
              </div>

              {viewingCredit.subject && (
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Subject</span>
                  <p className="text-slate-800 font-medium mt-0.5">{viewingCredit.subject}</p>
                </div>
              )}

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Line Items ({viewingCredit.items?.length || 0})
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <th className="py-2.5 px-3">Item Details</th>
                        <th className="py-2.5 px-3">Account</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingCredit.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800">{item.name}</span>
                            {item.description ? (
                              <p className="text-[10px] text-slate-400">{item.description}</p>
                            ) : null}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{item.account}</td>
                          <td className="py-2.5 px-3 text-right text-slate-800">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-right text-slate-800">{formatINR(item.rate)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatINR(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Calculation Breakdown */}
              <div className="flex justify-end">
                <div className="w-full sm:w-72 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>{formatINR(viewingCredit.subTotal)}</span>
                  </div>
                  {viewingCredit.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount ({viewingCredit.discount}{viewingCredit.discountType === "percent" ? "%" : "₹"}):</span>
                      <span>-{formatINR(viewingCredit.discountAmount)}</span>
                    </div>
                  )}
                  {viewingCredit.taxAmount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>{viewingCredit.taxType} ({viewingCredit.taxRate}%):</span>
                      <span>{formatINR(viewingCredit.taxAmount)}</span>
                    </div>
                  )}
                  {viewingCredit.adjustment !== 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Adjustment:</span>
                      <span>{formatINR(viewingCredit.adjustment)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-slate-900 text-sm">
                    <span>Total Credit:</span>
                    <span>{formatINR(viewingCredit.total)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-purple-700">
                    <span>Applied to Bills:</span>
                    <span>{formatINR(viewingCredit.appliedAmount)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-1 flex justify-between font-bold text-emerald-600 text-xs">
                    <span>Balance Remaining:</span>
                    <span>{formatINR(viewingCredit.balanceRemaining)}</span>
                  </div>
                </div>
              </div>

              {/* Application History */}
              {viewingCredit.billsApplied && viewingCredit.billsApplied.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" />
                    Bill Application History ({viewingCredit.billsApplied.length})
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                          <th className="py-2.5 px-3">Bill Number</th>
                          <th className="py-2.5 px-3">Applied Date</th>
                          <th className="py-2.5 px-3 text-right">Amount Applied</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingCredit.billsApplied.map((app, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-3 font-semibold text-blue-600">
                              {app.billNumber}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {formatDate(app.appliedDate || app.appliedAt)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                              {formatINR(app.amountApplied)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Attachments Preview */}
              {viewingCredit.attachments && viewingCredit.attachments.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attachments ({viewingCredit.attachments.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {viewingCredit.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                          <div className="truncate">
                            <p className="font-semibold text-slate-800 truncate">{att.name}</p>
                            <span className="text-[10px] text-slate-400">{formatBytes(att.size)}</span>
                          </div>
                        </div>
                        {att.dataUrl && (
                          <a
                            href={att.dataUrl}
                            download={att.name}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition shadow-xs"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewingCredit.notes && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Notes / Remarks</span>
                  <p className="text-slate-700 mt-1 whitespace-pre-line">{viewingCredit.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50">
              <button
                type="button"
                onClick={() => setViewingCredit(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {viewingCredit.balanceRemaining > 0 && viewingCredit.status !== "Draft" && (
                  <button
                    type="button"
                    onClick={() => {
                      const c = viewingCredit;
                      setViewingCredit(null);
                      handleOpenApplyModal(c);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                  >
                    <Coins className="h-3.5 w-3.5" />
                    Apply to Bills
                  </button>
                )}

                <Link
                  href={`/purchases/vendor-credits/${viewingCredit.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit Credit Note
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DELETE CONFIRMATION MODAL
         ========================================================================= */}
      {creditToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Vendor Credit</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete Vendor Credit{" "}
              <strong className="text-slate-900">{creditToDelete.creditNoteNumber}</strong> for{" "}
              <strong className="text-slate-900">{creditToDelete.vendorName}</strong>?
            </p>

            {creditToDelete.appliedAmount > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>Notice:</strong> This credit note has already been applied to{" "}
                  {creditToDelete.billsAppliedCount || 0} bill(s) (totaling{" "}
                  {formatINR(creditToDelete.appliedAmount)}). Deleting it will restore bill balances.
                </span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreditToDelete(null)}
                disabled={deleting}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCredit}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete Credit Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
