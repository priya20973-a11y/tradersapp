"use client";

import {
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Mail,
  Printer,
  Receipt,
  ShoppingCart,
  Truck,
  User,
  X,
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

interface SalesOrderDetailModalProps {
  order: SalesOrderDocument | null;
  customer?: CustomerRecord;
  onClose: () => void;
  onAction: (orderId: string, action: "invoice-from-order") => void;
  onStatusChange: (orderId: string, status: string) => void;
}

export function SalesOrderDetailModal({
  order,
  customer,
  onClose,
  onAction,
  onStatusChange,
}: SalesOrderDetailModalProps) {
  if (!order) return null;

  const statusStyle = getSalesOrderStatusStyle(order.status);
  const isClosed = ["Invoiced", "Cancelled"].includes(order.status);
  const customerName = customer?.name || "Customer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 sm:p-6 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header Banner */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">{order.number}</h3>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${statusStyle.badge}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                  {order.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Created on {formatDate(order.issueDate)}
                {order.referenceNumber && (
                  <>
                    {" "}
                    · Ref: <span className="font-mono text-slate-700">{order.referenceNumber}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              title="Print Order"
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

        {/* Modal Content Body */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {/* Customer & Fulfillment Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Customer & Billing
              </span>
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold border shadow-2xs ${getAvatarColor(
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
                <span className="text-slate-500 block">Expected Shipment</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  {formatDate(order.expectedShipmentDate)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Payment Terms</span>
                <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5">
                  <CreditCard className="h-3 w-3 text-slate-400" />
                  {order.paymentTerms || "Due on Receipt"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Delivery Method</span>
                <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5">
                  <Truck className="h-3 w-3 text-slate-400" />
                  {order.deliveryMethod || "Transport"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Salesperson</span>
                <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5">
                  <User className="h-3 w-3 text-slate-400" />
                  {order.salesperson || "Operations Team"}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Itemized Order Lines
            </h4>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{it.name}</p>
                          {it.description && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{it.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          {it.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {currency.format(it.rate)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {currency.format(it.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                        No item breakdown recorded for this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Totals Breakdown */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pt-2">
            <div className="flex-1 space-y-3">
              {order.customerNotes && (
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Customer Notes
                  </span>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {order.customerNotes}
                  </p>
                </div>
              )}
              {order.termsAndConditions && (
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Terms & Conditions
                  </span>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {order.termsAndConditions}
                  </p>
                </div>
              )}
            </div>

            <div className="w-full sm:w-72 space-y-2 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Sub Total:</span>
                <span className="font-semibold text-slate-800">
                  {currency.format(order.subTotal || order.total)}
                </span>
              </div>
              {order.discount ? (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span className="font-semibold">- {currency.format(order.discount)}</span>
                </div>
              ) : null}
              {order.taxAmount ? (
                <div className="flex justify-between text-slate-600">
                  <span>
                    Tax {order.taxName ? `(${order.taxName})` : ""}:
                  </span>
                  <span className="font-semibold">
                    {order.taxType === "TDS" ? "- " : "+ "}
                    {currency.format(order.taxAmount)}
                  </span>
                </div>
              ) : null}
              {order.adjustment ? (
                <div className="flex justify-between text-slate-600">
                  <span>Adjustment:</span>
                  <span className="font-semibold">{currency.format(order.adjustment)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                <span>Total Amount:</span>
                <span className="text-base text-blue-600 tabular-nums">
                  {currency.format(order.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2">
            {!isClosed && (
              <button
                type="button"
                onClick={() => {
                  onAction(order.id, "invoice-from-order");
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
              >
                <Receipt className="h-4 w-4" />
                Convert to Invoice
              </button>
            )}

            {!isClosed && order.status === "Draft" && (
              <button
                type="button"
                onClick={() => {
                  onStatusChange(order.id, "Confirmed");
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirm Order
              </button>
            )}

            {!isClosed && order.status === "Confirmed" && (
              <button
                type="button"
                onClick={() => {
                  onStatusChange(order.id, "Fulfilled");
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition cursor-pointer"
              >
                <Truck className="h-4 w-4" />
                Mark as Fulfilled
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
