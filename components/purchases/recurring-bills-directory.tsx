"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Edit,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Trash2,
  X,
  Zap,
} from "lucide-react";

interface GeneratedBillInfo {
  billId: string;
  billNumber: string;
  generatedAt: string;
  total: number;
  status: string;
}

interface RecurringBillProfile {
  id: string;
  _id: string;
  profileName: string;
  vendorId: string;
  vendorName: string;
  repeatEvery: string;
  startDate: string;
  endsOn: string;
  neverExpires: boolean;
  nextBillDate: string;
  lastGeneratedDate?: string | null;
  billsGeneratedCount: number;
  paymentTerms: string;
  accountsPayable: string;
  items: unknown[];
  subTotal: number;
  discount: number;
  discountType: string;
  taxType: string;
  taxRate: number;
  adjustment: number;
  total: number;
  status: "Active" | "Paused" | "Expired";
  lastBill?: GeneratedBillInfo | null;
  notes?: string;
  createdAt?: string;
}

interface Metrics {
  totalProfiles: number;
  statusCounts: {
    total: number;
    active: number;
    paused: number;
    expired: number;
  };
  monthlyCommitment: number;
  dueCount: number;
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

export function RecurringBillsDirectory() {
  const [profiles, setProfiles] = useState<RecurringBillProfile[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalProfiles: 0,
    statusCounts: { total: 0, active: 0, paused: 0, expired: 0 },
    monthlyCommitment: 0,
    dueCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedVendorId, setSelectedVendorId] = useState("all");

  // Actions state
  const [processingBatch, setProcessingBatch] = useState(false);
  const [profileActionLoading, setProfileActionLoading] = useState<string | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<RecurringBillProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    const loadProfiles = async () => {
      try {
        const res = await fetch("/api/purchases/recurring-bills");
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          throw new Error(data.error || "Failed to load recurring bills.");
        }
        setProfiles(data.profiles || []);
        if (data.metrics) setMetrics(data.metrics);
        if (data.vendors) setVendors(data.vendors);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error fetching recurring bills.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProfiles();
    return () => {
      active = false;
    };
  }, [refreshIndex]);

  const fetchProfiles = () => {
    setLoading(true);
    setRefreshIndex((prev) => prev + 1);
  };

  // Filtered list
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (selectedVendorId !== "all" && p.vendorId !== selectedVendorId) {
        return false;
      }
      if (statusFilter !== "ALL" && p.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matches =
          p.profileName.toLowerCase().includes(q) ||
          p.vendorName.toLowerCase().includes(q) ||
          p.repeatEvery.toLowerCase().includes(q) ||
          (p.notes && p.notes.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [profiles, selectedVendorId, statusFilter, search]);

  // Batch Process Due Bills
  const handleProcessDue = async () => {
    setProcessingBatch(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/purchases/recurring-bills/process", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Batch processing failed.");

      setNotice(data.message || `Processed ${data.totalDue || 0} recurring profiles.`);
      fetchProfiles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to process recurring bills.");
    } finally {
      setProcessingBatch(false);
    }
  };

