"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Edit,
  Eye,
  FileText,
  Mail,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { formatCurrency } from "@/lib/invoice-utils";
import { type InvoiceRecord } from "./invoice-types";

interface InvoiceTableViewProps {
  invoices: InvoiceRecord[];
  loading: boolean;
  selectedInvoices: string[];
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onRecordPayment: (invoice: InvoiceRecord) => void;
  onApplyCredit?: (invoice: InvoiceRecord) => void;
  onSendEmail: (invoice: InvoiceRecord) => void;
  onDownloadPdf: (invoice: InvoiceRecord) => void;
  onStatusChange: (invoiceId: string, status: string) => void;
  onDelete: (invoiceId: string, number: string) => void;
}

export function InvoiceTableView({
  invoices,
  loading,
  selectedInvoices,
  onToggleSelectAll,
  onToggleSelect,
  onRecordPayment,
  onApplyCredit,
  onSendEmail,
  onDownloadPdf,
  onDelete,
}: InvoiceTableViewProps) {
  const allSelected =
    invoices.length > 0 && selectedInvoices.length === invoices.length;

  const renderStatus = (status: string) => {
    switch (status) {
      case "Paid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            PAID
          </span>
        );
      case "Overdue":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
            <Clock className="h-3 w-3" />
            OVERDUE
          </span>
        );
      case "Partly paid":
      case "Partially Paid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
            <CreditCard className="h-3 w-3" />
            PARTIALLY PAID
          </span>
        );
      case "Sent":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
            <Send className="h-3 w-3" />
            SENT
          </span>
        );
      case "Void":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-500 border border-slate-200 line-through">
            VOID
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200">
            DRAFT
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-12 text-center text-sm text-slate-400">
        Loading invoices...
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <FileText className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-base font-bold text-slate-900">
          No invoices found
        </h3>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Create your first invoice or adjust your search filter to see matching records.
        </p>
        <div className="mt-6">
          <Link
            href="/sales/invoices/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            Create Invoice
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-3.5 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  aria-label="Select all invoices"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="py-3 px-3">Invoice #</th>
              <th className="py-3 px-3">Date</th>
              <th className="py-3 px-3">Customer</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Due Date</th>
              <th className="py-3 px-3 text-right">Amount</th>
              <th className="py-3 px-3 text-right">Balance Due</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => {
              const isSelected = selectedInvoices.includes(inv.id);
              return (
                <tr
                  key={inv.id}
                  className={`group transition hover:bg-slate-50/80 ${
                    isSelected ? "bg-blue-50/30" : ""
                  }`}
                >
                  {/* Select Checkbox */}
                  <td className="py-3.5 px-3.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(inv.id)}
                      aria-label={`Select invoice ${inv.number}`}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>

                  {/* Invoice # */}
                  <td className="py-3.5 px-3">
                    <Link
                      href={`/sales/invoices/${inv.id}`}
                      className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {inv.number}
                    </Link>
                    {inv.referenceNumber && (
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Ref: {inv.referenceNumber}
                      </p>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-3 text-slate-600">
                    {inv.issueDate
                      ? new Date(inv.issueDate).toLocaleDateString("en-IN")
                      : "-"}
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-3">
                    <p className="font-semibold text-slate-900">{inv.customerName}</p>
                    {inv.customerCompany && (
                      <p className="text-[11px] text-slate-500">{inv.customerCompany}</p>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-3">{renderStatus(inv.status)}</td>

                  {/* Due Date */}
                  <td className="py-3.5 px-3 text-slate-600">
                    {inv.dueDate
                      ? new Date(inv.dueDate).toLocaleDateString("en-IN")
                      : "-"}
                  </td>

                  {/* Total Amount */}
                  <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-900">
                    {formatCurrency(inv.total, inv.currency)}
                  </td>

                  {/* Balance Due */}
                  <td className="py-3.5 px-3 text-right font-mono font-bold">
                    {inv.balanceDue > 0 ? (
                      <span className={inv.status === "Overdue" ? "text-rose-600" : "text-amber-600"}>
                        {formatCurrency(inv.balanceDue, inv.currency)}
                      </span>
                    ) : (
                      <span className="text-slate-400">₹0.00</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition">
                      {/* Apply credit note quick button if balance > 0 */}
                      {inv.balanceDue > 0 && inv.status !== "Void" && (
                        <button
                          type="button"
                          onClick={() => onApplyCredit?.(inv)}
                          title="Apply Credit Note"
                          className="rounded-lg p-1.5 text-purple-600 hover:bg-purple-50 transition cursor-pointer"
                        >
                          <CreditCard className="h-4 w-4" />
                        </button>
                      )}

                      {/* Record payment quick button if balance > 0 */}
                      {inv.balanceDue > 0 && inv.status !== "Void" && (
                        <button
                          type="button"
                          onClick={() => onRecordPayment(inv)}
                          title="Record Payment"
                          className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                        >
                          <DollarSign className="h-4 w-4" />
                        </button>
                      )}

                      <Link
                        href={`/sales/invoices/${inv.id}`}
                        title="View Invoice"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>

                      {inv.status !== "Paid" && inv.status !== "Void" && (
                        <Link
                          href={`/sales/invoices/${inv.id}/edit`}
                          title="Edit Invoice"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={() => onDownloadPdf(inv)}
                        title="Download PDF"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
                      >
                        <Download className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onSendEmail(inv)}
                        title="Send via Email"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition cursor-pointer"
                      >
                        <Mail className="h-4 w-4" />
                      </button>

                      {inv.status === "Draft" && (
                        <button
                          type="button"
                          onClick={() => onDelete(inv.id, inv.number)}
                          title="Delete Draft"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
