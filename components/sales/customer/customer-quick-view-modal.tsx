"use client";

import { useRouter } from "next/navigation";
import {
  Building2,
  Mail,
  Phone,
  User,
  X,
} from "lucide-react";
import {
  calculateCustomerReceivable,
  currency,
  getAvatarColor,
  getInitials,
  type Customer,
  type SalesDocument,
} from "./customer-types";

type CustomerQuickViewModalProps = {
  customer: Customer;
  documents: SalesDocument[];
  onClose: () => void;
};

export function CustomerQuickViewModal({
  customer,
  documents,
  onClose,
}: CustomerQuickViewModalProps) {
  const router = useRouter();
  const receivable = calculateCustomerReceivable(customer, documents);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold shadow-md ${getAvatarColor(
                  customer.name
                )}`}
              >
                {getInitials(customer.name)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {customer.customerType || "Business"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      customer.status === "Active"
                        ? "bg-emerald-400/20 text-emerald-300"
                        : "bg-slate-400/20 text-slate-300"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        customer.status === "Active" ? "bg-emerald-400" : "bg-slate-300"
                      }`}
                    />
                    {customer.status || "Active"}
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-bold">{customer.name}</h2>
                {customer.companyName && (
                  <p className="text-xs text-slate-300">{customer.companyName}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-6">
          {/* Financial Snapshot */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Financial Snapshot</h4>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5">
                <span className="text-[11px] font-medium text-slate-500">Outstanding Receivables</span>
                <div
                  className={`mt-1 text-lg font-bold tabular-nums ${
                    receivable > 0 ? "text-rose-600" : "text-slate-900"
                  }`}
                >
                  {currency.format(receivable)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5">
                <span className="text-[11px] font-medium text-slate-500">Unused Credits</span>
                <div className="mt-1 text-lg font-bold tabular-nums text-purple-700">
                  {currency.format(customer.unusedCredits || 0)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5">
                <span className="text-[11px] font-medium text-slate-500">Opening Balance</span>
                <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                  {currency.format(customer.openingBalance || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact Details</h4>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <Mail className="h-4 w-4 text-blue-600" />
                <div>
                  <span className="text-slate-400">Email:</span>{" "}
                  <span className="font-semibold text-slate-800">{customer.email || "Not specified"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <Phone className="h-4 w-4 text-emerald-600" />
                <div>
                  <span className="text-slate-400">Work Phone:</span>{" "}
                  <span className="font-semibold text-slate-800">{customer.phone || "Not specified"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <User className="h-4 w-4 text-purple-600" />
                <div>
                  <span className="text-slate-400">Mobile Phone:</span>{" "}
                  <span className="font-semibold text-slate-800">{customer.mobile || "Not specified"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <Building2 className="h-4 w-4 text-amber-600" />
                <div>
                  <span className="text-slate-400">Company:</span>{" "}
                  <span className="font-semibold text-slate-800">
                    {customer.companyName || "Independent"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Commercial Activity */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Commercial Activity</h4>
            <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-slate-500">Invoices</span>
                <div className="mt-1 text-base font-bold text-slate-900">
                  {documents.filter((d) => d.type === "Invoice" && d.customerId === customer.id).length}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-slate-500">Quotes</span>
                <div className="mt-1 text-base font-bold text-slate-900">
                  {documents.filter((d) => d.type === "Quote" && d.customerId === customer.id).length}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-slate-500">Sales Orders</span>
                <div className="mt-1 text-base font-bold text-slate-900">
                  {documents.filter((d) => d.type === "Sales Order" && d.customerId === customer.id).length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push(`/sales/quotes/new?customerId=${encodeURIComponent(customer.id)}`);
              }}
              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              + New Quote
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push(`/sales/orders/new?customerId=${encodeURIComponent(customer.id)}`);
              }}
              className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
            >
              + New Sales Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
