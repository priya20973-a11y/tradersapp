"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Building2,
  Calendar,
  MapPin,
  Package,
  X,
  Check,
} from "lucide-react";

type AdminStatus = "Pending" | "Approved";

interface AdminBuyingRequestItem {
  id: string;
  requestId: string;
  organizationId: string;
  organizationName: string;
  commodity: string;
  requiredQuantity: number;
  unit: string;
  targetPrice: number | null;
  deliveryLocation: string;
  requiredDeliveryDate: string;
  buyerName: string;
  buyerCompany: string;
  status: string;
  adminStatus: AdminStatus;
  offersCount: number;
  createdAt: string;
}

type TabFilter = "Pending" | "Approved" | "all";

export function AdminBuyingRequests() {
  const [requests, setRequests] = useState<AdminBuyingRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>("Pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [total, setTotal] = useState(0);

  const loadRequests = useCallback(async (tab: TabFilter) => {
    setLoading(true);
    setFeedback(null);
    try {
      const params = new URLSearchParams({ adminStatus: tab, limit: "50" });
      const res = await fetch(`/api/admin/buying-requests?${params.toString()}`, { cache: "no-store" });
      const data = await res.json() as { requests?: AdminBuyingRequestItem[]; total?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load buying requests");
      setFeedback(null);
      setRequests(data.requests ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load requests",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const params = new URLSearchParams({ adminStatus: activeTab, limit: "50" });
        const res = await fetch(`/api/admin/buying-requests?${params.toString()}`, { cache: "no-store" });
        const data = await res.json() as { requests?: AdminBuyingRequestItem[]; total?: number; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load buying requests");
        if (!active) return;
        setFeedback(null);
        setRequests(data.requests ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        if (active) {
          setFeedback({
            type: "error",
            message: err instanceof Error ? err.message : "Failed to load requests",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [activeTab]);

  const handleApprove = async (req: AdminBuyingRequestItem) => {
    setBusyId(req.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/buying-requests/${req.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json() as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to approve request");
      setFeedback({ type: "success", message: data.message ?? "Request approved successfully." });
      // Refresh the list
      await loadRequests(activeTab);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to approve request",
      });
    } finally {
      setBusyId(null);
    }
  };

  const getAdminStatusBadge = (adminStatus: AdminStatus) => {
    if (adminStatus === "Approved") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <ShieldCheck className="h-3 w-3" /> Approved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
        <Clock className="h-3 w-3" /> Pending Approval
      </span>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Buying Requests Approval</h1>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              Admin Panel
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Review and approve buying requests submitted by users across all organizations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRequests(activeTab)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 text-sm shadow-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="rounded p-1 hover:bg-black/5">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {(["Pending", "Approved", "all"] as TabFilter[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              if (tab !== activeTab) {
                setLoading(true);
                setFeedback(null);
                setActiveTab(tab);
              }
            }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab
                ? tab === "Pending"
                  ? "bg-amber-600 text-white shadow-sm"
                  : tab === "Approved"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {tab === "Pending" ? "⏳ Pending Approval" : tab === "Approved" ? "✅ Approved" : "All Requests"}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500 font-medium">
          {loading ? "Loading..." : `${total} request${total !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Request List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="h-5 w-40 rounded bg-slate-200" />
              <div className="h-4 w-64 rounded bg-slate-200" />
              <div className="h-10 w-full rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <ClipboardList className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">
            {activeTab === "Pending"
              ? "No pending requests"
              : activeTab === "Approved"
              ? "No approved requests"
              : "No buying requests found"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {activeTab === "Pending"
              ? "All buying requests have been reviewed. No pending approvals at this time."
              : "No requests match this filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className={`rounded-2xl border p-5 shadow-sm transition ${
                req.adminStatus === "Approved"
                  ? "border-emerald-200 bg-emerald-50/30"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                {/* Left Column */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {req.requestId}
                    </span>
                    {getAdminStatusBadge(req.adminStatus)}
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {req.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      Posted {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{req.commodity}</h3>
                    <p className="text-xs text-slate-500">
                      by <span className="font-semibold text-slate-700">{req.buyerCompany}</span> ({req.buyerName})
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl bg-slate-50 p-3 text-xs">
                    <div>
                      <span className="text-slate-400 flex items-center gap-1 mb-0.5">
                        <Package className="h-3 w-3" /> Quantity
                      </span>
                      <span className="font-bold text-slate-900">
                        {req.requiredQuantity} {req.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Target Price</span>
                      <span className="font-bold text-slate-900">
                        {req.targetPrice
                          ? `₹${req.targetPrice.toLocaleString("en-IN")}/${req.unit}`
                          : "Open to Bids"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 flex items-center gap-1 mb-0.5">
                        <Calendar className="h-3 w-3" /> Delivery By
                      </span>
                      <span className="font-semibold text-slate-900">
                        {new Date(req.requiredDeliveryDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 flex items-center gap-1 mb-0.5">
                        <Building2 className="h-3 w-3" /> Organization
                      </span>
                      <span className="font-semibold text-slate-900 truncate block" title={req.organizationName}>
                        {req.organizationName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{req.deliveryLocation}</span>
                  </div>
                </div>

                {/* Right Column: Actions */}
                <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end lg:justify-center shrink-0">
                  {req.adminStatus === "Pending" ? (
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => void handleApprove(req)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      {busyId === req.id ? "Approving..." : "Approve Request"}
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                      <ShieldCheck className="h-4 w-4" />
                      Approved
                    </div>
                  )}
                  {req.offersCount > 0 && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                      {req.offersCount} {req.offersCount === 1 ? "Offer" : "Offers"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
