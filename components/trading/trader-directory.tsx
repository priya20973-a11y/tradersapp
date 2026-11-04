"use client";

import Link from "next/link";
import { Store, Sparkles, Clock, ArrowRight, ShieldCheck, Users, TrendingUp } from "lucide-react";

/**
 * TraderDirectory
 *
 * Displays a clean, centered "Coming Soon" message for the Marketplace -> Trader module
 * with responsive styling and quick navigation to active Marketplace modules.
 */
export function TraderDirectory() {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] w-full items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xl shadow-slate-900/5 sm:p-12 transition-all">
        {/* Subtle decorative background glow */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-teal-100/60 blur-3xl" />

        {/* Pill Badge */}
        <div className="relative mb-6 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800 shadow-sm backdrop-blur-sm">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
          <span>Marketplace · Trader</span>
        </div>

        {/* Central Icon */}
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-100 bg-gradient-to-tr from-emerald-500/10 via-teal-500/10 to-emerald-500/20 text-emerald-600 shadow-inner">
          <Store className="h-10 w-10 text-emerald-600" />
          <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-amber-400 shadow-md">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
          </div>
        </div>

        {/* Main Heading */}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Coming Soon
        </h1>

        {/* Description */}
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
          The <span className="font-semibold text-slate-800">Trader Directory</span> module is currently under development. Soon you will be able to connect with verified agricultural traders, manage commercial KYC, and streamline commodity transactions in one place.
        </p>

        {/* Feature Highlights Preview */}
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:border-slate-200">
            <ShieldCheck className="h-5 w-5 text-emerald-600 mb-1.5" />
            <span className="text-xs font-semibold text-slate-800">Verified KYC</span>
            <span className="text-[11px] text-slate-500">Commercial compliance</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:border-slate-200">
            <Users className="h-5 w-5 text-blue-600 mb-1.5" />
            <span className="text-xs font-semibold text-slate-800">Trader Network</span>
            <span className="text-[11px] text-slate-500">Direct connections</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:border-slate-200">
            <TrendingUp className="h-5 w-5 text-indigo-600 mb-1.5" />
            <span className="text-xs font-semibold text-slate-800">Trade Analytics</span>
            <span className="text-[11px] text-slate-500">Limits & ledgers</span>
          </div>
        </div>

        {/* Quick Navigation to other Marketplace modules */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 pt-6 border-t border-slate-100 sm:flex-row">
          <Link
            href="/marketplace/find-buyers"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            <span>Explore Find Buyers</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/marketplace/buying-requests"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span>View Buying Requests</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
