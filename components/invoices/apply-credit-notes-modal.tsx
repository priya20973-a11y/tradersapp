"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CreditCard,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

export interface AvailableCreditNote {
  id: string;
  creditNoteNumber: string;
  customerId: string;
  customerName: string;
  creditNoteDate: string;
  referenceNumber?: string;
  subject?: string;
  total: number;
  creditedAmount: number;
  balanceRemaining: number;
  status: string;
}

interface ApplyCreditNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  balanceDue: number;
  onSuccess: () => void;
}

export function ApplyCreditNotesModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  customerName,
  balanceDue,
  onSuccess,
}: ApplyCreditNotesModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availableCredits, setAvailableCredits] = useState<AvailableCreditNote[]>([]);
  const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({});
  const [invoiceDetails, setInvoiceDetails] = useState<{
    balanceDue: number;
    total: number;
    amountPaid: number;
    creditedAmount: number;
  }>({
    balanceDue,
    total: balanceDue,
    amountPaid: 0,
    creditedAmount: 0,
  });

  useEffect(() => {
    if (!isOpen || !invoiceId) return;

    let isMounted = true;

    fetch(`/api/sales/invoices/${invoiceId}/credit-notes`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load credit notes for invoice.");
        return data;
      })
      .then((data) => {
        if (!isMounted) return;
        setAvailableCredits(data.availableCredits || []);
        if (data.invoice) {
          setInvoiceDetails({
            balanceDue: Number(data.invoice.balanceDue ?? balanceDue),
            total: Number(data.invoice.total || 0),
            amountPaid: Number(data.invoice.amountPaid || 0),
            creditedAmount: Number(data.invoice.creditedAmount || 0),
          });
        }
        // If exactly one credit note is available, pre-fill its max applicable amount
        if (Array.isArray(data.availableCredits) && data.availableCredits.length === 1) {
          const single = data.availableCredits[0];
          const curBal = Number(data.invoice?.balanceDue ?? balanceDue);
          const maxApp = Math.min(single.balanceRemaining, curBal);
          if (maxApp > 0) {
            setCreditAmounts({ [single.id]: maxApp.toFixed(2) });
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Failed to load available credit notes.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, invoiceId, balanceDue]);

  if (!isOpen) return null;

  const totalCreditApplying = Object.values(creditAmounts).reduce((sum, val) => {
    const num = parseFloat(val);
    return sum + (isNaN(num) || num < 0 ? 0 : num);
  }, 0);
  const roundedApplying = Math.round(totalCreditApplying * 100) / 100;
  const currentInvoiceDue = invoiceDetails.balanceDue;
  const remainingDueAfterCredit = Math.max(
    0,
    Math.round((currentInvoiceDue - roundedApplying) * 100) / 100,
  );
  const totalAvailableCredit = availableCredits.reduce(
    (sum, c) => sum + c.balanceRemaining,
    0,
  );

  const handleAmountChange = (credId: string, val: string, maxCreditAvailable: number) => {
    setError(null);
    if (val === "") {
      setCreditAmounts((prev) => ({ ...prev, [credId]: "" }));
      return;
    }

    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      setCreditAmounts((prev) => ({ ...prev, [credId]: "0" }));
      return;
    }

    if (num > maxCreditAvailable) {
      setError(
        `Amount cannot exceed the available credit balance of ₹${maxCreditAvailable.toFixed(2)}.`,
      );
      setCreditAmounts((prev) => ({ ...prev, [credId]: maxCreditAvailable.toFixed(2) }));
      return;
    }

    setCreditAmounts((prev) => ({ ...prev, [credId]: val }));
  };

  const handleSetMaxForCredit = (credId: string, maxCreditAvailable: number) => {
    setError(null);
    const otherAllocations = Object.entries(creditAmounts)
      .filter(([id]) => id !== credId)
      .reduce((sum, [, amt]) => {
        const num = parseFloat(amt);
        return sum + (isNaN(num) || num < 0 ? 0 : num);
      }, 0);

    const remainingDueForThis = Math.max(0, currentInvoiceDue - otherAllocations);
    const maxCanApply = Math.min(maxCreditAvailable, remainingDueForThis);
    setCreditAmounts((prev) => ({
      ...prev,
      [credId]: maxCanApply > 0 ? maxCanApply.toFixed(2) : "0",
    }));
  };

  const handleApplyAllAvailable = () => {
    setError(null);
    let remainingDue = currentInvoiceDue;
    const newAmounts: Record<string, string> = {};

    for (const cred of availableCredits) {
      if (remainingDue <= 0) {
        newAmounts[cred.id] = "";
        continue;
      }
      const canApply = Math.min(cred.balanceRemaining, remainingDue);
      const rounded = Math.round(canApply * 100) / 100;
      newAmounts[cred.id] = rounded > 0 ? rounded.toFixed(2) : "";
      remainingDue = Math.max(0, Math.round((remainingDue - rounded) * 100) / 100);
    }

    setCreditAmounts(newAmounts);
  };

  const handleClearAll = () => {
    setCreditAmounts({});
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    const validApps = Object.entries(creditAmounts)
      .map(([creditNoteId, amtStr]) => ({
        creditNoteId,
        amount: Math.round((parseFloat(amtStr) || 0) * 100) / 100,
      }))
      .filter((app) => app.amount > 0);

    if (validApps.length === 0) {
      setError("Please specify at least one valid credit note amount to apply.");
      return;
    }

    if (roundedApplying > currentInvoiceDue + 0.01) {
      setError(
        `Total credit applied (₹${roundedApplying.toFixed(2)}) exceeds invoice's balance due (₹${currentInvoiceDue.toFixed(2)}).`,
      );
      return;
    }

    for (const app of validApps) {
      const targetCred = availableCredits.find((c) => c.id === app.creditNoteId);
      if (targetCred && app.amount > targetCred.balanceRemaining + 0.01) {
        setError(
          `Amount for Credit Note #${targetCred.creditNoteNumber} exceeds available balance (₹${targetCred.balanceRemaining.toFixed(2)}).`,
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/sales/invoices/${invoiceId}/apply-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: validApps }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to apply credit notes to invoice.");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply credit notes.";
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Apply Credit Notes to Invoice #{invoiceNumber}
              </h3>
              <p className="text-xs text-slate-500">
                Customer: <span className="font-semibold text-slate-700">{customerName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary Metric Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border-b border-slate-200 px-6 py-3 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium">
              Invoice Total
            </span>
            <span className="font-bold text-slate-900 text-sm sm:text-base font-mono">
              ₹{invoiceDetails.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium">
              Payment Due
            </span>
            <span className="font-bold text-amber-700 text-sm sm:text-base font-mono">
              ₹{currentInvoiceDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium">
              Credit Applying
            </span>
            <span
              className={`font-bold text-sm sm:text-base font-mono ${
                roundedApplying > currentInvoiceDue ? "text-rose-600" : "text-purple-700"
              }`}
            >
              ₹{roundedApplying.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium">
              Remaining Due
            </span>
            <span className="font-bold text-emerald-600 text-sm sm:text-base font-mono">
              ₹{remainingDueAfterCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Error Notice */}
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
              <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-2" />
              <p className="text-xs">Loading available customer credit notes…</p>
            </div>
          ) : availableCredits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 mb-3">
                <CreditCard className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                No Available Credit Notes Found
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                There are no open or partially applied credit notes with an available balance for{" "}
                <span className="font-medium text-slate-700">{customerName}</span>.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <span>
                  Customer has{" "}
                  <strong className="text-purple-700 font-mono">
                    ₹{totalAvailableCredit.toFixed(2)}
                  </strong>{" "}
                  in available credit notes. Enter amounts to apply:
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleApplyAllAvailable}
                    className="inline-flex items-center gap-1 font-semibold text-purple-700 hover:text-purple-800 hover:underline cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Apply All Available
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="font-medium text-slate-500 hover:text-slate-700 underline cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-3 py-2.5">Credit Note#</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5 text-right">Total Amount</th>
                      <th className="px-3 py-2.5 text-right">Already Applied</th>
                      <th className="px-3 py-2.5 text-right">Available Balance</th>
                      <th className="px-3 py-2.5 text-right min-w-[160px]">Amount to Apply</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {availableCredits.map((cred) => {
                      const curVal = creditAmounts[cred.id] || "";
                      const curNum = parseFloat(curVal) || 0;
                      const hasAmt = curNum > 0;

                      return (
                        <tr
                          key={cred.id}
                          className={`transition ${hasAmt ? "bg-purple-50/40" : "hover:bg-slate-50"}`}
                        >
                          <td className="px-3 py-3 font-semibold text-slate-900">
                            {cred.creditNoteNumber}
                            {cred.subject && (
                              <p className="text-[11px] text-slate-400 font-normal truncate max-w-[160px]">
                                {cred.subject}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                            {cred.creditNoteDate || "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-slate-900 font-mono">
                            ₹{cred.total.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-600 font-mono">
                            ₹{cred.creditedAmount.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-emerald-600 font-mono">
                            ₹{cred.balanceRemaining.toFixed(2)}
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
                                  max={cred.balanceRemaining}
                                  value={curVal}
                                  onChange={(e) =>
                                    handleAmountChange(cred.id, e.target.value, cred.balanceRemaining)
                                  }
                                  placeholder="0.00"
                                  className="w-full rounded-lg border border-slate-300 bg-white pl-6 pr-2 py-1.5 text-right font-mono text-xs text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetMaxForCredit(cred.id, cred.balanceRemaining)
                                }
                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-purple-700 hover:bg-purple-50 hover:border-purple-200 transition cursor-pointer shrink-0"
                                title="Apply maximum allowable amount from this credit note"
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
              availableCredits.length === 0 ||
              roundedApplying <= 0 ||
              roundedApplying > currentInvoiceDue
            }
            className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 transition cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying Credit…
              </>
            ) : (
              `Apply Credit (₹${roundedApplying.toFixed(2)})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

