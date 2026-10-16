"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

type OrganizationOption = { id: string; name: string };
type SelectOption = { id: string; name: string; sku?: string };
type Lot = {
  id: string;
  lotId: string;
  commodity: { _id: string; name: string; sku: string };
  ownershipType: string;
  owner: { _id: string; legalBusinessName: string } | null;
  warehouse: { _id: string; code: string; name: string };
  locationCode: string;
  numberOfBags: number;
  unit: string;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  dispatchedQuantity: number;
  damagedQuantity: number;
  status: string;
  inwardDate: string;
};
type Movement = { movementId: string; movementType: string; quantity: number; unit: string; actorId: string; occurredAt: string; reservationId?: string; remarks?: string; hasBeenReversed?: boolean; isReversal?: boolean };
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const button = "inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50";
const fields = {
  lotId: "", commodityItemId: "", ownershipType: "Trader-owned", ownerTraderId: "",
  warehouseId: "", locationCode: "", variety: "", grade: "", cropYear: "",
  unit: "kg", openingQuantity: "0", numberOfBags: "0", bagWeight: "",
};

export function StockLotWorkspace() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [commodities, setCommodities] = useState<SelectOption[]>([]);
  const [warehouses, setWarehouses] = useState<SelectOption[]>([]);
  const [traders, setTraders] = useState<SelectOption[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [movementType, setMovementType] = useState("Inward");
  const [quantity, setQuantity] = useState("");
  const [reservationId, setReservationId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(fields);

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

  const loadOptions = useCallback(async () => {
    if (!organizationId) return;
    try {
      const [commodityResponse, warehouseResponse, traderResponse] = await Promise.all([
        fetch(`/api/commodities?organizationId=${encodeURIComponent(organizationId)}`),
        fetch(`/api/trading/warehouses?organizationId=${encodeURIComponent(organizationId)}`),
        fetch(`/api/traders?organizationId=${encodeURIComponent(organizationId)}&limit=100`),
      ]);
      const [commodityData, warehouseData, traderData] = await Promise.all([
        commodityResponse.json(), warehouseResponse.json(), traderResponse.json(),
      ]);
      for (const [response, data] of [[commodityResponse, commodityData], [warehouseResponse, warehouseData], [traderResponse, traderData]] as const) {
        if (!response.ok) throw new Error(data.error || "Unable to load stock options.");
      }
      setCommodities(commodityData.commodities.map((item: { id: string; name: string; sku: string }) => ({ id: item.id, name: item.name, sku: item.sku })));
      setWarehouses(warehouseData.warehouses.filter((item: { status: string }) => item.status === "Active").map((item: { id: string; name: string; code: string }) => ({ id: item.id, name: `${item.code} · ${item.name}` })));
      setTraders(traderData.rows.map((item: { id: string; legalBusinessName: string; traderCode: string }) => ({ id: item.id, name: `${item.traderCode} · ${item.legalBusinessName}` })));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load stock options.");
    }
  }, [organizationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOptions(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOptions]);

  const loadLots = useCallback(async () => {
    if (!organizationId) { setLots([]); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/trading/stock/lots?organizationId=${encodeURIComponent(organizationId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load stock lots.");
      setLots(data.lots);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load stock lots.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadLots(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLots]);

  const createLot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/trading/stock/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          organizationId,
          ownerTraderId: form.ownerTraderId || undefined,
          openingQuantity: Number(form.openingQuantity),
          numberOfBags: Number(form.numberOfBags),
          bagWeight: form.bagWeight ? Number(form.bagWeight) : undefined,
          grossWeight: Number(form.openingQuantity),
          tareWeight: 0,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create stock lot.");
      setNotice(`Lot ${data.lotId} created.`);
      setOpen(false);
      setForm(fields);
      await loadLots();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create stock lot.");
    } finally {
      setSaving(false);
    }
  };

  const loadMovements = async (lot: Lot) => {
    setSelectedLot(lot);
    setError("");
    try {
      const response = await fetch(`/api/trading/stock/lots/${lot.id}/movements?organizationId=${encodeURIComponent(organizationId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load stock movement history.");
      setMovements(data.movements);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load stock movement history.");
    }
  };

  const submitMovement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedLot) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/trading/stock/lots/${selectedLot.id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          action: movementType,
          quantity: Number(quantity),
          idempotencyKey: crypto.randomUUID(),
          reservationId: reservationId || undefined,
          destinationWarehouseId: destinationWarehouseId || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to record movement.");
      setNotice(data.replayed ? "The movement had already been recorded." : `Movement saved (${data.movementId}).`);
      setQuantity("");
      setReservationId("");
      setDestinationWarehouseId("");
      await Promise.all([loadLots(), loadMovements(selectedLot)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record movement.");
    } finally {
      setSaving(false);
    }
  };

  const reverseMovement = async (movement: Movement) => {
    if (!selectedLot || movement.isReversal || movement.hasBeenReversed) return;
    if (!window.confirm(`Reverse movement ${movement.movementId}? This is recorded as a new, audited stock movement.`)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/trading/stock/lots/${selectedLot.id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          action: "Reverse",
          quantity: movement.quantity,
          originalMovementId: movement.movementId,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to reverse movement.");
      setNotice(`Reversal recorded (${data.movementId}).`);
      await Promise.all([loadLots(), loadMovements(selectedLot)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reverse movement.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Trading / Inventory</p><h1 className="mt-1 text-3xl font-semibold">Stock lots</h1><p className="mt-1 text-sm text-slate-600">Track commodity ownership, warehouse position, reservations and traceable movements.</p></div><button type="button" disabled={!organizationId} className={button} onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create stock lot</button></div>
    {isAdmin && <label className="block max-w-md"><span className="mb-1 block text-xs font-medium text-slate-600">Organization scope</span><select className={input} value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Select an organization</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {loading ? <p className="p-10 text-center text-sm text-slate-500">Loading lots…</p> : !organizationId ? <p className="p-10 text-center text-sm text-slate-500">{isAdmin ? "Select an organization to view stock." : "No organization is linked to your account."}</p> : lots.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No lots recorded. Configure commodities and warehouses first.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Lot", "Commodity", "Owner / storage", "On hand", "Reserved", "Available", "Status", "History"].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{lots.map((lot) => <tr key={lot.id}><td className="px-4 py-3 font-semibold">{lot.lotId}<p className="text-xs font-normal text-slate-500">{lot.locationCode}</p></td><td className="px-4 py-3">{lot.commodity?.name || "—"}<p className="text-xs text-slate-500">{lot.commodity?.sku}</p></td><td className="px-4 py-3">{lot.owner?.legalBusinessName || lot.ownershipType}<p className="text-xs text-slate-500">{lot.warehouse?.name || "—"}</p></td><td className="whitespace-nowrap px-4 py-3">{lot.physicalQuantity} {lot.unit}</td><td className="px-4 py-3">{lot.reservedQuantity}</td><td className="px-4 py-3 font-semibold">{lot.availableQuantity} {lot.unit}</td><td className="px-4 py-3">{lot.status}</td><td className="px-4 py-3"><button type="button" className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => void loadMovements(lot)}>Movement / actions</button></td></tr>)}</tbody></table></div>}
    </section>
    {open && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8"><form onSubmit={createLot} className="my-auto w-full max-w-3xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl"><div><h2 className="text-xl font-semibold">Create stock lot</h2><p className="mt-1 text-sm text-slate-500">Opening quantity is recorded as an immutable opening-stock movement.</p></div><div className="grid gap-3 sm:grid-cols-2">
      <label><span className="mb-1 block text-xs font-medium text-slate-600">Lot ID *</span><input required className={input} value={form.lotId} onChange={(e) => setForm({ ...form, lotId: e.target.value })} /></label>
      <label><span className="mb-1 block text-xs font-medium text-slate-600">Commodity *</span><select required className={input} value={form.commodityItemId} onChange={(e) => setForm({ ...form, commodityItemId: e.target.value })}><option value="">Select commodity</option>{commodities.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</select></label>
      <label><span className="mb-1 block text-xs font-medium text-slate-600">Ownership</span><select className={input} value={form.ownershipType} onChange={(e) => setForm({ ...form, ownershipType: e.target.value })}>{["Trader-owned", "Customer-owned", "Consignment", "Warehouse-owned"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span className="mb-1 block text-xs font-medium text-slate-600">Owner trader</span><select className={input} value={form.ownerTraderId} onChange={(e) => setForm({ ...form, ownerTraderId: e.target.value })}><option value="">Select trader (optional)</option>{traders.map((trader) => <option key={trader.id} value={trader.id}>{trader.name}</option>)}</select></label>
      <label><span className="mb-1 block text-xs font-medium text-slate-600">Warehouse *</span><select required className={input} value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}><option value="">Select warehouse</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
      <label><span className="mb-1 block text-xs font-medium text-slate-600">Storage area code</span><input className={input} value={form.locationCode} onChange={(e) => setForm({ ...form, locationCode: e.target.value })} /></label>
      {([["variety", "Variety"], ["grade", "Grade"], ["cropYear", "Crop year"], ["unit", "Unit *"], ["openingQuantity", "Opening quantity"], ["numberOfBags", "Number of bags"], ["bagWeight", "Bag weight"]] as const).map(([key, title]) => <label key={key}><span className="mb-1 block text-xs font-medium text-slate-600">{title}</span><input type={["openingQuantity", "numberOfBags", "bagWeight"].includes(key) ? "number" : "text"} min={key === "bagWeight" ? "0.001" : "0"} required={key === "unit"} className={input} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
    </div><div className="flex justify-end gap-2 border-t pt-3"><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setOpen(false)}>Cancel</button><button disabled={saving || commodities.length === 0 || warehouses.length === 0} className={button}>{saving ? "Saving…" : "Create lot"}</button></div></form></div>}
    {selectedLot && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8" onClick={() => setSelectedLot(null)}><section className="my-auto w-full max-w-3xl space-y-5 rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex justify-between"><div><h2 className="text-xl font-semibold">{selectedLot.lotId} · {selectedLot.commodity?.name}</h2><p className="text-sm text-slate-500">Available {selectedLot.availableQuantity} {selectedLot.unit} · {selectedLot.warehouse?.name}</p></div><button type="button" aria-label="Close" onClick={() => setSelectedLot(null)}><X className="h-5 w-5" /></button></div>
      <form onSubmit={submitMovement} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-medium text-slate-600">Movement</span><select className={input} value={movementType} onChange={(e) => setMovementType(e.target.value)}>{["Inward", "Reserve", "Release", "Dispatch", "Damage", "Transfer"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span className="mb-1 block text-xs font-medium text-slate-600">Quantity ({selectedLot.unit})</span><input required type="number" min="0.000001" step="any" className={input} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
      {(movementType === "Reserve" || movementType === "Release") && <label><span className="mb-1 block text-xs font-medium text-slate-600">Reservation ID</span><input required className={input} value={reservationId} onChange={(e) => setReservationId(e.target.value)} /></label>}
      {movementType === "Transfer" && <label><span className="mb-1 block text-xs font-medium text-slate-600">Destination warehouse</span><select required className={input} value={destinationWarehouseId} onChange={(e) => setDestinationWarehouseId(e.target.value)}><option value="">Select destination</option>{warehouses.filter((item) => item.id !== selectedLot.warehouse?._id).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>}
      <button type="submit" className={button} disabled={saving}>{saving ? "Saving…" : "Record movement"}</button></form>
      <div><h3 className="mb-2 text-sm font-semibold">Traceable movement history</h3>{movements.length === 0 ? <p className="text-sm text-slate-500">No recorded movements.</p> : <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">{movements.map((movement) => <li key={movement.movementId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"><span><strong>{movement.movementType}</strong> · {movement.quantity} {movement.unit}{movement.reservationId ? ` · reservation ${movement.reservationId}` : ""}<span className="block text-xs text-slate-500">{movement.movementId} · {movement.actorId}{movement.hasBeenReversed ? " · reversed" : ""}</span></span><div className="flex items-center gap-3"><time className="text-xs text-slate-500">{new Date(movement.occurredAt).toLocaleString()}</time>{!movement.isReversal && !movement.hasBeenReversed && <button type="button" className="text-xs font-medium text-red-700 hover:underline" disabled={saving} onClick={() => void reverseMovement(movement)}>Reverse</button>}</div></li>)}</ul>}</div>
      <div className="flex justify-end border-t pt-3"><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setSelectedLot(null)}>Close</button></div>
    </section></div>}
  </div>;
}
