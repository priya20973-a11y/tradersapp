"use client";

import { useCallback, useEffect, useState } from "react";

type OrganizationOption = { id: string; name: string };
type AuditRecord = { id: string; actorId: string; action: string; entityType: string; entityId: string; changes: Record<string, unknown>; occurredAt: string };
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600";

export function TradingAuditLog() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [events, setEvents] = useState<AuditRecord[]>([]);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
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

  const loadEvents = useCallback(async () => {
    if (!organizationId) { setEvents([]); return; }
    setLoading(true);
    const query = new URLSearchParams({ organizationId, page: String(page), limit: "50" });
    if (entityType) query.set("entityType", entityType);
    if (action) query.set("action", action);
    try {
      const response = await fetch(`/api/trading/audit?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load audit events.");
      setEvents(data.events);
      setPages(Math.max(1, Math.ceil(data.total / data.limit)));
      setTotal(data.total);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load audit events.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, page, entityType, action]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadEvents(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadEvents]);

  return <div className="space-y-5">
    <div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Trading / Controls</p><h1 className="mt-1 text-3xl font-semibold">Trading audit log</h1><p className="mt-1 text-sm text-slate-600">Organization-scoped record of sensitive master and operational changes.</p></div>
    {isAdmin && <label className="block max-w-md"><span className="mb-1 block text-xs font-medium text-slate-600">Organization scope</span><select className={input} value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setPage(1); }}><option value="">Select an organization</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
    <div className="grid max-w-2xl gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-medium text-slate-600">Entity type</span><select className={input} value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1); }}><option value="">All types</option>{["TraderProfile", "Item", "TradeDeal", "StockLot", "Warehouse", "TraderPayment"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span className="mb-1 block text-xs font-medium text-slate-600">Action contains</span><input className={input} value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} placeholder="e.g. kyc or stock" /></label></div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {loading ? <p className="p-10 text-center text-sm text-slate-500">Loading audit events…</p> : events.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No audit events found.</p> : <div className="divide-y">{events.map((event) => <article key={event.id} className="grid gap-2 p-4 sm:grid-cols-[190px_180px_minmax(0,1fr)]"><div><p className="text-sm font-medium">{new Date(event.occurredAt).toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Actor {event.actorId}</p></div><div><p className="text-sm font-semibold">{event.action}</p><p className="text-xs text-slate-500">{event.entityType} · {event.entityId}</p></div><pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{JSON.stringify(event.changes, null, 2)}</pre></article>)}</div>}
      {total > 50 && <div className="flex items-center justify-between border-t px-4 py-3 text-sm"><span className="text-slate-500">Page {page} of {pages}</span><div className="flex gap-2"><button className="rounded-lg border px-3 py-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="rounded-lg border px-3 py-1.5 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div>}
    </section>
  </div>;
}
