"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  DollarSign,
  FileEdit,
  Loader2,
  Printer,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { ApplyCreditToInvoiceModal } from "./apply-credit-to-invoice-modal";

interface AppliedInvoiceRecord {
  invoiceId: string;
  invoiceNumber: string;
  amountApplied: number;
  appliedDate: string;
  notes?: string;
}

export function formatBillingAddressLines(
  addr: unknown,
  customerName?: string
): string[] {
  if (!addr) return [];
  if (typeof addr === "string") {
    return addr
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }
  if (typeof addr === "object" && addr !== null) {
    const record = addr as {
      attention?: unknown;
      street?: unknown;
      city?: unknown;
      state?: unknown;
      postalCode?: unknown;
      country?: unknown;
    };
    const lines: string[] = [];

    const attention = typeof record.attention === "string" ? record.attention.trim() : "";
    if (attention && attention.toLowerCase() !== customerName?.trim().toLowerCase()) {
      lines.push(`Attn: ${attention}`);
    }

    if (typeof record.street === "string" && record.street.trim()) {
      lines.push(record.street.trim());
    }

    const localityParts = [record.city, record.state]
      .filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
      .map((s) => s.trim());
    const locality = localityParts.join(", ");
    const postal = typeof record.postalCode === "string" ? record.postalCode.trim() : "";

    let cityLine = "";
    if (locality && postal) {
      cityLine = `${locality} - ${postal}`;
    } else if (locality) {
      cityLine = locality;
    } else if (postal) {
      cityLine = postal;
    }
    if (cityLine) {
      lines.push(cityLine);
    }

    if (typeof record.country === "string" && record.country.trim()) {
      lines.push(record.country.trim());
    }

    return lines;
  }
  return [];
}

interface CreditNoteDetail {
  id: string;
  creditNoteNumber: string;
  customerId: string;
  customerName: string;
  customerSnapshot?: {
    companyName?: string;
    name?: string;
    billingAddress?: unknown;
    gstin?: string;
  };
  referenceNumber?: string;
  creditNoteDate: string;
  status: "Draft" | "Open" | "Partially Applied" | "Closed" | "Void";
  accountsReceivable?: string;
  salesperson?: string;
  subject?: string;
  items: {
    id?: string;
    itemId?: string;
    name: string;
    description?: string;
    account?: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  subTotal: number;
  discount: number;
  discountType: "percent" | "amount";
  tdsTcsType: "TDS" | "TCS" | "None";
  tdsTcsRate: number;
  tdsTcsAmount: number;
  adjustment: number;
  total: number;
  creditedAmount: number;
  balanceRemaining: number;
  customerNotes?: string;
  termsAndConditions?: string;
  invoicesApplied: AppliedInvoiceRecord[];
  createdAt: string;
}

export function CreditNoteDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = loadedId !== id;
  const [error, setError] = useState<string | null>(null);
  const [creditNote, setCreditNote] = useState<CreditNoteDetail | null>(null);

