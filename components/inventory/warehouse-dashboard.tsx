"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  TrendingDown,
  X,
} from "lucide-react";
import { formatCommodityNameWithUnit } from "@/lib/commodity-utils";

interface WarehouseOption {
  id: string;
  name: string;
  code?: string;
  type?: string;
  city?: string;
}

interface StockLevelRow {
  commodityId: string;
  commodityName: string;
  sku?: string;
  unit?: string;
  onHandStock: number;
  reservedStock: number;
  availableStock: number;
  damagedStock: number;
  valuationRate: number;
  stockValue: number;
}

interface StockMovementItem {
  id: string;
  movementNumber: string;
  movementType: string;
  direction: "IN" | "OUT";
  quantity: number;
  balanceAfterOnHand: number;
  balanceAfterReserved: number;
  referenceType: string;
  referenceNumber?: string;
  remarks?: string;
  createdAt: string;
}

interface StockReservationItem {
  id: string;
  reservationNumber: string;
  salesOrderId: string;
  salesOrderNumber?: string;
  commodityName: string;
  quantity: number;
  status: string;
  reservedAt: string;
}

export function WarehouseDashboard() {
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);

  const [stockLevels, setStockLevels] = useState<StockLevelRow[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Ledger Drawer / Modal State
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerCommodity, setLedgerCommodity] = useState<StockLevelRow | null>(null);
  const [ledgerMovements, setLedgerMovements] = useState<StockMovementItem[]>([]);
  const [ledgerReservations, setLedgerReservations] = useState<StockReservationItem[]>([]);
  const [ledgerTab, setLedgerTab] = useState<"movements" | "reservations">("movements");
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerStartDate, setLedgerStartDate] = useState("");
  const [ledgerEndDate, setLedgerEndDate] = useState("");

  // Write-off / Adjust Modal State
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [writeOffCommodity, setWriteOffCommodity] = useState<StockLevelRow | null>(null);
  const [writeOffQty, setWriteOffQty] = useState<string>("");
  const [writeOffReason, setWriteOffReason] = useState("Damaged in storage");
  const [writeOffRemarks, setWriteOffRemarks] = useState("");
  const [submittingWriteOff, setSubmittingWriteOff] = useState(false);

  // Quick message / alerts
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load Warehouses
  const fetchWarehouses = async () => {
    setLoadingWarehouses(true);
    try {
      const res = await fetch("/api/inventory/locations?type=Warehouse");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load warehouses.");
      }
      const list: WarehouseOption[] = (data.warehouses || []).filter(
        (l: { type: string }) => l.type === "Warehouse"
      );
      setWarehouses(list);
      if (list.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(list[0].id);
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to load warehouses." });
    } finally {
      setLoadingWarehouses(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => fetchWarehouses());
  }, []);

  // Load Stock Levels for Selected Warehouse
  const fetchStockLevels = async (warehouseId: string) => {
    if (!warehouseId) {
      setStockLevels([]);
      return;
    }
    setLoadingStock(true);
    try {
      const res = await fetch(`/api/inventory/stock-levels?locationType=Warehouse&locationId=${warehouseId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load warehouse stock levels.");
      }
      setStockLevels(Array.isArray(data.stockLevels) ? data.stockLevels : []);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load warehouse stock levels.",
      });
    } finally {
      setLoadingStock(false);
    }
  };

  useEffect(() => {
    if (selectedWarehouseId) {
      void Promise.resolve().then(() => fetchStockLevels(selectedWarehouseId));
    }
  }, [selectedWarehouseId]);

  // Load Ledger
  const fetchLedger = async (commodityId?: string) => {
    if (!selectedWarehouseId) return;
    setLoadingLedger(true);
    try {
      let url = `/api/inventory/ledger?locationType=Warehouse&locationId=${selectedWarehouseId}`;
      if (commodityId) url += `&commodityId=${commodityId}`;
      if (ledgerStartDate) url += `&startDate=${ledgerStartDate}`;
      if (ledgerEndDate) url += `&endDate=${ledgerEndDate}`;

      const res = await fetch(url);
      const data = await res.json();
      setLedgerMovements(data.movements || []);
      setLedgerReservations(data.reservations || []);
    } catch {
      // ignore
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleOpenLedger = (item?: StockLevelRow) => {
    setLedgerCommodity(item || null);
    setShowLedgerModal(true);
    fetchLedger(item?.commodityId);
  };

  const handleOpenWriteOff = (item: StockLevelRow) => {
    setWriteOffCommodity(item);
    setWriteOffQty("");
    setWriteOffReason("Damaged in storage");
    setWriteOffRemarks("");
    setShowWriteOffModal(true);
  };

  const handleConfirmWriteOff = async () => {
    if (!writeOffCommodity || !selectedWarehouseId) return;
    const qty = Number(writeOffQty);
    if (!qty || qty <= 0) {
      setMessage({ type: "error", text: "Please enter a valid write-off quantity." });
      return;
    }
    if (qty > writeOffCommodity.availableStock) {
      setMessage({
        type: "error",
        text: `Cannot write off more than available stock (${writeOffCommodity.availableStock}).`,
      });
      return;
    }

    setSubmittingWriteOff(true);
    try {
      const res = await fetch("/api/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustmentType: "DamagedWriteOff",
          locationType: "Warehouse",
          locationId: selectedWarehouseId,
          commodityId: writeOffCommodity.commodityId,
          quantity: qty,
          reason: writeOffReason,
          remarks: writeOffRemarks,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record adjustment.");
      }

      setMessage({ type: "success", text: `Successfully wrote off ${qty} units of damaged stock.` });
      setShowWriteOffModal(false);
      fetchStockLevels(selectedWarehouseId);
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to record write-off." });
    } finally {
      setSubmittingWriteOff(false);
    }
  };

  // Filtered Stock Levels
  const filteredStocks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return stockLevels;
    return stockLevels.filter(
      (s) =>
        s.commodityName.toLowerCase().includes(q) ||
        (s.sku && s.sku.toLowerCase().includes(q)) ||
        (s.unit && s.unit.toLowerCase().includes(q)) ||
        formatCommodityNameWithUnit(s.commodityName, s.unit).toLowerCase().includes(q)
    );
  }, [stockLevels, searchQuery]);

  // Aggregate Totals
  const totals = useMemo(() => {
    return stockLevels.reduce(
      (acc, s) => ({
        onHand: acc.onHand + s.onHandStock,
        reserved: acc.reserved + s.reservedStock,
        available: acc.available + s.availableStock,
        damaged: acc.damaged + s.damagedStock,
        value: acc.value + s.stockValue,
      }),
      { onHand: 0, reserved: 0, available: 0, damaged: 0, value: 0 }
    );
  }, [stockLevels]);

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inventory</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Location Tracking</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
              Warehouse Inventory Dashboard
            </h1>
          </div>
        </div>

        {/* Warehouse Selector & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  🏢 {wh.name} {wh.code ? `(${wh.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/inventory/transfers"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition shadow-2xs"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
            Stock Transfer
          </Link>

          <button
            type="button"
            onClick={() => handleOpenLedger()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition shadow-xs"
          >
            <History className="w-3.5 h-3.5" />
            Warehouse Ledger
          </button>
        </div>
      </div>

      {/* Notice Message */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">On Hand Stock</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {totals.onHand.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] text-slate-400">Total physical units</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Reserved Stock</p>
          <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">
            {totals.reserved.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] text-amber-500">Committed in Sales Orders</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Available Stock</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {totals.available.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] text-emerald-600">Free to sell / transfer</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">Damaged Stock</p>
          <p className="text-2xl font-bold text-rose-700 mt-1 tabular-nums">
            {totals.damaged.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] text-rose-500">Unusable / written off</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs col-span-2 sm:col-span-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Stock Value</p>
          <p className="text-2xl font-bold text-blue-700 mt-1 tabular-nums">
            ₹{totals.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Valuation at purchase rate</span>
        </div>
      </div>

      {/* Main Stock Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search commodity name or SKU…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchStockLevels(selectedWarehouseId)}
              className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition cursor-pointer"
              title="Refresh Stock Data"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStock ? "animate-spin" : ""}`} />
            </button>
            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredStocks.length} Commodities
            </span>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Commodity</th>
                <th className="py-3 px-4 text-right">On Hand</th>
                <th className="py-3 px-4 text-right">Reserved</th>
                <th className="py-3 px-4 text-right">Available</th>
                <th className="py-3 px-4 text-right">Damaged</th>
                <th className="py-3 px-4 text-right">Stock Value (₹)</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingStock ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading stock records…
                  </td>
                </tr>
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No commodity stock found in {selectedWarehouse?.name || "this warehouse"}.
                  </td>
                </tr>
              ) : (
                filteredStocks.map((stock) => (
                  <tr key={stock.commodityId} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{formatCommodityNameWithUnit(stock.commodityName, stock.unit)}</div>
                      <div className="text-[11px] font-normal text-slate-400">
                        {stock.sku ? `SKU: ${stock.sku} • ` : ""}Unit: {stock.unit || "unit"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                      {stock.onHandStock.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums">
                      {stock.reservedStock > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setLedgerTab("reservations");
                            handleOpenLedger(stock);
                          }}
                          className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/70 hover:bg-amber-100 transition cursor-pointer"
                        >
                          {stock.reservedStock.toLocaleString("en-IN")} ℹ️
                        </button>
                      ) : (
                        <span className="text-slate-400 font-medium">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                      {stock.availableStock.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums">
                      {stock.damagedStock > 0 ? (
                        <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/70">
                          {stock.damagedStock.toLocaleString("en-IN")}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-blue-700 tabular-nums">
                      ₹{stock.stockValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setLedgerTab("movements");
                            handleOpenLedger(stock);
                          }}
                          className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition cursor-pointer"
                          title="View Ledger Movements"
                        >
                          Ledger
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenWriteOff(stock)}
                          className="px-2.5 py-1 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg font-medium transition cursor-pointer"
                          title="Write-off Damaged Stock"
                        >
                          Write-off
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Ledger Modal */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Warehouse Stock Ledger {ledgerCommodity ? `— ${formatCommodityNameWithUnit(ledgerCommodity.commodityName, ledgerCommodity.unit)}` : ""}
                </h3>
                <p className="text-xs text-slate-500">
                  Location: {selectedWarehouse?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLedgerModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Tabs */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLedgerTab("movements")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    ledgerTab === "movements"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Movement History ({ledgerMovements.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTab("reservations")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    ledgerTab === "reservations"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Active Reservations ({ledgerReservations.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={ledgerStartDate}
                  onChange={(e) => setLedgerStartDate(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg outline-none"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={ledgerEndDate}
                  onChange={(e) => setLedgerEndDate(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg outline-none"
                />
                <button
                  type="button"
                  onClick={() => fetchLedger(ledgerCommodity?.commodityId)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg text-slate-700"
                >
                  Filter
                </button>
              </div>
            </div>

            {/* Ledger Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingLedger ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  Loading ledger records…
                </div>
              ) : ledgerTab === "movements" ? (
                ledgerMovements.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">No stock movements found.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Movement#</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right">On Hand Balance</th>
                        <th className="py-2.5 px-3">Ref Document</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledgerMovements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-slate-600">
                            {new Date(m.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                            {m.movementNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                m.direction === "IN"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              {m.direction} • {m.movementType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                            {m.direction === "IN" ? `+${m.quantity}` : `-${m.quantity}`}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900 tabular-nums">
                            {m.balanceAfterOnHand}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {m.referenceType} {m.referenceNumber ? `(${m.referenceNumber})` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : ledgerReservations.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">No active stock reservations found.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Reservation#</th>
                      <th className="py-2.5 px-3">Sales Order#</th>
                      <th className="py-2.5 px-3">Commodity</th>
                      <th className="py-2.5 px-3 text-right">Reserved Qty</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerReservations.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                          {r.reservationNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-blue-600">
                          {r.salesOrderNumber || r.salesOrderId}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{r.commodityName}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-700 tabular-nums">
                          {r.quantity}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {new Date(r.reservedAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLedgerModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-xs font-semibold rounded-xl text-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write-off / Damaged Stock Modal */}
      {showWriteOffModal && writeOffCommodity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative flex w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-bold">
                <ShieldAlert className="w-5 h-5" />
                <h3>Write-off Damaged Stock</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWriteOffModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
              <p>
                Commodity: <strong className="text-slate-800">{formatCommodityNameWithUnit(writeOffCommodity.commodityName, writeOffCommodity.unit)}</strong>
              </p>
              <p>
                Location: <strong className="text-slate-800">{selectedWarehouse?.name}</strong>
              </p>
              <div className="flex gap-4 pt-1 font-medium">
                <span>On Hand: <strong>{writeOffCommodity.onHandStock}</strong></span>
                <span>Available: <strong className="text-emerald-700">{writeOffCommodity.availableStock}</strong></span>
                <span>Current Damaged: <strong className="text-rose-700">{writeOffCommodity.damagedStock}</strong></span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Quantity to Write-Off <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={writeOffCommodity.availableStock}
                  placeholder={`Max ${writeOffCommodity.availableStock}`}
                  value={writeOffQty}
                  onChange={(e) => setWriteOffQty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <select
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-rose-500 bg-white"
                >
                  <option value="Damaged in storage">Damaged in storage</option>
                  <option value="Spoilage / Perished">Spoilage / Perished</option>
                  <option value="Moisture / Rain damage">Moisture / Rain damage</option>
                  <option value="Pest infestation">Pest infestation</option>
                  <option value="Transit breakage">Transit breakage</option>
                  <option value="Handling breakage">Handling breakage</option>
                  <option value="Quality expiration">Quality expiration</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Optional audit notes or inspection details"
                  value={writeOffRemarks}
                  onChange={(e) => setWriteOffRemarks(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWriteOffModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingWriteOff}
                onClick={handleConfirmWriteOff}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition"
              >
                {submittingWriteOff ? "Processing..." : "Confirm Write-Off"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
