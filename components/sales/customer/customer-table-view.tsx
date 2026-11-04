"use client";

import { Eye, Mail, Phone } from "lucide-react";
import {
  calculateCustomerReceivable,
  currency,
  getAvatarColor,
  getInitials,
  type Customer,
  type SalesDocument,
} from "./customer-types";

type CustomerTableViewProps = {
  customers: Customer[];
  allCustomersCount: number;
  documents: SalesDocument[];
  selected: string[];
  onToggleCustomer: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onQuickView: (customer: Customer) => void;
};

export function CustomerTableView({
  customers,
  allCustomersCount,
  documents,
  selected,
  onToggleCustomer,
  onSelectAll,
  onQuickView,
}: CustomerTableViewProps) {
  const isAllSelected = customers.length > 0 && selected.length === customers.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-12 px-4 py-3.5">
                <input
                  type="checkbox"
                  aria-label="Select all customers"
                  checked={isAllSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3.5">Customer Profile</th>
              <th className="px-4 py-3.5">Company / Representative</th>
              <th className="px-4 py-3.5">Contact Channels</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5 text-right">Receivables (INR)</th>
              <th className="px-4 py-3.5 text-right">Unused Credits</th>
              <th className="px-4 py-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {customers.map((customer) => {
              const receivable = calculateCustomerReceivable(customer, documents);
              const isRowSelected = selected.includes(customer.id);
              return (
                <tr
                  key={customer.id}
                  className={`transition hover:bg-slate-50/80 ${isRowSelected ? "bg-blue-50/40" : ""}`}
                >
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      aria-label={`Select ${customer.name}`}
                      checked={isRowSelected}
                      onChange={() => onToggleCustomer(customer.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-xs ${getAvatarColor(
                          customer.name
                        )}`}
                      >
                        {getInitials(customer.name)}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onQuickView(customer)}
                          className="truncate text-left font-semibold text-slate-900 hover:text-blue-600 hover:underline"
                        >
                          {customer.name}
                        </button>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                              customer.customerType === "Business"
                                ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20"
                                : "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20"
                            }`}
                          >
                            {customer.customerType || "Business"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="font-medium text-slate-800">
                      {customer.companyName || <span className="text-slate-400">—</span>}
                    </div>
                    {customer.phone && (
                      <div className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    {customer.email ? (
                      <a
                        href={`mailto:${customer.email}`}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600"
                      >
                        <Mail className="h-3 w-3 text-slate-400" />
                        <span className="truncate max-w-[180px]">{customer.email}</span>
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {customer.mobile && (
                      <div className="mt-0.5 text-[11px] text-slate-500">M: {customer.mobile}</div>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
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
                  </td>

                  <td className="px-4 py-3.5 text-right font-medium tabular-nums">
                    <span className={receivable > 0 ? "font-bold text-rose-600" : "text-slate-800"}>
                      {currency.format(receivable)}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right font-medium tabular-nums text-slate-700">
                    {customer.unusedCredits > 0 ? (
                      <span className="font-semibold text-purple-700">
                        {currency.format(customer.unusedCredits)}
                      </span>
                    ) : (
                      currency.format(0)
                    )}
                  </td>

                  <td className="px-4 py-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => onQuickView(customer)}
                      title="Quick view customer profile"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-blue-600"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-5 py-3 text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-800">{customers.length}</strong> of{" "}
          <strong className="text-slate-800">{allCustomersCount}</strong> customers
        </span>
        <span>FinanceOS · LedgerFlow Customer Directory</span>
      </div>
    </div>
  );
}
