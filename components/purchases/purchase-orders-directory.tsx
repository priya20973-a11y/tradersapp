"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Edit2,
  Eye,
  FileText,
  Loader2,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type { PurchaseOrderStatus } from "@/models/purchase-order";

export interface PurchaseOrderItem {
  itemId?: string;
  name: string;
  description?: string;
  sku?: string;
  account?: string;
  quantity: number;
  receivedQuantity: number;
  unit: string;
  rate: number;
  discount: number;
  discountType: "percent" | "amount";
  taxRate: number;
  taxAmount: number;
  amount: number;
}

export interface PurchaseOrderRecord {
  id: string;
  _id?: string;
  purchaseOrderNumber: string;
  referenceNumber?: string;
  vendorName: string;
  vendorDetails?: {
    companyName?: string;
    email?: string;
    phone?: string;
    gstin?: string;
  };
  deliveryAddressType: "organization" | "customer";
  customerName?: string;
  orderDate: string;
  deliveryDate?: string;
  paymentTerms: string;
  shipmentPreference: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  discount: number;
  discountType: "percent" | "amount";
  discountAmount: number;
  taxType: "None" | "TDS" | "TCS";
  taxName?: string;
  taxRate: number;
  taxDeduction: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
  adjustment: number;
  adjustmentDescription?: string;
  total: number;
  status: PurchaseOrderStatus;
  notes?: string;
  termsAndConditions?: string;
  attachments?: Array<{ id: string; name: string; size: number }>;
  receivingLogs?: Array<{
    receivedAt: string | Date;
    receivedBy: string;
    notes?: string;
    items: Array<{ name: string; quantityReceived: number }>;
  }>;
}

