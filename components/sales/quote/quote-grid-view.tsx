"use client";

import {
  ArrowRight,
  Calendar,
  Download,
  Eye,
  FileText,
  Mail,
  Package,
  Pencil,
} from "lucide-react";
import {
  currency,
  formatDate,
  getAvatarColor,
  getInitials,
  getQuoteStatusStyle,
  type CustomerRecord,
  type QuoteDocument,
} from "./quote-types";

interface QuoteGridViewProps {
  quotes: QuoteDocument[];
  customerMap: Map<string, CustomerRecord>;
  onQuickView: (quote: QuoteDocument) => void;
  onConvert: (quoteId: string) => void;
  onStatusChange: (quoteId: string, status: string) => void;
  onEdit?: (quote: QuoteDocument) => void;
  onDownloadPdf?: (quote: QuoteDocument) => void;
}

export function QuoteGridView({
  quotes,
  customerMap,
  onQuickView,
  onConvert,
  onStatusChange,
  onEdit,
  onDownloadPdf,
}: QuoteGridViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {quotes.map((quote) => {
        const customer = customerMap.get(quote.customerId);
        const customerName = customer?.name || "Customer";
        const statusStyle = getQuoteStatusStyle(quote.status);
        const canConvert = quote.status !== "Converted" && quote.status !== "Rejected";
        const itemsCount = quote.items?.length || 0;

        return (
          <div
            key={quote.id}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-blue-400 hover:shadow-md"
          >
            <div>
              {/* Header: Quote Number, Status & Quick View */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-600/10">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => onQuickView(quote)}
                      className="font-mono text-sm font-bold text-slate-900 group-hover:text-blue-600 text-left transition"
                    >
                      {quote.number}
                    </button>
                    {quote.referenceNumber && (
                      <p className="text-[11px] font-mono text-slate-400">
                        Ref: {quote.referenceNumber}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${statusStyle.badge}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                    {quote.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => onQuickView(quote)}
                    title="Quick View"
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Customer Info */}
              <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold border ${getAvatarColor(
                    customerName
                  )}`}
                >
                  {getInitials(customerName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-800">{customerName}</p>
                  {customer?.email ? (
                    <p className="truncate text-[11px] text-slate-400 flex items-center gap-1">
                      <Mail className="h-3 w-3 shrink-0" />
                      {customer.email}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400">Registered Client</p>
                  )}
                </div>
              </div>

              {/* Details & Dates */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>Date: {formatDate(quote.issueDate)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>Valid: {formatDate(quote.expiryDate || quote.dueDate)}</span>
                </div>
                <div className="col-span-2 flex items-center gap-1 text-slate-600">
                  <Package className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>
                    {itemsCount > 0 ? `${itemsCount} itemized line item${itemsCount > 1 ? "s" : ""}` : "General estimate"}
                  </span>
                </div>
              </div>

              {/* Quote Total */}
              <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Value
                </span>
                <span className="text-lg font-bold tracking-tight text-slate-900 tabular-nums">
                  {currency.format(quote.total || 0)}
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <select
                value={quote.status}
                onChange={(e) => onStatusChange(quote.id, e.target.value)}
                className="text-xs rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700 outline-none hover:bg-white focus:bg-white transition"
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Converted" disabled>Converted</option>
              </select>

              <div className="flex items-center gap-1.5">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(quote)}
                    title="Edit Quote"
                    className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {onDownloadPdf && (
                  <button
                    type="button"
                    onClick={() => onDownloadPdf(quote)}
                    title="Download PDF"
                    className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                )}
                {canConvert && (
                  <button
                    type="button"
                    onClick={() => onConvert(quote.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                  >
                    Convert
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onQuickView(quote)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
