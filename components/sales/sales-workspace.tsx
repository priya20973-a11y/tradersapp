"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  type SalesData,
  type SalesDocument,
  type SalesSection,
  tabs,
} from "./workspace/sales-workspace-types";
import { SalesWorkspaceModal } from "./workspace/sales-workspace-modal";
import { SalesWorkspaceTable } from "./workspace/sales-workspace-table";
import { fetchCachedSales, invalidateSalesCache } from "@/lib/sales-cache";

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
  const [showForm, setShowForm] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("action") === "new";
  });
  const [formType, setFormType] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [initialCustomerId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("customerId") || "";
  });

  const currentTab = tabs.find((tab) => tab.section === section)!;
  const activeFormType = formType ?? currentTab.type;

  const loadData = useCallback(async (orgId?: string, force = false) => {
    try {
      const queryParams = new URLSearchParams();
      if (orgId) queryParams.set("organizationId", orgId);
      queryParams.set("section", section);
      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
      const result = await fetchCachedSales<SalesData>(queryString, { force });
      setError("");
      setData(result);
      if (!result.isAdmin && result.organizations[0]?.id) {
        setOrganizationId(result.organizations[0].id);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load sales data.");
    } finally {
      setIsLoading(false);
    }
  }, [section]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (organizationId) queryParams.set("organizationId", organizationId);
        queryParams.set("section", section);
        const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
        const result = await fetchCachedSales<SalesData>(queryString);
        if (!active) return;
        setError("");
        setData(result);
        if (!result.isAdmin && result.organizations[0]?.id) {
          setOrganizationId(result.organizations[0].id);
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load sales data.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [organizationId, section]);

  const invoices = useMemo(
    () => data.documents.filter((doc) => doc.type === "Invoice"),
    [data.documents],
  );

  const orders = useMemo(
    () => data.documents.filter((doc) => doc.type === "Sales Order"),
    [data.documents],
  );

  const customersById = useMemo(
    () => new Map(data.customers.map((customer) => [customer.id, customer])),
    [data.customers],
  );

  const documentsById = useMemo(
    () => new Map(data.documents.map((doc) => [doc.id, doc])),
    [data.documents],
  );

  const customerBalance = useCallback(
    (customerId: string) => {
      const customerInvoices = invoices.filter((doc) => doc.customerId === customerId);
      const totalInvoiced = customerInvoices.reduce((sum, doc) => sum + doc.total, 0);
      const totalPaid = customerInvoices.reduce((sum, doc) => sum + doc.amountPaid, 0);
      const totalCredited = customerInvoices.reduce((sum, doc) => sum + doc.creditedAmount, 0);
      const unallocatedPayments = data.documents
        .filter((doc) => doc.type === "Payment Received" && doc.customerId === customerId && !doc.relatedDocumentId)
        .reduce((sum, doc) => sum + doc.total, 0);
      return totalInvoiced - totalPaid - totalCredited - unallocatedPayments;
    },
    [data.documents, invoices],
  );

  const visibleDocuments = useMemo(() => {
    return data.documents.filter((doc) => doc.type === currentTab.type);
  }, [currentTab.type, data.documents]);

  async function postAction(payload: Record<string, string | number | undefined>) {
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const body = {
        ...payload,
        ...(data.isAdmin ? { organizationId } : {}),
      };
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Action failed.");
      invalidateSalesCache();
      setShowForm(false);
      setNotice("Action completed.");
      await loadData(data.isAdmin ? organizationId : undefined, true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload: Record<string, string | number | undefined> = { type: activeFormType };

    if (activeFormType === "Customer") {
      payload.name = String(formData.get("name") ?? "");
      payload.email = String(formData.get("email") ?? "");
      payload.phone = String(formData.get("phone") ?? "");
    } else {
      payload.customerId = String(formData.get("customerId") ?? "");
      if (activeFormType === "Payment Received") {
        payload.relatedDocumentId = String(formData.get("relatedDocumentId") ?? "");
        payload.total = String(formData.get("total") ?? "");
        payload.method = String(formData.get("method") ?? "");
        payload.referenceNumber = String(formData.get("referenceNumber") ?? "");
        const matched = invoices.find((inv) => inv.id === payload.relatedDocumentId);
        if (matched) payload.customerId = matched.customerId;
      } else if (activeFormType === "Credit Note") {
        payload.relatedDocumentId = String(formData.get("relatedDocumentId") ?? "");
        payload.total = String(formData.get("total") ?? "");
        payload.notes = String(formData.get("notes") ?? "");
        const matched = invoices.find((inv) => inv.id === payload.relatedDocumentId);
        if (matched) payload.customerId = matched.customerId;
      } else if (activeFormType === "Delivery Challan") {
        const related = String(formData.get("relatedDocumentId") ?? "");
        if (related) payload.relatedDocumentId = related;
        payload.notes = String(formData.get("notes") ?? "");
      } else if (activeFormType === "Recurring Invoice") {
        payload.total = String(formData.get("total") ?? "");
        payload.frequency = String(formData.get("frequency") ?? "");
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
      invalidateSalesCache();
      setNotice(`${document.number} updated.`);
      await loadData(data.isAdmin ? organizationId : undefined, true);
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
          <p className="mt-2 text-sm text-slate-500">
            Manage sales records and keep customer balances in sync.
          </p>
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
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition disabled:opacity-50"
            onClick={() => {
              setError("");
              setNotice("");
              setFormType(currentTab.type);
              setSelectedInvoiceId("");
              setShowForm(true);
            }}
            disabled={isLoading || (data.isAdmin && !organizationId)}
          >
            {currentTab.type === "Customer"
              ? "New customer"
              : `New ${currentTab.label.replace(/s$/, "").toLowerCase()}`}
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
          {notice}
        </p>
      )}
      {emptyOrganization && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          No organizations are available yet. Create an account to establish an organization before
          managing sales.
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading sales data…
        </div>
      ) : (
        <SalesWorkspaceTable
          currentTab={currentTab}
          data={data}
          visibleDocuments={visibleDocuments}
          documentsById={documentsById}
          customersById={customersById}
          customerBalance={customerBalance}
          isSaving={isSaving}
          changeStatus={changeStatus}
          runAction={runAction}
          onRecordPayment={(id) => {
            setFormType("Payment Received");
            setSelectedInvoiceId(id);
            setShowForm(true);
          }}
          onCreateCreditNote={(id) => {
            setFormType("Credit Note");
            setSelectedInvoiceId(id);
            setShowForm(true);
          }}
        />
      )}

      <SalesWorkspaceModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreate}
        isSaving={isSaving}
        activeFormType={activeFormType}
        currentTab={currentTab}
        data={data}
        invoices={invoices}
        orders={orders}
        customersById={customersById}
        selectedInvoiceId={selectedInvoiceId}
        initialCustomerId={initialCustomerId}
      />
    </div>
  );
}
