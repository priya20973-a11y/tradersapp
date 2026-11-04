"use client";

import Link from "next/link";
import {
  Calendar,
  Clock,
  DollarSign,
  Download,
  Mail,
} from "lucide-react";
import { formatCurrency } from "@/lib/invoice-utils";
import { type InvoiceRecord } from "./invoice-types";

interface InvoiceGridViewProps {
  invoices: InvoiceRecord[];
  onRecordPayment: (invoice: InvoiceRecord) => void;
  onSendEmail: (invoice: InvoiceRecord) => void;
  onDownloadPdf: (invoice: InvoiceRecord) => void;
}

export function InvoiceGridView({
  invoices,
  onRecordPayment,
  onSendEmail,
  onDownloadPdf,
}: InvoiceGridViewProps) {
  const renderStatus = (status: string) => {
    switch (status) {
      case "Paid":
        return (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
            PAID
          </span>
        );
      case "Overdue":
        return (
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
            OVERDUE
          </span>
        );
      case "Partly paid":
      case "Partially Paid":
        return (
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
            PARTIAL
          </span>
        );
      case "Sent":
        return (
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
            SENT
          </span>
        );
      case "Void":
        return (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200 line-through">
            VOID
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
            DRAFT
          </span>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {invoices.map((inv) => {
        const percentPaid =
          inv.total > 0
            ? Math.min(100, Math.round((inv.amountPaid / inv.total) * 100))
            : 0;

        return (
          <div
            key={inv.id}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-md"
          >
            <div>
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <Link
                  href={`/sales/invoices/${inv.id}`}
                  className="font-mono text-sm font-bold text-blue-600 hover:underline"
                >
                  {inv.number}
                </Link>
                {renderStatus(inv.status)}
              </div>

              {/* Customer */}
              <div className="mt-3">
                <h4 className="text-sm font-bold text-slate-900 line-clamp-1">
                  {inv.customerName}
                </h4>
                {inv.customerCompany && (
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {inv.customerCompany}
                  </p>
                )}
              </div>

              {/* Dates */}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {inv.issueDate
                      ? new Date(inv.issueDate).toLocaleDateString("en-IN")
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    Due:{" "}
                    {inv.dueDate
                      ? new Date(inv.dueDate).toLocaleDateString("en-IN")
                      : "-"}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Payment:</span>
                  <span className="font-semibold text-slate-700 font-mono">
                    {percentPaid}% ({formatCurrency(inv.amountPaid, inv.currency)})
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full transition-all ${
                      inv.status === "Paid" ? "bg-emerald-500" : "bg-blue-600"
                    }`}
                    style={{ width: `${percentPaid}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Amount & Actions */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Total
                  </span>
                  <p className="text-sm font-bold text-slate-900 font-mono">
                    {formatCurrency(inv.total, inv.currency)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Balance
                  </span>
                  <p
                    className={`text-sm font-bold font-mono ${
                      inv.balanceDue > 0
                        ? inv.status === "Overdue"
                          ? "text-rose-600"
                          : "text-amber-600"
                        : "text-slate-400"
                    }`}
                  >
                    {formatCurrency(inv.balanceDue, inv.currency)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-1.5">
                <Link
                  href={`/sales/invoices/${inv.id}`}
                  className="flex-1 text-center rounded-xl border border-slate-200 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  View Details
                </Link>

                {inv.balanceDue > 0 && inv.status !== "Void" && (
                  <button
                    type="button"
                    onClick={() => onRecordPayment(inv)}
                    title="Record Payment"
                    className="rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 p-1.5 hover:bg-emerald-100 transition cursor-pointer"
                  >
                    <DollarSign className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onDownloadPdf(inv)}
                  title="PDF"
                  className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 transition cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onSendEmail(inv)}
                  title="Email"
                  className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 transition cursor-pointer"
                >
                  <Mail className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
