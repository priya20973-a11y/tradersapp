"use client";

import {
  type CustomerRecord,
  type SalesData,
  type SalesDocument,
  type SalesSection,
  currency,
} from "./sales-workspace-types";
import { Field, SelectField } from "./sales-workspace-fields";

interface SalesWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isSaving: boolean;
  activeFormType: string;
  currentTab: { section: SalesSection; label: string; type: string };
  data: SalesData;
  invoices: SalesDocument[];
  orders: SalesDocument[];
  customersById: Map<string, CustomerRecord>;
  selectedInvoiceId: string;
  initialCustomerId?: string;
}

export function SalesWorkspaceModal({
  isOpen,
  onClose,
  onSubmit,
  isSaving,
  activeFormType,
  currentTab,
  data,
  invoices,
  orders,
  customersById,
  selectedInvoiceId,
  initialCustomerId,
}: SalesWorkspaceModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-form-title"
        className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="sales-form-title" className="text-xl font-semibold text-slate-900">
            New{" "}
            {activeFormType === "Payment Received"
              ? "payment received"
              : activeFormType === "Credit Note"
                ? "credit note"
                : currentTab.label.replace(/s$/, "").toLowerCase()}
          </h2>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close form"
            onClick={onClose}
            disabled={isSaving}
          >
            ×
          </button>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          {activeFormType === "Customer" ? (
            <>
              <Field label="Customer name" name="name" required minLength={2} maxLength={120} />
              <Field label="Email" name="email" type="email" />
              <Field label="Phone" name="phone" maxLength={30} />
            </>
          ) : activeFormType === "Payment Received" || activeFormType === "Credit Note" ? (
            <>
              <SelectField
                label="Invoice"
                name="relatedDocumentId"
                required
                defaultValue={selectedInvoiceId}
                options={invoices
                  .filter((invoice) => invoice.total - invoice.amountPaid - invoice.creditedAmount > 0)
                  .map((invoice) => ({
                    value: invoice.id,
                    label: `${invoice.number} — ${customersById.get(invoice.customerId)?.name ?? "Customer"} — ${currency.format(invoice.total - invoice.amountPaid - invoice.creditedAmount)}`,
                  }))}
              />
              <Field label="Amount" name="total" type="number" min="0.01" step="0.01" required />
              {activeFormType === "Payment Received" ? (
                <>
                  <SelectField
                    label="Payment method"
                    name="method"
                    required
                    options={["Cash", "Bank", "UPI", "Cheque"].map((method) => ({
                      value: method,
                      label: method,
                    }))}
                  />
                  <Field label="Reference number" name="referenceNumber" maxLength={100} />
                </>
              ) : (
                <Field label="Notes" name="notes" maxLength={1000} />
              )}
            </>
          ) : activeFormType === "Delivery Challan" ? (
            <>
              <SelectField
                label="Customer"
                name="customerId"
                required
                defaultValue={initialCustomerId || ""}
                options={data.customers.map((customer) => ({
                  value: customer.id,
                  label: customer.name,
                }))}
              />
              <SelectField
                label="Sales order (optional)"
                name="relatedDocumentId"
                options={[
                  { value: "", label: "No order link" },
                  ...orders.map((order) => ({
                    value: order.id,
                    label: `${order.number} — ${customersById.get(order.customerId)?.name ?? "Customer"}`,
                  })),
                ]}
              />
              <Field label="Notes" name="notes" maxLength={1000} />
            </>
          ) : (
            <>
              <SelectField
                label="Customer"
                name="customerId"
                required
                defaultValue={initialCustomerId || ""}
                options={data.customers.map((customer) => ({
                  value: customer.id,
                  label: customer.name,
                }))}
              />
              <Field label="Total amount" name="total" type="number" min="0.01" step="0.01" required />
              {activeFormType === "Recurring Invoice" ? (
                <>
                  <SelectField
                    label="Frequency"
                    name="frequency"
                    required
                    options={["Weekly", "Monthly", "Quarterly", "Yearly"].map((frequency) => ({
                      value: frequency,
                      label: frequency,
                    }))}
                  />
                  <Field label="Next invoice date" name="nextRunDate" type="date" required />
                </>
              ) : (
                <>
                  <Field label="Issue date" name="issueDate" type="date" />
                  <Field label="Due date" name="dueDate" type="date" />
                </>
              )}
              <Field label="Notes" name="notes" maxLength={1000} />
            </>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || (data.customers.length === 0 && activeFormType !== "Customer")}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
          {data.customers.length === 0 && activeFormType !== "Customer" && (
            <p className="text-sm text-amber-700">Add a customer first to create sales records.</p>
          )}
        </form>
      </section>
    </div>
  );
}
