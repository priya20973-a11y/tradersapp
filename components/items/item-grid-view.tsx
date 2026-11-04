"use client";

import { ChevronRight, Package, Sparkles } from "lucide-react";
import { formatCurrency, type ItemRecord } from "./item-types";

type ItemGridViewProps = {
  items: ItemRecord[];
  onSelectItem: (item: ItemRecord) => void;
};

export function ItemGridView({ items, onSelectItem }: ItemGridViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => {
        const sPrice = item.salesPrice || 0;
        const cPrice = item.purchasePrice || 0;
        const marginPercent =
          sPrice > 0 && cPrice > 0 ? Math.round(((sPrice - cPrice) / sPrice) * 100) : null;
        const isLow = item.type === "goods" && (item.stock || 0) < 15;

        return (
          <div
            key={item.id || item.sku}
            onClick={() => onSelectItem(item)}
            className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md hover:border-blue-300 transition cursor-pointer flex flex-col justify-between group"
          >
            <div>
              {/* Card Header */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                    item.type === "service"
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {item.type === "service" ? (
                    <Sparkles className="h-3 w-3" />
                  ) : (
                    <Package className="h-3 w-3" />
                  )}
                  {item.type}
                </span>

                <span className="text-[11px] font-semibold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {item.unit || "PCS"}
                </span>
              </div>

              {/* Title & SKU */}
              <div className="mt-3">
                <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition text-base line-clamp-1">
                  {item.name}
                </h3>
                {item.sku && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                    <span>SKU: {item.sku}</span>
                  </div>
                )}
                {item.salesDescription && (
                  <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">
                    {item.salesDescription}
                  </p>
                )}
              </div>

              {/* Pricing Matrix */}
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200/70 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Selling Price
                  </span>
                  <span className="text-sm font-bold text-slate-900">{formatCurrency(sPrice)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Cost Price
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    {formatCurrency(cPrice)}
                  </span>
                  {marginPercent !== null && (
                    <span className="block text-[10px] font-bold text-emerald-600">
                      {marginPercent}% margin
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              {item.type === "service" ? (
                <span className="text-xs text-slate-400 italic">Billable service rate</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      (item.stock || 0) === 0
                        ? "bg-rose-500"
                        : isLow
                        ? "bg-amber-500 animate-pulse"
                        : "bg-emerald-500"
                    }`}
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    {item.stock ?? 0} {item.unit || "units"} in stock
                  </span>
                </div>
              )}

              <span className="text-xs font-semibold text-blue-600 group-hover:underline flex items-center gap-0.5">
                Details
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
