"use client";

import { Calculator, ChevronDown, Plus, Trash2 } from "lucide-react";
import { type ItemOption, type QuoteItemRow } from "./quote-types";

type QuoteItemsTableProps = {
  rows: QuoteItemRow[];
  availableItems: ItemOption[];
  onSelectItem: (rowId: string, itemId: string) => void;
  onUpdateRow: (rowId: string, updates: Partial<QuoteItemRow>) => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
};

export function QuoteItemsTable({
  rows,
  availableItems,
  onSelectItem,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
}: QuoteItemsTableProps) {
  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Item Table</h3>
        <button
          type="button"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <span className="w-4 h-4 rounded-full border border-blue-600 flex items-center justify-center text-[10px]">
            ✓
          </span>
          Bulk Actions
        </button>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">ITEM DETAILS</th>
              <th className="w-32 px-4 py-3 text-right font-semibold">QUANTITY</th>
              <th className="w-36 px-4 py-3 text-right font-semibold">
                <span className="inline-flex items-center gap-1">
                  RATE
                  <Calculator className="w-3.5 h-3.5 text-slate-400" />
                </span>
              </th>
              <th className="w-32 px-4 py-3 text-right font-semibold">AMOUNT</th>
              <th className="w-10 px-2 py-3 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 space-y-2">
                  <div className="relative">
                    <select
                      value={row.itemId || ""}
                      onChange={(e) => onSelectItem(row.id, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
                    >
                      <option value="">Type or click to select an item.</option>
                      {availableItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} {item.salesPrice ? `— ₹${item.salesPrice}` : ""}{" "}
                          {item.unit ? `(${item.unit})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={1}
                    value={row.description}
                    onChange={(e) => onUpdateRow(row.id, { description: e.target.value })}
                    placeholder="Add a description to this item..."
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50 text-slate-600 resize-none"
                  />
                </td>
                <td className="px-4 py-3 text-right align-top">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={row.quantity}
                    onChange={(e) => onUpdateRow(row.id, { quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 text-sm text-right border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3 text-right align-top">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={row.rate}
                    onChange={(e) => onUpdateRow(row.id, { rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 text-sm text-right border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900 align-top pt-4">
                  {row.amount.toFixed(2)}
                </td>
                <td className="px-2 py-3 text-center align-top pt-3">
                  <button
                    type="button"
                    onClick={() => onRemoveRow(row.id)}
                    className="text-slate-400 hover:text-red-500 p-1 transition"
                    title="Delete line item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <div className="inline-flex rounded-md shadow-sm">
          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-l-md border border-blue-200 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Row
          </button>
          <button
            type="button"
            onClick={onAddRow}
            className="px-2 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-r-md border-y border-r border-blue-200 transition"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Items in Bulk
        </button>
      </div>
    </div>
  );
}
