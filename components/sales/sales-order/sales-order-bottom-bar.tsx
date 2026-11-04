"use client";

import { Check, ChevronDown, Plus, Printer } from "lucide-react";

interface SalesOrderBottomBarProps {
  loading: boolean;
  handleSave: (status: "Draft" | "Confirmed" | "Print" | "CreateNew") => Promise<void>;
  handleCancel: () => void;
  showSaveSplitMenu: boolean;
  setShowSaveSplitMenu: React.Dispatch<React.SetStateAction<boolean>>;
  total: number;
  totalQuantity: number;
}

export function SalesOrderBottomBar({
  loading,
  handleSave,
  handleCancel,
  showSaveSplitMenu,
  setShowSaveSplitMenu,
  total,
  totalQuantity,
}: SalesOrderBottomBarProps) {
  return (
    <div className="fixed bottom-0 left-0 lg:left-72 right-0 z-30 bg-white/90 backdrop-blur-md border-t border-slate-200/90 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <button
          type="button"
          disabled={loading}
          onClick={() => handleSave("Draft")}
          className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-xl shadow-2xs transition cursor-pointer active:scale-98"
        >
          Save as Draft
        </button>

        <div className="relative inline-flex rounded-xl shadow-xs">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave("Confirmed")}
            className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-l-xl transition cursor-pointer active:scale-98"
          >
            {loading ? "Saving Order..." : "Save and Confirm"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setShowSaveSplitMenu((prev) => !prev)}
            className="px-2.5 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-r-xl border-l border-blue-500 transition cursor-pointer"
            aria-label="More save options"
          >
            <ChevronDown className="w-4 h-4" />
          </button>

          {showSaveSplitMenu && (
            <div className="absolute left-0 bottom-full mb-2 w-52 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 py-1.5 text-xs text-slate-700 animate-in fade-in zoom-in-95">
              <button
                type="button"
                onClick={() => {
                  setShowSaveSplitMenu(false);
                  handleSave("Confirmed");
                }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-600" />
                Save and Confirm
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveSplitMenu(false);
                  handleSave("Print");
                }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                Save and Print
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveSplitMenu(false);
                  handleSave("CreateNew");
                }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer border-t border-slate-100"
              >
                <Plus className="w-4 h-4 text-blue-600" />
                Save and Create Another
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs font-medium text-slate-600 bg-slate-100/70 px-3.5 py-1.5 rounded-xl border border-slate-200/60">
        <span>
          Total Amount:{" "}
          <strong className="text-slate-900 font-bold tabular-nums">₹ {total.toFixed(2)}</strong>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Quantity:{" "}
          <strong className="text-slate-900 font-bold tabular-nums">
            {totalQuantity.toFixed(0)}
          </strong>
        </span>
      </div>
    </div>
  );
}
