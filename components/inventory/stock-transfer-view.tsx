"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Filter,
  History,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Store,
  X,
} from "lucide-react";

interface LocationOption {
  id: string;
  name: string;
  type: "Warehouse" | "Shop";
  code?: string;
}

interface CommodityOption {
  id: string;
  name: string;
  sku?: string;
  unit?: string;
}

interface CommodityStockInfo {
  onHandStock: number;
  reservedStock: number;
  availableStock: number;
}

interface StockTransferRecord {
  id: string;
  transferNumber: string;
  transferDate: string;
  fromLocationType: "Warehouse" | "Shop";
  fromLocationId: string;
  fromLocationName?: string;
  toLocationType: "Warehouse" | "Shop";
  toLocationId: string;
  toLocationName?: string;
  commodityId: string;
  commodityName?: string;
  quantity: number;
  remarks?: string;
  status: string;
  createdAt: string;
}

export function StockTransferView() {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [commodities, setCommodities] = useState<CommodityOption[]>([]);
  const [transfers, setTransfers] = useState<StockTransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferNumber, setTransferNumber] = useState("");
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [fromLocationType, setFromLocationType] = useState<"Warehouse" | "Shop">("Warehouse");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationType, setToLocationType] = useState<"Warehouse" | "Shop">("Shop");
  const [toLocationId, setToLocationId] = useState("");
  const [selectedCommodityId, setSelectedCommodityId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");

  // Source Available Stocks Map
  const [sourceStockLevels, setSourceStockLevels] = useState<Record<string, CommodityStockInfo>>({});

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Load Locations & Commodities
  const loadMasterData = async () => {
    setLoading(true);
    try {
      const [locRes, itemsRes, transferRes] = await Promise.all([
        fetch("/api/inventory/locations"),
        fetch("/api/items"),
        fetch("/api/inventory/transfers"),
      ]);

      const locData = await locRes.json();
      const itemsData = await itemsRes.json();
      const transData = await transferRes.json();

      const locs: LocationOption[] = locData.locations || [];
      setLocations(locs);

      const items: CommodityOption[] = (itemsData.items || []).map((i: Record<string, unknown>) => ({
        id: String(i.id || i.sku || ""),
        name: String(i.name || ""),
        sku: (i.sku as string) || "",
        unit: (i.unit as string) || "unit",
      }));
      setCommodities(items);

      setTransfers(transData.transfers || []);

      // Default locations
      const defaultWh = locs.find((l) => l.type === "Warehouse");
      const defaultShop = locs.find((l) => l.type === "Shop");
      if (defaultWh) setFromLocationId(defaultWh.id);
      if (defaultShop) setToLocationId(defaultShop.id);
      else if (locs.length > 1) setToLocationId(locs[1].id);
    } catch {
      setMessage({ type: "error", text: "Failed to load stock transfer data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadMasterData());
  }, []);

  // Fetch Source Location Stock Levels
  useEffect(() => {
    if (!fromLocationId) {
      void Promise.resolve().then(() => setSourceStockLevels({}));
      return;
    }
    fetch(`/api/inventory/stock-levels?locationType=${fromLocationType}&locationId=${fromLocationId}`)
      .then((r) => (r.ok ? r.json() : { stockLevels: [] }))
      .then((data) => {
        const map: Record<string, CommodityStockInfo> = {};
        for (const s of data.stockLevels || []) {
          map[s.commodityId] = {
            onHandStock: Number(s.onHandStock) || 0,
            reservedStock: Number(s.reservedStock) || 0,
            availableStock: Number(s.availableStock) || 0,
          };
        }
        setSourceStockLevels(map);
      })
      .catch(() => {});
  }, [fromLocationType, fromLocationId]);

  // Selected Commodity Available Stock
  const currentCommodityStock = selectedCommodityId ? sourceStockLevels[selectedCommodityId] : null;
  const maxAvailable = currentCommodityStock ? currentCommodityStock.availableStock : 0;

  // Handle Transfer Submit
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromLocationId || !toLocationId) {
      setMessage({ type: "error", text: "Please select both source and destination locations." });
      return;
    }
    if (fromLocationType === toLocationType && fromLocationId === toLocationId) {
      setMessage({ type: "error", text: "Source and destination location cannot be identical." });
      return;
    }
    if (!selectedCommodityId) {
      setMessage({ type: "error", text: "Please select a commodity to transfer." });
      return;
    }

    const transferQty = Number(quantity);
    if (!transferQty || transferQty <= 0) {
      setMessage({ type: "error", text: "Please enter a valid transfer quantity." });
      return;
    }

    if (transferQty > maxAvailable) {
      setMessage({
        type: "error",
        text: `Transfer quantity (${transferQty}) cannot exceed available stock (${maxAvailable}). Reserved stock cannot be transferred.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transferNumber: transferNumber.trim() || undefined,
          transferDate,
          fromLocationType,
          fromLocationId,
          toLocationType,
          toLocationId,
          commodityId: selectedCommodityId,
          quantity: transferQty,
          remarks: remarks.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute stock transfer.");
      }

      setMessage({
        type: "success",
        text: `Transfer ${data.transfer?.transferNumber || ""} completed successfully!`,
      });
      setShowTransferModal(false);
      setQuantity("");
      setRemarks("");
      loadMasterData();
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Transfer failed." });
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Transfers
  const filteredTransfers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return transfers.filter((t) => {
      const matchesSearch =
        !q ||
        t.transferNumber.toLowerCase().includes(q) ||
        (t.commodityName && t.commodityName.toLowerCase().includes(q)) ||
        (t.fromLocationName && t.fromLocationName.toLowerCase().includes(q)) ||
        (t.toLocationName && t.toLocationName.toLowerCase().includes(q));

      const matchesType =
        typeFilter === "ALL" ||
        `${t.fromLocationType}-${t.toLocationType}` === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [transfers, searchQuery, typeFilter]);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inventory</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Internal Movements</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
              Stock Transfer Module
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowTransferModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Stock Transfer
          </button>
        </div>
      </div>

      {/* Alert Notice */}
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

      {/* Transfer Types Summary Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Building2 className="w-4 h-4 text-blue-600" />
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xs font-bold text-slate-900 mt-2">Warehouse → Warehouse</p>
          <span className="text-[11px] text-slate-400">Inter-hub rebalancing</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Building2 className="w-4 h-4 text-blue-600" />
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <Store className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xs font-bold text-slate-900 mt-2">Warehouse → Shop</p>
          <span className="text-[11px] text-slate-400">Retail store replenishment</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Store className="w-4 h-4 text-purple-600" />
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xs font-bold text-slate-900 mt-2">Shop → Warehouse</p>
          <span className="text-[11px] text-slate-400">Shop stock consolidation</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Store className="w-4 h-4 text-purple-600" />
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <Store className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xs font-bold text-slate-900 mt-2">Shop → Shop</p>
          <span className="text-[11px] text-slate-400">Direct outlet-to-outlet transfer</span>
        </div>
      </div>

      {/* Transfer History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by transfer#, commodity, or location…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none"
            >
              <option value="ALL">All Transfer Routes</option>
              <option value="Warehouse-Warehouse">Warehouse → Warehouse</option>
              <option value="Warehouse-Shop">Warehouse → Shop</option>
              <option value="Shop-Warehouse">Shop → Warehouse</option>
              <option value="Shop-Shop">Shop → Shop</option>
            </select>

            <button
              type="button"
              onClick={loadMasterData}
              className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition cursor-pointer"
              title="Refresh Transfers"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Transfer#</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">From Location</th>
                <th className="py-3 px-4">To Location</th>
                <th className="py-3 px-4">Commodity</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading transfer history…
                  </td>
                </tr>
              ) : filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No stock transfer records found.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      {t.transferNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(t.transferDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          t.fromLocationType === "Warehouse"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        {t.fromLocationType === "Warehouse" ? "🏢" : "🏪"} {t.fromLocationName || t.fromLocationId}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          t.toLocationType === "Warehouse"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        {t.toLocationType === "Warehouse" ? "🏢" : "🏪"} {t.toLocationName || t.toLocationId}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {t.commodityName || t.commodityId}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                      {t.quantity.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        {t.status || "Completed"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                      {t.remarks || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Stock Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={handleTransferSubmit}
            className="relative flex w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-blue-700 font-bold">
                <ArrowRightLeft className="w-5 h-5" />
                <h3>Create New Stock Transfer</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Transfer Date & Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transfer Date</label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transfer Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="Auto-generated (e.g. TR-0001)"
                    value={transferNumber}
                    onChange={(e) => setTransferNumber(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Source & Destination Locations Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                {/* Source */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1">
                    From Source Location <span className="text-rose-500">*</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFromLocationType("Warehouse");
                        const wh = locations.find((l) => l.type === "Warehouse");
                        if (wh) setFromLocationId(wh.id);
                      }}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1 ${
                        fromLocationType === "Warehouse"
                          ? "bg-white border-blue-600 text-blue-700 shadow-2xs"
                          : "bg-transparent border-slate-200 text-slate-600"
                      }`}
                    >
                      🏢 Warehouse
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFromLocationType("Shop");
                        const shop = locations.find((l) => l.type === "Shop");
                        if (shop) setFromLocationId(shop.id);
                      }}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1 ${
                        fromLocationType === "Shop"
                          ? "bg-white border-purple-600 text-purple-700 shadow-2xs"
                          : "bg-transparent border-slate-200 text-slate-600"
                      }`}
                    >
                      🏪 Shop
                    </button>
                  </div>
                  <select
                    value={fromLocationId}
                    onChange={(e) => setFromLocationId(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-blue-500"
                  >
                    {locations
                      .filter((l) => l.type === fromLocationType)
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} {loc.code ? `(${loc.code})` : ""}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Destination */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                    To Destination Location <span className="text-rose-500">*</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setToLocationType("Warehouse");
                        const wh = locations.find((l) => l.type === "Warehouse" && l.id !== fromLocationId);
                        if (wh) setToLocationId(wh.id);
                      }}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1 ${
                        toLocationType === "Warehouse"
                          ? "bg-white border-blue-600 text-blue-700 shadow-2xs"
                          : "bg-transparent border-slate-200 text-slate-600"
                      }`}
                    >
                      🏢 Warehouse
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setToLocationType("Shop");
                        const shop = locations.find((l) => l.type === "Shop" && l.id !== fromLocationId);
                        if (shop) setToLocationId(shop.id);
                      }}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1 ${
                        toLocationType === "Shop"
                          ? "bg-white border-purple-600 text-purple-700 shadow-2xs"
                          : "bg-transparent border-slate-200 text-slate-600"
                      }`}
                    >
                      🏪 Shop
                    </button>
                  </div>
                  <select
                    value={toLocationId}
                    onChange={(e) => setToLocationId(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-blue-500"
                  >
                    {locations
                      .filter((l) => l.type === toLocationType && !(l.id === fromLocationId && l.type === fromLocationType))
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} {loc.code ? `(${loc.code})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Commodity & Available Stock */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Commodity <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedCommodityId}
                  onChange={(e) => setSelectedCommodityId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">Select a commodity to transfer…</option>
                  {commodities.map((c) => {
                    const st = sourceStockLevels[c.id];
                    const avail = st ? st.availableStock : 0;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.sku ? `(${c.sku})` : ""} — Available: {avail} {c.unit}
                      </option>
                    );
                  })}
                </select>

                {selectedCommodityId && currentCommodityStock && (
                  <div className="mt-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-600">
                      Source On Hand: <strong className="text-slate-900">{currentCommodityStock.onHandStock}</strong>
                    </span>
                    <span className="text-amber-700 font-semibold">
                      Reserved: {currentCommodityStock.reservedStock} (Cannot transfer)
                    </span>
                    <span className="text-emerald-800 font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                      Available to Transfer: {maxAvailable}
                    </span>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Transfer Quantity <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxAvailable}
                  required
                  placeholder={`Enter units to transfer (max ${maxAvailable})`}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks / Reason</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Stock rebalancing for peak festival season"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || maxAvailable <= 0}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition cursor-pointer"
              >
                {submitting ? "Transferring..." : "Confirm & Transfer Stock"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
