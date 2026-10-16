"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

type OrganizationOption = { id: string; name: string };
type Option = { id: string; name: string; sku?: string };
type Deal = {
  _id: string;
  dealReference: string;
  dealType: string;
  status: string;
  tradeDate: string;
  contractedQuantity: number;
  deliveredQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  unit: string;
  agreedRate: number;
  commissionAmount: number;
  settledAmount: number;
  estimatedCosts: { category: string; amount: number }[];
  realizedCosts: { category: string; amount: number }[];
  buyerTraderId?: { _id: string; traderCode: string; legalBusinessName: string };
  sellerTraderId?: { _id: string; traderCode: string; legalBusinessName: string };
  commodityItemId?: { _id: string; name: string; sku: string };
};
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const button = "inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50";
const emptyForm = {
  dealReference: "", dealType: "Sale", buyerTraderId: "", sellerTraderId: "",
  brokerTraderId: "", commodityItemId: "", contractedQuantity: "", unit: "kg",
  agreedRate: "", rateBasis: "per kg", commissionRate: "0", expectedDeliveryDate: "",
};

export function DealWorkspace() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [traders, setTraders] = useState<Option[]>([]);
  const [commodities, setCommodities] = useState<Option[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [statusChoice, setStatusChoice] = useState("");
  const [delivery, setDelivery] = useState({ quantity: "", acceptedQuantity: "", rejectedQuantity: "" });
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementDirection, setSettlementDirection] = useState("Receipt");
  const [settlementMethod, setSettlementMethod] = useState("Bank");
  const [costForm, setCostForm] = useState({ category: "", amount: "", realized: false });
  const [open, setOpen] = useState(false);
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

  const loadData = useCallback(async () => {
    if (!organizationId) { setDeals([]); return; }
    setLoading(true);
    try {
      const [dealsResponse, tradersResponse, commoditiesResponse] = await Promise.all([
        fetch(`/api/trading/deals?organizationId=${encodeURIComponent(organizationId)}`),
        fetch(`/api/traders?organizationId=${encodeURIComponent(organizationId)}&limit=100`),
        fetch(`/api/commodities?organizationId=${encodeURIComponent(organizationId)}`),
      ]);
      const [dealsData, tradersData, commoditiesData] = await Promise.all([dealsResponse.json(), tradersResponse.json(), commoditiesResponse.json()]);
      for (const [response, data] of [[dealsResponse, dealsData], [tradersResponse, tradersData], [commoditiesResponse, commoditiesData]] as const) {
        if (!response.ok) throw new Error(data.error || "Unable to load deal data.");
      }
      setDeals(dealsData.deals);
      setTraders(tradersData.rows.map((trader: { id: string; traderCode: string; legalBusinessName: string }) => ({ id: trader.id, name: `${trader.traderCode} · ${trader.legalBusinessName}` })));
      setCommodities(commoditiesData.commodities.map((item: { id: string; name: string; sku: string }) => ({ id: item.id, name: `${item.sku} · ${item.name}` })));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load deal data.");
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const createDeal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        organizationId,
        buyerTraderId: form.buyerTraderId || undefined,
        sellerTraderId: form.sellerTraderId || undefined,
        brokerTraderId: form.brokerTraderId || undefined,
        contractedQuantity: Number(form.contractedQuantity),
        agreedRate: Number(form.agreedRate),
        commissionRate: Number(form.commissionRate),
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
      };
      const response = await fetch("/api/trading/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create deal.");
      setNotice(`Deal ${data.dealReference} created as a draft.`);
      setForm(emptyForm);
      setOpen(false);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create deal.");
    } finally {
      setSaving(false);
    }
  };

  const updateDeal = async (action: string, data: Record<string, unknown>) => {
    if (!selectedDeal) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/trading/deals/${selectedDeal._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, action, data }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update deal.");
      setNotice(`Deal updated. Status: ${result.status}.`);
      await loadData();
      setSelectedDeal((current) => current ? { ...current, status: result.status, deliveredQuantity: result.deliveredQuantity, settledAmount: result.settledAmount } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update deal.");
    } finally {
      setSaving(false);
    }
  };

  const transitionOptions: Record<string, string[]> = {
    Draft: ["Negotiation", "Confirmed", "Cancelled"],
    Negotiation: ["Confirmed", "Cancelled"],
    Confirmed: ["Cancelled", "Disputed"],
    "Partially Delivered": ["Disputed"],
    Delivered: ["Partially Invoiced", "Invoiced", "Partially Settled", "Settled", "Disputed"],
    "Partially Invoiced": ["Invoiced", "Partially Settled", "Settled", "Disputed"],
    Invoiced: ["Partially Settled", "Settled", "Disputed"],
    "Partially Settled": ["Settled", "Disputed"],
    Disputed: ["Confirmed", "Cancelled"],
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Trading / Operations</p><h1 className="mt-1 text-3xl font-semibold">Commodity deals</h1><p className="mt-1 text-sm text-slate-600">Track contracts, delivery acceptance, settlement and deal lifecycle.</p></div><button type="button" className={button} disabled={!organizationId} onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New deal</button></div>
    {isAdmin && <label className="block max-w-md"><span className="mb-1 block text-xs font-medium text-slate-600">Organization scope</span><select className={input} value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Select an organization</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {loading ? <p className="p-10 text-center text-sm text-slate-500">Loading deals…</p> : !organizationId ? <p className="p-10 text-center text-sm text-slate-500">{isAdmin ? "Select an organization to view its deals." : "No organization is linked to your account."}</p> : deals.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No deals yet. Configure traders and commodities first.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Reference", "Type / counterparties", "Commodity", "Contract / delivered", "Rate / settlement", "Status", "Actions"].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{deals.map((deal) => <tr key={deal._id}><td className="px-4 py-3 font-semibold">{deal.dealReference}<p className="text-xs font-normal text-slate-500">{new Date(deal.tradeDate).toLocaleDateString()}</p></td><td className="px-4 py-3">{deal.dealType}<p className="text-xs text-slate-500">{deal.buyerTraderId?.legalBusinessName || "—"} / {deal.sellerTraderId?.legalBusinessName || "—"}</p></td><td className="px-4 py-3">{deal.commodityItemId?.name || "—"}</td><td className="whitespace-nowrap px-4 py-3">{deal.contractedQuantity} / {deal.deliveredQuantity} {deal.unit}<p className="text-xs text-slate-500">Accepted {deal.acceptedQuantity} · rejected {deal.rejectedQuantity}</p></td><td className="whitespace-nowrap px-4 py-3">₹{deal.agreedRate.toLocaleString("en-IN")} / {deal.unit}<p className="text-xs text-slate-500">Settled ₹{deal.settledAmount.toLocaleString("en-IN")}</p></td><td className="px-4 py-3">{deal.status}</td><td className="px-4 py-3"><button type="button" className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => { setSelectedDeal(deal); setStatusChoice(transitionOptions[deal.status]?.[0] || ""); }}>Manage</button></td></tr>)}</tbody></table></div>}
    </section>
    {open && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8"><form onSubmit={createDeal} className="my-auto w-full max-w-3xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl"><div><h2 className="text-xl font-semibold">Create commodity deal</h2><p className="mt-1 text-sm text-slate-500">Deal references are unique within the selected organization.</p></div><div className="grid gap-3 sm:grid-cols-2">
      <label><span className="mb-1 block text-xs font-medium text-slate-600">Deal reference *</span><input required className={input} value={form.dealReference} onChange={(e) => setForm({ ...form, dealReference: e.target.value })} /></label>
      <label><span className="mb-1 block text-xs font-medium text-slate-600">Deal type</span><select className={input} value={form.dealType} onChange={(e) => setForm({ ...form, dealType: e.target.value })}>{["Purchase", "Sale", "Buy-Sell", "Brokered Deal", "Consignment"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span className="mb-1 block text-xs font-medium text-slate-600">Buyer</span><select className={input} value={form.buyerTraderId} onChange={(e) => setForm({ ...form, buyerTraderId: e.target.value })}><option value="">Select buyer</option>{traders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span className="mb-1 block text-xs font-medium text-slate-600">Seller / consignment owner</span><select className={input} value={form.sellerTraderId} onChange={(e) => setForm({ ...form, sellerTraderId: e.target.value })}><option value="">Select seller</option>{traders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span className="mb-1 block text-xs font-medium text-slate-600">Broker</span><select className={input} value={form.brokerTraderId} onChange={(e) => setForm({ ...form, brokerTraderId: e.target.value })}><option value="">No broker</option>{traders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span className="mb-1 block text-xs font-medium text-slate-600">Commodity *</span><select required className={input} value={form.commodityItemId} onChange={(e) => setForm({ ...form, commodityItemId: e.target.value })}><option value="">Select commodity</option>{commodities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {([["contractedQuantity", "Contract quantity *"], ["unit", "Unit *"], ["agreedRate", "Agreed rate *"], ["rateBasis", "Rate basis"], ["commissionRate", "Commission %"], ["expectedDeliveryDate", "Expected delivery"]] as const).map(([key, label]) => <label key={key}><span className="mb-1 block text-xs font-medium text-slate-600">{label}</span><input type={key === "expectedDeliveryDate" ? "date" : key === "contractedQuantity" || key === "agreedRate" || key === "commissionRate" ? "number" : "text"} min={key === "contractedQuantity" || key === "agreedRate" ? "0.001" : "0"} required={key === "contractedQuantity" || key === "agreedRate" || key === "unit"} className={input} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
    </div><div className="flex justify-end gap-2 border-t pt-3"><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setOpen(false)}>Cancel</button><button className={button} disabled={saving || commodities.length === 0}>{saving ? "Saving…" : "Create draft deal"}</button></div></form></div>}
    {selectedDeal && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8" onClick={() => setSelectedDeal(null)}><section className="my-auto w-full max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex justify-between"><div><p className="text-xs uppercase tracking-wide text-slate-500">{selectedDeal.dealType} · {selectedDeal.status}</p><h2 className="text-xl font-semibold">{selectedDeal.dealReference}</h2></div><button type="button" aria-label="Close" onClick={() => setSelectedDeal(null)}><X className="h-5 w-5" /></button></div>
      {transitionOptions[selectedDeal.status]?.length > 0 && <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><select className={input} value={statusChoice} onChange={(e) => setStatusChoice(e.target.value)}>{transitionOptions[selectedDeal.status].map((value) => <option key={value}>{value}</option>)}</select><button type="button" className={button} disabled={saving || !statusChoice} onClick={() => void updateDeal("transition", { status: statusChoice })}>Change status</button></div>}
      {["Confirmed", "Partially Delivered"].includes(selectedDeal.status) && <form onSubmit={(event) => { event.preventDefault(); void updateDeal("record-delivery", { quantity: delivery.quantity, acceptedQuantity: delivery.acceptedQuantity, rejectedQuantity: delivery.rejectedQuantity }); }} className="grid gap-2 rounded-xl bg-slate-50 p-4 sm:grid-cols-3"><h3 className="text-sm font-semibold sm:col-span-3">Record delivery</h3><input required type="number" min="0.001" step="any" className={input} aria-label="Delivered quantity" placeholder="Delivered quantity" value={delivery.quantity} onChange={(e) => setDelivery({ ...delivery, quantity: e.target.value })} /><input required type="number" min="0" step="any" className={input} aria-label="Accepted quantity" placeholder="Accepted quantity" value={delivery.acceptedQuantity} onChange={(e) => setDelivery({ ...delivery, acceptedQuantity: e.target.value })} /><input required type="number" min="0" step="any" className={input} aria-label="Rejected quantity" placeholder="Rejected quantity" value={delivery.rejectedQuantity} onChange={(e) => setDelivery({ ...delivery, rejectedQuantity: e.target.value })} /><button className={button} disabled={saving}>Save delivery</button></form>}
      {["Delivered", "Partially Invoiced", "Invoiced", "Partially Settled"].includes(selectedDeal.status) && <form onSubmit={(event) => { event.preventDefault(); void updateDeal("record-settlement", { amount: settlementAmount, direction: settlementDirection, method: settlementMethod, idempotencyKey: crypto.randomUUID() }); }} className="grid gap-2 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><h3 className="text-sm font-semibold sm:col-span-2">Record settlement payment</h3><label><span className="mb-1 block text-xs font-medium text-slate-600">Direction</span><select className={input} value={settlementDirection} onChange={(e) => setSettlementDirection(e.target.value)}><option value="Receipt">Receipt from buyer</option><option value="Payment">Payment to seller</option></select></label><label><span className="mb-1 block text-xs font-medium text-slate-600">Method</span><select className={input} value={settlementMethod} onChange={(e) => setSettlementMethod(e.target.value)}>{["Cash", "Bank", "UPI", "Cheque", "RTGS", "NEFT"].map((value) => <option key={value}>{value}</option>)}</select></label><input required type="number" min="0.01" step="any" className={input} aria-label="Settlement amount" placeholder="Settlement amount" value={settlementAmount} onChange={(e) => setSettlementAmount(e.target.value)} /><button className={button} disabled={saving}>Record settlement</button></form>}
      <div className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">Deal costs</h3><div className="grid gap-2 sm:grid-cols-2"><p className="rounded-lg bg-slate-50 p-3 text-sm">Estimated costs: ₹{selectedDeal.estimatedCosts.reduce((sum, cost) => sum + cost.amount, 0).toLocaleString("en-IN")}</p><p className="rounded-lg bg-slate-50 p-3 text-sm">Realized costs: ₹{selectedDeal.realizedCosts.reduce((sum, cost) => sum + cost.amount, 0).toLocaleString("en-IN")}</p></div><form onSubmit={(event) => { event.preventDefault(); void updateDeal("record-cost", { category: costForm.category, amount: Number(costForm.amount), realized: costForm.realized }); setCostForm({ category: "", amount: "", realized: false }); }} className="grid gap-2 sm:grid-cols-[1fr_140px_160px_auto]"><input required className={input} placeholder="Cost category" value={costForm.category} onChange={(event) => setCostForm({ ...costForm, category: event.target.value })} /><input required type="number" min="0" step="any" className={input} placeholder="Amount" value={costForm.amount} onChange={(event) => setCostForm({ ...costForm, amount: event.target.value })} /><select className={input} value={costForm.realized ? "realized" : "estimated"} onChange={(event) => setCostForm({ ...costForm, realized: event.target.value === "realized" })}><option value="estimated">Estimated cost</option><option value="realized">Realized cost</option></select><button className={button} disabled={saving}>Add cost</button></form></div>
      <p className="border-t pt-3 text-sm text-slate-500">Cost totals are operational estimates/actuals only; they are not posted to the general ledger.</p>
      <div className="flex justify-end"><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setSelectedDeal(null)}>Close</button></div>
    </section></div>}
  </div>;
}
