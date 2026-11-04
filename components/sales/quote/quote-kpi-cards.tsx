"use client";

import { CheckCircle2, Clock, FileText, TrendingUp } from "lucide-react";
import { currency, type QuoteDocument } from "./quote-types";

interface QuoteKpiCardsProps {
  quotes: QuoteDocument[];
}

export function QuoteKpiCards({ quotes }: QuoteKpiCardsProps) {
  const totalQuotes = quotes.length;
  const draftQuotes = quotes.filter((q) => q.status === "Draft");
  const sentQuotes = quotes.filter((q) => q.status === "Sent");
  const acceptedQuotes = quotes.filter((q) => q.status === "Accepted" || q.status === "Converted");

  const totalPipelineValue = quotes.reduce((acc, q) => acc + (q.total || 0), 0);
  const acceptedValue = acceptedQuotes.reduce((acc, q) => acc + (q.total || 0), 0);

  const winRate =
    totalQuotes > 0 ? Math.round((acceptedQuotes.length / totalQuotes) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {/* Total Pipeline Card */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-blue-400 hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pipeline Value
          </span>
          <span className="rounded-xl bg-blue-50 p-2 text-blue-600 ring-1 ring-blue-600/10">
            <TrendingUp className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl tabular-nums">
          {currency.format(totalPipelineValue)}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{totalQuotes}</span> total quotes created
        </div>
      </div>

      {/* Won / Accepted */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-emerald-400 hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Accepted / Won
          </span>
          <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600 ring-1 ring-emerald-600/10">
            <CheckCircle2 className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight text-emerald-600 sm:text-2xl tabular-nums">
          {currency.format(acceptedValue)}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-medium text-slate-700">{acceptedQuotes.length} quotes</span> ·{" "}
          <span className="font-semibold text-emerald-600">{winRate}% conversion</span>
        </div>
      </div>

      {/* Sent / Pending Response */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-sky-400 hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Awaiting Client
          </span>
          <span className="rounded-xl bg-sky-50 p-2 text-sky-600 ring-1 ring-sky-600/10">
            <Clock className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-sky-600 sm:text-3xl">
          {sentQuotes.length}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Actively delivered proposals
        </div>
      </div>

      {/* Drafts */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-amber-400 hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Draft Estimates
          </span>
          <span className="rounded-xl bg-amber-50 p-2 text-amber-600 ring-1 ring-amber-600/10">
            <FileText className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {draftQuotes.length}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Pending review or submission
        </div>
      </div>
    </div>
  );
}
