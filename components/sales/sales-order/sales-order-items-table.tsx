"use client";

import {
  Calculator,
  ChevronDown,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { type ItemOption, type OrderItemRow } from "./sales-order-types";

interface SalesOrderItemsTableProps {
  rows: OrderItemRow[];
  availableItems: ItemOption[];
  showBulkActionsMenu: boolean;
  setShowBulkActionsMenu: React.Dispatch<React.SetStateAction<boolean>>;
  handleSelectItem: (rowId: string, itemId: string) => void;
  updateRow: (rowId: string, updates: Partial<OrderItemRow>) => void;
  removeRow: (rowId: string) => void;
  addRow: () => void;
  onOpenBulkAddModal: () => void;
  onApplyBulkDiscount: () => void;
  onClearTable: () => void;
}

export function SalesOrderItemsTable({
  rows,
  availableItems,
  showBulkActionsMenu,
  setShowBulkActionsMenu,
  handleSelectItem,
  updateRow,
  removeRow,
  addRow,
  onOpenBulkAddModal,
  onApplyBulkDiscount,
  onClearTable,
}: SalesOrderItemsTableProps) {
  return (
    <div className="space-y-3.5 pt-6 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Order Line Items</h2>
          <p className="text-xs text-slate-500">Configure commodities, stock lots, units, and rates.</p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBulkActionsMenu((prev) => !prev)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/70 hover:bg-blue-100/60 px-3 py-1.5 rounded-xl border border-blue-200/80 flex items-center gap-1.5 transition cursor-pointer"
          >
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
              ✓
            </span>
            Bulk Actions
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showBulkActionsMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-20 py-1.5 text-xs text-slate-700 animate-in fade-in zoom-in-95">
              <button
                type="button"
                onClick={() => {
                  onOpenBulkAddModal();
                  setShowBulkActionsMenu(false);
                }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
              >
                <Plus className="w-4 h-4 text-blue-600" />
                Add Multiple Items
              </button>
              <button
                type="button"
                onClick={() => {
                  onApplyBulkDiscount();
                  setShowBulkActionsMenu(false);
                }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                Apply 5% Bulk Discount
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearTable();
                  setShowBulkActionsMenu(false);
                }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-red-50 text-red-600 flex items-center gap-2 font-medium cursor-pointer border-t border-slate-100"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
                Clear Table
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-8 px-3 py-3.5 text-center"></th>
                <th className="px-4 py-3.5 font-semibold">Item Details</th>
                <th className="w-32 px-4 py-3.5 text-right font-semibold">Quantity</th>
                <th className="w-36 px-4 py-3.5 text-right font-semibold">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Rate ( ₹ )
                    <Calculator className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                </th>
                <th className="w-36 px-4 py-3.5 text-right font-semibold">Amount ( ₹ )</th>
                <th className="w-10 px-3 py-3.5 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-3 py-3.5 text-center text-slate-300 hover:text-slate-500 cursor-grab">
                    <GripVertical className="w-4 h-4 mx-auto" />
                  </td>
                  <td className="px-4 py-3.5 space-y-2">
                    <div className="relative">
                      <select
                        value={row.itemId || ""}
                        onChange={(e) => handleSelectItem(row.id, e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white text-slate-900 transition cursor-pointer"
                      >
                        <option value="">Type or select an inventory commodity / item...</option>
                        {availableItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      rows={1}
                      value={row.description}
                      onChange={(e) => updateRow(row.id, { description: e.target.value })}
                      placeholder="Add an optional specification or notes to this item..."
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-slate-50/70 text-slate-700 resize-none transition"
                    />
                  </td>
                  <td className="px-4 py-3.5 text-right align-top">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={row.quantity}
                      onChange={(e) =>
                        updateRow(row.id, {
                          quantity: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 text-sm text-right border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white text-slate-900 transition tabular-nums"
                    />
                  </td>
                  <td className="px-4 py-3.5 text-right align-top">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={row.rate}
                      onChange={(e) =>
                        updateRow(row.id, {
                          rate: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 text-sm text-right border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white text-slate-900 transition tabular-nums"
                    />
                  </td>
                  <td className="px-4 py-3.5 text-right align-top pt-5">
                    <span className="font-bold text-slate-900 text-sm tabular-nums">
                      {row.amount.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-center align-top pt-4">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        title="Remove Line Item"
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 rounded-xl shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Another Item
          </button>
          <span className="text-xs text-slate-400">
            {rows.length} line item{rows.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
