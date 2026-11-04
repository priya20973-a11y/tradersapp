"use client";

import { AlertCircle, CheckCircle2, Clock, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/invoice-utils";
import { type InvoiceKpiStats } from "./invoice-types";

interface InvoiceKpiCardsProps {
  stats: InvoiceKpiStats;
  currency?: string;
  onFilterClick?: (status: string) => void;
}

export function InvoiceKpiCards({
  stats,
  currency = "INR",
  onFilterClick,
}: InvoiceKpiCardsProps) {
  const collectionRate =
    stats.totalInvoiced > 0
      ? Math.round((stats.totalPaid / stats.totalInvoiced) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Invoiced */}
      <div
        onClick={() => onFilterClick && onFilterClick("all")}
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-md active:scale-99"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Invoiced
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
            <FileText className="h-4.5 w-4.5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold tracking-tight text-slate-900">
            {formatCurrency(stats.totalInvoiced, currency)}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              {stats.counts.total}
            </span>{" "}
            total invoices
          </div>
        </div>
      </div>

      {/* 2. Received / Paid */}
      <div
        onClick={() => onFilterClick && onFilterClick("paid")}
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-md active:scale-99"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Received
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold tracking-tight text-emerald-600">
            {formatCurrency(stats.totalPaid, currency)}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {collectionRate}% collected
            </span>
            <span>• {stats.counts.paid} paid</span>
          </div>
        </div>
      </div>

      {/* 3. Outstanding Balance */}
      <div
        onClick={() => onFilterClick && onFilterClick("partially paid")}
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-md active:scale-99"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Outstanding
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-amber-600 group-hover:text-white">
            <Clock className="h-4.5 w-4.5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold tracking-tight text-amber-600">
            {formatCurrency(stats.totalOutstanding, currency)}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              {stats.counts.sent + stats.counts.partlyPaid}
            </span>{" "}
            awaiting payment
          </div>
        </div>
      </div>

      {/* 4. Overdue Invoices */}
      <div
        onClick={() => onFilterClick && onFilterClick("overdue")}
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-md active:scale-99"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Overdue
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition group-hover:bg-rose-600 group-hover:text-white">
            <AlertCircle className="h-4.5 w-4.5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold tracking-tight text-rose-600">
            {formatCurrency(stats.totalOverdue, currency)}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
              {stats.counts.overdue} overdue
            </span>
            <span>invoices</span>
          </div>
        </div>
      </div>
    </div>
  );
}
