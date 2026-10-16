"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";

type OrganizationOption = { id: string; name: string };
type WarehouseRow = { id: string; code: string; name: string; address: string; city: string; state: string; status: string; locations: { code: string; name: string; type: string }[] };
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const button = "inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50";

export function WarehouseCatalog() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ code: "", name: "", address: "", city: "", state: "", locationName: "", locationCode: "" });

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

  const loadWarehouses = useCallback(async () => {
    if (!organizationId) {
      setWarehouses([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/trading/warehouses?organizationId=${encodeURIComponent(organizationId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load warehouses.");
      setWarehouses(data.warehouses);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load warehouses.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWarehouses(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadWarehouses]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const locations = form.locationCode.trim() && form.locationName.trim()
      ? [{ code: form.locationCode, name: form.locationName, type: "Other" }]
      : [];
    try {
      const response = await fetch("/api/trading/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, locations, organizationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create warehouse.");
      setNotice("Warehouse created.");
      setOpen(false);
      setForm({ code: "", name: "", address: "", city: "", state: "", locationName: "", locationCode: "" });
      await loadWarehouses();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create warehouse.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Trading / Storage</p><h1 className="mt-1 text-3xl font-semibold">Warehouses & cold storage</h1><p className="mt-1 text-sm text-slate-600">Organization-scoped storage locations used by stock lots and traceable movements.</p></div><button type="button" disabled={!organizationId} className={button} onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add warehouse</button></div>
    {isAdmin && <label className="block max-w-md"><span className="mb-1 block text-xs font-medium text-slate-600">Organization scope</span><select className={input} value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Select an organization</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {loading ? <p className="p-10 text-center text-sm text-slate-500">Loading warehouses…</p> : !organizationId ? <p className="p-10 text-center text-sm text-slate-500">{isAdmin ? "Select an organization to view its warehouses." : "No organization is linked to your account."}</p> : warehouses.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No warehouse or storage location configured.</p> : <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">{warehouses.map((warehouse) => <article key={warehouse.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between"><div><p className="text-xs font-medium text-slate-500">{warehouse.code}</p><h2 className="mt-1 font-semibold">{warehouse.name}</h2></div><span className="h-fit rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{warehouse.status}</span></div><p className="mt-2 text-sm text-slate-600">{[warehouse.city, warehouse.state].filter(Boolean).join(", ") || warehouse.address || "Location not specified"}</p><p className="mt-3 text-xs text-slate-500">{warehouse.locations.length} storage areas</p>{warehouse.locations.length > 0 && <ul className="mt-2 space-y-1 text-sm">{warehouse.locations.map((location) => <li key={location.code}>{location.name} <span className="text-xs text-slate-400">({location.code} · {location.type})</span></li>)}</ul>}</article>)}</div>}
    </section>
    {open && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8"><form onSubmit={save} className="my-auto w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl"><div><h2 className="text-xl font-semibold">Add warehouse</h2><p className="mt-1 text-sm text-slate-500">You can add further storage areas in future warehouse updates.</p></div><div className="grid gap-3 sm:grid-cols-2">{([["code", "Warehouse code *"], ["name", "Name *"], ["city", "City"], ["state", "State"], ["address", "Address"], ["locationCode", "First area code"], ["locationName", "First area name"]] as const).map(([key, title]) => <label key={key} className={key === "address" ? "sm:col-span-2" : ""}><span className="mb-1 block text-xs font-medium text-slate-600">{title}</span><input required={key === "code" || key === "name"} className={input} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}</div><div className="flex justify-end gap-2 border-t pt-3"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className={button}>{saving ? "Saving…" : "Create warehouse"}</button></div></form></div>}
  </div>;
}
