"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type SalesSection =
  | "customers"
  | "quotes"
  | "orders"
  | "invoices"
  | "recurring-invoices"
  | "delivery-challans"
  | "payments-received"
  | "credit-notes";

type CustomerRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  openingBalance: number;
  creditLimit: number;
  status: string;
};

type SalesDocument = {
  id: string;
  type: string;
  number: string;
  customerId: string;
  relatedDocumentId: string;
  status: string;
  total: number;
  amountPaid: number;
  creditedAmount: number;
  issueDate: string;
  dueDate: string;
  nextRunDate: string;
  frequency: string;
  method: string;
  referenceNumber: string;
  notes: string;
};

type Organization = { id: string; name: string };
type SalesData = {
  organizations: Organization[];
  customers: CustomerRecord[];
  documents: SalesDocument[];
  isAdmin: boolean;
};

const tabs: { section: SalesSection; label: string; type: string }[] = [
  { section: "customers", label: "Customers", type: "Customer" },
  { section: "quotes", label: "Quotes", type: "Quote" },
  { section: "orders", label: "Sales Orders", type: "Sales Order" },
  { section: "invoices", label: "Invoices", type: "Invoice" },
  { section: "recurring-invoices", label: "Recurring Invoices", type: "Recurring Invoice" },
  { section: "delivery-challans", label: "Delivery Challans", type: "Delivery Challan" },
  { section: "payments-received", label: "Payments Received", type: "Payment Received" },
  { section: "credit-notes", label: "Credit Notes", type: "Credit Note" },
];

const inputClassName =
  "mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10";
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

