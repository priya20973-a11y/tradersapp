"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Edit,
  Eye,
  Pause,
  Play,
  Plus,
  RotateCw,
  Search,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";
import {
  RecurringExpenseForm,
  RecurringExpenseData,
  formatDateLocale,
  formatDatePretty,
} from "./recurring-expense-form";

export function RecurringExpensesDirectory() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [profiles, setProfiles] = useState<RecurringExpenseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit / Create / View state
  const isNewParam = searchParams.get("new") === "true";
  const [isCreating, setIsCreating] = useState(isNewParam);
  const [prevSearchNew, setPrevSearchNew] = useState(isNewParam);
  if (isNewParam !== prevSearchNew) {
    setPrevSearchNew(isNewParam);
    if (isNewParam) {
      setIsCreating(true);
    }
  }

  const [editingProfile, setEditingProfile] = useState<RecurringExpenseData | null>(null);
  const [viewingProfile, setViewingProfile] = useState<RecurringExpenseData | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Load recurring expenses from API
  useEffect(() => {
    let active = true;
    const fetchProfiles = async () => {
      try {
        const res = await fetch("/api/purchases/recurring-expenses");
        const data = await res.json();
        if (!active) return;
        if (!res.ok) throw new Error(data.error || "Failed to load recurring expenses");
        setProfiles(data.profiles || []);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load profiles");
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchProfiles();
    return () => {
      active = false;
    };
  }, [refreshIndex]);

  const loadProfiles = () => {
    setLoading(true);
    setRefreshIndex((prev) => prev + 1);
  };

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchesStatus =
        statusFilter === "ALL" || p.status?.toLowerCase() === statusFilter.toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        [p.profileName, p.expenseAccount, p.vendor, p.customerName, p.notes, p.repeatEvery]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [profiles, statusFilter, searchQuery]);

  // Key KPI metrics
  const metrics = useMemo(() => {
    const activeCount = profiles.filter((p) => p.status === "Active").length;
    const monthlyTotal = profiles
      .filter((p) => p.status === "Active")
      .reduce((sum, p) => {
        const amt = typeof p.amount === "number" ? p.amount : parseFloat(p.amount) || 0;
        // Normalize to monthly approximation
        if (p.repeatEvery === "Week") return sum + amt * 4.33;
        if (p.repeatEvery === "2 Weeks") return sum + amt * 2.16;
        if (p.repeatEvery === "Year") return sum + amt / 12;
        return sum + amt;
      }, 0);

    const upcoming = profiles
      .filter((p) => p.status === "Active" && p.nextDate)
      .sort((a, b) => new Date(a.nextDate!).getTime() - new Date(b.nextDate!).getTime());

    const nextDate = upcoming[0]?.nextDate ? formatDatePretty(upcoming[0].nextDate) : "None scheduled";

    return {
      activeProfiles: `${activeCount} Active`,
      monthlyTotal: `₹${Math.round(monthlyTotal).toLocaleString("en-IN")}`,
      nextScheduled: nextDate,
    };
  }, [profiles]);

  // Toggle Pause / Resume
  const handleToggleStatus = async (profile: RecurringExpenseData) => {
    const newStatus = profile.status === "Active" ? "Paused" : "Active";
    try {
      const endpoint = `/api/purchases/recurring-expenses/${profile.id || profile._id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setProfiles((prev) =>
        prev.map((p) =>
          (p.id || p._id) === (profile.id || profile._id) ? { ...p, status: newStatus } : p,
        ),
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  // Delete profile
  const handleDelete = async (profile: RecurringExpenseData) => {
    if (!window.confirm(`Are you sure you want to delete profile "${profile.profileName}"?`)) {
      return;
    }
    try {
      const endpoint = `/api/purchases/recurring-expenses/${profile.id || profile._id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete recurring expense");
      setProfiles((prev) =>
        prev.filter((p) => (p.id || p._id) !== (profile.id || profile._id)),
      );
      if (viewingProfile && (viewingProfile.id || viewingProfile._id) === (profile.id || profile._id)) {
        setViewingProfile(null);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete recurring expense");
    }
  };

  // If in create mode, render the form
  if (isCreating) {
    return (
      <RecurringExpenseForm
        mode="create"
        onCancel={() => {
          setIsCreating(false);
          router.replace("/purchases/recurring-expenses");
        }}
        onSaved={() => {
          setIsCreating(false);
          router.replace("/purchases/recurring-expenses");
          loadProfiles();
        }}
      />
    );
  }

  // If in edit mode, render the form with initialData
  if (editingProfile) {
    return (
      <RecurringExpenseForm
        mode="edit"
        id={editingProfile.id || editingProfile._id}
        initialData={editingProfile}
        onCancel={() => setEditingProfile(null)}
        onSaved={() => {
          setEditingProfile(null);
          loadProfiles();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Purchases
            </p>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              Auto-Pilot
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Recurring Expenses
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Automated scheduled expenses for software, rent, storage, and utilities.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Recurring Expense
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Active Profiles
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{metrics.activeProfiles}</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              All Healthy
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Est. Monthly Commitment
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{metrics.monthlyTotal}</span>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              Auto-recorded
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Next Scheduled Run
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{metrics.nextScheduled}</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              Automated
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {["ALL", "Active", "Paused", "Expired"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                statusFilter === st
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search profiles, vendor, account..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500">
            <RotateCw className="h-6 w-6 animate-spin text-blue-600" />
            <p className="mt-3 text-sm">Loading recurring expenses…</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">
            <AlertCircle className="mx-auto h-6 w-6 mb-2" />
            {error}
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="p-12 text-center">
            <RotateCw className="mx-auto h-8 w-8 text-slate-300" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900">
              No recurring expenses found
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery
                ? "No profiles match your current search criteria."
                : "Create automated schedules for rent, subscriptions, or retainers."}
            </p>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              New Recurring Expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50 font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Profile Name</th>
                  <th className="px-5 py-3.5">Repeat Every</th>
                  <th className="px-5 py-3.5">Expense Account</th>
                  <th className="px-5 py-3.5">Vendor</th>
                  <th className="px-5 py-3.5">Next Date</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProfiles.map((p) => {
                  const numAmount =
                    typeof p.amount === "number" ? p.amount : parseFloat(p.amount) || 0;
                  const formattedAmt = `${p.currency || "INR"} ${numAmount.toLocaleString("en-IN")}`;

                  return (
                    <tr
                      key={p.id || p._id}
                      className="transition hover:bg-slate-50/80 cursor-pointer"
                      onClick={() => setViewingProfile(p)}
                    >
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <RotateCw className="h-3.5 w-3.5 text-blue-600" />
                          <span>{p.profileName}</span>
                        </div>
                        {p.notes && (
                          <p className="mt-0.5 truncate text-[11px] font-normal text-slate-400 max-w-xs">
                            {p.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                          <Clock className="h-3 w-3" />
                          {p.repeatEvery}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-800">
                        <span>{p.expenseAccount}</span>
                        <p className="text-[11px] text-slate-400">Via {p.paidThrough}</p>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-700">
                        {p.vendor || "—"}
                      </td>
                      <td className="px-5 py-4 font-mono font-medium text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{formatDateLocale(p.nextDate || "")}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {formattedAmt}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            p.status === "Active"
                              ? "bg-emerald-50 text-emerald-700"
                              : p.status === "Paused"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              p.status === "Active"
                                ? "bg-emerald-500"
                                : p.status === "Paused"
                                ? "bg-amber-500"
                                : "bg-slate-400"
                            }`}
                          />
                          {p.status || "Active"}
                        </span>
                      </td>
                      <td
                        className="px-5 py-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingProfile(p)}
                            title="View Profile Details"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingProfile(p)}
                            title="Edit Recurring Expense"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleStatus(p)}
                            title={p.status === "Active" ? "Pause Profile" : "Activate Profile"}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                          >
                            {p.status === "Active" ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(p)}
                            title="Delete Profile"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Details View Modal */}
      {viewingProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
          onClick={() => setViewingProfile(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    Recurring Profile
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      viewingProfile.status === "Active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {viewingProfile.status}
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {viewingProfile.profileName}
                </h2>
                <p className="text-xs text-slate-500">
                  Repeats every <strong className="text-slate-700">{viewingProfile.repeatEvery}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewingProfile(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
                <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                  Recurrence Schedule
                </p>
                <div>
                  <span className="text-slate-400">Frequency:</span>{" "}
                  <strong className="text-slate-800">{viewingProfile.repeatEvery}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Start Date:</span>{" "}
                  <strong className="text-slate-800">{formatDateLocale(viewingProfile.startDate)}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Ends On:</span>{" "}
                  <strong className="text-slate-800">
                    {viewingProfile.neverExpires ? "Never Expires (Indefinite)" : formatDateLocale(viewingProfile.endsOn)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Next Execution:</span>{" "}
                  <strong className="text-blue-700">{formatDateLocale(viewingProfile.nextDate || "")}</strong>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
                <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                  Financial Accounts
                </p>
                <div>
                  <span className="text-slate-400">Amount:</span>{" "}
                  <strong className="text-slate-900 font-bold text-sm">
                    {viewingProfile.currency} {Number(viewingProfile.amount).toLocaleString("en-IN")}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Expense Account:</span>{" "}
                  <strong className="text-slate-800">{viewingProfile.expenseAccount}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Paid Through:</span>{" "}
                  <strong className="text-slate-800">{viewingProfile.paidThrough}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Vendor:</span>{" "}
                  <strong className="text-slate-800">{viewingProfile.vendor || "—"}</strong>
                </div>
              </div>

              <div className="sm:col-span-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
                <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                  Additional Details
                </p>
                <div>
                  <span className="text-slate-400">Customer Name:</span>{" "}
                  <strong className="text-slate-800">{viewingProfile.customerName || "—"}</strong>
                </div>
                {viewingProfile.reportingTags && viewingProfile.reportingTags.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-slate-400">Tags:</span>
                    {viewingProfile.reportingTags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {viewingProfile.notes && (
                  <div className="pt-1">
                    <span className="text-slate-400">Notes:</span>
                    <p className="mt-0.5 text-slate-700 italic">{viewingProfile.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  const toEdit = viewingProfile;
                  setViewingProfile(null);
                  setEditingProfile(toEdit);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => setViewingProfile(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
