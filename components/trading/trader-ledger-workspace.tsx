"use client";

import { useCallback, useEffect, useState } from "react";

type OrganizationOption = { id: string; name: string };
type TraderOption = { id: string; traderCode: string; legalBusinessName: string; roles: string[] };
type Ledger = {
  trader: { id: string; traderCode: string; legalBusinessName: string; openingReceivable: number; openingPayable: number; creditLimit: number };
  balances: { receivable: number; payable: number; supplierAdvances: number; receiptAdvances: number; openDealExposure: number; availableCredit: number };
  ageing: { current: number; days1to30: number; days31to60: number; days61to90: number; over90: number };
  openInvoices: { id: string; number: string; dueDate: string | null; total: number; outstanding: number }[];
  entries: { date: string; reference: string; type: string; debit: number; credit: number; runningBalance: number; description: string }[];
  notice: string;
};
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const button = "inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50";
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);

export function TraderLedgerWorkspace() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [traders, setTraders] = useState<TraderOption[]>([]);
  const [traderId, setTraderId] = useState("");
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [direction, setDirection] = useState("Receipt");
  const [method, setMethod] = useState("Bank");
  const [amount, setAmount] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  const loadTraders = useCallback(async () => {
    if (!organizationId) { setTraders([]); setTraderId(""); setLedger(null); return; }
    try {
      const response = await fetch(`/api/traders?organizationId=${encodeURIComponent(organizationId)}&limit=100`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load traders.");
      setTraders(data.rows);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load traders.");
    }
  }, [organizationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTraders(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTraders]);

  const loadLedger = useCallback(async () => {
    if (!organizationId || !traderId) { setLedger(null); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/trading/traders/${traderId}/ledger?organizationId=${encodeURIComponent(organizationId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load ledger.");
      setLedger(data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load ledger.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, traderId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadLedger(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLedger]);

  const selectedInvoice = ledger?.openInvoices.find((invoice) => invoice.id === invoiceId);
  const savePayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!traderId) return;
    setSaving(true);
    setError("");
    try {
      const allocations = direction === "Receipt" && invoiceId && Number(allocationAmount) > 0
        ? [{ targetType: "Invoice", targetId: invoiceId, amount: Number(allocationAmount) }]
        : [];
      const response = await fetch("/api/trading/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          traderId,
          direction,
          method,
          amount: Number(amount),
          allocations,
          referenceNumber: referenceNumber || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to record payment.");
      setNotice(data.replayed ? "Payment had already been recorded." : "Payment recorded.");
      setAmount("");
      setAllocationAmount("");
      setInvoiceId("");
      setReferenceNumber("");
      await loadLedger();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record payment.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-5">
    <div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Trading / Finance</p><h1 className="mt-1 text-3xl font-semibold">Trader ledger & payments</h1><p className="mt-1 text-sm text-slate-600">Invoices, credits, receipts, advances, aging and settlement exposure.</p></div>
    {isAdmin && <label className="block max-w-md"><span className="mb-1 block text-xs font-medium text-slate-600">Organization scope</span><select className={input} value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setTraderId(""); }}><option value="">Select an organization</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
    {organizationId && <label className="block max-w-md"><span className="mb-1 block text-xs font-medium text-slate-600">Trader</span><select className={input} value={traderId} onChange={(event) => setTraderId(event.target.value)}><option value="">Select trader</option>{traders.map((trader) => <option key={trader.id} value={trader.id}>{trader.traderCode} · {trader.legalBusinessName}</option>)}</select></label>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    {loading && <p className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Loading ledger…</p>}
    {!loading && ledger && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Receivable balance", money(ledger.balances.receivable)],
          ["Payable opening balance", money(ledger.balances.payable)],
          ["Buyer advances", money(ledger.balances.receiptAdvances)],
          ["Supplier advances", money(ledger.balances.supplierAdvances)],
          ["Available credit", money(ledger.balances.availableCredit)],
          ["Open deal exposure (estimate)", money(ledger.balances.openDealExposure)],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b px-4 py-3"><h2 className="font-semibold">Account statement · {ledger.trader.traderCode}</h2><p className="text-xs text-slate-500">Opening balance {money(ledger.trader.openingReceivable - ledger.trader.openingPayable)}</p></div>
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Date", "Reference", "Type", "Debit", "Credit", "Balance"].map((title) => <th key={title} className="whitespace-nowrap px-3 py-2">{title}</th>)}</tr></thead><tbody className="divide-y">{ledger.entries.map((entry, index) => <tr key={`${entry.reference}-${index}`}><td className="whitespace-nowrap px-3 py-2">{new Date(entry.date).toLocaleDateString()}</td><td className="px-3 py-2">{entry.reference}</td><td className="px-3 py-2">{entry.type}</td><td className="px-3 py-2">{entry.debit ? money(entry.debit) : "—"}</td><td className="px-3 py-2">{entry.credit ? money(entry.credit) : "—"}</td><td className="px-3 py-2 font-medium">{money(entry.runningBalance)}</td></tr>)}</tbody></table></div>
          {ledger.entries.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No ledger entries found.</p>}
        </section>
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold">Receivable aging</h2><dl className="mt-3 space-y-2 text-sm">{[["Current", ledger.ageing.current], ["1–30 days overdue", ledger.ageing.days1to30], ["31–60 days", ledger.ageing.days31to60], ["61–90 days", ledger.ageing.days61to90], [">90 days", ledger.ageing.over90]].map(([label, value]) => <div key={String(label)} className="flex justify-between"><dt className="text-slate-600">{label}</dt><dd className="font-medium">{money(Number(value))}</dd></div>)}</dl></section>
          <form onSubmit={savePayment} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div><h2 className="font-semibold">Record trader payment</h2><p className="text-xs text-slate-500">Buyer receipts can be allocated to a posted invoice. Unallocated remainder is recorded as an advance.</p></div>
            <label><span className="mb-1 block text-xs font-medium text-slate-600">Direction</span><select className={input} value={direction} onChange={(event) => { setDirection(event.target.value); setInvoiceId(""); }}><option value="Receipt">Receipt from buyer</option><option value="Payment">Payment to supplier (advance)</option></select></label>
            <label><span className="mb-1 block text-xs font-medium text-slate-600">Amount (₹)</span><input required type="number" min="0.01" step="any" className={input} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
            {direction === "Receipt" && <><label><span className="mb-1 block text-xs font-medium text-slate-600">Allocate to invoice (optional)</span><select className={input} value={invoiceId} onChange={(event) => { setInvoiceId(event.target.value); const invoice = ledger.openInvoices.find((item) => item.id === event.target.value); setAllocationAmount(invoice ? String(invoice.outstanding) : ""); }}><option value="">Keep as buyer advance</option>{ledger.openInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.number} · balance {money(invoice.outstanding)}</option>)}</select></label>{invoiceId && <label><span className="mb-1 block text-xs font-medium text-slate-600">Allocation (max {money(selectedInvoice?.outstanding ?? 0)})</span><input required type="number" min="0.01" step="any" max={selectedInvoice?.outstanding} className={input} value={allocationAmount} onChange={(event) => setAllocationAmount(event.target.value)} /></label>}</>}
            <label><span className="mb-1 block text-xs font-medium text-slate-600">Method</span><select className={input} value={method} onChange={(event) => setMethod(event.target.value)}>{["Cash", "Bank", "UPI", "Cheque", "RTGS", "NEFT"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span className="mb-1 block text-xs font-medium text-slate-600">Reference number</span><input className={input} value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} /></label>
            <button type="submit" className={button} disabled={saving || !traderId}>{saving ? "Saving…" : "Record payment"}</button>
            <p className="text-xs leading-relaxed text-slate-500">Payments record operational balances only; they do not create general-ledger journal entries. Supplier bill allocation is not available because the app has no purchase-bill module.</p>
          </form>
        </aside>
      </div>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">{ledger.notice}</p>
    </>}
  </div>;
}
