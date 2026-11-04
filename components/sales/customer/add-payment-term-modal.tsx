"use client";

import { useState, type FormEvent } from "react";
import { CalendarDays, Clock, Loader2, Plus, X } from "lucide-react";
import { type PaymentTermItem } from "@/lib/payment-terms";

interface AddPaymentTermModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newTerm: PaymentTermItem) => void;
  organizationId?: string;
  existingTerms?: string[];
}

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function AddPaymentTermModal({
  isOpen,
  onClose,
  onCreated,
  organizationId,
  existingTerms = [],
}: AddPaymentTermModalProps) {
  const [termName, setTermName] = useState("");
  const [dueDays, setDueDays] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = termName.trim();
    if (!trimmedName) {
      setError("Please enter a payment term name.");
      return;
    }

    if (dueDays === "" || isNaN(Number(dueDays))) {
      setError("Please enter the number of due days.");
      return;
    }

    const numDays = Math.floor(Number(dueDays));
    if (numDays < 0) {
      setError("Due days must be 0 or greater.");
      return;
    }

    if (numDays > 365) {
      setError("Due days cannot exceed 365 days.");
      return;
    }

    // Check duplicate against existing terms locally
    const isDup = existingTerms.some(
      (term) => term.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDup) {
      setError(`Payment term "${trimmedName}" already exists.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/payment-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          days: numDays,
          ...(organizationId ? { organizationId } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create payment term.");
      }

      onCreated(data.term);
      setTermName("");
      setDueDays("");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create payment term.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setError("");
    setTermName("");
    setDueDays("");
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-payment-term-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h2 id="add-payment-term-title" className="text-sm font-bold text-slate-900">
                Add New Payment Term
              </h2>
              <p className="text-[11px] text-slate-500">
                Create a custom credit or payment period for invoices.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="term-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Term Name <span className="text-red-500">*</span>
            </label>
            <input
              id="term-name-input"
              type="text"
              required
              autoFocus
              value={termName}
              onChange={(e) => setTermName(e.target.value)}
              placeholder="e.g. Net 45, Custom 60 Days"
              className={inputClass}
              maxLength={60}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              The display name shown in customer forms and invoice documents.
            </p>
          </div>

          <div>
            <label htmlFor="due-days-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Number of Due Days <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="due-days-input"
                type="number"
                min="0"
                max="365"
                step="1"
                required
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 45"
                className={`${inputClass} pl-9`}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Number of days from the invoice date when payment is due (0 for Due on Receipt).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save Term</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
