"use client";

import { CheckCircle2, Clock, ShoppingCart, TrendingUp, Truck } from "lucide-react";
import { currency, type SalesOrderDocument } from "./sales-order-types";

interface SalesOrderKpiCardsProps {
  orders: SalesOrderDocument[];
}

export function SalesOrderKpiCards({ orders }: SalesOrderKpiCardsProps) {
  const totalOrders = orders.length;
  const draftOrders = orders.filter((o) => (o.status || "").toLowerCase() === "draft");
  const confirmedOrders = orders.filter((o) => (o.status || "").toLowerCase() === "confirmed");
  const fulfilledOrders = orders.filter((o) => (o.status || "").toLowerCase() === "fulfilled");
  const invoicedOrders = orders.filter((o) => (o.status || "").toLowerCase() === "invoiced");

  const totalOrderValue = orders.reduce((acc, o) => acc + (o.total || 0), 0);
  const confirmedValue = confirmedOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  const completedValue = [...fulfilledOrders, ...invoicedOrders].reduce(
    (acc, o) => acc + (o.total || 0),
    0
  );

  const fulfillmentRate =
    totalOrders > 0
      ? Math.round(((fulfilledOrders.length + invoicedOrders.length) / totalOrders) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {/* Total Order Volume Card */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-blue-400 hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Order Volume
          </span>
          <span className="rounded-xl bg-blue-50 p-2 text-blue-600 ring-1 ring-blue-600/10">
            <TrendingUp className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl tabular-nums">
          {currency.format(totalOrderValue)}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{totalOrders}</span> total orders logged
        </div>
      </div>

      {/* Confirmed Orders (Ready for fulfillment) */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-blue-400 hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Confirmed Orders
          </span>
          <span className="rounded-xl bg-blue-50 p-2 text-blue-600 ring-1 ring-blue-600/10">
            <CheckCircle2 className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight text-blue-600 sm:text-2xl tabular-nums">
          {currency.format(confirmedValue)}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          <span className="font-medium text-slate-700">{confirmedOrders.length} orders</span> ·{" "}
          <span className="font-medium text-slate-500">Ready to dispatch</span>
        </div>
      </div>

      {/* Fulfilled & Invoiced */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-emerald-400 hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Fulfilled / Billed
          </span>
          <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600 ring-1 ring-emerald-600/10">
            <Truck className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight text-emerald-600 sm:text-2xl tabular-nums">
          {currency.format(completedValue)}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-medium text-slate-700">
            {fulfilledOrders.length + invoicedOrders.length} closed
          </span>{" "}
          · <span className="font-semibold text-emerald-600">{fulfillmentRate}% fulfilled</span>
        </div>
      </div>

      {/* Draft Orders */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-amber-400 hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Draft Pipeline
          </span>
          <span className="rounded-xl bg-amber-50 p-2 text-amber-600 ring-1 ring-amber-600/10">
            <Clock className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {draftOrders.length}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Awaiting confirmation or review
        </div>
      </div>
    </div>
  );
}
