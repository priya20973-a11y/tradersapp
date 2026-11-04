"use client";

import {
  AlertTriangle,
  Boxes,
  Package,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, type ItemRecord } from "./item-types";

type ItemKpiCardsProps = {
  items: ItemRecord[];
  onFilterChange: (filter: "all" | "goods" | "service" | "low_stock") => void;
};

export function ItemKpiCards({ items, onFilterChange }: ItemKpiCardsProps) {
  const totalItems = items.length;
  const totalGoods = items.filter((i) => i.type === "goods").length;
  const totalServices = items.filter((i) => i.type === "service").length;
  const lowStockItems = items.filter((i) => i.type === "goods" && (i.stock || 0) < 15);
  const totalInventoryValue = items.reduce(
    (acc, item) => acc + (item.stock || 0) * (item.purchasePrice || item.salesPrice || 0),
    0
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Catalog Items */}
      <div
        onClick={() => onFilterChange("all")}
        className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-blue-400 hover:shadow-md transition cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Catalog Items
          </span>
          <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
            <Boxes className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">{totalItems}</span>
          <span className="text-xs font-medium text-slate-500">units cataloged</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 font-medium">
          <span>{totalGoods} goods</span>
          <span>·</span>
          <span>{totalServices} services</span>
        </div>
      </div>

      {/* Physical Goods */}
      <div
        onClick={() => onFilterChange("goods")}
        className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-emerald-400 hover:shadow-md transition cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Physical Goods
          </span>
          <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition">
            <Package className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">{totalGoods}</span>
          <span className="text-xs font-medium text-slate-500">active commodities</span>
        </div>
        <div className="mt-2 text-xs text-emerald-600 font-medium">
          Trackable physical inventory
        </div>
      </div>

      {/* Billable Services */}
      <div
        onClick={() => onFilterChange("service")}
        className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-purple-400 hover:shadow-md transition cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Billable Services
          </span>
          <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">{totalServices}</span>
          <span className="text-xs font-medium text-slate-500">service lines</span>
        </div>
        <div className="mt-2 text-xs text-purple-600 font-medium">
          Non-inventory billable labor & transport
        </div>
      </div>

      {/* Inventory Valuation & Alerts */}
      <div
        onClick={() => lowStockItems.length > 0 && onFilterChange("low_stock")}
        className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-amber-400 hover:shadow-md transition cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Asset Valuation
          </span>
          <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xl font-bold text-slate-900 tracking-tight">
            {formatCurrency(totalInventoryValue)}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          {lowStockItems.length > 0 ? (
            <span className="text-amber-600 font-semibold flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {lowStockItems.length} low stock alerts
            </span>
          ) : (
            <span className="text-emerald-600 font-medium">Healthy inventory status</span>
          )}
        </div>
      </div>
    </div>
  );
}
