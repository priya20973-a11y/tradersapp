"use client";

import { useState, type FormEvent } from "react";
import { DollarSign, Loader2, X } from "lucide-react";
import { formatCurrency } from "@/lib/invoice-utils";
import { type InvoiceRecord, type PaymentRecordData } from "./invoice-types";

interface RecordPaymentModalProps {
  isOpen: boolean;
  invoice: InvoiceRecord;
  onClose: () => void;
  onSuccess: (payment: PaymentRecordData, updatedInvoice: InvoiceRecord) => void;
}

export function RecordPaymentModal({
  isOpen,
  invoice,
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState(() => String(invoice.balanceDue));
  const [paymentDate, setPaymentDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [method, setMethod] = useState<"Bank" | "UPI" | "Cash" | "Cheque">("Bank");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      setError("Please enter a valid payment amount greater than zero.");
      return;
    }

    if (payAmount > invoice.balanceDue + 0.05) {
      setError(
        `Payment amount cannot exceed remaining balance of ${formatCurrency(invoice.balanceDue, invoice.currency)}.`,
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/sales/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: payAmount,
          paymentDate,
          method,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record payment.");
      }

      onSuccess(data.payment, data.invoice);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Record Payment</h3>
              <p className="text-xs text-slate-500">
                Invoice {invoice.number} • {invoice.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {/* Invoice Balance Snapshot Card */}
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Invoice Total: {formatCurrency(invoice.total, invoice.currency)}</span>
            <span>Paid: {formatCurrency(invoice.amountPaid, invoice.currency)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-200/60 pt-2">
            <span className="text-xs font-semibold text-slate-700">Balance Due:</span>
            <span className="text-base font-bold text-rose-600">
              {formatCurrency(invoice.balanceDue, invoice.currency)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">
                Amount Received (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAmount(String(invoice.balanceDue))}
                  className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                >
                  Full ({formatCurrency(invoice.balanceDue, invoice.currency)})
                </button>
                {invoice.balanceDue > 100 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(Math.round(invoice.balanceDue / 2)))}
                    className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                  >
                    50%
                  </button>
                )}
              </div>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={invoice.balanceDue + 0.05}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment Date
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment Mode
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as "Bank" | "UPI" | "Cash" | "Cheque")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              >
                <option value="Bank">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="UPI">UPI / QR</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque / DD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Reference / Transaction ID
            </label>
            <input
              type="text"
              placeholder="e.g. UTR12345678, UPI Ref, Cheque #40291"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Notes / Remarks
            </label>
            <textarea
              rows={2}
              placeholder="Payment remarks (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                "Record Payment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
