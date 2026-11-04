"use client";

import {
  Calendar,
  Eye,
  Mail,
  Package,
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

interface SalesOrderGridViewProps {
  orders: SalesOrderDocument[];
  customerMap: Map<string, CustomerRecord>;
  onQuickView: (order: SalesOrderDocument) => void;
  onAction: (orderId: string, action: "invoice-from-order") => void;
  onStatusChange: (orderId: string, status: string) => void;
}

export function SalesOrderGridView({
  orders,
  customerMap,
  onQuickView,
  onAction,
  onStatusChange,
}: SalesOrderGridViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {orders.map((order) => {
        const customer = customerMap.get(order.customerId);
        const customerName = customer?.name || "Customer";
        const statusStyle = getSalesOrderStatusStyle(order.status);
        const isClosed = ["Invoiced", "Cancelled"].includes(order.status);
        const itemsCount = order.items?.length || 0;

        return (
          <div
            key={order.id}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-blue-400 hover:shadow-md"
          >
            <div>
              {/* Header: Sales Order Number & Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-600/10">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => onQuickView(order)}
                      className="font-mono text-sm font-bold text-slate-900 group-hover:text-blue-600 text-left transition cursor-pointer"
                    >
                      {order.number}
                    </button>
                    {order.referenceNumber && (
                      <p className="text-[11px] font-mono text-slate-400">
                        Ref: {order.referenceNumber}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${statusStyle.badge}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                    {order.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => onQuickView(order)}
                    title="Quick View"
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Customer Info */}
              <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold border shadow-2xs ${getAvatarColor(
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
                    <p className="text-[11px] text-slate-400">Direct Customer</p>
                  )}
                </div>
              </div>

              {/* Order Dates & Item Count */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>Date: {formatDate(order.issueDate)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Truck className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>Ship: {formatDate(order.expectedShipmentDate)}</span>
                </div>
                <div className="col-span-2 flex items-center gap-1 text-slate-600">
                  <Package className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>
                    {itemsCount > 0
                      ? `${itemsCount} order line item${itemsCount > 1 ? "s" : ""}`
                      : "General consignment order"}
                  </span>
                </div>
              </div>

              {/* Order Total Value */}
              <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Order Total
                </span>
                <span className="text-lg font-bold tracking-tight text-slate-900 tabular-nums">
                  {currency.format(order.total || 0)}
                </span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <select
                value={order.status}
                onChange={(e) => onStatusChange(order.id, e.target.value)}
                className="text-xs rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700 outline-none hover:bg-white focus:bg-white transition cursor-pointer"
              >
                <option value="Draft">Draft</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Fulfilled">Fulfilled</option>
                <option value="Invoiced">Invoiced</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <div className="flex items-center gap-1.5">
                {!isClosed && (
                  <button
                    type="button"
                    onClick={() => onAction(order.id, "invoice-from-order")}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                  >
                    <Receipt className="h-3 w-3" />
                    Invoice
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onQuickView(order)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Details
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