function dateLabel(date: string) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function SalesWorkspace({ section }: { section: SalesSection }) {
  const [data, setData] = useState<SalesData>({
    organizations: [],
    customers: [],
    documents: [],
    isAdmin: false,
  });
  const [organizationId, setOrganizationId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");

  const currentTab = tabs.find((tab) => tab.section === section)!;
  const activeFormType = formType ?? currentTab.type;

  const loadData = useCallback(async (orgId?: string) => {
    setError("");
    try {
      const query = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : "";
      const response = await fetch(`/api/sales${query}`, { cache: "no-store" });
      const result = (await response.json()) as SalesData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load sales data.");
      setData(result);
      if (!result.isAdmin && result.organizations[0]?.id) {
        setOrganizationId(result.organizations[0].id);
      }
      if (result.isAdmin && !orgId && result.organizations[0]?.id) {
        setOrganizationId(result.organizations[0].id);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load sales data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(request);
  }, [loadData]);

  useEffect(() => {
    if (!data.isAdmin || !organizationId) return;
    const request = window.setTimeout(() => {
      void loadData(organizationId);
    }, 0);
    return () => window.clearTimeout(request);
  }, [data.isAdmin, loadData, organizationId]);

  const customersById = useMemo(
    () => new Map(data.customers.map((customer) => [customer.id, customer])),
    [data.customers],
  );
  const documentsById = useMemo(
    () => new Map(data.documents.map((document) => [document.id, document])),
    [data.documents],
  );
  const visibleDocuments = data.documents.filter((document) => document.type === currentTab.type);
  const invoices = data.documents.filter((document) => document.type === "Invoice");
  const orders = data.documents.filter((document) => document.type === "Sales Order");

  const customerBalance = (customerId: string) => {
    const customer = customersById.get(customerId);
    return (
      Number(customer?.openingBalance ?? 0) +
      data.documents
        .filter((document) => document.type === "Invoice" && document.customerId === customerId)
        .reduce((balance, invoice) => balance + invoice.total - invoice.amountPaid - invoice.creditedAmount, 0)
    );
  };

  async function postAction(payload: Record<string, string>) {
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...(data.isAdmin ? { organizationId } : {}) }),
      });
      const result = (await response.json()) as { error?: string; number?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save this record.");
      setShowForm(false);
      setNotice(result.number ? `${result.number} created successfully.` : "Saved successfully.");
      await loadData(data.isAdmin ? organizationId : undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this record.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload: Record<string, string> = { type: activeFormType };

    if (activeFormType === "Customer") {
      payload.name = String(formData.get("name") ?? "");
      payload.email = String(formData.get("email") ?? "");
      payload.phone = String(formData.get("phone") ?? "");
    } else if (activeFormType === "Payment Received" || activeFormType === "Credit Note") {
      payload.relatedDocumentId = String(formData.get("relatedDocumentId") ?? "");
      payload.total = String(formData.get("total") ?? "");
      if (activeFormType === "Payment Received") {
        payload.method = String(formData.get("method") ?? "Bank");
        payload.referenceNumber = String(formData.get("referenceNumber") ?? "");
      } else {
        payload.notes = String(formData.get("notes") ?? "");
      }
    } else {
      payload.customerId = String(formData.get("customerId") ?? "");
      if (activeFormType === "Delivery Challan") {
        const relatedDocumentId = String(formData.get("relatedDocumentId") ?? "");
        if (relatedDocumentId) payload.relatedDocumentId = relatedDocumentId;
        payload.notes = String(formData.get("notes") ?? "");
      } else if (activeFormType === "Recurring Invoice") {
        payload.total = String(formData.get("total") ?? "");
        payload.frequency = String(formData.get("frequency") ?? "Monthly");
        payload.nextRunDate = String(formData.get("nextRunDate") ?? "");
        payload.notes = String(formData.get("notes") ?? "");
      } else {
        payload.total = String(formData.get("total") ?? "");
        const issueDate = String(formData.get("issueDate") ?? "");
        const dueDate = String(formData.get("dueDate") ?? "");
        if (issueDate) payload.issueDate = issueDate;
        if (dueDate) payload.dueDate = dueDate;
        payload.notes = String(formData.get("notes") ?? "");
      }
    }
    await postAction(payload);
  }

  async function runAction(document: SalesDocument, action: string) {
    await postAction({ action, documentId: document.id });
  }

  async function changeStatus(document: SalesDocument, status: string) {
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/sales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document.id,
          status,
          ...(data.isAdmin ? { organizationId } : {}),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to update the status.");
      setNotice(`${document.number} updated.`);
      await loadData(data.isAdmin ? organizationId : undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the status.");
    }
  }

  const emptyOrganization = data.isAdmin && !organizationId && data.organizations.length === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sales</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">{currentTab.label}</h1>
          <p className="mt-2 text-sm text-slate-500">Manage sales records and keep customer balances in sync.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.isAdmin && (
            <label className="text-sm text-slate-600">
              Organization
              <select
                className="ml-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                aria-label="Select organization"
              >
                <option value="">Select organization</option>
                {data.organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            onClick={() => {
              setError("");
              setNotice("");
              setFormType(currentTab.type);
              setSelectedInvoiceId("");
              setShowForm(true);
            }}
            disabled={isLoading || (data.isAdmin && !organizationId)}
          >
            {currentTab.type === "Customer" ? "New customer" : `New ${currentTab.label.replace(/s$/, "").toLowerCase()}`}
          </button>
        </div>
      </header>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{notice}</p>}
      {emptyOrganization && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          No organizations are available yet. Create an account to establish an organization before managing sales.
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading sales data…</div>
      ) : currentTab.type === "Customer" ? (
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
              {data.customers.length === 0 && <EmptyRow columns={5} label="No customers yet. Add a customer to get started." />}
            </tbody>
          </table>
        </div>
      ) : (
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
                      {linkedDocument && <div className="mt-1 text-xs text-slate-500">Linked to {linkedDocument.number}</div>}
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
                            .map((status) => <option key={status} value={status}>{status}</option>)}
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
                        {document.type === "Invoice" && document.total - document.amountPaid - document.creditedAmount > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setFormType("Payment Received");
                                setSelectedInvoiceId(document.id);
                                setShowForm(true);
                              }}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100"
                              aria-label={`Record payment for ${document.number}`}
                            >
                              Record payment
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormType("Credit Note");
                                setSelectedInvoiceId(document.id);
                                setShowForm(true);
                              }}
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
                <EmptyRow columns={6} label={`No ${currentTab.label.toLowerCase()} yet. Add a record to get started.`} />
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) setShowForm(false);
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
                New {activeFormType === "Payment Received" ? "payment received" : activeFormType === "Credit Note" ? "credit note" : currentTab.label.replace(/s$/, "").toLowerCase()}
              </h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close form"
                onClick={() => setShowForm(false)}
                disabled={isSaving}
              >
                ×
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleCreate}>
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
                    options={invoices.filter((invoice) => invoice.total - invoice.amountPaid - invoice.creditedAmount > 0).map((invoice) => ({
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
                        options={["Cash", "Bank", "UPI", "Cheque"].map((method) => ({ value: method, label: method }))}
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
                    options={data.customers.map((customer) => ({ value: customer.id, label: customer.name }))}
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
                    options={data.customers.map((customer) => ({ value: customer.id, label: customer.name }))}
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
                  onClick={() => setShowForm(false)}
                  disabled={isSaving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || (data.customers.length === 0 && activeFormType !== "Customer")}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
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
      )}
    </div>
  );
}

function EmptyRow({ columns, label }: { columns: number; label: string }) {
  return (
    <tr>
      <td colSpan={columns} className="px-4 py-10 text-center text-sm text-slate-500">{label}</td>
    </tr>
  );
}

function Field({
  label,
  name,
  type = "text",
  ...inputProps
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: string;
  maxLength?: number;
  minLength?: number;
  step?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input className={inputClassName} name={name} type={type} {...inputProps} />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select className={inputClassName} name={name} required={required} defaultValue={defaultValue ?? ""}>
        <option value="" disabled={required}>Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
