"use client";

import {
  ArrowRight,
  Calculator,
  Download,
  Eye,
  Pencil,
  Plus,
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

interface QuoteTableViewProps {
  quotes: QuoteDocument[];
  customerMap: Map<string, CustomerRecord>;
  loading: boolean;
  searchTerm: string;
  selectedQuotes: string[];
  onToggleSelectAll: () => void;
  onToggleSelectQuote: (id: string) => void;
  onQuickView: (quote: QuoteDocument) => void;
  onConvert: (quoteId: string) => void;
  onStatusChange: (quoteId: string, status: string) => void;
  onOpenCreate: () => void;
  onEdit?: (quote: QuoteDocument) => void;
  onDownloadPdf?: (quote: QuoteDocument) => void;
}

export function QuoteTableView({
  quotes,
  customerMap,
  loading,
  searchTerm,
  selectedQuotes,
  onToggleSelectAll,
  onToggleSelectQuote,
  onQuickView,
  onConvert,
  onStatusChange,
  onOpenCreate,
  onEdit,
  onDownloadPdf,
}: QuoteTableViewProps) {
  const allSelected = quotes.length > 0 && selectedQuotes.length === quotes.length;
  const someSelected = selectedQuotes.length > 0 && selectedQuotes.length < quotes.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-10 px-4 py-3.5 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onToggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="px-5 py-3.5 font-semibold">Quote#</th>
              <th className="px-4 py-3.5 font-semibold">Customer</th>
              <th className="px-4 py-3.5 font-semibold">Reference#</th>
              <th className="px-4 py-3.5 font-semibold">Date</th>
              <th className="px-4 py-3.5 font-semibold">Expiry Date</th>
              <th className="px-4 py-3.5 font-semibold text-right">Amount</th>
              <th className="px-4 py-3.5 font-semibold text-center">Status</th>
              <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <span>Loading quotations...</span>
                  </div>
                </td>
              </tr>
            ) : quotes.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-16 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3 shadow-xs">
                    <Calculator className="h-7 w-7" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base">No quotations found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {searchTerm
                      ? `No quotes matching "${searchTerm}". Try a different search term or clear filters.`
                      : "Create sales proposals and estimates for your customers to close deals faster."}
                  </p>
                  <button
                    type="button"
                    onClick={onOpenCreate}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Quote
                  </button>
                </td>
              </tr>
            ) : (
              quotes.map((quote) => {
                const customer = customerMap.get(quote.customerId);
                const customerName = customer?.name || "Customer";
                const statusStyle = getQuoteStatusStyle(quote.status);
                const isSelected = selectedQuotes.includes(quote.id);
                const canConvert = quote.status !== "Converted" && quote.status !== "Rejected";

                return (
                  <tr
                    key={quote.id}
                    className={`group transition-colors ${
                      isSelected ? "bg-blue-50/60" : "hover:bg-slate-50/80"
                    }`}
                  >
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectQuote(quote.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => onQuickView(quote)}
                        className="font-mono text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer text-left"
                      >
                        {quote.number}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold border ${getAvatarColor(
                            customerName
                          )}`}
                        >
                          {getInitials(customerName)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 text-xs">
                            {customerName}
                          </p>
                          {customer?.email && (
                            <p className="truncate text-[11px] text-slate-400">
                              {customer.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs font-mono text-slate-500">
                      {quote.referenceNumber || "—"}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      {formatDate(quote.issueDate)}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      {formatDate(quote.expiryDate || quote.dueDate)}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-slate-900 tabular-nums">
                      {currency.format(quote.total || 0)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${statusStyle.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                        {quote.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canConvert && (
                          <button
                            type="button"
                            onClick={() => onConvert(quote.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                          >
                            <span>Convert</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                        <select
                          value={quote.status}
                          onChange={(e) => onStatusChange(quote.id, e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 outline-none hover:bg-slate-50 transition cursor-pointer"
                        >
                          <option value="Draft">Draft</option>
                          <option value="Sent">Sent</option>
                          <option value="Accepted">Accepted</option>
                          <option value="Rejected">Rejected</option>
                          <option value="Converted" disabled>Converted</option>
                        </select>
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(quote)}
                            title="Edit Quote"
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {onDownloadPdf && (
                          <button
                            type="button"
                            onClick={() => onDownloadPdf(quote)}
                            title="Download PDF"
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onQuickView(quote)}
                          title="View Details"
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
