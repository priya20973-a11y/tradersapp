"use client";

import { useEffect, useState } from "react";
import { AlertCircle, FileText, Loader2, X } from "lucide-react";

export interface OpenInvoiceItem {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  creditedAmount: number;
  balanceDue: number;
  status: string;
  subject?: string;
}

interface ApplyCreditToInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditNoteId: string;
  creditNoteNumber: string;
  customerName: string;
  availableBalance: number;
  onSuccess: () => void;
}

export function ApplyCreditToInvoiceModal({
  isOpen,
  onClose,
  creditNoteId,
  creditNoteNumber,
  customerName,
  availableBalance,
  onSuccess,
}: ApplyCreditToInvoiceModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<OpenInvoiceItem[]>([]);
  const [appliedAmounts, setAppliedAmounts] = useState<Record<string, string>>({});
  const [currentAvailable, setCurrentAvailable] = useState<number>(availableBalance);

  useEffect(() => {
    if (!isOpen || !creditNoteId) return;

    let isMounted = true;

    fetch(`/api/sales/credit-notes/${creditNoteId}/invoices`)
      .then(async (res) => {
        if (!isMounted) return null;
        setLoading(true);
        setError(null);
        setAppliedAmounts({});
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load customer invoices.");
        return data;
      })
      .then((data) => {
        if (!isMounted || !data) return;
        setInvoices(data.openInvoices || []);
        if (data.creditNote?.balanceRemaining !== undefined) {
          setCurrentAvailable(Number(data.creditNote.balanceRemaining));
        } else {
          setCurrentAvailable(availableBalance);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Failed to load invoices.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, creditNoteId, availableBalance]);

  if (!isOpen) return null;

  // Calculate total currently allocated in the modal
  const totalAllocated = Object.values(appliedAmounts).reduce((sum, val) => {
    const num = parseFloat(val);
    return sum + (isNaN(num) || num < 0 ? 0 : num);
  }, 0);
  const roundedAllocated = Math.round(totalAllocated * 100) / 100;
  const remainingCreditAfterApplication = Math.max(
    0,
    Math.round((currentAvailable - roundedAllocated) * 100) / 100,
  );

  const handleAmountChange = (invId: string, val: string, maxAllowed: number) => {
    setError(null);
    if (val === "") {
      setAppliedAmounts((prev) => ({ ...prev, [invId]: "" }));
      return;
    }

    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      setAppliedAmounts((prev) => ({ ...prev, [invId]: "0" }));
      return;
    }

    // Do not exceed invoice balance due
    if (num > maxAllowed) {
      setError(`Cannot apply more than the invoice balance due (₹${maxAllowed.toFixed(2)}).`);
      setAppliedAmounts((prev) => ({ ...prev, [invId]: maxAllowed.toFixed(2) }));
      return;
    }

    setAppliedAmounts((prev) => ({ ...prev, [invId]: val }));
  };

  const handleApplyMax = (invId: string, invBalanceDue: number) => {
    setError(null);
    // Other allocations
    const otherAllocated = Object.entries(appliedAmounts).reduce((sum, [id, val]) => {
      if (id === invId) return sum;
      const num = parseFloat(val);
      return sum + (isNaN(num) || num < 0 ? 0 : num);
    }, 0);

    const creditLeftForThis = Math.max(0, currentAvailable - otherAllocated);
    const maxCanApply = Math.min(invBalanceDue, creditLeftForThis);
    setAppliedAmounts((prev) => ({
      ...prev,
      [invId]: maxCanApply > 0 ? maxCanApply.toFixed(2) : "0",
    }));
  };

  const handleClearAll = () => {
    setAppliedAmounts({});
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    const validApplications = Object.entries(appliedAmounts)
      .map(([invoiceId, amtStr]) => ({
        invoiceId,
        amount: Math.round((parseFloat(amtStr) || 0) * 100) / 100,
      }))
      .filter((app) => app.amount > 0);

    if (validApplications.length === 0) {
      setError("Please enter an amount to apply to at least one invoice.");
      return;
    }

    if (roundedAllocated > currentAvailable + 0.01) {
      setError(
        `Total allocated credit (₹${roundedAllocated.toFixed(2)}) exceeds available credit note balance (₹${currentAvailable.toFixed(2)}).`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/sales/credit-notes/${creditNoteId}/apply-to-invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applications: validApplications }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to apply credit note.");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply credit.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Apply Credit Note #{creditNoteNumber} to Invoices
            </h3>
            <p className="text-xs text-slate-500">
              Customer: <span className="font-semibold text-slate-700">{customerName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Credit Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border-b border-slate-200 px-6 py-3 text-xs sm:text-sm">
          <div>
            <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium">
              Available Credit
            </span>
            <span className="font-bold text-slate-900 text-base">
              ₹{currentAvailable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium">
              Amount to Apply
            </span>
            <span
              className={`font-bold text-base ${
                roundedAllocated > currentAvailable ? "text-rose-600" : "text-blue-600"
              }`}
            >
              ₹{roundedAllocated.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium">
              Remaining Credit After
            </span>
            <span className="font-bold text-emerald-600 text-base">
              ₹{remainingCreditAfterApplication.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-xs">Loading open invoices…</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Outstanding Invoices</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                There are no open or partially paid invoices with a balance due for this customer.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Select the amount of credit to apply to each invoice below:</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 underline cursor-pointer"
                >
                  Clear all
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-3 py-2.5">Invoice#</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5 text-right">Invoice Total</th>
                      <th className="px-3 py-2.5 text-right">Amount Paid</th>
                      <th className="px-3 py-2.5 text-right">Credits Applied</th>
                      <th className="px-3 py-2.5 text-right">Balance Due</th>
                      <th className="px-3 py-2.5 text-right min-w-[160px]">Amount to Apply</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {invoices.map((inv) => {
                      const curVal = appliedAmounts[inv.id] || "";
                      const curNum = parseFloat(curVal) || 0;
                      const hasAmt = curNum > 0;

                      return (
                        <tr
                          key={inv.id}
                          className={`transition ${hasAmt ? "bg-blue-50/40" : "hover:bg-slate-50"}`}
                        >
                          <td className="px-3 py-3 font-semibold text-slate-900">
                            {inv.invoiceNumber}
                            {inv.subject && (
                              <p className="text-[11px] text-slate-400 font-normal truncate max-w-[160px]">
                                {inv.subject}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                            {inv.invoiceDate || "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-slate-900">
                            ₹{inv.total.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-600">
                            ₹{inv.amountPaid.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-600">
                            ₹{inv.creditedAmount.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-amber-700">
                            ₹{inv.balanceDue.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="relative w-28">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                                  ₹
                                </span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  max={inv.balanceDue}
                                  value={curVal}
                                  onChange={(e) =>
                                    handleAmountChange(inv.id, e.target.value, inv.balanceDue)
                                  }
                                  placeholder="0.00"
                                  className="w-full rounded-lg border border-slate-300 bg-white pl-6 pr-2 py-1.5 text-right font-mono text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleApplyMax(inv.id, inv.balanceDue)}
                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition cursor-pointer shrink-0"
                                title="Apply maximum allowable amount"
                              >
                                Max
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              loading ||
              invoices.length === 0 ||
              roundedAllocated <= 0 ||
              roundedAllocated > currentAvailable
            }
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying Credit…
              </>
            ) : (
              `Apply Credit (₹${roundedAllocated.toFixed(2)})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
