"use client";

import { Building2, Eye, Mail, Phone } from "lucide-react";
import {
  calculateCustomerReceivable,
  currency,
  getAvatarColor,
  getInitials,
  type Customer,
  type SalesDocument,
} from "./customer-types";

type CustomerGridViewProps = {
  customers: Customer[];
  documents: SalesDocument[];
  selected: string[];
  onToggleCustomer: (id: string) => void;
  onQuickView: (customer: Customer) => void;
};

export function CustomerGridView({
  customers,
  documents,
  selected,
  onToggleCustomer,
  onQuickView,
}: CustomerGridViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {customers.map((customer) => {
        const receivable = calculateCustomerReceivable(customer, documents);
        const isCardSelected = selected.includes(customer.id);
        return (
          <div
            key={customer.id}
            className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition hover:border-blue-400 hover:shadow-md ${
              isCardSelected ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200/90"
            }`}
          >
            <div>
              {/* Header: Avatar, Name & Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold shadow-xs ${getAvatarColor(
                      customer.name
                    )}`}
                  >
                    {getInitials(customer.name)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-bold text-slate-900 group-hover:text-blue-600">
                      {customer.name}
                    </h4>
                    <span
                      className={`mt-1 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        customer.customerType === "Business"
                          ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20"
                          : "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20"
                      }`}
                    >
                      {customer.customerType || "Business"}
                    </span>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    customer.status === "Active"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                      : customer.status === "Inactive"
                      ? "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20"
                      : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      customer.status === "Active"
                        ? "bg-emerald-600"
                        : customer.status === "Inactive"
                        ? "bg-slate-400"
                        : "bg-amber-600"
                    }`}
                  />
                  {customer.status || "Active"}
                </span>
              </div>

              {/* Company & Contact Info */}
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                {customer.companyName && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate font-medium text-slate-800">{customer.companyName}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate text-slate-600">{customer.email}</span>
                  </div>
                )}
                {(customer.phone || customer.mobile) && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="text-slate-600">{customer.phone || customer.mobile}</span>
                  </div>
                )}
              </div>

              {/* Financial Summary Box */}
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50/80 p-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Receivables
                  </div>
                  <div
                    className={`mt-1 text-xs font-bold tabular-nums ${
                      receivable > 0 ? "text-rose-600" : "text-slate-900"
                    }`}
                  >
                    {currency.format(receivable)}
                  </div>
                </div>
                <div className="border-l border-slate-200/80 pl-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Unused Credits
                  </div>
                  <div className="mt-1 text-xs font-bold tabular-nums text-purple-700">
                    {currency.format(customer.unusedCredits || 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Card Actions Footer */}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => onToggleCustomer(customer.id)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                {isCardSelected ? "✓ Selected" : "+ Select"}
              </button>
              <button
                type="button"
                onClick={() => onQuickView(customer)}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Quick View</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
