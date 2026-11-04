"use client";

import { Check, Copy, Eye, Package, Sparkles } from "lucide-react";
import { formatCurrency, type ItemRecord } from "./item-types";

type ItemTableViewProps = {
  items: ItemRecord[];
  copiedSku: string | null;
  onCopySku: (sku: string, e: React.MouseEvent) => void;
  onSelectItem: (item: ItemRecord) => void;
};

export function ItemTableView({
  items,
  copiedSku,
  onCopySku,
  onSelectItem,
}: ItemTableViewProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Item & Description</th>
              <th className="px-4 py-3.5">Type</th>
              <th className="px-4 py-3.5">SKU</th>
              <th className="px-4 py-3.5">Unit</th>
              <th className="px-4 py-3.5 text-right">Selling Price</th>
              <th className="px-4 py-3.5 text-right">Cost Price / Margin</th>
              <th className="px-4 py-3.5 text-center">Stock</th>
              <th className="px-4 py-3.5 text-right">Status</th>
              <th className="px-4 py-3.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {items.map((item) => {
              const sPrice = item.salesPrice || 0;
              const cPrice = item.purchasePrice || 0;
              const marginPercent =
                sPrice > 0 && cPrice > 0 ? Math.round(((sPrice - cPrice) / sPrice) * 100) : null;
              const isLow = item.type === "goods" && (item.stock || 0) < 15;

              return (
                <tr
                  key={item.id || item.sku}
                  onClick={() => onSelectItem(item)}
                  className="hover:bg-blue-50/40 cursor-pointer transition group"
                >
                  {/* Name & Description */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-xs ${
                          item.type === "service"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {item.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition block truncate">
                          {item.name}
                        </span>
                        {item.salesDescription ? (
                          <span className="text-xs text-slate-500 truncate block max-w-xs">
                            {item.salesDescription}
                          </span>
                        ) : item.preferredVendor ? (
                          <span className="text-[11px] text-slate-400 block truncate">
                            Vendor: {item.preferredVendor}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  {/* Type Badge */}
                  <td className="px-4 py-3.5">
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
                  </td>

                  {/* SKU */}
                  <td className="px-4 py-3.5">
                    {item.sku ? (
                      <div className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        <span>{item.sku}</span>
                        <button
                          type="button"
                          onClick={(e) => onCopySku(item.sku, e)}
                          title="Copy SKU"
                          className="text-slate-400 hover:text-slate-600 transition"
                        >
                          {copiedSku === item.sku ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  {/* Unit */}
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-semibold uppercase text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                      {item.unit || "PCS"}
                    </span>
                  </td>

                  {/* Selling Price */}
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-bold text-slate-900">{formatCurrency(sPrice)}</span>
                  </td>

                  {/* Cost Price & Margin */}
                  <td className="px-4 py-3.5 text-right">
                    <div className="text-xs text-slate-600 font-medium">{formatCurrency(cPrice)}</div>
                    {marginPercent !== null && (
                      <span
                        className={`text-[10px] font-semibold ${
                          marginPercent >= 20
                            ? "text-emerald-600"
                            : marginPercent > 0
                            ? "text-blue-600"
                            : "text-slate-400"
                        }`}
                      >
                        {marginPercent}% margin
                      </span>
                    )}
                  </td>

                  {/* Stock Level */}
                  <td className="px-4 py-3.5 text-center">
                    {item.type === "service" ? (
                      <span className="text-xs text-slate-400 font-medium">N/A</span>
                    ) : (
                      <div className="inline-flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            (item.stock || 0) === 0
                              ? "bg-rose-500"
                              : isLow
                              ? "bg-amber-500 animate-pulse"
                              : "bg-emerald-500"
                          }`}
                        />
                        <span className="font-semibold text-slate-900 text-xs">{item.stock ?? 0}</span>
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50/80 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3.5 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectItem(item);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-white transition"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
