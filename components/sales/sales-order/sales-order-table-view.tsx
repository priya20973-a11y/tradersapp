"use client";

import {
  CheckCircle2,
  Eye,
  Plus,
  Receipt,
  ShoppingCart,
  Truck,
} from "lucide-react";
import {
  currency,
  formatDate,
  getAvatarColor,
  getInitials,
  getSalesOrderStatusStyle,
  type CustomerRecord,
  type SalesOrderDocument,
} from "./sales-order-types";

interface SalesOrderTableViewProps {
  orders: SalesOrderDocument[];
  customerMap: Map<string, CustomerRecord>;
  loading: boolean;
  searchTerm: string;
  selectedOrders: string[];
  onToggleSelectAll: () => void;
  onToggleSelectOrder: (id: string) => void;
  onQuickView: (order: SalesOrderDocument) => void;
  onAction: (orderId: string, action: "invoice-from-order") => void;
  onStatusChange: (orderId: string, status: string) => void;
  onOpenCreate: () => void;
}

export function SalesOrderTableView({
  orders,
  customerMap,
  loading,
  searchTerm,
  selectedOrders,
  onToggleSelectAll,
  onToggleSelectOrder,
  onQuickView,
  onAction,
  onStatusChange,
  onOpenCreate,
}: SalesOrderTableViewProps) {
  const allSelected = orders.length > 0 && selectedOrders.length === orders.length;
  const someSelected = selectedOrders.length > 0 && selectedOrders.length < orders.length;

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
                  aria-label="Select all orders"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="px-5 py-3.5 font-semibold">Sales Order#</th>
              <th className="px-4 py-3.5 font-semibold">Customer</th>
              <th className="px-4 py-3.5 font-semibold">Reference#</th>
              <th className="px-4 py-3.5 font-semibold">Order Date</th>
              <th className="px-4 py-3.5 font-semibold">Shipment Date</th>
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
                    <span className="text-sm font-medium">Loading sales orders...</span>
                  </div>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-16 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3 shadow-xs">
                    <ShoppingCart className="h-7 w-7" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base">No sales orders found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {searchTerm
                      ? `No orders matching "${searchTerm}". Try a different keyword or reset filters.`
                      : "Create sales orders to track fulfillment, issue deliveries, and convert them directly to invoices."}
                  </p>
                  <button
                    type="button"
                    onClick={onOpenCreate}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Sales Order
                  </button>
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const customer = customerMap.get(order.customerId);
                const customerName = customer?.name || "Customer";
                const statusStyle = getSalesOrderStatusStyle(order.status);
                const isSelected = selectedOrders.includes(order.id);
                const isClosed = ["Invoiced", "Cancelled"].includes(order.status);

                return (
                  <tr
                    key={order.id}
                    className={`group transition-colors ${
                      isSelected ? "bg-blue-50/60" : "hover:bg-slate-50/80"
                    }`}
                  >
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectOrder(order.id)}
                        aria-label={`Select order ${order.number}`}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => onQuickView(order)}
                        className="font-mono text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer text-left"
                      >
                        {order.number}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold border shadow-2xs ${getAvatarColor(
                            customerName
                          )}`}
                        >
                          {getInitials(customerName)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate max-w-[170px] text-xs sm:text-sm">
                            {customerName}
                          </p>
                          {customer?.email && (
                            <p className="text-[11px] text-slate-400 truncate max-w-[170px]">
                              {customer.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs font-mono text-slate-600">
                      {order.referenceNumber ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                          {order.referenceNumber}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600 whitespace-nowrap">
                      {formatDate(order.issueDate)}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600 whitespace-nowrap">
                      {formatDate(order.expectedShipmentDate)}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-slate-900 tabular-nums">
                      {currency.format(order.total)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${statusStyle.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onQuickView(order)}
                          title="Quick View"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {!isClosed && (
                          <button
                            type="button"
                            onClick={() => onAction(order.id, "invoice-from-order")}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                            title="Convert to Invoice"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            Invoice
                          </button>
                        )}

                        {!isClosed && order.status === "Draft" && (
                          <button
                            type="button"
                            onClick={() => onStatusChange(order.id, "Confirmed")}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                            title="Confirm Sales Order"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Confirm
                          </button>
                        )}

                        {!isClosed && order.status === "Confirmed" && (
                          <button
                            type="button"
                            onClick={() => onStatusChange(order.id, "Fulfilled")}
                            className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-200 hover:bg-purple-100 transition cursor-pointer"
                            title="Mark as Fulfilled"
                          >
                            <Truck className="h-3.5 w-3.5" />
                            Fulfill
                          </button>
                        )}
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
