"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Sparkles,
  Tag,
  Truck,
  X,
} from "lucide-react";

function IndianRupeeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 3h12" />
      <path d="M6 8h12" />
      <path d="m6 13 8.5 8" />
      <path d="M6 13h3" />
      <path d="M9 13c6.667 0 6.667-10 0-10" />
    </svg>
  );
}

import {
  standardUnits,
  standardCategories,
  salesAccounts,
  purchaseAccounts,
} from "./item-constants";
import { getAllUnitsList, getStoredCustomUnits, type UnitOption } from "./unit-storage";
import { AddUnitModal } from "./add-unit-modal";
import { ItemMarginPreview } from "./item-margin-preview";
import {
  fetchInventoryPreference,
  getStoredInventoryPreference,
} from "./inventory-preference";
import { type ItemRecord } from "./item-types";

export interface NewItemFormProps {
  mode?: "create" | "edit";
  initialData?: Partial<ItemRecord> | null;
  itemId?: string;
  inModal?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function NewItemForm({
  mode = "create",
  initialData,
  itemId,
  inModal = false,
  onSuccess,
  onCancel,
}: NewItemFormProps) {
  const router = useRouter();

  const isEdit = mode === "edit" || Boolean(itemId) || Boolean(initialData?.id);
  const targetId = itemId || initialData?.id;

  const [name, setName] = useState(initialData?.name || "");
  const [sku, setSku] = useState(initialData?.sku || "");
  const [type, setType] = useState<"goods" | "service">(initialData?.type || "goods");
  const [unit, setUnit] = useState(initialData?.unit || "pcs");
  const [category, setCategory] = useState(initialData?.commodityCategory || initialData?.category || "");
  const [openingStock, setOpeningStock] = useState(
    initialData?.openingStock !== undefined
      ? String(initialData.openingStock)
      : initialData?.stock !== undefined
      ? String(initialData.stock)
      : "0"
  );
  const [isInventoryEnabled, setIsInventoryEnabled] = useState(false);
  const [unitsList, setUnitsList] = useState<UnitOption[]>(() => {
    if (initialData?.unit && !standardUnits.some((u) => u.value.toLowerCase() === initialData.unit?.toLowerCase())) {
      return [{ value: initialData.unit, label: `${initialData.unit} (${initialData.unit})` }, ...standardUnits];
    }
    return standardUnits;
  });
  const [vendorsList, setVendorsList] = useState<string[]>([]);
  const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState(false);

  // Sales Info
  const [salesInfoEnabled, setSalesInfoEnabled] = useState(
    initialData?.trackSales !== undefined ? Boolean(initialData.trackSales) : true
  );
  const [sellingPrice, setSellingPrice] = useState(
    initialData?.salesPrice !== undefined && initialData?.salesPrice !== null ? String(initialData.salesPrice) : ""
  );
  const [salesAccount, setSalesAccount] = useState(initialData?.salesAccount || "Sales");
  const [salesDescription, setSalesDescription] = useState(initialData?.salesDescription || "");

  // Purchase Info
  const [purchaseInfoEnabled, setPurchaseInfoEnabled] = useState(
    initialData?.trackPurchase !== undefined ? Boolean(initialData.trackPurchase) : true
  );
  const [costPrice, setCostPrice] = useState(
    initialData?.purchasePrice !== undefined && initialData?.purchasePrice !== null ? String(initialData.purchasePrice) : ""
  );
  const [purchaseAccount, setPurchaseAccount] = useState(initialData?.purchaseAccount || "Cost of Goods Sold");
  const [purchaseDescription, setPurchaseDescription] = useState(initialData?.purchaseDescription || "");
  const [preferredVendor, setPreferredVendor] = useState(initialData?.preferredVendor || "");

  // State
  const [loading, setLoading] = useState(Boolean(itemId && !initialData));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (itemId && !initialData) {
      fetch(`/api/items/${itemId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.item) {
            const it = data.item;
            setName(it.name || "");
            setSku(it.sku || "");
            setType(it.type || "goods");
            if (it.unit) {
              setUnit(it.unit);
              setUnitsList((prev) => {
                if (!prev.some((u) => u.value.toLowerCase() === it.unit?.toLowerCase())) {
                  return [{ value: it.unit, label: `${it.unit} (${it.unit})` }, ...prev];
                }
                return prev;
              });
            }
            setCategory(it.commodityCategory || it.category || "");
            setOpeningStock(String(it.openingStock ?? it.stock ?? 0));
            setSellingPrice(it.salesPrice ? String(it.salesPrice) : "");
            setSalesAccount(it.salesAccount || "Sales");
            setSalesDescription(it.salesDescription || "");
            setCostPrice(it.purchasePrice ? String(it.purchasePrice) : "");
            setPurchaseAccount(it.purchaseAccount || "Cost of Goods Sold");
            setPurchaseDescription(it.purchaseDescription || "");
            setPreferredVendor(it.preferredVendor || "");
          }
        })
        .finally(() => setLoading(false));
    }
  }, [itemId, initialData]);

  useEffect(() => {
    let isMounted = true;

    // Load custom units from localStorage after hydration to prevent SSR mismatch
    fetch("/api/units")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.units && Array.isArray(data.units)) {
          setUnitsList(getAllUnitsList([...getStoredCustomUnits(), ...data.units]));
        }
      })
      .catch(() => {
        if (isMounted) {
          setUnitsList(getAllUnitsList(getStoredCustomUnits()));
        }
      });

    const handleUnitsUpdated = () => {
      if (isMounted) {
        setUnitsList(getAllUnitsList(getStoredCustomUnits()));
      }
    };

    window.addEventListener("custom_units_updated", handleUnitsUpdated);

    // Load inventory preference
    fetchInventoryPreference()
      .then((enabled) => {
        if (isMounted) setIsInventoryEnabled(enabled);
      })
      .catch(() => {});

    // Load dynamic vendors list
    fetch("/api/vendors")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.vendors && Array.isArray(data.vendors)) {
          const names = data.vendors
            .map((v: { displayName?: string; name?: string }) => v.displayName || v.name)
            .filter(Boolean);
          setVendorsList(names);
        }
      })
      .catch(() => {});

    const handlePrefUpdated = () => {
      if (isMounted) {
        setIsInventoryEnabled(getStoredInventoryPreference());
      }
    };

    window.addEventListener("inventory_preference_updated", handlePrefUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener("custom_units_updated", handleUnitsUpdated);
      window.removeEventListener("inventory_preference_updated", handlePrefUpdated);
    };
  }, []);

  // Live calculation of profit margin
  const sellNum = parseFloat(sellingPrice) || 0;
  const costNum = parseFloat(costPrice) || 0;
  const profitPerUnit = sellNum - costNum;
  const marginPercent = sellNum > 0 ? Math.round((profitPerUnit / sellNum) * 100) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Item name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = isEdit && targetId ? `/api/items/${targetId}` : "/api/items";
      const method = isEdit ? "PUT" : "POST";

      const payload = {
        ...(isEdit && targetId ? { id: targetId } : {}),
        name: name.trim(),
        sku: sku.trim() || undefined,
        type,
        unit: unit || "pcs",
        commodityCategory: category.trim() || undefined,
        category: category.trim() || undefined,
        openingStock: isInventoryEnabled ? parseFloat(openingStock) || 0 : 0,
        trackSales: salesInfoEnabled,
        salesPrice: salesInfoEnabled && sellingPrice ? parseFloat(sellingPrice) : 0,
        salesAccount,
        salesDescription,
        trackPurchase: purchaseInfoEnabled,
        purchasePrice: purchaseInfoEnabled && costPrice ? parseFloat(costPrice) : 0,
        purchaseAccount,
        purchaseDescription,
        preferredVendor,
      };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || (isEdit ? "Failed to update item" : "Failed to create item"));
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/items");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isEdit ? "Something went wrong updating the item" : "Something went wrong creating the item"));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/items");
    }
  };

  return (
    <div
      className={`w-full bg-white rounded-2xl border border-slate-200/90 text-slate-800 flex flex-col ${
        inModal
          ? "max-h-[calc(100dvh-2.5rem)] sm:max-h-[calc(100dvh-4rem)] shadow-2xl overflow-hidden"
          : "shadow-sm overflow-hidden"
      }`}
    >
      {/* Header Bar */}
      <div
        className={`flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-gradient-to-r from-slate-50/70 to-white z-10 ${
          inModal ? "shrink-0" : "sticky top-0 bg-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition shadow-2xs"
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEdit ? "Edit Item" : "Create New Item"}
            </h2>
            <p className="text-xs text-slate-500">
              {isEdit
                ? "Update product, commodity details, pricing, or inventory configuration"
                : "Add a product, commodity, or billable service to your inventory"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCancel}
          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className={`flex flex-col min-h-0 ${inModal ? "flex-1 overflow-hidden" : ""}`}>
        <div className={`p-6 space-y-6 ${inModal ? "flex-1 overflow-y-auto overscroll-contain" : ""}`}>
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 font-medium flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)}>
                <X className="w-4 h-4 text-rose-500" />
              </button>
            </div>
          )}

          {/* Inventory Tracking Informational Banner (Zoho Books Reference) */}
          {!isInventoryEnabled && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/90 p-4 text-slate-800 shadow-2xs">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold"
                  aria-hidden="true"
                >
                  ℹ
                </div>
                <div className="space-y-1 text-xs leading-relaxed text-slate-700">
                  <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>ℹ️</span> Do you want to keep track of this item?
                  </p>
                  <p className="text-slate-600 text-xs">
                    <Link
                      href="/settings/preferences/items"
                      className="font-bold text-blue-700 hover:text-blue-800 underline transition underline-offset-2"
                    >
                      Enable Inventory
                    </Link>{" "}
                    to track the item&apos;s stock based on the sales and purchase transactions recorded for it. Go to{" "}
                    <Link
                      href="/settings/preferences/items"
                      className="font-bold text-slate-900 hover:text-blue-700 transition"
                    >
                      Settings &gt; Preferences &gt; Items
                    </Link>{" "}
                    and enable inventory.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Type Selector (Goods vs Service Cards) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Item Classification
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              {/* Goods Card */}
              <div
                onClick={() => setType("goods")}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3.5 ${
                  type === "goods"
                    ? "border-emerald-600 bg-emerald-50/40 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    type === "goods" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">Goods</span>
                    {type === "goods" && (
                      <span className="h-4 w-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Physical commodities, agricultural crops, packaged products with stock tracking
                  </p>
                </div>
              </div>

              {/* Service Card */}
              <div
                onClick={() => setType("service")}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3.5 ${
                  type === "service"
                    ? "border-purple-600 bg-purple-50/40 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    type === "service" ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">Service</span>
                    {type === "service" && (
                      <span className="h-4 w-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Labor, brokerage fee, packaging, freight, cleaning, milling, or consulting
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Basic Information */}
          <div className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Tag className="h-4 w-4 text-blue-600" />
              General Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Item Name */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  Item Name<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Organic Basmati Rice 25kg"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 bg-white text-slate-900 font-medium transition"
                />
              </div>

              {/* SKU */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">SKU / Code</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g. SKU-BAS-25"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 bg-white font-mono text-slate-800 transition"
                />
              </div>

              {/* Category / Commodity */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Category / Commodity</label>
                <input
                  type="text"
                  list="category-suggestions"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Grains & Cereals, Pulses..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 bg-white text-slate-900 transition"
                />
                <datalist id="category-suggestions">
                  {standardCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* Unit of Measurement */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Unit of Measurement</label>
                  <button
                    type="button"
                    onClick={() => setIsAddUnitModalOpen(true)}
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition cursor-pointer"
                  >
                    + Add New Unit
                  </button>
                </div>
                <div className="relative">
                  <select
                    value={unit}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (
                        val === "ADD_NEW_UNIT" ||
                        val === "__ADD_NEW__" ||
                        val === "Add New Unit"
                      ) {
                        setIsAddUnitModalOpen(true);
                      } else {
                        setUnit(val);
                      }
                    }}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white text-slate-800 cursor-pointer transition"
                  >
                    {unitsList.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                    <option disabled value="">
                      ──────────
                    </option>
                    <option value="ADD_NEW_UNIT" className="font-semibold text-emerald-600">
                      Add New Unit
                    </option>
                  </select>
                </div>
              </div>

              {/* Initial Opening Stock (when inventory is enabled) */}
              {isInventoryEnabled && type === "goods" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      {isEdit ? "Opening / Base Stock" : "Initial Opening Stock"}
                    </label>
                    <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Tracking Active
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={openingStock}
                    onChange={(e) => setOpeningStock(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 bg-white text-slate-900 transition"
                  />
                  <p className="text-[11px] text-slate-500">
                    Base stock level before sales and purchase transaction adjustments.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Sales & Pricing */}
          <div className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={salesInfoEnabled}
                  onChange={(e) => setSalesInfoEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <IndianRupeeIcon className="h-4 w-4 text-emerald-600" />
                  Sales Information
                </span>
              </label>
              <span className="text-xs text-slate-400">Enable item for sales quotes & invoices</span>
            </div>

            {salesInfoEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Selling Price */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    Selling Price (₹)<span className="text-red-500">*</span>
                  </label>
                  <div className="flex rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:border-blue-500 focus-within:ring-3 focus-within:ring-blue-500/10">
                    <span className="px-3 py-2 bg-slate-100 text-slate-600 font-semibold text-xs border-r border-slate-300 flex items-center">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-sm outline-none text-slate-900 font-bold"
                    />
                  </div>
                </div>

                {/* Sales Account */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Income Account</label>
                  <select
                    value={salesAccount}
                    onChange={(e) => setSalesAccount(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white text-slate-800 cursor-pointer"
                  >
                    {salesAccounts.map((acc) => (
                      <option key={acc} value={acc}>
                        {acc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sales Description */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Sales Description (on Invoices)</label>
                  <textarea
                    rows={2}
                    value={salesDescription}
                    onChange={(e) => setSalesDescription(e.target.value)}
                    placeholder="Specification or billing description that appears on transaction PDFs..."
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white resize-y"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Purchase & Cost */}
          <div className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purchaseInfoEnabled}
                  onChange={(e) => setPurchaseInfoEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-amber-600" />
                  Purchase & Procurement
                </span>
              </label>
              <span className="text-xs text-slate-400">Enable item for vendor bills & purchase orders</span>
            </div>

            {purchaseInfoEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Cost Price */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Cost Price (INR)</label>
                  <div className="flex rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:border-blue-500 focus-within:ring-3 focus-within:ring-blue-500/10">
                    <span className="px-3 py-2 bg-slate-100 text-slate-600 font-semibold text-xs border-r border-slate-300 flex items-center">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-sm outline-none text-slate-900 font-medium"
                    />
                  </div>
                </div>

                {/* Purchase Account */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Expense Account</label>
                  <select
                    value={purchaseAccount}
                    onChange={(e) => setPurchaseAccount(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white text-slate-800 cursor-pointer"
                  >
                    {purchaseAccounts.map((acc) => (
                      <option key={acc} value={acc}>
                        {acc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preferred Vendor */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Preferred Vendor</label>
                  <select
                    value={preferredVendor}
                    onChange={(e) => setPreferredVendor(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white text-slate-800 cursor-pointer"
                  >
                    <option value="">Select a vendor (optional)</option>
                    {vendorsList.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Purchase Description */}
                <div className="md:col-span-1 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Purchase Description</label>
                  <textarea
                    rows={2}
                    value={purchaseDescription}
                    onChange={(e) => setPurchaseDescription(e.target.value)}
                    placeholder="Specifications for supplier purchase orders..."
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white resize-y"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Profit Margin Preview Card */}
          <ItemMarginPreview
            sellNum={sellNum}
            costNum={costNum}
            profitPerUnit={profitPerUnit}
            marginPercent={marginPercent}
          />
        </div>

        {/* Footer Actions */}
        <div
          className={`flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200 z-10 ${
            inModal ? "shrink-0" : "sticky bottom-0 bg-slate-50/95 backdrop-blur-xs"
          }`}
        >
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl shadow-2xs transition"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm hover:shadow-md transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            {loading ? (isEdit ? "Updating Item..." : "Saving Item...") : isEdit ? "Save Changes" : "Save Item"}
          </button>
        </div>
      </form>

      <AddUnitModal
        isOpen={isAddUnitModalOpen}
        onClose={() => setIsAddUnitModalOpen(false)}
        onUnitCreated={(newUnit) => {
          setUnitsList((prev) => getAllUnitsList([...prev, newUnit]));
          setUnit(newUnit.value);
        }}
      />
    </div>
  );
}
