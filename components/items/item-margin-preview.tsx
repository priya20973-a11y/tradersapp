"use client";

import { Percent } from "lucide-react";

type ItemMarginPreviewProps = {
  sellNum: number;
  costNum: number;
  profitPerUnit: number;
  marginPercent: number | null;
};

export function ItemMarginPreview({
  sellNum,
  costNum,
  profitPerUnit,
  marginPercent,
}: ItemMarginPreviewProps) {
  if (sellNum <= 0 || costNum <= 0) return null;

  const isNegative = marginPercent !== null && marginPercent < 0;

  return (
    <div
      className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 transition ${
        isNegative
          ? "bg-gradient-to-r from-rose-50/70 to-red-50/70 border-rose-200/80"
          : "bg-gradient-to-r from-emerald-50/70 to-teal-50/70 border-emerald-200/80"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-xl text-white flex items-center justify-center font-bold ${
            isNegative ? "bg-rose-500" : "bg-emerald-600"
          }`}
        >
          <Percent className="h-5 w-5" />
        </div>
        <div>
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              isNegative ? "text-rose-800" : "text-emerald-800"
            }`}
          >
            Gross Margin Calculation
          </span>
          <p
            className={`text-sm font-bold ${
              isNegative ? "text-red-500" : "text-emerald-950"
            }`}
          >
            {marginPercent}% Profit Margin · ₹{profitPerUnit.toFixed(2)} per unit
          </p>
        </div>
      </div>
      <div
        className={`text-xs font-medium px-3 py-1.5 rounded-lg shadow-2xs ${
          isNegative
            ? "text-rose-800 bg-white/80 border border-rose-200"
            : "text-emerald-800 bg-white/80 border border-emerald-200"
        }`}
      >
        Selling: ₹{sellNum.toFixed(2)} | Cost: ₹{costNum.toFixed(2)}
      </div>
    </div>
  );
}
