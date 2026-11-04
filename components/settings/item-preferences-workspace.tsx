"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  Package,
  Save,
  Sliders,
} from "lucide-react";
import {
  fetchInventoryPreference,
  saveInventoryPreference,
} from "@/components/items/inventory-preference";

export function ItemPreferencesWorkspace() {
  const [inventoryEnabled, setInventoryEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchInventoryPreference()
      .then((enabled) => {
        setInventoryEnabled(enabled);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      await saveInventoryPreference(inventoryEnabled);
      setFeedback({
        type: "success",
        message: inventoryEnabled
          ? "Inventory tracking enabled. Item stock will now be tracked based on sales and purchase transactions."
          : "Inventory tracking disabled. Items will no longer be tracked for inventory.",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "Failed to save preferences. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6 space-y-6 text-slate-800">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link href="/settings" className="hover:text-slate-800 transition">
          Settings
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <Link href="/settings/preferences/items" className="hover:text-slate-800 transition">
          Preferences
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span className="text-slate-900 font-semibold">Items</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Sliders className="h-3 w-3 text-blue-600" />
              Settings &gt; Preferences &gt; Items
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Items & Inventory Preferences
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure how item stock, commodities, and transactions are tracked in your organization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/items/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to New Item</span>
          </Link>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-3 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <Info className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Settings Card */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-gradient-to-r from-slate-50/70 to-white">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Inventory Tracking</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Track the item&apos;s stock based on the sales and purchase transactions recorded for it.
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              inventoryEnabled
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            {inventoryEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Main Toggle Switch */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
            <div className="space-y-1">
              <label
                htmlFor="enable-inventory-toggle"
                className="text-sm font-bold text-slate-900 cursor-pointer flex items-center gap-2"
              >
                Enable Inventory Tracking
              </label>
              <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                When enabled, stock levels for physical commodities and goods will be automatically tracked and adjusted based on recorded sales and purchase transactions (invoices, sales orders, purchase bills, and orders).
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                id="enable-inventory-toggle"
                type="checkbox"
                checked={inventoryEnabled}
                onChange={(e) => setInventoryEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Contextual Information Card */}
          <div className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/70 text-xs text-blue-900 space-y-2">
            <div className="font-bold flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span>How Stock Tracking Works</span>
            </div>
            <p className="text-blue-800 leading-relaxed">
              {inventoryEnabled ? (
                <>
                  <strong>Inventory tracking is active:</strong> Creating or confirming sales invoices decreases item stock, while recording purchase bills increases item stock. Stock levels reflect: <em>Opening Stock + Purchases - Sales</em>.
                </>
              ) : (
                <>
                  <strong>Inventory tracking is currently disabled:</strong> Items in your catalog will not be tracked for stock quantities. New items will display an informational banner guiding users to enable inventory here.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <Link
            href="/items"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            View Items Catalog
          </Link>

          <button
            type="submit"
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-xs transition hover:shadow cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving Preferences…</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
