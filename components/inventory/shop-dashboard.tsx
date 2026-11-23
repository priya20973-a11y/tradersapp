"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  Calendar,
  CheckCircle2,
  History,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  X,
} from "lucide-react";
import {
  DEFAULT_SHOP_WRITE_OFF_REASONS,
  getShopWriteOffReasons,
  saveStoredShopWriteOffReason,
} from "@/lib/shop-write-off-storage";
import { formatCommodityNameWithUnit } from "@/lib/commodity-utils";

interface ShopOption {
  id: string;
  name: string;
  code?: string;
  type?: string;
  city?: string;
  address?: string;
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

export function ShopDashboard() {
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>("");
  const [loadingShops, setLoadingShops] = useState(true);

  const [stockLevels, setStockLevels] = useState<StockLevelRow[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Create Shop Modal
  const [showAddShopModal, setShowAddShopModal] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const [newShopCode, setNewShopCode] = useState("");
  const [newShopCity, setNewShopCity] = useState("");
  const [submittingShop, setSubmittingShop] = useState(false);

  // Shop Ledger Modal
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerCommodity, setLedgerCommodity] = useState<StockLevelRow | null>(null);
  const [ledgerMovements, setLedgerMovements] = useState<StockMovementItem[]>([]);
  const [movementFilter, setMovementFilter] = useState<string>("ALL");
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerStartDate, setLedgerStartDate] = useState("");
  const [ledgerEndDate, setLedgerEndDate] = useState("");

  // Write-off / Damaged Stock Modal
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [writeOffCommodity, setWriteOffCommodity] = useState<StockLevelRow | null>(null);
  const [writeOffQty, setWriteOffQty] = useState("");
  const [writeOffReason, setWriteOffReason] = useState(DEFAULT_SHOP_WRITE_OFF_REASONS[0]);
  const [writeOffReasons, setWriteOffReasons] = useState<string[]>(DEFAULT_SHOP_WRITE_OFF_REASONS);
  const [isAddingReason, setIsAddingReason] = useState(false);
  const [newReasonInput, setNewReasonInput] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [writeOffRemarks, setWriteOffRemarks] = useState("");
  const [submittingWriteOff, setSubmittingWriteOff] = useState(false);

  // Sync shop write-off reasons from storage
  useEffect(() => {
    const updateReasons = () => {
      setWriteOffReasons(getShopWriteOffReasons());
    };
    updateReasons();
    window.addEventListener("shop_write_off_reasons_updated", updateReasons);
    return () => {
      window.removeEventListener("shop_write_off_reasons_updated", updateReasons);
    };
  }, []);

  // Alerts
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch Shops
  const fetchShops = async () => {
    setLoadingShops(true);
    try {
      const res = await fetch("/api/inventory/locations?type=Shop");
      const data = await res.json();
      const list: ShopOption[] = (data.locations || []).filter(
        (l: { type: string }) => l.type === "Shop"
      );
      setShops(list);
      if (list.length > 0 && !selectedShopId) {
        setSelectedShopId(list[0].id);
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load shops." });
    } finally {
      setLoadingShops(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => fetchShops());
  }, []);

  // Fetch Stock Levels
  const fetchStockLevels = async (shopId: string) => {
    if (!shopId) {
      setStockLevels([]);
      return;
    }
    setLoadingStock(true);
    try {
      const res = await fetch(`/api/inventory/stock-levels?locationType=Shop&locationId=${shopId}`);
      const data = await res.json();
      setStockLevels(data.stockLevels || []);
    } catch {
      setMessage({ type: "error", text: "Failed to load shop inventory." });
    } finally {
      setLoadingStock(false);
    }
  };

  useEffect(() => {
    if (selectedShopId) {
      void Promise.resolve().then(() => fetchStockLevels(selectedShopId));
    }
  }, [selectedShopId]);

  // Create Shop
  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim()) return;

