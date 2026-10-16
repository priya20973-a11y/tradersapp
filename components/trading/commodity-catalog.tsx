"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";

type OrganizationOption = { id: string; name: string };
type Commodity = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  varieties: string[];
  grades: string[];
  sizeCalibres: string[];
  alternateUnits: { unit: string; kilogramsPerUnit: number }[];
  standardBagWeightKg: number | null;
  packagingTypes: string[];
  qualityParameters: { name: string; unit?: string; required: boolean }[];
  shelfLifeDays: number | null;
};

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const field = "mb-1 block text-xs font-medium text-slate-600";
const button = "inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50";
const emptyForm = {
  name: "", sku: "", category: "", unit: "kg", varieties: "", grades: "",
  sizes: "", packaging: "", bagWeight: "", shelfLife: "",
};

export function CommodityCatalog() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [open, setOpen] = useState(false);
  const [editingCommodityId, setEditingCommodityId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let active = true;
    fetch("/api/trading/organizations")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load organizations.");
        if (!active) return;
        setOrganizations(data.organizations);
        setIsAdmin(Boolean(data.isAdmin));
        if (data.organizations.length === 1) setOrganizationId(data.organizations[0].id);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load organizations.");
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const loadCommodities = useCallback(async () => {
    if (!organizationId) {
      setCommodities([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/commodities?organizationId=${encodeURIComponent(organizationId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load commodities.");
      setCommodities(data.commodities);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load commodities.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCommodities(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCommodities]);

  const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
  const createCommodity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      organizationId,
      commodityCategory: form.category,
      varieties: list(form.varieties),
      grades: list(form.grades),
      sizeCalibres: list(form.sizes),
      packagingTypes: list(form.packaging),
      standardBagWeightKg: form.bagWeight ? Number(form.bagWeight) : undefined,
      shelfLifeDays: form.shelfLife ? Number(form.shelfLife) : undefined,
    };
    try {
      const response = await fetch(editingCommodityId ? `/api/commodities/${editingCommodityId}` : "/api/commodities", {
        method: editingCommodityId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingCommodityId
          ? {
            organizationId,
            data: {
              name: form.name,
              commodityCategory: form.category,
              unit: form.unit,
              varieties: list(form.varieties),
              grades: list(form.grades),
              sizeCalibres: list(form.sizes),
              packagingTypes: list(form.packaging),
              standardBagWeightKg: form.bagWeight ? Number(form.bagWeight) : null,
              shelfLifeDays: form.shelfLife ? Number(form.shelfLife) : null,
            },
          }
          : payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to add commodity.");
      setNotice(editingCommodityId ? "Commodity updated." : "Commodity added.");
      setOpen(false);
      setEditingCommodityId("");
      setForm(emptyForm);
      await loadCommodities();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add commodity.");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (commodity: Commodity) => {
    if (!window.confirm(`Deactivate ${commodity.name}? Existing trade and stock records will remain.`)) return;
    try {
      const response = await fetch(`/api/commodities/${commodity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, data: { active: false } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to deactivate commodity.");
      setNotice("Commodity deactivated. Existing records were preserved.");
      await loadCommodities();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to deactivate commodity.");
    }
  };

  const editCommodity = (commodity: Commodity) => {
    setEditingCommodityId(commodity.id);
    setForm({
      name: commodity.name,
      sku: commodity.sku,
      category: commodity.category,
      unit: commodity.unit,
      varieties: commodity.varieties.join(", "),
      grades: commodity.grades.join(", "),
      sizes: commodity.sizeCalibres.join(", "),
      packaging: commodity.packagingTypes.join(", "),
      bagWeight: commodity.standardBagWeightKg ? String(commodity.standardBagWeightKg) : "",
      shelfLife: commodity.shelfLifeDays ? String(commodity.shelfLifeDays) : "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Trading / Masters</p><h1 className="mt-1 text-3xl font-semibold">Commodity catalog</h1><p className="mt-1 text-sm text-slate-600">Commodity configuration extends the organization&apos;s existing inventory items.</p></div>
        <button type="button" className={button} disabled={!organizationId} onClick={() => { setError(""); setEditingCommodityId(""); setForm(emptyForm); setOpen(true); }}><Plus className="h-4 w-4" /> Add commodity</button>
      </div>
      {isAdmin && <label className="block max-w-md"><span className={field}>Organization scope</span><select className={input} value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Select an organization</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? <p className="p-10 text-center text-sm text-slate-500">Loading commodities…</p> : !organizationId ? <p className="p-10 text-center text-sm text-slate-500">{isAdmin ? "Select an organization to view its commodities." : "No organization is linked to your account."}</p> : commodities.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No commodities configured yet.</p> : (
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Commodity", "Code", "Category", "Unit", "Varieties / grades", "Packaging", ""].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{commodities.map((commodity) => <tr key={commodity.id}>
              <td className="px-4 py-3 font-semibold">{commodity.name}<p className="text-xs font-normal text-slate-500">{commodity.standardBagWeightKg ? `${commodity.standardBagWeightKg} kg/bag` : ""}{commodity.shelfLifeDays ? ` · ${commodity.shelfLifeDays} days shelf life` : ""}</p></td>
              <td className="px-4 py-3">{commodity.sku}</td><td className="px-4 py-3">{commodity.category}</td><td className="px-4 py-3">{commodity.unit}</td>
              <td className="px-4 py-3">{commodity.varieties.join(", ") || "—"}<p className="text-xs text-slate-500">{commodity.grades.join(", ")}</p></td><td className="px-4 py-3">{commodity.packagingTypes.join(", ") || "—"}</td>
              <td className="px-4 py-3 whitespace-nowrap"><button type="button" className="mr-3 text-xs font-medium text-emerald-700 hover:underline" onClick={() => editCommodity(commodity)}>Edit</button><button type="button" className="text-xs font-medium text-red-700 hover:underline" onClick={() => void deactivate(commodity)}>Deactivate</button></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
      {open && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8"><form onSubmit={createCommodity} className="my-auto w-full max-w-2xl space-y-5 rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <div><h2 className="text-xl font-semibold">{editingCommodityId ? "Edit commodity" : "Add commodity"}</h2><p className="mt-1 text-sm text-slate-500">The commodity is stored as an inventory-tracked item in this organization.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {([["name", "Commodity name *"], ["sku", "Commodity code *"], ["category", "Category *"], ["unit", "Base unit *"], ["varieties", "Varieties (comma separated)"], ["grades", "Grades (comma separated)"], ["sizes", "Size calibres (comma separated)"], ["packaging", "Packaging types (comma separated)"], ["bagWeight", "Standard bag weight (kg)"], ["shelfLife", "Shelf life (days)"]] as const).map(([key, title]) => <label key={key}><span className={field}>{title}</span><input required={["name", "sku", "category", "unit"].includes(key)} disabled={editingCommodityId !== "" && key === "sku"} min={key === "bagWeight" || key === "shelfLife" ? "0.001" : undefined} type={key === "bagWeight" || key === "shelfLife" ? "number" : "text"} className={input} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}
        </div>
        <div className="flex justify-end gap-2 border-t pt-4"><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => { setOpen(false); setEditingCommodityId(""); }}>Cancel</button><button type="submit" disabled={saving} className={button}>{saving ? "Saving…" : "Save commodity"}</button></div>
      </form></div>}
    </div>
  );
}
