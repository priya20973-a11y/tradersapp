"use client";

import { TrendingUp, UserCheck, Users, Wallet } from "lucide-react";
import { currency } from "./customer-types";

type CustomerMetricsProps = {
  totalCustomers: number;
  activeCount: number;
  businessCount: number;
  individualCount: number;
  totalReceivables: number;
  totalUnusedCredits: number;
};

export function CustomerKpiCards({
  totalCustomers,
  activeCount,
  businessCount,
  individualCount,
  totalReceivables,
  totalUnusedCredits,
}: CustomerMetricsProps) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Clients</span>
          <span className="rounded-xl bg-blue-50 p-2 text-blue-600 ring-1 ring-blue-600/10">
            <Users className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{totalCustomers}</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{businessCount}</span> B2B ·{" "}
          <span className="font-medium text-slate-700">{individualCount}</span> B2C
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Accounts</span>
          <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600 ring-1 ring-emerald-600/10">
            <UserCheck className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">{activeCount}</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span>
            {totalCustomers > 0
              ? `${Math.round((activeCount / totalCustomers) * 100)}% active rate`
              : "No clients registered"}
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Receivables (INR)</span>
          <span className="rounded-xl bg-amber-50 p-2 text-amber-600 ring-1 ring-amber-600/10">
            <TrendingUp className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl tabular-nums">
          {currency.format(totalReceivables)}
        </div>
        <div className="mt-1 text-xs text-slate-500">Outstanding balance sum</div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Unused Credits</span>
          <span className="rounded-xl bg-purple-50 p-2 text-purple-600 ring-1 ring-purple-600/10">
            <Wallet className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight text-purple-700 sm:text-2xl tabular-nums">
          {currency.format(totalUnusedCredits)}
        </div>
        <div className="mt-1 text-xs text-slate-500">Prepayments & credits</div>
      </div>
    </div>
  );
}
