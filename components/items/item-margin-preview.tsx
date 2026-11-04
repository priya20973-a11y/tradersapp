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

  return (
    <div className="p-4 bg-gradient-to-r from-emerald-50/70 to-teal-50/70 rounded-2xl border border-emerald-200/80 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
          <Percent className="h-5 w-5" />
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Gross Margin Calculation
          </span>
          <p className="text-sm font-bold text-emerald-950">
            {marginPercent}% Profit Margin · ₹{profitPerUnit.toFixed(2)} per unit
          </p>
        </div>
      </div>
      <div className="text-xs font-medium text-emerald-800 bg-white/80 border border-emerald-200 px-3 py-1.5 rounded-lg shadow-2xs">
        Selling: ₹{sellNum.toFixed(2)} | Cost: ₹{costNum.toFixed(2)}
      </div>
    </div>
  );
}
