"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Mail,
  Pencil,
  Printer,
  X,
} from "lucide-react";
import { generateQuotePdf } from "./quote-pdf-generator";
import {
  currency,
  formatDate,
  getAvatarColor,
  getInitials,
  getQuoteStatusStyle,
  type CustomerRecord,
  type QuoteDocument,
} from "./quote-types";

interface QuoteDetailModalProps {
  quote: QuoteDocument | null;
  customer?: CustomerRecord;
  onClose: () => void;
  onConvert: (quoteId: string) => void;
  onStatusChange: (quoteId: string, status: string) => void;
  onEdit?: (quote: QuoteDocument) => void;
}

export function QuoteDetailModal({
  quote,
  customer,
  onClose,
  onConvert,
  onStatusChange,
  onEdit,
}: QuoteDetailModalProps) {
  const [companyLogo, setCompanyLogo] = useState<string>("");

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile?.logo) {
          setCompanyLogo(data.profile.logo);
        }
      })
      .catch(() => {});
  }, []);

  if (!quote) return null;

  const statusStyle = getQuoteStatusStyle(quote.status);
  const canConvert = quote.status !== "Converted" && quote.status !== "Rejected";
  const customerName = customer?.name || "Customer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 sm:p-6 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header Banner */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-3">
            {companyLogo ? (
              <div className="flex h-10 w-16 items-center justify-center rounded-xl bg-white p-1 border border-slate-200 shadow-xs shrink-0 overflow-hidden">
                <Image
                  src={companyLogo}
                  alt="Company Logo"
                  width={64}
                  height={40}
                  unoptimized
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shrink-0">
                <FileText className="h-5 w-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">{quote.number}</h3>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${statusStyle.badge}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                  {quote.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Created on {formatDate(quote.issueDate)}
                {quote.referenceNumber && (
                  <> · Ref: <span className="font-mono text-slate-700">{quote.referenceNumber}</span></>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const doc = await generateQuotePdf(quote, customer);
                doc.save(`${quote.number}.pdf`);
              }}
              title="Download Quotation PDF"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                const doc = await generateQuotePdf(quote, customer);
                const blobUrl = doc.output("bloburl");
                window.open(blobUrl, "_blank");
              }}
              title="Preview Quotation PDF"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-xs"
            >
              <Eye className="h-3.5 w-3.5 text-slate-600" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              title="Print Quote"
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {/* Customer & Key Metadata Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Client Details
              </span>
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold border shadow-xs ${getAvatarColor(
                    customerName
                  )}`}
                >
                  {getInitials(customerName)}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{customerName}</h4>
                  {customer?.email && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Mail className="h-3 w-3 text-slate-400" />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  {customer?.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Building2 className="h-3 w-3 text-slate-400" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs border-t sm:border-t-0 sm:border-l border-slate-200/80 pt-3 sm:pt-0 sm:pl-4">
              <div>
                <span className="text-slate-500 block">Quote Date</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  {formatDate(quote.issueDate)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Valid Until / Expiry</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  {formatDate(quote.expiryDate || quote.dueDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Itemized Quotation
            </h4>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5">Item & Description</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Rate</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {(!quote.items || quote.items.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                        No individual line items listed.
                      </td>
                    </tr>
                  ) : (
                    quote.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          {item.description && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-slate-800">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600">
                          {currency.format(item.rate)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {currency.format(item.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Breakdown & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3 text-xs text-slate-600">
              {quote.customerNotes && (
                <div>
                  <span className="font-semibold text-slate-800 block mb-1">Customer Notes</span>
                  <p className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-slate-600 whitespace-pre-wrap">
                    {quote.customerNotes}
                  </p>
                </div>
              )}
              {quote.termsAndConditions && (
                <div>
                  <span className="font-semibold text-slate-800 block mb-1">
                    Terms & Conditions
                  </span>
                  <p className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-slate-600 text-[11px] whitespace-pre-wrap">
                    {quote.termsAndConditions}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Sub Total</span>
                <span className="font-semibold text-slate-800">
                  {currency.format(quote.subTotal || quote.total || 0)}
                </span>
              </div>
              {Number(quote.discount || 0) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>- {currency.format(quote.discount || 0)}</span>
                </div>
              )}
              {Number(quote.discount || 0) > 0 && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Applicable Taxable Amount</span>
                  <span className="font-mono">
                    {currency.format(
                      Math.max(
                        0,
                        (quote.subTotal || quote.total || 0) - Number(quote.discount || 0)
                      )
                    )}
                  </span>
                </div>
              )}
              {/* GST Row */}
              {(quote.taxType === "GST" ||
                (!quote.taxType && Number(quote.taxAmount || 0) > 0) ||
                (quote.tdsTcsType && Number(quote.taxAmount || 0) > 0)) && (
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>
                    GST (
                    {quote.taxRate !== undefined && quote.taxRate !== null
                      ? quote.taxRate
                      : quote.taxName
                      ? quote.taxName.replace(/[^0-9.]/g, "") || "18"
                      : "18"}
                    %)
                  </span>
                  <span className="font-semibold text-slate-900">
                    + {currency.format(Math.abs(Number(quote.taxAmount || 0)))}
                  </span>
                </div>
              )}

              {/* TDS Deduction Row */}
              {(quote.tdsTcsType === "TDS" || quote.taxType === "TDS") && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>
                    {quote.tdsTcsName || quote.taxName
                      ? `TDS - ${quote.tdsTcsName || quote.taxName} [${
                          quote.tdsTcsRate ?? quote.taxRate ?? 0
                        }%]`
                      : `TDS (${quote.tdsTcsRate ?? quote.taxRate ?? 0}%)`}
                  </span>
                  <span className="font-semibold">
                    -{" "}
                    {currency.format(
                      Math.abs(
                        Number(
                          quote.tdsTcsAmount !== undefined
                            ? quote.tdsTcsAmount
                            : quote.taxAmount || 0
                        )
                      )
                    )}
                  </span>
                </div>
              )}

              {/* TCS Addition Row */}
              {(quote.tdsTcsType === "TCS" || quote.taxType === "TCS") && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>
                    {quote.tdsTcsName || quote.taxName
                      ? `TCS - ${quote.tdsTcsName || quote.taxName} [${
                          quote.tdsTcsRate ?? quote.taxRate ?? 0
                        }%]`
                      : `TCS (${quote.tdsTcsRate ?? quote.taxRate ?? 0}%)`}
                  </span>
                  <span className="font-semibold">
                    +{" "}
                    {currency.format(
                      Math.abs(
                        Number(
                          quote.tdsTcsAmount !== undefined
                            ? quote.tdsTcsAmount
                            : quote.taxAmount || 0
                        )
                      )
                    )}
                  </span>
                </div>
              )}

              {Number(quote.adjustment || 0) !== 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Adjustment</span>
                  <span>{currency.format(quote.adjustment || 0)}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline text-sm font-bold text-slate-900">
                <span>Total Amount</span>
                <span className="text-base text-blue-600">
                  {currency.format(quote.total || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={quote.status}
              onChange={(e) => onStatusChange(quote.id, e.target.value)}
              className="text-xs rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 shadow-xs outline-none focus:border-blue-500"
            >
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
              <option value="Converted" disabled>Converted</option>
            </select>
          </div>

          <div className="flex items-center gap-2.5">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(quote);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Quote
              </button>
            )}
            {canConvert && (
              <button
                type="button"
                onClick={() => {
                  onConvert(quote.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Convert to Sales Order
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
