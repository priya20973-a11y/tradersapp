"use client";

import {
  type CustomerRecord,
  type SalesData,
  type SalesDocument,
  type SalesSection,
  currency,
  dateLabel,
} from "./sales-workspace-types";
import { EmptyRow } from "./sales-workspace-fields";

interface SalesWorkspaceTableProps {
  currentTab: { section: SalesSection; label: string; type: string };
  data: SalesData;
  visibleDocuments: SalesDocument[];
  documentsById: Map<string, SalesDocument>;
  customersById: Map<string, CustomerRecord>;
  customerBalance: (customerId: string) => number;
  isSaving: boolean;
  changeStatus: (document: SalesDocument, status: string) => Promise<void>;
  runAction: (document: SalesDocument, action: string) => Promise<void>;
  onRecordPayment: (documentId: string) => void;
  onCreateCreditNote: (documentId: string) => void;
}

export function SalesWorkspaceTable({
  currentTab,
  data,
  visibleDocuments,
  documentsById,
  customersById,
  customerBalance,
  isSaving,
  changeStatus,
  runAction,
  onRecordPayment,
  onCreateCreditNote,
}: SalesWorkspaceTableProps) {
  if (currentTab.type === "Customer") {
    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Email / phone</th>
              <th className="px-4 py-3 text-right font-medium">Outstanding</th>
              <th className="px-4 py-3 text-right font-medium">Credit limit</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {data.customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{customer.name}</td>
                <td className="px-4 py-3">
                  <div>{customer.email || "—"}</div>
                  <div className="text-xs text-slate-500">{customer.phone || ""}</div>
                </td>
                <td className="px-4 py-3 text-right">{currency.format(customerBalance(customer.id))}</td>
                <td className="px-4 py-3 text-right">{currency.format(customer.creditLimit)}</td>
                <td className="px-4 py-3">{customer.status}</td>
              </tr>
            ))}
            {data.customers.length === 0 && (
              <EmptyRow columns={5} label="No customers yet. Add a customer to get started." />
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-left">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Number</th>
            <th className="px-4 py-3 font-medium">Customer</th>
            <th className="px-4 py-3 font-medium">Date / linked record</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
          {visibleDocuments.map((document) => {
            const linkedDocument = documentsById.get(document.relatedDocumentId);
            const statusOptions: Record<string, string[]> = {
              Quote: ["Accepted", "Rejected"],
              "Sales Order": ["Confirmed", "Fulfilled", "Cancelled"],
              "Recurring Invoice": ["Active", "Paused"],
              "Delivery Challan": ["Dispatched", "Delivered"],
            };
            const isClosed =
              (document.type === "Quote" && ["Converted", "Rejected"].includes(document.status)) ||
              (document.type === "Sales Order" && ["Invoiced", "Cancelled"].includes(document.status)) ||
              (document.type === "Delivery Challan" && document.status === "Delivered");
            const actions: { label: string; action: string }[] =
              document.type === "Quote" && !["Converted", "Rejected"].includes(document.status)
                ? [{ label: "Create order", action: "convert-quote" }]
                : document.type === "Sales Order" && !["Invoiced", "Cancelled"].includes(document.status)
                  ? [{ label: "Create invoice", action: "invoice-from-order" }]
                  : document.type === "Recurring Invoice" && document.status === "Active"
                    ? [{ label: "Generate invoice", action: "generate-recurring" }]
                    : [];

            return (
              <tr key={document.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{document.number}</td>
                <td className="px-4 py-3">{customersById.get(document.customerId)?.name ?? "Customer"}</td>
                <td className="px-4 py-3">
                  <div>
                    {document.type === "Recurring Invoice"
                      ? `${document.frequency} · Next ${dateLabel(document.nextRunDate)}`
                      : dateLabel(document.issueDate)}
                  </div>
                  {linkedDocument && (
                    <div className="mt-1 text-xs text-slate-500">Linked to {linkedDocument.number}</div>
                  )}
                  {document.type === "Invoice" && (
                    <div className="mt-1 text-xs text-slate-500">
                      Due {dateLabel(document.dueDate)} · Balance{" "}
                      {currency.format(document.total - document.amountPaid - document.creditedAmount)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {document.type === "Payment Received" ? "-" : ""}
                  {currency.format(document.total)}
                  {document.type === "Invoice" && document.creditedAmount > 0 && (
                    <div className="text-xs text-slate-500">Credit {currency.format(document.creditedAmount)}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {statusOptions[document.type] && !isClosed ? (
                    <select
                      aria-label={`Update ${document.number} status`}
                      value={document.status}
                      onChange={(event) => void changeStatus(document, event.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value={document.status}>{document.status}</option>
                      {statusOptions[document.type]
                        .filter((status) => status !== document.status)
                        .map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {document.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {actions.map(({ label, action }) => (
                      <button
                        key={action}
                        type="button"
                        disabled={isSaving}
                        onClick={() => void runAction(document, action)}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {label}
                      </button>
                    ))}
                    {document.type === "Invoice" &&
                      document.total - document.amountPaid - document.creditedAmount > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => onRecordPayment(document.id)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100"
                            aria-label={`Record payment for ${document.number}`}
                          >
                            Record payment
                          </button>
                          <button
                            type="button"
                            onClick={() => onCreateCreditNote(document.id)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100"
                            aria-label={`Create credit note for ${document.number}`}
                          >
                            Credit note
                          </button>
                        </>
                      )}
                  </div>
                </td>
              </tr>
            );
          })}
          {visibleDocuments.length === 0 && (
            <EmptyRow
              columns={6}
              label={`No ${currentTab.label.toLowerCase()} yet. Add a record to get started.`}
            />
          )}
        </tbody>
      </table>
    </div>
  );
}
