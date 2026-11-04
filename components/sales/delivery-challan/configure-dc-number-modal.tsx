"use client";

import { useState } from "react";
import { Info, Layers, Loader2, X } from "lucide-react";
import { getFiscalYear, parseNextNumberInput } from "@/lib/delivery-challan-numbering";
import { type DeliveryChallanPreferencesData } from "./delivery-challan-types";

interface ConfigureDcNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings?: DeliveryChallanPreferencesData | null;
  onSaved: (updatedSettings: DeliveryChallanPreferencesData) => void;
}

export function ConfigureDcNumberModal({
  isOpen,
  onClose,
  currentSettings,
  onSaved,
}: ConfigureDcNumberModalProps) {
  const [mode, setMode] = useState<"auto" | "manual">(() =>
    currentSettings?.autoGenerateNumbering === false ? "manual" : "auto",
  );
  const [prefix, setPrefix] = useState<string>(() => currentSettings?.prefix || "DC-");
  const [nextNumberStr, setNextNumberStr] = useState<string>(() => {
    const num = currentSettings?.nextNumber ?? 2;
    const pad = currentSettings?.numberZeroPadding ?? 5;
    return String(num).padStart(pad, "0");
  });
  const [restartFiscalYear, setRestartFiscalYear] = useState<boolean>(
    () => Boolean(currentSettings?.restartNumberingEachFiscalYear),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      const isAuto = currentSettings?.autoGenerateNumbering !== false;
      setMode(isAuto ? "auto" : "manual");
      setPrefix(currentSettings?.prefix || "DC-");

      const num = currentSettings?.nextNumber ?? 2;
      const pad = currentSettings?.numberZeroPadding ?? 5;
      setNextNumberStr(String(num).padStart(pad, "0"));

      setRestartFiscalYear(Boolean(currentSettings?.restartNumberingEachFiscalYear));
      setError(null);
    }
  }

  if (!isOpen) return null;

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      const isAuto = mode === "auto";
      const cleanPrefix = isAuto ? prefix.trim() || "DC-" : prefix.trim();
      const parsedNum = parseNextNumberInput(nextNumberStr);

      const payload = {
        autoGenerateNumbering: isAuto,
        prefix: cleanPrefix,
        nextNumber: parsedNum.nextNumber,
        numberZeroPadding: parsedNum.padding,
        restartNumberingEachFiscalYear: isAuto ? restartFiscalYear : false,
      };

      const res = await fetch("/api/sales/delivery-challans/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save delivery challan numbering settings.");
      }

      onSaved(data.settings);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const previewFormatted = `${prefix.trim() || "DC-"}${nextNumberStr.trim() || "00001"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Configure Delivery Challan Number
              </h3>
              <p className="text-xs text-slate-500">
                Set up automated serial prefix & auto-incrementing numbers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Numbering Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("auto")}
                className={`px-3 py-2.5 text-xs font-semibold rounded-xl border text-left transition ${
                  mode === "auto"
                    ? "border-blue-600 bg-blue-50/60 text-blue-700 shadow-xs"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Auto-generate
                <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                  Increment sequentially
                </p>
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`px-3 py-2.5 text-xs font-semibold rounded-xl border text-left transition ${
                  mode === "manual"
                    ? "border-blue-600 bg-blue-50/60 text-blue-700 shadow-xs"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Manual Entry
                <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                  Type custom number each time
                </p>
              </button>
            </div>
          </div>

          {mode === "auto" && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Prefix
                  </label>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="DC-"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Next Number
                  </label>
                  <input
                    type="text"
                    value={nextNumberStr}
                    onChange={(e) => setNextNumberStr(e.target.value)}
                    placeholder="00002"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                <span className="text-slate-500">Live Preview: </span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 ml-1">
                  {previewFormatted}
                </span>
              </div>

              <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restartFiscalYear}
                  onChange={(e) => setRestartFiscalYear(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded mt-0.5"
                />
                <span className="text-xs text-slate-600 leading-snug">
                  Restart numbering each financial year (e.g., FY {getFiscalYear()})
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

