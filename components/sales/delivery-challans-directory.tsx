"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Download,
  Edit2,
  Eye,
  FileText,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import {
  type DeliveryChallanDocument,
} from "./delivery-challan/delivery-challan-types";
import { DeliveryChallanDetailModal } from "./delivery-challan/delivery-challan-detail-modal";
import {
  downloadDeliveryChallanPDF,
  printDeliveryChallan,
} from "./delivery-challan/delivery-challan-pdf-generator";

interface MetricsData {
  totalChallans: number;
  draftCount: number;
  openCount: number;
  deliveredCount: number;
  closedCount: number;
  totalValue: number;
}

export function DeliveryChallansDirectory() {
  const [challans, setChallans] = useState<DeliveryChallanDocument[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Detail Modal
  const [selectedChallan, setSelectedChallan] = useState<DeliveryChallanDocument | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (customerFilter !== "ALL") params.set("customerId", customerFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/sales/delivery-challans?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load delivery challans.");

      setError(null);
      setChallans(data.deliveryChallans || []);
      setCustomers(data.customers || []);
      setMetrics(data.metrics || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load delivery challans.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, customerFilter, startDate, endDate]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (customerFilter !== "ALL") params.set("customerId", customerFilter);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await fetch(`/api/sales/delivery-challans?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load delivery challans.");
        if (!active) return;
        setError(null);
        setChallans(data.deliveryChallans || []);
        setCustomers(data.customers || []);
        setMetrics(data.metrics || null);
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load delivery challans.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [statusFilter, customerFilter, startDate, endDate, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleDelete = async (id: string, number: string) => {
    if (!window.confirm(`Are you sure you want to delete Delivery Challan #${number}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/sales/delivery-challans/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete delivery challan.");
      if (selectedChallan?.id === id) {
        setShowDetailModal(false);
      }
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete delivery challan.");
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/sales/delivery-challans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status.");
      if (selectedChallan?.id === id) {
        setSelectedChallan((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Delivered":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Delivered
          </span>
        );
      case "Open":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Open
          </span>
        );
      case "Draft":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Draft
          </span>
        );
      case "Closed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Closed
          </span>
        );
      case "Void":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Void
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Detail Modal */}
      <DeliveryChallanDetailModal
        challan={selectedChallan}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedChallan(null);
        }}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Delivery Challans
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track and manage outbound merchandise dispatches, approvals, and job works
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadData()}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/sales/delivery-challans/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            New Delivery Challan
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Challans</span>
              <FileText className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-slate-900 mt-2">{metrics.totalChallans}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Recorded dispatches</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Delivered</span>
              <PackageCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-bold text-emerald-600 mt-2">{metrics.deliveredCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Completed deliveries</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Drafts</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold text-amber-600 mt-2">{metrics.draftCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Pending dispatch</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Value</span>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-slate-900 mt-2">
              ₹{metrics.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">All challan merchandise</p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          {["ALL", "Draft", "Open", "Delivered", "Closed"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                statusFilter === st
                  ? "bg-blue-50 text-blue-600 border border-blue-200"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {st === "ALL" ? "All Challans" : st}
            </button>
          ))}
        </div>

        {/* Search, Customer, Date filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <form onSubmit={handleSearchSubmit} className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Challan#, customer, or reference..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
            />
          </form>

          <div className="sm:col-span-3">
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white cursor-pointer"
            >
              <option value="ALL">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-4 flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-slate-600"
              title="From Date"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-slate-600"
              title="To Date"
            />
            {(startDate || endDate || search || statusFilter !== "ALL" || customerFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                  setCustomerFilter("ALL");
                  setStartDate("");
                  setEndDate("");
                }}
                className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear all filters"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Loading delivery challans…
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-600">{error}</div>
        ) : challans.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Delivery Challans Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first Delivery Challan to record dispatches for approval, job work, or sales.
            </p>
            <div className="pt-2">
              <Link
                href="/sales/delivery-challans/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                Create Delivery Challan
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 text-left">Date</th>
                  <th className="py-3 px-4 text-left">Delivery Challan#</th>
                  <th className="py-3 px-4 text-left">Reference#</th>
                  <th className="py-3 px-4 text-left">Customer Name</th>
                  <th className="py-3 px-4 text-left">Challan Type</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-right">Amount ( ₹ )</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {challans.map((challan) => (
                  <tr key={challan.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 text-slate-600">
                      {new Date(challan.deliveryChallanDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedChallan(challan);
                          setShowDetailModal(true);
                        }}
                        className="font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                      >
                        {challan.deliveryChallanNumber}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono">
                      {challan.referenceNumber || "-"}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {challan.customerName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{challan.challanType}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(challan.status)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                      {challan.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedChallan(challan);
                            setShowDetailModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          href={`/sales/delivery-challans/${challan.id}/edit`}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => downloadDeliveryChallanPDF(challan, challan.customerSnapshot)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => printDeliveryChallan(challan, challan.customerSnapshot)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                          title="Print"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(challan.id, challan.deliveryChallanNumber)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
