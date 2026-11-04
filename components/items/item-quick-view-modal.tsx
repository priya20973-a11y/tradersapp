"use client";

import { X } from "lucide-react";
import { formatCurrency, type ItemRecord } from "./item-types";

type ItemQuickViewModalProps = {
  item: ItemRecord;
  onClose: () => void;
};

export function ItemQuickViewModal({ item, onClose }: ItemQuickViewModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={`h-11 w-11 rounded-2xl flex items-center justify-center text-sm font-bold ${
                item.type === "service"
                  ? "bg-purple-100 text-purple-700 border border-purple-200"
                  : "bg-emerald-100 text-emerald-700 border border-emerald-200"
              }`}
            >
              {item.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-slate-500">{item.sku || "NO SKU"}</span>
                <span>·</span>
                <span className="text-xs font-semibold uppercase text-slate-600">{item.unit}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-xs text-slate-500 block">Selling Price</span>
              <span className="text-lg font-bold text-slate-900">{formatCurrency(item.salesPrice)}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Account: {item.salesAccount || "Sales"}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Cost Price</span>
              <span className="text-lg font-bold text-slate-700">{formatCurrency(item.purchasePrice)}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Account: {item.purchaseAccount || "COGS"}
              </span>
            </div>
          </div>

          {item.salesDescription && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Sales Description</label>
              <p className="text-sm text-slate-700 mt-1 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                {item.salesDescription}
              </p>
            </div>
          )}

          {item.purchaseDescription && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Purchase Description</label>
              <p className="text-sm text-slate-700 mt-1 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                {item.purchaseDescription}
              </p>
            </div>
          )}

          {item.preferredVendor && (
            <div className="flex items-center justify-between p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-slate-700">
              <span className="font-semibold text-blue-900">Preferred Vendor</span>
              <span className="font-medium text-blue-800">{item.preferredVendor}</span>
            </div>
          )}

          {item.type === "goods" && (
            <div className="flex items-center justify-between p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs">
              <span className="font-semibold text-emerald-900">Current Stock Quantity</span>
              <span className="font-bold text-emerald-800 text-sm">
                {item.stock ?? 0} {item.unit}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">ID: {item.id}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