  // Toggle Pause / Resume
  const handleToggleStatus = async (profileId: string) => {
    setProfileActionLoading(profileId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/purchases/recurring-bills/${profileId}/status`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle status.");

      setNotice(data.message || "Status updated.");
      fetchProfiles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setProfileActionLoading(null);
    }
  };

  // Generate Bill Now
  const handleGenerateNow = async (profileId: string) => {
    setProfileActionLoading(profileId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/purchases/recurring-bills/${profileId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate bill.");

      setNotice(`Bill ${data.bill.billNumber} created successfully! Next bill date is now ${data.nextBillDate}.`);
      fetchProfiles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate bill.");
    } finally {
      setProfileActionLoading(null);
    }
  };

  // Delete Profile
  const handleDeleteProfile = async () => {
    if (!profileToDelete) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/purchases/recurring-bills/${profileToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete profile.");

      setNotice(`Profile "${profileToDelete.profileName}" deleted.`);
      setProfileToDelete(null);
      fetchProfiles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete profile.");
    } finally {
      setDeleting(false);
    }
  };

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-500">
              Purchases
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <RotateCw className="h-2.5 w-2.5" /> Auto-Scheduler
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Recurring Bills</h1>
          <p className="text-xs text-slate-500 mt-1">
            Automate recurring supplier invoices, warehouse contracts, and scheduled trade payments
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void fetchProfiles()}
            disabled={loading}
            title="Refresh list"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleProcessDue}
            disabled={processingBatch}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition shadow-sm"
          >
            {processingBatch ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5 text-emerald-600" />
            )}
            Process Due Bills
          </button>

          <Link
            href="/purchases/recurring-bills/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            New Recurring Bill
          </Link>
        </div>
      </div>

      {/* Alerts */}
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
        {/* Active Profiles */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Profiles
            </p>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {metrics.statusCounts?.active ?? 0} Running
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {metrics.statusCounts?.active ?? 0}
            </span>
            <span className="text-xs text-slate-400">of {metrics.totalProfiles ?? 0} total</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Scheduled automated bill generators</p>
        </div>

        {/* Est. Monthly Commitment */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Monthly Commitment
            </p>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              Normalized
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-blue-600">
              {formatINR(metrics.monthlyCommitment ?? 0)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Est. 30-day recurring liability</p>
        </div>

        {/* Due for Generation */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Due for Run
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                (metrics.dueCount ?? 0) > 0
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {metrics.dueCount ?? 0} Due
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold tracking-tight ${
                (metrics.dueCount ?? 0) > 0 ? "text-amber-600" : "text-slate-900"
              }`}
            >
              {metrics.dueCount ?? 0}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Ready to create Purchase Bills today</p>
        </div>

        {/* Paused / Expired */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Inactive Profiles
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              Hold
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-700">
              {(metrics.statusCounts?.paused ?? 0) + (metrics.statusCounts?.expired ?? 0)}
            </span>
            <span className="text-xs text-slate-400">
              {metrics.statusCounts?.paused ?? 0} paused, {metrics.statusCounts?.expired ?? 0} expired
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Temporarily paused or past end date</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "ALL", label: `All (${metrics.totalProfiles ?? 0})` },
            { id: "Active", label: `Active (${metrics.statusCounts?.active ?? 0})` },
            { id: "Paused", label: `Paused (${metrics.statusCounts?.paused ?? 0})` },
            { id: "Expired", label: `Expired (${metrics.statusCounts?.expired ?? 0})` },
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

          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search profile, vendor, terms…"
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Profiles Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
              <RotateCw className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Recurring Bills Found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              {search || statusFilter !== "ALL" || selectedVendorId !== "all"
                ? "No recurring bill profiles match the current filters. Try resetting filters."
                : "Automate predictable supplier commitments like office rent, packaging retainers, and utility bills."}
            </p>
            <Link
              href="/purchases/recurring-bills/new"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Plus className="h-3.5 w-3.5" /> Create First Recurring Bill
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Profile Name</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Next Bill Date</th>
                  <th className="py-3 px-4 text-right">Amount / Occurrence</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Generated</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProfiles.map((p) => {
                  const isDueToday = p.status === "Active" && p.nextBillDate && p.nextBillDate <= todayStr;
                  const isBusy = profileActionLoading === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      {/* Profile Name */}
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <Link
                          href={`/purchases/recurring-bills/${p.id}`}
                          className="hover:text-blue-600 transition flex items-center gap-1.5"
                        >
                          {p.profileName}
                        </Link>
                        <p className="text-[11px] font-normal text-slate-400">
                          {p.items?.length || 0} line {p.items?.length === 1 ? "item" : "items"} • {p.paymentTerms}
                        </p>
                      </td>

                      {/* Vendor */}
                      <td className="py-3 px-4 text-slate-700">
                        <span className="font-medium text-slate-900">{p.vendorName}</span>
                      </td>

                      {/* Repeat Frequency */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          <RotateCw className="h-3 w-3 text-slate-500" />
                          {p.repeatEvery}
                        </span>
                      </td>

                      {/* Next Bill Date */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-medium text-slate-800">{formatDate(p.nextBillDate)}</span>
                          {isDueToday && (
                            <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[9px] font-bold text-white uppercase tracking-wider">
                              Due
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {p.neverExpires ? "Never expires" : `Ends: ${formatDate(p.endsOn)}`}
                        </p>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatINR(p.total)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            p.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : p.status === "Paused"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>

                      {/* Last Generated Bill */}
                      <td className="py-3 px-4 text-slate-600">
                        {p.lastBill ? (
                          <div>
                            <Link
                              href="/purchases/bills"
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {p.lastBill.billNumber}
                            </Link>
                            <p className="text-[10px] text-slate-400">
                              {formatDate(p.lastBill.generatedAt)} ({p.billsGeneratedCount || 0} total)
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None yet</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          {/* Run Now Button */}
                          <button
                            type="button"
                            onClick={() => handleGenerateNow(p.id)}
                            disabled={isBusy}
                            title="Generate a bill now"
                            className="rounded-lg p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Zap className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Pause / Resume Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(p.id)}
                            disabled={isBusy}
                            title={p.status === "Active" ? "Pause Profile" : "Resume Profile"}
                            className="rounded-lg p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                          >
                            {p.status === "Active" ? (
                              <Pause className="h-3.5 w-3.5 text-amber-600" />
                            ) : (
                              <Play className="h-3.5 w-3.5 text-emerald-600" />
                            )}
                          </button>

                          {/* Edit Button */}
                          <Link
                            href={`/purchases/recurring-bills/${p.id}`}
                            title="Edit profile"
                            className="rounded-lg p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Link>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setProfileToDelete(p)}
                            title="Delete profile"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
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

      {/* Delete Confirmation Modal */}
      {profileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Recurring Profile</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mt-2">
              Are you sure you want to delete profile{" "}
              <strong className="text-slate-800 font-semibold">
                &ldquo;{profileToDelete.profileName}&rdquo;
              </strong>
              ? Previously generated bills will remain safely preserved in the Bills Directory and Vendor Ledger.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setProfileToDelete(null)}
                disabled={deleting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProfile}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-3 w-3 animate-spin" />}
                {deleting ? "Deleting…" : "Delete Profile"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
