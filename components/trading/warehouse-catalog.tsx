"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Layers,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";
import { getCachedTradingOrganizations } from "@/lib/trading-cache";

type OrganizationOption = { id: string; name: string };
type StorageLocation = { code: string; name: string; type: string; capacity?: number; unit?: string };
type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  state: string;
  status: string;
  locations: StorageLocation[];
};

const inputStyle =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer";

export function WarehouseCatalog() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    address: "",
    city: "",
    state: "",
    locationName: "",
    locationCode: "",
  });

  useEffect(() => {
    let active = true;
    getCachedTradingOrganizations()
      .then((data) => {
        if (!active) return;
        setOrganizations(data.organizations || []);
        setIsAdmin(Boolean(data.isAdmin));
        if (data.organizations && data.organizations.length > 0) {
          setOrganizationId((prev) => prev || data.organizations[0].id);
        }
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load organizations.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadWarehouses = useCallback(async () => {
    const targetOrg = organizationId || organizations[0]?.id;
    if (!targetOrg) {
      setWarehouses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/trading/warehouses?organizationId=${encodeURIComponent(targetOrg)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load warehouses.");
      setWarehouses(data.warehouses || []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load warehouses.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, organizations]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWarehouses();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadWarehouses]);

  const handleOpenModal = () => {
    if (!organizationId && organizations.length > 0) {
      setOrganizationId(organizations[0].id);
    }
    setModalError("");
    setOpen(true);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setModalError("");
    setError("");

    const targetOrg = organizationId || organizations[0]?.id;
    if (!targetOrg) {
      setModalError("Please select an organization before creating a warehouse.");
      setSaving(false);
      return;
    }

    const locName = form.locationName.trim();
    let locCode = form.locationCode.trim();
    if (locName && !locCode) {
      locCode = locName.slice(0, 10).toUpperCase().replace(/\s+/g, "-");
    } else if (locCode && !locName) {
      // If code was entered without name, use code as name
      // locName = locCode;
    }

    const locations =
      locCode && (locName || form.locationCode.trim())
        ? [{ code: locCode, name: locName || locCode, type: "Other" as const }]
        : [];

    try {
      const response = await fetch("/api/trading/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          locations,
          organizationId: targetOrg,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to create warehouse.");
      }

      setNotice(`Warehouse "${form.name.trim()}" created successfully.`);
      setOpen(false);
      setForm({
        code: "",
        name: "",
        address: "",
        city: "",
        state: "",
        locationName: "",
        locationCode: "",
      });
      await loadWarehouses();
    } catch (cause) {
      setModalError(cause instanceof Error ? cause.message : "Unable to create warehouse.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete warehouse "${name}"?`)) {
      return;
    }

    setDeletingId(id);
    setError("");
    setNotice("");

    try {
      const targetOrg = organizationId || organizations[0]?.id;
      const res = await fetch(
        `/api/trading/warehouses?id=${encodeURIComponent(id)}&organizationId=${encodeURIComponent(targetOrg || "")}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete warehouse.");
      setNotice(`Warehouse "${name}" deleted.`);
      await loadWarehouses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete warehouse.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredWarehouses = warehouses.filter((w) => {
    const q = searchTerm.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.code.toLowerCase().includes(q) ||
      w.city.toLowerCase().includes(q) ||
      w.state.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              Storage & Inventory
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">
            Warehouses & Cold Storage
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Storage locations used for commodity lots, dispatches, and inventory traceability.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className={buttonPrimary}
        >
          <Plus className="h-4 w-4" /> Add Warehouse
        </button>
      </div>

      {/* Organization Scope & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-1 items-center gap-3">
          {(isAdmin || organizations.length > 1) && (
            <div className="w-full sm:w-64">
              <select
                className={inputStyle}
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search warehouses by name, code, or city..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
            />
          </div>
        </div>

        <span className="text-xs text-slate-400 font-medium text-right">
          {filteredWarehouses.length} warehouse{filteredWarehouses.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Notice / Error banners */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="cursor-pointer">
            <X className="w-4 h-4 text-rose-400" />
          </button>
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="cursor-pointer">
            <X className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      )}

      {/* Warehouse Cards Grid */}
      <section className="min-h-[240px]">
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            Loading warehouses…
          </div>
        ) : filteredWarehouses.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center">
              <WarehouseIcon className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {searchTerm ? "No matching warehouses found" : "No warehouses configured yet"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your first warehouse, godown, or cold storage facility to track commodities and lots.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenModal}
                className={buttonPrimary}
              >
                <Plus className="w-4 h-4" /> Add Warehouse
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredWarehouses.map((warehouse) => (
              <article
                key={warehouse.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        {warehouse.code}
                      </span>
                      <h2 className="mt-2 text-base font-bold text-slate-900">{warehouse.name}</h2>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {warehouse.status || "Active"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-start gap-1.5 text-xs text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      {[warehouse.address, warehouse.city, warehouse.state]
                        .filter(Boolean)
                        .join(", ") || "Location not specified"}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        Storage Areas ({warehouse.locations.length})
                      </span>
                    </div>

                    {warehouse.locations.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {warehouse.locations.map((loc) => (
                          <span
                            key={loc.code}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-700"
                          >
                            <span className="font-semibold">{loc.name}</span>
                            <span className="text-slate-400 font-mono">({loc.code})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No specific sub-areas recorded</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="button"
                    disabled={deletingId === warehouse.id}
                    onClick={() => handleDelete(warehouse.id, warehouse.name)}
                    className="text-xs text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
                    title="Delete warehouse"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Add Warehouse Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={save}
            className="my-auto w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <WarehouseIcon className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Add New Warehouse
                  </h2>
                  <p className="text-xs text-slate-500">Configure storage facility or cold room</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {modalError}
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              {/* Organization Scope (if multiple) */}
              {organizations.length > 1 && (
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Organization <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    className={inputStyle}
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Warehouse Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    placeholder="e.g. WH-01 or SHED-A"
                    className={inputStyle}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Warehouse Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    placeholder="e.g. Central Cold Storage"
                    className={inputStyle}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">City</label>
                  <input
                    placeholder="e.g. Navi Mumbai"
                    className={inputStyle}
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">State</label>
                  <input
                    placeholder="e.g. Maharashtra"
                    className={inputStyle}
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">Address / Location</label>
                <input
                  placeholder="Plot number, APMC Market Yard, Road..."
                  className={inputStyle}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-800 block mb-1">
                  Optional Initial Storage Area
                </span>
                <p className="text-[11px] text-slate-400 mb-2">
                  You can specify an initial chamber, rack, or floor area.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      placeholder="Area Name (e.g. Chamber 1)"
                      className={inputStyle}
                      value={form.locationName}
                      onChange={(e) => setForm({ ...form, locationName: e.target.value })}
                    />
                  </div>
                  <div>
                    <input
                      placeholder="Area Code (e.g. CH-01)"
                      className={inputStyle}
                      value={form.locationCode}
                      onChange={(e) => setForm({ ...form, locationCode: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? "Creating…" : "Create Warehouse"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
