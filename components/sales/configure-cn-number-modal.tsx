"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, Layers, Loader2, Plus, X } from "lucide-react";
import { getFiscalYear, parseNextNumberInput } from "@/lib/credit-note-numbering";

export interface CreditNotePreferencesData {
  autoGenerateNumbering: boolean;
  prefix: string;
  nextNumber: number;
  numberZeroPadding: number;
  restartNumberingEachFiscalYear: boolean;
  lastFiscalYear?: string;
  formattedNextNumber?: string;
}

interface ConfigureCnNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings?: CreditNotePreferencesData | null;
  onSaved: (updatedSettings: CreditNotePreferencesData) => void;
}

export function ConfigureCnNumberModal({
  isOpen,
  onClose,
  currentSettings,
  onSaved,
}: ConfigureCnNumberModalProps) {
  const [mode, setMode] = useState<"auto" | "manual">(() =>
    currentSettings?.autoGenerateNumbering === false ? "manual" : "auto",
  );
  const [prefix, setPrefix] = useState<string>(
    () =>
      currentSettings?.prefix ||
      ((currentSettings as Record<string, unknown> | null)?.creditNotePrefix as string) ||
      "CN-",
  );
  const [nextNumberStr, setNextNumberStr] = useState<string>(() => {
    const num = currentSettings?.nextNumber ?? 2;
    const pad = currentSettings?.numberZeroPadding ?? 5;
    return String(num).padStart(pad, "0");
  });
  const [restartFiscalYear, setRestartFiscalYear] = useState<boolean>(
    () => Boolean(currentSettings?.restartNumberingEachFiscalYear),
  );
  const [showPrefixTags, setShowPrefixTags] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      const isAuto = currentSettings?.autoGenerateNumbering !== false;
      setMode(isAuto ? "auto" : "manual");
      setPrefix(
        currentSettings?.prefix ||
          ((currentSettings as Record<string, unknown> | null)?.creditNotePrefix as string) ||
          "CN-",
      );

      const num = currentSettings?.nextNumber ?? 2;
      const pad = currentSettings?.numberZeroPadding ?? 5;
      setNextNumberStr(String(num).padStart(pad, "0"));

      setRestartFiscalYear(Boolean(currentSettings?.restartNumberingEachFiscalYear));
      setError(null);
      setShowPrefixTags(false);
    }
  }

  if (!isOpen) return null;

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      const isAuto = mode === "auto";
      const cleanPrefix = isAuto ? prefix.trim() || "CN-" : prefix.trim();
      const parsedNum = parseNextNumberInput(nextNumberStr);

      const payload = {
        autoGenerateNumbering: isAuto,
        prefix: cleanPrefix,
        nextNumber: parsedNum.nextNumber,
        numberZeroPadding: parsedNum.padding,
        restartNumberingEachFiscalYear: isAuto ? restartFiscalYear : false,
      };

      const res = await fetch("/api/sales/credit-notes/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save credit note preferences.");
      }

      const resSettings = (data.preferences || data.settings || {}) as Record<string, unknown>;
      const updated: CreditNotePreferencesData = {
        autoGenerateNumbering: resSettings.autoGenerateNumbering !== false,
        prefix: (resSettings.prefix || resSettings.creditNotePrefix || cleanPrefix) as string,
        nextNumber: (resSettings.nextNumber || parsedNum.nextNumber) as number,
        numberZeroPadding: (resSettings.numberZeroPadding || parsedNum.padding) as number,
        restartNumberingEachFiscalYear: Boolean(resSettings.restartNumberingEachFiscalYear),
        lastFiscalYear: resSettings.lastFiscalYear as string | undefined,
        formattedNextNumber: data.formattedNextNumber as string | undefined,
      };
      onSaved(updated);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save preferences.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleInsertTag = (tag: string) => {
    setPrefix((prev) => `${prev.trim()}${tag}`);
    setShowPrefixTags(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="configure-cn-title"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3">
          <h3
            id="configure-cn-title"
            className="text-base sm:text-lg font-bold text-slate-900"
          >
            Configure Credit Note# Preferences
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Top Banner Card: Transaction Number Series */}
        <div className="mt-2 rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white mt-0.5">
            <Layers className="h-4 w-4" />
          </div>
          <div className="flex-1 text-xs text-slate-600 leading-relaxed">
            Configure multiple transaction number series to auto-generate transaction numbers with unique prefixes according to your business needs.
          </div>
          <Link
            href="/settings/preferences"
            onClick={onClose}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline shrink-0 flex items-center gap-0.5 mt-0.5"
          >
            Configure →
          </Link>
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-slate-100" />

        {/* Error notice if any */}
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Informational Text */}
        <p className="text-xs sm:text-sm text-slate-700 leading-normal">
          Your credit note numbers are set on auto-generate mode to save your time.
          <br />
          Are you sure about changing this setting?
        </p>

        {/* Options */}
        <div className="mt-4 space-y-4">
          {/* Option 1: Continue auto-generating */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cn-numbering-mode"
                checked={mode === "auto"}
                onChange={() => setMode("auto")}
                className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs sm:text-sm font-semibold text-slate-900">
                Continue auto-generating credit note numbers
              </span>
              <span
                className="text-slate-400 hover:text-slate-600 cursor-help"
                title="Credit note numbers will be generated automatically in sequence for each new credit note."
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </label>

            {/* Prefix & Next Number inputs (Indented) */}
            <div
              className={`ml-6 mt-3 space-y-3 transition-opacity ${
                mode === "auto" ? "opacity-100" : "opacity-40 pointer-events-none"
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Prefix */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Prefix
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      disabled={mode !== "auto"}
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      placeholder="CN-"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-9 font-mono text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <button
                        type="button"
                        onClick={() => setShowPrefixTags(!showPrefixTags)}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                        title="Add prefix variable tag"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>

                      {showPrefixTags && (
                        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 text-xs animate-in fade-in duration-100">
                          <p className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Insert variable tag:
                          </p>
                          <button
                            type="button"
                            onClick={() => handleInsertTag(`FY${getFiscalYear().replace("-", "")}-`)}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition"
                          >
                            Fiscal Year ({`FY${getFiscalYear().replace("-", "")}-`})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInsertTag(`${new Date().getFullYear()}-`)}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition"
                          >
                            Current Year ({new Date().getFullYear()}-)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Next Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Next Number
                  </label>
                  <input
                    type="text"
                    disabled={mode !== "auto"}
                    value={nextNumberStr}
                    onChange={(e) => setNextNumberStr(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="00002"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Leading zeros preserve the sequence width.
                  </p>
                </div>
              </div>

              {/* Fiscal Year Restart Checkbox */}
              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    disabled={mode !== "auto"}
                    checked={restartFiscalYear}
                    onChange={(e) => setRestartFiscalYear(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>
                    Restart numbering for credit notes at the start of each fiscal year.
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Option 2: Enter manually */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cn-numbering-mode"
                checked={mode === "manual"}
                onChange={() => setMode("manual")}
                className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs sm:text-sm font-semibold text-slate-900">
                Enter credit note numbers manually
              </span>
            </label>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-8 flex items-center gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 transition cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