  // Apply modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [unapplyingId, setUnapplyingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch(`/api/sales/credit-notes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load credit note.");
      setError(null);
      setCreditNote(data.creditNote);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load credit note.");
    } finally {
      setLoadedId(id);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/sales/credit-notes/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load credit note.");
        if (!active) return;
        setError(null);
        setCreditNote(data.creditNote);
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load credit note.");
        }
      } finally {
        if (active) setLoadedId(id);
      }
    };
    if (id) void load();
    return () => {
      active = false;
    };
  }, [id]);

  const handleUnapply = async (invoiceId: string, invoiceNumber: string, amount: number) => {
    if (
      !window.confirm(
        `Are you sure you want to unapply ₹${amount.toFixed(2)} from Invoice #${invoiceNumber}? This will restore the balance on both this credit note and the invoice.`,
      )
    ) {
      return;
    }

    setUnapplyingId(invoiceId);
    try {
      const res = await fetch(`/api/sales/credit-notes/${id}/unapply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unapply credit.");

      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to unapply credit.");
    } finally {
      setUnapplyingId(null);
    }
  };

  const handleDelete = async () => {
    if (!creditNote) return;
    if (!window.confirm(`Are you sure you want to delete Credit Note #${creditNote.creditNoteNumber}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/sales/credit-notes/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete credit note.");
      router.push("/sales/credit-notes");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete credit note.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
        <p className="text-sm">Loading credit note details…</p>
      </div>
    );
  }

  if (error || !creditNote) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Failed to load credit note</h2>
        <p className="text-xs sm:text-sm text-slate-500">{error || "Credit note not found."}</p>
        <Link
          href="/sales/credit-notes"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Credit Notes
        </Link>
      </div>
    );
  }

  const canApply =
    (creditNote.status === "Open" || creditNote.status === "Partially Applied") &&
    creditNote.balanceRemaining > 0;

  return (
    <div className="space-y-6 pb-20">
      {/* Apply to Invoice Modal */}
      {showApplyModal && (
        <ApplyCreditToInvoiceModal
          isOpen={showApplyModal}
          onClose={() => setShowApplyModal(false)}
          creditNoteId={creditNote.id}
          creditNoteNumber={creditNote.creditNoteNumber}
          customerName={creditNote.customerName}
          availableBalance={creditNote.balanceRemaining}
          onSuccess={() => {
            setShowApplyModal(false);
            loadData();
          }}
        />
      )}

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/sales/credit-notes"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
                {creditNote.creditNoteNumber}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                  creditNote.status === "Open"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : creditNote.status === "Partially Applied"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : creditNote.status === "Closed"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : creditNote.status === "Draft"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {creditNote.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Customer: <span className="font-semibold text-slate-700">{creditNote.customerName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canApply && (
            <button
              type="button"
              onClick={() => setShowApplyModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
            >
              <DollarSign className="h-4 w-4" />
              Apply to Invoice
            </button>
          )}

          {creditNote.status === "Draft" && (
            <>
              <Link
                href={`/sales/credit-notes/${creditNote.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <FileEdit className="h-4 w-4" />
                Edit
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title="Print"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Credit Amount
          </span>
          <span className="mt-1 text-2xl font-bold text-slate-900 font-mono block">
            ₹{creditNote.total.toFixed(2)}
          </span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Credit Applied
          </span>
          <span className="mt-1 text-2xl font-bold text-purple-700 font-mono block">
            ₹{creditNote.creditedAmount.toFixed(2)}
          </span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Balance Available
          </span>
          <span className="mt-1 text-2xl font-bold text-emerald-600 font-mono block">
            ₹{creditNote.balanceRemaining.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Main Voucher Document Container */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs space-y-8">
        {/* Document Top */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-100 pb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">CREDIT NOTE</h2>
            <p className="text-xs font-mono text-slate-500 mt-1">#{creditNote.creditNoteNumber}</p>
          </div>
          <div className="text-right text-xs sm:text-sm space-y-1">
            <p>
              <span className="text-slate-500">Date:</span>{" "}
              <span className="font-semibold text-slate-800">
                {creditNote.creditNoteDate
                  ? new Date(creditNote.creditNoteDate).toLocaleDateString()
                  : "—"}
              </span>
            </p>
            {creditNote.referenceNumber && (
              <p>
                <span className="text-slate-500">Reference:</span>{" "}
                <span className="font-semibold text-slate-800 font-mono">
                  {creditNote.referenceNumber}
                </span>
              </p>
            )}
            <p>
              <span className="text-slate-500">Account:</span>{" "}
              <span className="font-semibold text-slate-800">
                {creditNote.accountsReceivable || "Accounts Receivable"}
              </span>
            </p>
            {creditNote.salesperson && (
              <p>
                <span className="text-slate-500">Salesperson:</span>{" "}
                <span className="font-semibold text-slate-800">
                  {creditNote.salesperson}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Customer & Billing Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs sm:text-sm">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Credit To:
            </span>
            <p className="text-base font-bold text-slate-900">
              {creditNote.customerSnapshot?.companyName || creditNote.customerName}
            </p>
            {creditNote.customerSnapshot?.name && (
              <p className="text-slate-600">Attn: {creditNote.customerSnapshot.name}</p>
            )}
            {formatBillingAddressLines(
              creditNote.customerSnapshot?.billingAddress,
              creditNote.customerSnapshot?.name
            ).map((line, idx) => (
              <p key={idx} className="text-slate-600 mt-0.5">
                {line}
              </p>
            ))}
            {creditNote.customerSnapshot?.gstin && (
              <p className="text-slate-600 font-mono mt-1">
                GSTIN: {creditNote.customerSnapshot.gstin}
              </p>
            )}
          </div>
          {creditNote.subject && (
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Subject:
              </span>
              <p className="text-slate-700 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                &ldquo;{creditNote.subject}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Item Details</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {creditNote.items.map((it, idx) => (
                <tr key={it.id || idx}>
                  <td className="px-4 py-3 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{it.name}</p>
                    {it.description && (
                      <p className="text-slate-500 text-[11px]">{it.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{it.account || "Sales"}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {it.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    ₹{it.rate.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                    ₹{it.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculations and Notes */}
        <div className="flex flex-col sm:flex-row justify-between gap-8 pt-4">
          <div className="flex-1 space-y-4 text-xs">
            {creditNote.customerNotes && (
              <div>
                <span className="font-semibold text-slate-700 block mb-1">Customer Notes:</span>
                <p className="text-slate-600 whitespace-pre-line bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {creditNote.customerNotes}
                </p>
              </div>
            )}
            {creditNote.termsAndConditions && (
              <div>
                <span className="font-semibold text-slate-700 block mb-1">
                  Terms & Conditions:
                </span>
                <p className="text-slate-600 whitespace-pre-line bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {creditNote.termsAndConditions}
                </p>
              </div>
            )}
          </div>

          <div className="w-full sm:w-80 space-y-2 text-xs sm:text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between text-slate-600">
              <span>Sub Total</span>
              <span className="font-mono text-slate-900">₹{creditNote.subTotal.toFixed(2)}</span>
            </div>
            {creditNote.discount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>
                  Discount ({creditNote.discount}
                  {creditNote.discountType === "percent" ? "%" : "₹"})
                </span>
                <span className="font-mono text-rose-600">
                  - ₹
                  {(creditNote.discountType === "percent"
                    ? (creditNote.subTotal * creditNote.discount) / 100
                    : creditNote.discount
                  ).toFixed(2)}
                </span>
              </div>
            )}
            {creditNote.tdsTcsType !== "None" && creditNote.tdsTcsRate > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>
                  {creditNote.tdsTcsType} ({creditNote.tdsTcsRate}%)
                </span>
                <span className="font-mono text-slate-900">
                  {creditNote.tdsTcsType === "TDS" ? "- " : "+ "}₹
                  {creditNote.tdsTcsAmount.toFixed(2)}
                </span>
              </div>
            )}
            {creditNote.adjustment !== 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Adjustment</span>
                <span className="font-mono text-slate-900">
                  ₹{creditNote.adjustment.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm sm:text-base font-bold text-slate-900">
              <span>Total ( ₹ )</span>
              <span className="font-mono">₹{creditNote.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Applied Invoices Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Invoices Applied</h3>
            <p className="text-xs text-slate-500">
              History of sales invoices settled against this credit note.
            </p>
          </div>
          {canApply && (
            <button
              type="button"
              onClick={() => setShowApplyModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
            >
              <DollarSign className="h-3.5 w-3.5" />
              Apply to More Invoices
            </button>
          )}
        </div>

        {creditNote.invoicesApplied.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No invoices have been credited using this credit note yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-2.5">Invoice#</th>
                  <th className="px-4 py-2.5">Applied Date</th>
                  <th className="px-4 py-2.5 text-right">Amount Applied</th>
                  <th className="px-4 py-2.5">Notes</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {creditNote.invoicesApplied.map((app) => (
                  <tr key={app.invoiceId}>
                    <td className="px-4 py-3 font-semibold text-blue-600 hover:underline">
                      <Link href={`/sales/invoices/${app.invoiceId}`}>
                        {app.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {app.appliedDate
                        ? new Date(app.appliedDate).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      ₹{app.amountApplied.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{app.notes || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleUnapply(app.invoiceId, app.invoiceNumber, app.amountApplied)
                        }
                        disabled={unapplyingId === app.invoiceId}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                        title="Unapply this credit and restore balances"
                      >
                        {unapplyingId === app.invoiceId ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Unapplying…
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-3 w-3" />
                            Unapply
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
