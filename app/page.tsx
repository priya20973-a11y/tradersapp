"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, CircleDollarSign, Download, PackageCheck, ReceiptText, TrendingUp } from "lucide-react";
import { ageingData, dashboardMetrics, recentTransactions, salesTrend, seedDemoData } from "@/lib/demo-data";

const pieColors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

export default function HomePage() {
  const [loaded, setLoaded] = useState(false);

  const handleSeed = async () => {
    try {
      await fetch("/api/seed-demo", { method: "POST" });
      setLoaded(true);
    } catch {
      setLoaded(false);
    }
  };

  const selectedData = seedDemoData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Overview</p>
          <h2 className="text-3xl font-semibold text-slate-900">Financial dashboard</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSeed}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          >
            {loaded ? "Demo seed loaded" : "Load demo data"}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardMetrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{metric.label}</p>
              <div
                className={`rounded-lg p-2 ${
                  metric.accent === "emerald"
                    ? "bg-emerald-50 text-emerald-600"
                    : metric.accent === "blue"
                      ? "bg-blue-50 text-blue-600"
                      : metric.accent === "amber"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-rose-50 text-rose-600"
                }`}
              >
                {metric.accent === "rose" ? <ReceiptText className="h-4 w-4" /> : <CircleDollarSign className="h-4 w-4" />}
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <h3 className="text-2xl font-semibold text-slate-900">{metric.value}</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.7fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Income vs expenses</h3>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Monthly</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Bar dataKey="sales" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" fill="#94a3b8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Receivables ageing</h3>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ageingData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={84} paddingAngle={2}>
                  {ageingData.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            {ageingData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                  {item.name}
                </div>
                <span className="font-medium text-slate-800">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent transactions</h3>
            <span className="text-sm text-slate-500">Last 7 days</span>
          </div>
          <div className="space-y-3">
            {recentTransactions.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{item.party}</p>
                  <p className="text-xs text-slate-500">
                    {item.type} · {item.date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-800">{item.amount}</p>
                  <p className="text-xs text-emerald-600">{item.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Quick actions</h3>
            <PackageCheck className="h-4 w-4 text-slate-500" />
          </div>
          <div className="space-y-3 text-sm text-slate-700">
            <button className="w-full rounded-xl bg-slate-900 px-3 py-2 text-left font-medium text-white">Create invoice</button>
            <button className="w-full rounded-xl bg-emerald-50 px-3 py-2 text-left font-medium text-emerald-700">Record payment</button>
            <button className="w-full rounded-xl bg-blue-50 px-3 py-2 text-left font-medium text-blue-700">Add vendor bill</button>
            <button className="w-full rounded-xl bg-amber-50 px-3 py-2 text-left font-medium text-amber-700">Run report</button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Organization snapshot</h3>
          <span className="text-sm text-slate-500">{selectedData.organizations[0]?.name}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Net profit</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700">₹24,80,000</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cash balance</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">₹18,25,000</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Overdue invoices</p>
            <p className="mt-2 text-2xl font-semibold text-amber-700">₹5,40,000</p>
          </div>
        </div>
      </div>
    </div>
  );
}
