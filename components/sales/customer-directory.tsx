"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Search } from "lucide-react";

type Customer = {
  id: string;
  name: string;
  customerType: string;
  companyName: string;
  email: string;
  phone: string;
  mobile: string;
  openingBalance: number;
  creditLimit: number;
  unusedCredits: number;
  status: string;
};

type SalesDocument = {
  type: string;
  customerId: string;
  total: number;
  amountPaid: number;
  creditedAmount: number;
};

type Organization = { id: string; name: string };
type SalesResponse = {
  organizations: Organization[];
  customers: Customer[];
  documents: SalesDocument[];
  isAdmin: boolean;
  error?: string;
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

export function CustomerDirectory() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const loadOrganization = useCallback(async (orgId?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : "";
      const response = await fetch(`/api/sales${query}`, { cache: "no-store" });
      const result = (await response.json()) as SalesResponse;
      if (!response.ok) throw new Error(result.error ?? "Unable to load customers.");
      setOrganizations(result.organizations);
      setIsAdmin(result.isAdmin);
      setCustomers(result.customers);
      setDocuments(result.documents);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load customers.");
      setCustomers([]);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadInitialData() {
      setLoading(true);
      try {
        const response = await fetch("/api/sales", { cache: "no-store" });
        const result = (await response.json()) as SalesResponse;
        if (!response.ok) throw new Error(result.error ?? "Unable to load customers.");
        if (!active) return;
        setOrganizations(result.organizations);
        setIsAdmin(result.isAdmin);
        if (result.isAdmin) {
          const requestedId = new URLSearchParams(window.location.search).get("organizationId");
          const selectedOrganization = result.organizations.find((item) => item.id === requestedId)
            ?? result.organizations[0];
          if (selectedOrganization) {
            setOrganizationId(selectedOrganization.id);
            await loadOrganization(selectedOrganization.id);
          } else {
            setCustomers([]);
            setDocuments([]);
            setLoading(false);
          }
        } else {
          setCustomers(result.customers);
          setDocuments(result.documents);
          setOrganizationId(result.organizations[0]?.id ?? "");
          setLoading(false);
        }
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load customers.");
        setLoading(false);
      }
    }
    void loadInitialData();
    return () => { active = false; };
  }, [loadOrganization]);

  const visibleCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesStatus = status === "All customers" || customer.status === status;
      const matchesSearch = !query || [
        customer.name,
        customer.companyName,
        customer.email,
        customer.phone,
        customer.mobile,
      ].some((value) => value?.toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [customers, search, status]);

  function receivableFor(customer: Customer) {
    return customer.openingBalance + documents
      .filter((document) => document.type === "Invoice" && document.customerId === customer.id)
      .reduce((balance, invoice) => balance + invoice.total - invoice.amountPaid - invoice.creditedAmount, 0);
  }

  function toggleCustomer(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <section className="min-h-[calc(100vh-7rem)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="customer-status">Customer status</label>
          <select
            id="customer-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="appearance-none bg-transparent pr-6 text-lg font-semibold text-slate-800 outline-none"
          >
            <option>Active</option>
            <option>Inactive</option>
            <option>Review</option>
            <option>All customers</option>
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none -ml-6 h-4 w-4 text-blue-600" />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <label className="text-sm text-slate-600">
              <span className="sr-only">Organization</span>
              <select
                aria-label="Select organization"
                value={organizationId}
                onChange={(event) => {
                  setOrganizationId(event.target.value);
                  setSelected([]);
                  if (event.target.value) void loadOrganization(event.target.value);
                  else {
                    setCustomers([]);
                    setDocuments([]);
                  }
                }}
                className="max-w-52 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <option value="">Select organization</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>{organization.name}</option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={() => router.push(`/sales/customers/new${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""}`)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> New
          </button>
        </div>
      </div>

      {error && <p className="m-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}
      {isAdmin && organizations.length === 0 && !loading && (
        <p className="m-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">No organizations are available. Create an organization before adding customers.</p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-2.5 sm:px-8">
        <label className="sr-only" htmlFor="customer-search">Search customers</label>
        <div className="relative ml-auto w-full max-w-xs">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="customer-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customers"
            className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full border-collapse text-left">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all customers"
                  checked={visibleCustomers.length > 0 && selected.length === visibleCustomers.length}
                  onChange={(event) => setSelected(event.target.checked ? visibleCustomers.map((customer) => customer.id) : [])}
                  className="accent-blue-600"
                />
              </th>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Company Name</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Work Phone</th>
              <th className="px-5 py-3 text-right">Receivables (INR)</th>
              <th className="px-5 py-3 text-right">Unused Credits (INR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[13px] text-slate-800">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">Loading customers…</td></tr>
            ) : visibleCustomers.map((customer) => (
              <tr key={customer.id} className="h-[52px] hover:bg-slate-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${customer.name}`}
                    checked={selected.includes(customer.id)}
                    onChange={() => toggleCustomer(customer.id)}
                    className="accent-blue-600"
                  />
                </td>
                <td className="px-3 py-3 font-medium text-blue-700">{customer.name}</td>
                <td className="px-3 py-3">{customer.companyName || "—"}</td>
                <td className="px-3 py-3">{customer.email || "—"}</td>
                <td className="px-3 py-3">{customer.phone || "—"}</td>
                <td className="px-5 py-3 text-right tabular-nums">{currency.format(receivableFor(customer))}</td>
                <td className="px-5 py-3 text-right tabular-nums">{currency.format(customer.unusedCredits)}</td>
              </tr>
            ))}
            {!loading && !error && visibleCustomers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-sm text-slate-500">
                  {customers.length === 0 ? "No customers yet. Select New to add your first customer." : "No customers match this search or status."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
