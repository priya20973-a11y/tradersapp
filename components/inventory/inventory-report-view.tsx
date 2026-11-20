"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  Download,
  FileSpreadsheet,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Store,
  X,
} from "lucide-react";

interface LocationInfo {
  id: string;
  name: string;
  code?: string;
  type?: string;
}

interface CommodityLocationStock {
  onHandStock: number;
  reservedStock: number;
  availableStock: number;
  damagedStock: number;
}

interface ConsolidatedRow {
  commodityId: string;
  commodityName: string;
  sku?: string;
  unit?: string;
  warehouses: Record<string, CommodityLocationStock>;
  shops: Record<string, CommodityLocationStock>;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  totalDamaged: number;
  totalStockValue: number;
}

export function InventoryReportView() {
  const [warehouses, setWarehouses] = useState<LocationInfo[]>([]);
  const [shops, setShops] = useState<LocationInfo[]>([]);
  const [rows, setRows] = useState<ConsolidatedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/reports");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate inventory report.");
      }
      const data = await res.json();
      setWarehouses(data.warehouses || []);
      setShops(data.shops || []);

      const rawRows = (data.rows || data.reportRows || []) as Array<Record<string, unknown>>;
      const normalizedRows: ConsolidatedRow[] = rawRows.map((r) => ({
        commodityId: String(r.commodityId || r._id || ""),
        commodityName: String(r.commodityName || r.name || "Commodity"),
        sku: String(r.sku || r.commoditySku || ""),
        unit: String(r.unit || "unit"),
        warehouses: (r.warehouses || r.warehouseStocks || {}) as Record<string, CommodityLocationStock>,
        shops: (r.shops || r.shopStocks || {}) as Record<string, CommodityLocationStock>,
        totalOnHand: Number(r.totalOnHand || 0),
        totalReserved: Number(r.totalReserved || 0),
        totalAvailable: Number(r.totalAvailable || 0),
        totalDamaged: Number(r.totalDamaged || 0),
        totalStockValue: Number(r.totalStockValue || r.totalValue || 0),
      }));

      setRows(normalizedRows);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate inventory report.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => fetchReport());
  }, []);

  // Filtered Rows
  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.commodityName.toLowerCase().includes(q) ||
        (r.sku && r.sku.toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  // Overall Grand Totals
  const grandTotals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        onHand: acc.onHand + r.totalOnHand,
        reserved: acc.reserved + r.totalReserved,
        available: acc.available + r.totalAvailable,
        damaged: acc.damaged + r.totalDamaged,
        value: acc.value + r.totalStockValue,
      }),
      { onHand: 0, reserved: 0, available: 0, damaged: 0, value: 0 }
    );
  }, [rows]);

  // Export to CSV
  const handleExportCSV = () => {
    if (rows.length === 0) return;

    const headers = [
      "Commodity",
      "SKU",
      "Unit",
      ...warehouses.map((w) => `WH: ${w.name} (On Hand)`),
      ...warehouses.map((w) => `WH: ${w.name} (Avail)`),
      ...shops.map((s) => `Shop: ${s.name} (On Hand)`),
      ...shops.map((s) => `Shop: ${s.name} (Avail)`),
      "Total On Hand",
      "Total Reserved",
      "Total Available",
      "Total Damaged",
      "Total Stock Value (INR)",
    ];

    const csvRows = [headers.join(",")];

    for (const r of filteredRows) {
      const rowData = [
        `"${r.commodityName.replace(/"/g, '""')}"`,
        `"${(r.sku || "").replace(/"/g, '""')}"`,
        `"${(r.unit || "unit").replace(/"/g, '""')}"`,
        ...warehouses.map((w) => {
          const st = r.warehouses[w.id];
          return st ? (st.onHandStock ?? (st as unknown as { onHand?: number }).onHand ?? 0) : 0;
        }),
        ...warehouses.map((w) => {
          const st = r.warehouses[w.id];
          return st ? (st.availableStock ?? (st as unknown as { available?: number }).available ?? 0) : 0;
        }),
        ...shops.map((s) => {
          const st = r.shops[s.id];
          return st ? (st.onHandStock ?? (st as unknown as { onHand?: number }).onHand ?? 0) : 0;
        }),
        ...shops.map((s) => {
          const st = r.shops[s.id];
          return st ? (st.availableStock ?? (st as unknown as { available?: number }).available ?? 0) : 0;
        }),
        r.totalOnHand,
        r.totalReserved,
        r.totalAvailable,
        r.totalDamaged,
        r.totalStockValue.toFixed(2),
      ];
      csvRows.push(rowData.join(","));
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inventory</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">All Locations</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
              Consolidated Inventory Report
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Print
          </button>

          <button
            type="button"
            onClick={fetchReport}
            className="p-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition cursor-pointer"
            title="Refresh Report"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grand Totals KPI Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total On Hand</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {grandTotals.onHand.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] text-slate-400">All Warehouses & Shops</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Total Reserved</p>
          <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">
            {grandTotals.reserved.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] text-amber-500">Sales Orders committed</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Total Available</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {grandTotals.available.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] text-emerald-600">Free sellable stock</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Total Damaged</p>
          <p className="text-2xl font-bold text-rose-700 mt-1 tabular-nums">
            {grandTotals.damaged.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] text-rose-500">Recorded write-offs</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs col-span-2 sm:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Total Valuation</p>
          <p className="text-2xl font-bold text-blue-700 mt-1 tabular-nums">
            ₹{grandTotals.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Consolidated stock worth</span>
        </div>
      </div>

      {/* Main Consolidated Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Search Bar */}
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

          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredRows.length} Commodities across {warehouses.length} Warehouses & {shops.length} Shops
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {/* Grouping Header */}
              <tr className="bg-slate-100/80 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="py-2.5 px-4" colSpan={1}>Commodity Info</th>
                {warehouses.length > 0 && (
                  <th
                    className="py-2.5 px-4 text-center bg-blue-50/70 text-blue-800 border-x border-blue-200"
                    colSpan={warehouses.length}
                  >
                    🏢 Warehouse Stock (Available / On Hand)
                  </th>
                )}
                {shops.length > 0 && (
                  <th
                    className="py-2.5 px-4 text-center bg-purple-50/70 text-purple-800 border-r border-purple-200"
                    colSpan={shops.length}
                  >
                    🏪 Shop Stock (Available / On Hand)
                  </th>
                )}
                <th
                  className="py-2.5 px-4 text-center bg-slate-200/70 text-slate-900 border-l border-slate-300"
                  colSpan={5}
                >
                  📊 Consolidated Totals
                </th>
              </tr>

              {/* Sub-Header Columns */}
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200">
                <th className="py-2.5 px-4">Commodity</th>
                {warehouses.map((w) => (
                  <th key={w.id} className="py-2.5 px-3 text-right bg-blue-50/30">
                    {w.name}
                  </th>
                ))}
                {shops.map((s) => (
                  <th key={s.id} className="py-2.5 px-3 text-right bg-purple-50/30">
                    {s.name}
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right bg-slate-100 text-slate-800 font-bold border-l border-slate-200">
                  Total On Hand
                </th>
                <th className="py-2.5 px-3 text-right bg-slate-100 text-amber-700 font-bold">
                  Total Reserved
                </th>
                <th className="py-2.5 px-3 text-right bg-slate-100 text-emerald-700 font-bold">
                  Total Available
                </th>
                <th className="py-2.5 px-3 text-right bg-slate-100 text-rose-700 font-bold">
                  Total Damaged
                </th>
                <th className="py-2.5 px-4 text-right bg-slate-100 text-blue-700 font-bold">
                  Total Value (₹)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={1 + warehouses.length + shops.length + 5}
                    className="py-12 text-center text-slate-400"
                  >
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Generating consolidated inventory report…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={1 + warehouses.length + shops.length + 5}
                    className="py-12 text-center text-slate-400"
                  >
                    {searchQuery
                      ? "No matching commodities found."
                      : "No commodity records found in inventory."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.commodityId} className="hover:bg-slate-50/50 transition">
                    {/* Commodity */}
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      <div>{r.commodityName}</div>
                      <div className="text-[10px] font-normal text-slate-400">
                        {r.sku ? `SKU: ${r.sku} • ` : ""}Unit: {r.unit || "unit"}
                      </div>
                    </td>

                    {/* Warehouse columns */}
                    {warehouses.map((w) => {
                      const st = r.warehouses[w.id];
                      const onHand = st ? (st.onHandStock ?? (st as unknown as { onHand?: number }).onHand ?? 0) : 0;
                      const available = st ? (st.availableStock ?? (st as unknown as { available?: number }).available ?? 0) : 0;
                      return (
                        <td key={w.id} className="py-3 px-3 text-right tabular-nums bg-blue-50/10">
                          {st ? (
                            <div>
                              <span className="font-bold text-emerald-700">{available}</span>
                              <span className="text-slate-400 text-[10px]"> / {onHand}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Shop columns */}
                    {shops.map((s) => {
                      const st = r.shops[s.id];
                      const onHand = st ? (st.onHandStock ?? (st as unknown as { onHand?: number }).onHand ?? 0) : 0;
                      const available = st ? (st.availableStock ?? (st as unknown as { available?: number }).available ?? 0) : 0;
                      return (
                        <td key={s.id} className="py-3 px-3 text-right tabular-nums bg-purple-50/10">
                          {st ? (
                            <div>
                              <span className="font-bold text-emerald-700">{available}</span>
                              <span className="text-slate-400 text-[10px]"> / {onHand}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Consolidated Totals */}
                    <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums bg-slate-50/80 border-l border-slate-200">
                      {r.totalOnHand.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-amber-700 tabular-nums bg-slate-50/80">
                      {r.totalReserved.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-700 tabular-nums bg-slate-50/80">
                      {r.totalAvailable.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-rose-700 tabular-nums bg-slate-50/80">
                      {r.totalDamaged.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-blue-700 tabular-nums bg-slate-50/80">
                      ₹{r.totalStockValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Grand Total Footer */}
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 text-xs">
                  <td className="py-3 px-4" colSpan={1 + warehouses.length + shops.length}>
                    Grand Total
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums border-l border-slate-300">
                    {grandTotals.onHand.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-amber-700">
                    {grandTotals.reserved.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-emerald-700">
                    {grandTotals.available.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-rose-700">
                    {grandTotals.damaged.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-blue-700">
                    ₹{grandTotals.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