export function PurchaseOrdersDirectory() {
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [vendorFilter, setVendorFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Quick Receive Goods Modal State
  const [activeReceivePO, setActiveReceivePO] = useState<PurchaseOrderRecord | null>(null);
  const [receivedInput, setReceivedInput] = useState<Record<string, number>>({});
  const [receivedByInput, setReceivedByInput] = useState("Store Incharge");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [isSubmittingReceive, setIsSubmittingReceive] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/purchases/purchase-orders")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.purchaseOrders) {
          setOrders(data.purchaseOrders);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshIndex]);

  const fetchOrders = () => {
    setLoading(true);
    setRefreshIndex((prev) => prev + 1);
  };

  // Vendors list for filter dropdown
  const uniqueVendors = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.vendorName) set.add(o.vendorName);
    });
    return Array.from(set).sort();
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((po) => {
      // Status filter
      if (statusFilter !== "ALL" && po.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      // Vendor filter
      if (vendorFilter !== "ALL" && po.vendorName.toLowerCase() !== vendorFilter.toLowerCase()) {
        return false;
      }
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const poNum = String(po.purchaseOrderNumber || "").toLowerCase();
        const ref = String(po.referenceNumber || "").toLowerCase();
        const vendor = String(po.vendorName || "").toLowerCase();
        const customer = String(po.customerName || "").toLowerCase();
        const itemsHit = po.items?.some(
          (it) => it.name.toLowerCase().includes(q) || String(it.sku || "").toLowerCase().includes(q),
        );
        if (
          !poNum.includes(q) &&
          !ref.includes(q) &&
          !vendor.includes(q) &&
          !customer.includes(q) &&
          !itemsHit
        ) {
          return false;
        }
      }
      return true;
    });
  }, [orders, statusFilter, vendorFilter, search]);

  // KPI Calculations
  const metrics = useMemo(() => {
    const totalCount = orders.length;
    const totalVal = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const openOrders = orders.filter((o) => o.status === "Sent" || o.status === "Draft");
    const openVal = openOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const partialOrders = orders.filter((o) => o.status === "Partially Received");
    const receivedOrders = orders.filter((o) => o.status === "Received");

    return {
      totalCount,
      totalVal,
      openCount: openOrders.length,
      openVal,
      partialCount: partialOrders.length,
      receivedCount: receivedOrders.length,
    };
  }, [orders]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  // Delete Action
  const handleDelete = async (id: string, poNum: string) => {
    if (!confirm(`Are you sure you want to delete Purchase Order ${poNum}?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/purchases/purchase-orders/${id}`, { method: "DELETE" });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== id && o._id !== id && o.purchaseOrderNumber !== id));
      } else {
        alert("Failed to delete purchase order");
      }
    } catch {
      alert("Error deleting purchase order");
    } finally {
      setDeletingId(null);
    }
  };

  // Open Receive Goods Modal
  const handleOpenReceive = (po: PurchaseOrderRecord) => {
    setActiveReceivePO(po);
    const defaults: Record<string, number> = {};
    po.items?.forEach((it) => {
      const pending = Math.max(0, it.quantity - (it.receivedQuantity || 0));
      defaults[it.name] = pending; // default to remaining pending
    });
    setReceivedInput(defaults);
    setReceivedByInput("Store Incharge");
    setReceiveNotes("");
  };

  // Submit Receive Goods
  const handleSubmitReceive = async () => {
    if (!activeReceivePO) return;
    setIsSubmittingReceive(true);
    try {
      const payloadItems = Object.entries(receivedInput)
        .filter(([, qty]) => qty > 0)
        .map(([name, qty]) => ({ name, quantityReceived: Number(qty) }));

      if (payloadItems.length === 0) {
        alert("Please enter a received quantity greater than 0.");
        setIsSubmittingReceive(false);
        return;
      }

      const res = await fetch(
        `/api/purchases/purchase-orders/${activeReceivePO.id}/receive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receivedItems: payloadItems,
            receivedBy: receivedByInput,
            notes: receiveNotes,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record receipt");
      }

      const result = await res.json();
      // Update local state
      if (result.purchaseOrder) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === activeReceivePO.id || o.purchaseOrderNumber === activeReceivePO.purchaseOrderNumber
              ? { ...o, ...result.purchaseOrder, id: o.id }
              : o,
          ),
        );
      } else {
        fetchOrders();
      }
      setActiveReceivePO(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving receipt");
    } finally {
      setIsSubmittingReceive(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Purchases</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Purchase Orders</h2>
          <p className="text-xs text-slate-500 mt-1">
            Create, track, and manage supplier purchase orders, deliveries, and received inventory
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={fetchOrders}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            title="Refresh list"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/purchases/purchase-orders/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition"
          >
            <Plus className="h-4 w-4" />
            <span>New Purchase Order</span>
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Purchase Orders</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              ₹{metrics.totalVal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              {metrics.totalCount} orders
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Open / Pending POs</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-600">
              ₹{metrics.openVal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
              {metrics.openCount} open
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Partially Received</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600">{metrics.partialCount}</span>
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              In Delivery
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Received & Fulfilled</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600">{metrics.receivedCount}</span>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              100% Inwarded
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {["ALL", "Draft", "Sent", "Partially Received", "Received", "Cancelled"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === st
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              {st === "ALL" ? "All Orders" : st}
            </button>
          ))}
        </div>

        {/* Search & Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Vendor Filter */}
          <div className="relative">
            <select
              value={vendorFilter}
              onChange={(e) => {
                setVendorFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="ALL">All Vendors</option>
              {uniqueVendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search PO#, vendor, item..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-slate-400 focus:bg-white transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Date & PO#</th>
                <th className="px-5 py-3.5">Vendor & Reference</th>
                <th className="px-5 py-3.5">Delivery Target</th>
                <th className="px-5 py-3.5">Quantities Tracked</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400 mb-2" />
                    <span>Loading purchase orders…</span>
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShoppingBag className="h-8 w-8 text-slate-300" />
                      <span className="font-medium text-slate-600">No purchase orders found</span>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Create a formal request to your supplier for raw materials, commodities, or packaging supplies.
                      </p>
                      <Link
                        href="/purchases/purchase-orders/new"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Create First Purchase Order</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((po) => {
                  // Quantity metrics
                  const totalOrdered = po.items?.reduce((s, it) => s + (Number(it.quantity) || 0), 0) || 0;
                  const totalReceived = po.items?.reduce((s, it) => s + (Number(it.receivedQuantity) || 0), 0) || 0;
                  const pendingQty = Math.max(0, totalOrdered - totalReceived);
                  const percentReceived = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

                  return (
                    <tr key={po.id || po.purchaseOrderNumber} className="hover:bg-slate-50/80 transition group">
                      {/* Date & PO# */}
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/purchases/purchase-orders/${po.id || po.purchaseOrderNumber}?mode=view`}
                          className="font-bold text-slate-900 font-mono text-xs hover:text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          {po.purchaseOrderNumber}
                        </Link>
                        <div className="text-[11px] text-slate-500 mt-0.5">{po.orderDate}</div>
                      </td>

                      {/* Vendor & Ref */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">{po.vendorName}</div>
                        {po.referenceNumber && (
                          <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                            Ref: {po.referenceNumber}
                          </div>
                        )}
                        {po.deliveryAddressType === "customer" && po.customerName && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded mt-0.5">
                            Dropship: {po.customerName}
                          </span>
                        )}
                      </td>

                      {/* Delivery Date & Method */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 text-slate-800">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>{po.deliveryDate || "Not Specified"}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {po.shipmentPreference || "Surface Freight"}
                        </div>
                      </td>

                      {/* Quantities Tracking */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-slate-800">
                            {totalReceived} / {totalOrdered}
                          </span>
                          <span className="text-slate-500 text-[10px]">{percentReceived}%</span>
                        </div>
                        <div className="h-1.5 w-32 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              percentReceived === 100
                                ? "bg-emerald-500"
                                : percentReceived > 0
                                ? "bg-amber-500"
                                : "bg-slate-300"
                            }`}
                            style={{ width: `${percentReceived}%` }}
                          />
                        </div>
                        {pendingQty > 0 && (
                          <span className="text-[10px] text-amber-700 mt-0.5 block font-medium">
                            {pendingQty} pending
                          </span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 text-sm">
                          ₹{Number(po.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {po.items?.length || 0} line item(s)
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            po.status === "Received"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : po.status === "Partially Received"
                              ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                              : po.status === "Sent"
                              ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                              : po.status === "Cancelled"
                              ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {po.status === "Received" && <CheckCircle2 className="h-3 w-3" />}
                          {po.status === "Partially Received" && <Clock className="h-3 w-3" />}
                          {po.status === "Sent" && <Send className="h-3 w-3" />}
                          {po.status === "Cancelled" && <XCircle className="h-3 w-3" />}
                          {po.status === "Draft" && <FileText className="h-3 w-3" />}
                          <span>{po.status}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Receive quick button */}
                          {po.status !== "Received" && po.status !== "Cancelled" && (
                            <button
                              type="button"
                              onClick={() => handleOpenReceive(po)}
                              title="Record received goods"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <Link
                            href={`/purchases/purchase-orders/${po.id || po.purchaseOrderNumber}?mode=view`}
                            title="View details"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>

                          <Link
                            href={`/purchases/purchase-orders/${po.id || po.purchaseOrderNumber}?mode=edit`}
                            title="Edit purchase order"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Link>

                          <Link
                            href={`/purchases/purchase-orders/new?duplicate=${po.id || po.purchaseOrderNumber}`}
                            title="Duplicate order"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-purple-600 transition"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Link>

                          <Link
                            href={`/purchases/payments?search=${encodeURIComponent(po.purchaseOrderNumber)}`}
                            title="Payments against order bill"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                          </Link>

                          <Link
                            href={`/purchases/purchase-orders/${po.id || po.purchaseOrderNumber}?print=true`}
                            title="Print / PDF"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleDelete(po.id || po.purchaseOrderNumber, po.purchaseOrderNumber)}
                            disabled={deletingId === (po.id || po.purchaseOrderNumber)}
                            title="Delete order"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-50"
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

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs text-slate-600">
          <div>
            Showing{" "}
            <strong>
              {filteredOrders.length === 0 ? 0 : (page - 1) * pageSize + 1}
            </strong>{" "}
            to{" "}
            <strong>
              {Math.min(page * pageSize, filteredOrders.length)}
            </strong>{" "}
            of <strong>{filteredOrders.length}</strong> orders
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-slate-500">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-1 text-slate-500 font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* QUICK RECEIVE GOODS MODAL */}
      {activeReceivePO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Inward Goods</h3>
                  <p className="text-xs text-slate-500">
                    PO: <strong className="font-mono text-slate-800">{activeReceivePO.purchaseOrderNumber}</strong> • {activeReceivePO.vendorName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceivePO(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-slate-600 font-semibold mb-1">
                Enter received quantities for this delivery:
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                {activeReceivePO.items?.map((it) => {
                  const pending = Math.max(0, it.quantity - (it.receivedQuantity || 0));
                  return (
                    <div key={it.name} className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800">{it.name}</div>
                        <div className="text-[11px] text-slate-500">
                          Ordered: {it.quantity} {it.unit} | Already Recvd: {it.receivedQuantity || 0} | Pending: {pending}
                        </div>
                      </div>

                      <div className="w-28 flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max={it.quantity * 2}
                          step="0.01"
                          value={receivedInput[it.name] ?? pending}
                          onChange={(e) =>
                            setReceivedInput((prev) => ({
                              ...prev,
                              [it.name]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-right font-semibold text-slate-900 outline-none focus:border-blue-500"
                        />
                        <span className="text-[11px] text-slate-400">{it.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Received By</label>
                  <input
                    type="text"
                    value={receivedByInput}
                    onChange={(e) => setReceivedByInput(e.target.value)}
                    placeholder="e.g. Store Incharge"
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Inward Remarks</label>
                  <input
                    type="text"
                    value={receiveNotes}
                    onChange={(e) => setReceiveNotes(e.target.value)}
                    placeholder="e.g. Delivered via MH-04 truck"
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveReceivePO(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReceive}
                onClick={handleSubmitReceive}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition disabled:opacity-50"
              >
                {isSubmittingReceive ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PackageCheck className="h-3.5 w-3.5" />
                )}
                <span>Record Inward</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
