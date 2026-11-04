"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Grid,
  List,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { NewSalesOrderForm } from "@/components/sales/new-sales-order-form";
import {
  type CustomerRecord,
  type SalesApiResponse,
  type SalesOrderDocument,
} from "./sales-order/sales-order-types";
import { SalesOrderKpiCards } from "./sales-order/sales-order-kpi-cards";
import { SalesOrderTableView } from "./sales-order/sales-order-table-view";
import { SalesOrderGridView } from "./sales-order/sales-order-grid-view";
import { SalesOrderDetailModal } from "./sales-order/sales-order-detail-modal";
import { fetchCachedSales, invalidateSalesCache } from "@/lib/sales-cache";

export function SalesOrdersDirectory() {
  const [data, setData] = useState<{
    customers: CustomerRecord[];
    orders: SalesOrderDocument[];
    isAdmin: boolean;
  }>({
    customers: [],
    orders: [],
    isAdmin: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [quickViewOrder, setQuickViewOrder] = useState<SalesOrderDocument | null>(null);

  const loadOrders = useCallback(async (force = false) => {
    try {
      const json = await fetchCachedSales<SalesApiResponse>("?section=orders", { force });
      setError(null);
      const orderDocs = (json.documents || []).filter((d) => d.type === "Sales Order");
      setData({
        customers: json.customers || [],
        orders: orderDocs,
        isAdmin: json.isAdmin || false,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading sales orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const json = await fetchCachedSales<SalesApiResponse>("?section=orders");
        if (!active) return;
        const orderDocs = (json.documents || []).filter((document) => document.type === "Sales Order");
        setError(null);
        setData({
          customers: json.customers || [],
          orders: orderDocs,
          isAdmin: json.isAdmin || false,
        });
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "Error loading sales orders");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const customerMap = new Map(data.customers.map((c) => [c.id, c]));

  // Status transitions & Invoicing
  const handleAction = async (documentId: string, action: "invoice-from-order") => {
    try {
      setActionNotice(null);
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, documentId }),
      });
      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resJson.error || "Failed to convert sales order");
      }
      invalidateSalesCache();
      setActionNotice(
        resJson.number
          ? `Successfully created invoice ${resJson.number}`
          : "Action completed successfully"
      );
      await loadOrders(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to execute action");
    }
  };

  const handleStatusChange = async (documentId: string, status: string) => {
    try {
      setActionNotice(null);
      const res = await fetch("/api/sales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, status }),
      });
      if (!res.ok) {
        const resJson = await res.json().catch(() => ({}));
        throw new Error(resJson.error || "Failed to update status");
      }
      invalidateSalesCache();
      setActionNotice(`Sales Order status updated to ${status}`);
      await loadOrders(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map((o) => o.id));
    }
  };

  const handleToggleSelectOrder = (id: string) => {
    setSelectedOrders((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (showForm) {
    return (
      <div className="max-w-5xl mx-auto py-2">
        <NewSalesOrderForm
          onSuccess={() => {
            setShowForm(false);
            loadOrders();
          }}
          onCancel={() => setShowForm(false)}
        />
      </div>
    );
  }

  const filteredOrders = data.orders.filter((order) => {
    const cust = customerMap.get(order.customerId);
    const custName = cust?.name.toLowerCase() || "";
    const matchesSearch =
      (order.number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      custName.includes(searchTerm.toLowerCase()) ||
      (order.referenceNumber &&
        order.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" ||
      (order.status || "").toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const draftCount = data.orders.filter(
    (o) => (o.status || "").toLowerCase() === "draft"
  ).length;
  const confirmedCount = data.orders.filter(
    (o) => (o.status || "").toLowerCase() === "confirmed"
  ).length;
  const fulfilledCount = data.orders.filter(
    (o) => (o.status || "").toLowerCase() === "fulfilled"
  ).length;
  const invoicedCount = data.orders.filter(
    (o) => (o.status || "").toLowerCase() === "invoiced"
  ).length;
  const cancelledCount = data.orders.filter(
    (o) => (o.status || "").toLowerCase() === "cancelled"
  ).length;

  return (
    <div className="space-y-6 text-slate-800">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            <span>Sales & Pipeline</span>
            <span className="text-slate-300">/</span>
            <span className="text-blue-600">Sales Orders & Fulfillment</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Sales Orders
            </h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
              {data.orders.length} total
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage customer orders, monitor fulfillment dispatch, and convert confirmed deals to invoices.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadOrders()}
            title="Refresh sales orders"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            href="/sales/orders/new"
            className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer active:scale-98"
          >
            <Plus className="h-4 w-4" />
            New Sales Order
          </Link>

          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex sm:hidden items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Sales Order
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-800 font-medium flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-1 text-emerald-600 hover:text-emerald-800 rounded-lg hover:bg-emerald-100/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 font-medium flex items-center justify-between shadow-2xs">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-100/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Overview Metrics */}
      <SalesOrderKpiCards orders={data.orders} />

      {/* Controls & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {[
            { id: "all", label: "All", count: data.orders.length },
            { id: "draft", label: "Draft", count: draftCount },
            { id: "confirmed", label: "Confirmed", count: confirmedCount },
            { id: "fulfilled", label: "Fulfilled", count: fulfilledCount },
            { id: "invoiced", label: "Invoiced", count: invoicedCount },
            { id: "cancelled", label: "Cancelled", count: cancelledCount },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-2xs"
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

        {/* Right Search & View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 sm:flex-initial items-center gap-2 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50/70 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by SO#, customer, ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-60 text-xs sm:text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
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

          {/* Table vs Grid View Switcher */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/70 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Multi-selection summary notice */}
      {selectedOrders.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-blue-50/80 px-4 py-2.5 text-xs font-medium text-blue-900 border border-blue-200/80">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {selectedOrders.length}
            </span>
            <span>
              {selectedOrders.length} sales order{selectedOrders.length > 1 ? "s" : ""} selected
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedOrders([])}
            className="text-blue-700 hover:text-blue-900 underline cursor-pointer"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Main Content: Table or Grid View */}
      {viewMode === "table" ? (
        <SalesOrderTableView
          orders={filteredOrders}
          customerMap={customerMap}
          loading={loading}
          searchTerm={searchTerm}
          selectedOrders={selectedOrders}
          onToggleSelectAll={handleToggleSelectAll}
          onToggleSelectOrder={handleToggleSelectOrder}
          onQuickView={(order) => setQuickViewOrder(order)}
          onAction={handleAction}
          onStatusChange={handleStatusChange}
          onOpenCreate={() => setShowForm(true)}
        />
      ) : (
        <SalesOrderGridView
          orders={filteredOrders}
          customerMap={customerMap}
          onQuickView={(order) => setQuickViewOrder(order)}
          onAction={handleAction}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Sales Order Quick View / Detail Modal */}
      <SalesOrderDetailModal
        order={quickViewOrder}
        customer={quickViewOrder ? customerMap.get(quickViewOrder.customerId) : undefined}
        onClose={() => setQuickViewOrder(null)}
        onAction={handleAction}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
