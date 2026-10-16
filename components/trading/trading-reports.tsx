"use client";

import { useCallback, useEffect, useState } from "react";

type OrganizationOption = { id: string; name: string };
type ReportData = {
  traders: { total: number; active: number; blocked: number; pendingKyc: number; creditOnHold: number };
  dealsByStatus: { _id: string; count: number; contractValue: number; settledValue: number; estimatedCosts: number; realizedCosts: number }[];
  stockByCommodity: { commodity: string; sku: string; unit: string; lotCount: number; physicalQuantity: number; reservedQuantity: number; availableQuantity: number; damagedQuantity: number }[];
  invoices: { invoiceCount: number; invoiced: number; received: number; credited: number; outstanding: number; overdue: number };
  tradingPayments: { _id: string; count: number; amount: number; unallocated: number }[];
  notice: string;
};
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600";
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);

export function TradingReports() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/trading/organizations").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load organizations.");
      if (!active) return;
      setOrganizations(data.organizations);
      setIsAdmin(Boolean(data.isAdmin));
      if (data.organizations.length === 1) setOrganizationId(data.organizations[0].id);
      setLoading(false);
    }).catch((cause: unknown) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "Unable to load organizations.");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const loadReport = useCallback(async () => {
    if (!organizationId) { setReport(null); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/trading/reports?organizationId=${encodeURIComponent(organizationId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load reports.");
      setReport(data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load reports.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReport(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReport]);

  const metricCards = report ? [
    ["Total traders", report.traders.total],
    ["Active traders", report.traders.active],
    ["KYC pending", report.traders.pendingKyc],
    ["Blocked / credit hold", report.traders.blocked + report.traders.creditOnHold],
    ["Invoices outstanding", money(report.invoices.outstanding)],
    ["Overdue receivables", money(report.invoices.overdue)],
    ["Invoice receipts", money(report.invoices.received)],
    ["Invoiced", money(report.invoices.invoiced)],
  ] : [];

  return <div className="space-y-5">
    <div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Trading / Insights</p><h1 className="mt-1 text-3xl font-semibold">Trading reports</h1><p className="mt-1 text-sm text-slate-600">Live operational summaries from the selected organization&apos;s records.</p></div>
    {isAdmin && <label className="block max-w-md"><span className="mb-1 block text-xs font-medium text-slate-600">Organization scope</span><select className={input} value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Select an organization</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {loading ? <p className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Loading trading reports…</p> : report && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><h2 className="border-b px-4 py-3 font-semibold">Deal status & profitability estimates</h2><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Status", "Deals", "Contract value", "Settled", "Est. / realized costs"].map((title) => <th key={title} className="whitespace-nowrap px-3 py-2">{title}</th>)}</tr></thead><tbody className="divide-y">{report.dealsByStatus.map((deal) => <tr key={deal._id}><td className="px-3 py-2">{deal._id}</td><td className="px-3 py-2">{deal.count}</td><td className="px-3 py-2">{money(deal.contractValue)}</td><td className="px-3 py-2">{money(deal.settledValue)}</td><td className="px-3 py-2">{money(deal.estimatedCosts)} / {money(deal.realizedCosts)}</td></tr>)}</tbody></table></div>{report.dealsByStatus.length === 0 && <p className="p-5 text-sm text-slate-500">No deals found.</p>}</section>
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><h2 className="border-b px-4 py-3 font-semibold">Stock by commodity and unit</h2><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Commodity", "Lots", "On hand", "Reserved", "Available", "Damaged"].map((title) => <th key={title} className="whitespace-nowrap px-3 py-2">{title}</th>)}</tr></thead><tbody className="divide-y">{report.stockByCommodity.map((stock, index) => <tr key={`${stock.sku}-${stock.unit}-${index}`}><td className="px-3 py-2">{stock.commodity || stock.sku}<p className="text-xs text-slate-500">{stock.sku}</p></td><td className="px-3 py-2">{stock.lotCount}</td><td className="px-3 py-2">{stock.physicalQuantity} {stock.unit}</td><td className="px-3 py-2">{stock.reservedQuantity}</td><td className="px-3 py-2">{stock.availableQuantity}</td><td className="px-3 py-2">{stock.damagedQuantity}</td></tr>)}</tbody></table></div>{report.stockByCommodity.length === 0 && <p className="p-5 text-sm text-slate-500">No stock lots found.</p>}</section>
      </div>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">{report.notice}</p>
    </>}
  </div>;
}