    setSubmittingShop(true);
    try {
      const res = await fetch("/api/inventory/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "Shop",
          name: newShopName.trim(),
          code: newShopCode.trim() || undefined,
          city: newShopCity.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create shop.");

      setMessage({ type: "success", text: `Shop "${newShopName}" created successfully!` });
      setShowAddShopModal(false);
      setNewShopName("");
      setNewShopCode("");
      setNewShopCity("");
      await fetchShops();
      if (data.location?.id) {
        setSelectedShopId(data.location.id);
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to create shop." });
    } finally {
      setSubmittingShop(false);
    }
  };

  // Fetch Ledger
  const fetchLedger = async (commodityId?: string) => {
    if (!selectedShopId) return;
    setLoadingLedger(true);
    try {
      let url = `/api/inventory/ledger?locationType=Shop&locationId=${selectedShopId}`;
      if (commodityId) url += `&commodityId=${commodityId}`;
      if (ledgerStartDate) url += `&startDate=${ledgerStartDate}`;
      if (ledgerEndDate) url += `&endDate=${ledgerEndDate}`;

      const res = await fetch(url);
      const data = await res.json();
      setLedgerMovements(data.movements || []);
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
    const currentReasons = getShopWriteOffReasons();
    setWriteOffReasons(currentReasons);
    setWriteOffCommodity(item);
    setWriteOffQty("");
    setWriteOffReason(currentReasons[0] || "Damaged in retail display");
    setWriteOffRemarks("");
    setIsAddingReason(false);
    setNewReasonInput("");
    setReasonError("");
    setShowWriteOffModal(true);
  };

  const handleSaveCustomReason = () => {
    const trimmed = newReasonInput.trim();
    if (!trimmed) {
      setReasonError("Please enter a custom reason.");
      return;
    }
    saveStoredShopWriteOffReason(trimmed);
    const updated = getShopWriteOffReasons();
    setWriteOffReasons(updated);
    setWriteOffReason(trimmed);
    setIsAddingReason(false);
    setNewReasonInput("");
    setReasonError("");
  };

  const handleConfirmWriteOff = async () => {
    if (!writeOffCommodity || !selectedShopId) return;

    let effectiveReason = writeOffReason;
    if (isAddingReason) {
      const trimmed = newReasonInput.trim();
      if (trimmed) {
        saveStoredShopWriteOffReason(trimmed);
        const updated = getShopWriteOffReasons();
        setWriteOffReasons(updated);
        setWriteOffReason(trimmed);
        effectiveReason = trimmed;
        setIsAddingReason(false);
        setNewReasonInput("");
        setReasonError("");
      } else {
        setMessage({ type: "error", text: "Please enter or select a write-off reason." });
        return;
      }
    }

    if (!effectiveReason || !effectiveReason.trim()) {
      setMessage({ type: "error", text: "Please select a valid write-off reason." });
      return;
    }

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
          locationType: "Shop",
          locationId: selectedShopId,
          commodityId: writeOffCommodity.commodityId,
          quantity: qty,
          reason: effectiveReason,
          remarks: writeOffRemarks,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record write-off.");

      setMessage({ type: "success", text: `Recorded ${qty} damaged units write-off.` });
      setShowWriteOffModal(false);
      fetchStockLevels(selectedShopId);
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

  const selectedShop = shops.find((s) => s.id === selectedShopId);

  // Filtered Ledger Movements
  const filteredMovements = useMemo(() => {
    if (movementFilter === "ALL") return ledgerMovements;
    return ledgerMovements.filter((m) => m.movementType === movementFilter);
  }, [ledgerMovements, movementFilter]);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inventory</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Independent Location</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
              Shop Inventory Dashboard
            </h1>
          </div>
        </div>

        {/* Shop Selector & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-purple-500 focus:bg-white transition cursor-pointer"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  🏪 {s.name} {s.code ? `(${s.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowAddShopModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-purple-600" />
            Add Shop
          </button>

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
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            Shop Ledger
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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Shop On Hand</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {totals.onHand.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] text-slate-400">Total physical in shop</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Reserved</p>
          <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">
            {totals.reserved.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] text-amber-500">Committed in Shop Orders</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Available</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {totals.available.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] text-emerald-600">Ready for direct sale</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">Damaged Stock</p>
          <p className="text-2xl font-bold text-rose-700 mt-1 tabular-nums">
            {totals.damaged.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] text-rose-500">Shop display write-offs</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs col-span-2 sm:col-span-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Stock Value</p>
          <p className="text-2xl font-bold text-purple-700 mt-1 tabular-nums">
            ₹{totals.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Shop inventory valuation</span>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search commodity or SKU…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:border-purple-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchStockLevels(selectedShopId)}
              className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition cursor-pointer"
              title="Refresh Shop Stock"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStock ? "animate-spin" : ""}`} />
            </button>
            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredStocks.length} Commodities
            </span>
          </div>
        </div>

        {/* Table */}
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
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                    Loading shop stock records…
                  </td>
                </tr>
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No commodity stock recorded in {selectedShop?.name || "this shop"}.
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
                        <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {stock.reservedStock.toLocaleString("en-IN")}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                      {stock.availableStock.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums">
                      {stock.damagedStock > 0 ? (
                        <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {stock.damagedStock.toLocaleString("en-IN")}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-purple-700 tabular-nums">
                      ₹{stock.stockValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenLedger(stock)}
                          className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition cursor-pointer"
                        >
                          Ledger
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenWriteOff(stock)}
                          className="px-2.5 py-1 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg font-medium transition cursor-pointer"
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

      {/* Add New Shop Modal */}
      {showAddShopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={handleCreateShop}
            className="relative flex w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-purple-700 font-bold">
                <Store className="w-5 h-5" />
                <h3>Add New Retail Shop / Outlet</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddShopModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Shop Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. City Market Shop #2"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Shop Code</label>
                <input
                  type="text"
                  placeholder="e.g. SHOP-02"
                  value={newShopCode}
                  onChange={(e) => setNewShopCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">City / Branch Location</label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai Main Branch"
                  value={newShopCity}
                  onChange={(e) => setNewShopCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddShopModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingShop}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition"
              >
                {submittingShop ? "Saving..." : "Create Shop"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shop Ledger Modal */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Shop Stock Ledger {ledgerCommodity ? `— ${formatCommodityNameWithUnit(ledgerCommodity.commodityName, ledgerCommodity.unit)}` : ""}
                </h3>
                <p className="text-xs text-slate-500">
                  Shop Location: {selectedShop?.name}
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

            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: "All History", value: "ALL" },
                  { label: "Purchases", value: "PurchaseInward" },
                  { label: "Sales Out", value: "SalesInvoiceStockOut" },
                  { label: "Customer Returns", value: "CreditNoteReturn" },
                  { label: "Transfers In", value: "TransferIn" },
                  { label: "Transfers Out", value: "TransferOut" },
                  { label: "Write-Offs", value: "DamagedWriteOff" },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setMovementFilter(tab.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      movementFilter === tab.value
                        ? "bg-purple-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
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
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg text-slate-700 cursor-pointer"
                >
                  Filter
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingLedger ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                  Loading ledger records…
                </div>
              ) : filteredMovements.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">No stock movements found for this filter.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Movement#</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Shop On Hand</th>
                      <th className="py-2.5 px-3">Ref Document</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMovements.map((m) => (
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
              )}
            </div>

            <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLedgerModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-xs font-semibold rounded-xl text-slate-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write-off Modal */}
      {showWriteOffModal && writeOffCommodity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative flex w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-bold">
                <ShieldAlert className="w-5 h-5" />
                <h3>Write-off Shop Damaged Stock</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowWriteOffModal(false);
                  setIsAddingReason(false);
                  setNewReasonInput("");
                  setReasonError("");
                }}
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
                Shop: <strong className="text-slate-800">{selectedShop?.name}</strong>
              </p>
              <div className="flex gap-4 pt-1 font-medium">
                <span>Shop On Hand: <strong>{writeOffCommodity.onHandStock}</strong></span>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Reason</label>
                  {!isAddingReason && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingReason(true);
                        setNewReasonInput("");
                        setReasonError("");
                      }}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add New Reason
                    </button>
                  )}
                </div>
                <select
                  value={isAddingReason ? "__ADD_NEW__" : writeOffReason}
                  onChange={(e) => {
                    if (e.target.value === "__ADD_NEW__") {
                      setIsAddingReason(true);
                      setNewReasonInput("");
                      setReasonError("");
                    } else {
                      setIsAddingReason(false);
                      setWriteOffReason(e.target.value);
                      setReasonError("");
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-rose-500 bg-white"
                >
                  {writeOffReasons.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="__ADD_NEW__">+ Add New Reason...</option>
                </select>

                {isAddingReason && (
                  <div className="mt-2 space-y-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Enter custom reason..."
                        value={newReasonInput}
                        onChange={(e) => {
                          setNewReasonInput(e.target.value);
                          if (reasonError) setReasonError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveCustomReason();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setIsAddingReason(false);
                            setReasonError("");
                          }
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none focus:border-rose-500 bg-white"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSaveCustomReason}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        Save Reason
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingReason(false);
                          setNewReasonInput("");
                          setReasonError("");
                        }}
                        className="px-2.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    {reasonError && (
                      <p className="text-[11px] text-rose-600 font-medium">{reasonError}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes"
                  value={writeOffRemarks}
                  onChange={(e) => setWriteOffRemarks(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowWriteOffModal(false);
                  setIsAddingReason(false);
                  setNewReasonInput("");
                  setReasonError("");
                }}
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
