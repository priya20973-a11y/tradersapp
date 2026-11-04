"use client";

import { useState, useId } from "react";
import { Loader2, Plus, Ruler, X } from "lucide-react";
import { saveStoredCustomUnit, type UnitOption } from "./unit-storage";

interface AddUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnitCreated: (unit: UnitOption) => void;
}

export function AddUnitModal({ isOpen, onClose, onUnitCreated }: AddUnitModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitNameId = useId();
  const unitCodeId = useId();

  if (!isOpen) return null;

  const trimmedName = name.trim();
  const trimmedCode = code.trim();

  // Compute live preview
  const previewValue = (
    trimmedCode ||
    trimmedName ||
    "unit"
  )
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");

  const previewLabel = trimmedCode && trimmedCode.toLowerCase() !== trimmedName.toLowerCase()
    ? `${trimmedCode} (${trimmedName})`
    : trimmedName || "Custom Unit";

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setName("");
    setCode("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedName) {
      setError("Unit name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    const generatedValue = (trimmedCode || trimmedName).toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const generatedLabel = trimmedCode && trimmedCode.toLowerCase() !== trimmedName.toLowerCase()
      ? `${trimmedCode} (${trimmedName})`
      : trimmedName;

    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          code: trimmedCode || undefined,
          value: generatedValue,
          label: generatedLabel,
        }),
      });

      let savedUnit: UnitOption = {
        value: generatedValue,
        label: generatedLabel,
      };

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.unit?.value && data?.unit?.label) {
          savedUnit = {
            value: data.unit.value,
            label: data.unit.label,
          };
        }
      }

      // Always persist to client storage for instant offline / reload availability
      saveStoredCustomUnit(savedUnit);

      onUnitCreated(savedUnit);
      handleClose();
    } catch {
      // If network fails, still save locally
      const fallbackUnit: UnitOption = {
        value: generatedValue,
        label: generatedLabel,
      };
      saveStoredCustomUnit(fallbackUnit);
      onUnitCreated(fallbackUnit);
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-unit-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Ruler className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 id="add-unit-title" className="text-base font-bold text-slate-900 leading-tight">
                Add New Unit
              </h3>
              <p className="text-xs text-slate-500">Create a custom unit of measurement</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor={unitNameId} className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>
                Unit Name <span className="text-rose-500">*</span>
              </span>
              <span className="text-[11px] font-normal text-slate-400">e.g. Bale, Crate, Carton</span>
            </label>
            <input
              id={unitNameId}
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Crate"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 bg-white text-slate-900 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={unitCodeId} className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Unit Symbol / Abbreviation</span>
              <span className="text-[11px] font-normal text-slate-400">Optional</span>
            </label>
            <input
              id={unitCodeId}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. crt"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 bg-white font-mono text-slate-900 transition"
            />
          </div>

          {/* Live Preview Pill */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Dropdown Preview
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-xs">
                {previewLabel}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                (value: {previewValue})
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !trimmedName}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-xs transition hover:shadow cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save Unit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
