"use client";

import { useState, type FormEvent } from "react";
import { FileText, Loader2, Mail, Send, X } from "lucide-react";
import { formatCurrency } from "@/lib/invoice-utils";
import { type InvoiceRecord } from "./invoice-types";

interface SendEmailModalProps {
  isOpen: boolean;
  invoice: InvoiceRecord;
  companyName?: string;
  onClose: () => void;
  onSuccess: (emailData: Record<string, unknown>) => void;
}

export function SendEmailModal({
  isOpen,
  invoice,
  companyName = "Bharat Traders & Commodities Ltd.",
  onClose,
  onSuccess,
}: SendEmailModalProps) {
  const customerEmail =
    invoice.customerSnapshot?.email || "";

  const [to, setTo] = useState(customerEmail);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(
    () => `Invoice ${invoice.number} from ${companyName}`,
  );
  const [message, setMessage] = useState(() => {
    return `Dear ${invoice.customerName},

Thank you for your business. Please find attached invoice ${invoice.number} for ${formatCurrency(invoice.total, invoice.currency)}, with due date on ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "Receipt"}.

Please remit payment as per the terms specified. If you have any questions regarding this invoice, please do not hesitate to contact us.

Warm regards,
${companyName} Billing Team`;
  });

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!to.trim() || !to.includes("@")) {
      setError("Please enter a valid recipient email address.");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/sales/invoices/${invoice.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send email.");
      }

      onSuccess(data.email);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to dispatch email.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Send Invoice via Email</h3>
              <p className="text-xs text-slate-500">
                Email invoice {invoice.number} directly to client
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">
                To (Recipient) <span className="text-rose-500">*</span>
              </label>
              {!showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="text-xs font-medium text-blue-600 hover:underline cursor-pointer"
                >
                  + Add CC / BCC
                </button>
              )}
            </div>
            <input
              type="email"
              required
              placeholder="client@company.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          {showCc && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  CC
                </label>
                <input
                  type="text"
                  placeholder="manager@company.com"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  BCC
                </label>
                <input
                  type="text"
                  placeholder="accounts@mycompany.com"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Subject
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Message Body
            </label>
            <textarea
              rows={5}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-sans text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          {/* Attachment Preview Badge */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
            <FileText className="h-4 w-4 text-rose-500 shrink-0" />
            <span className="font-semibold text-slate-900">Attached:</span>
            <span className="font-mono text-slate-700">{invoice.number}.pdf</span>
            <span className="text-slate-400 text-[11px]">(A4 Printable PDF)</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Invoice
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
