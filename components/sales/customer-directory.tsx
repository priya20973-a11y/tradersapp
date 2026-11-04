"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Building2,
  Grid3X3,
  List,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  calculateCustomerReceivable,
  type Customer,
  type Organization,
  type SalesDocument,
  type SalesResponse,
  type SortOption,
  type ViewMode,
} from "./customer/customer-types";
import { CustomerKpiCards } from "./customer/customer-kpi-cards";
import { CustomerTableView } from "./customer/customer-table-view";
import { CustomerGridView } from "./customer/customer-grid-view";
import { CustomerQuickViewModal } from "./customer/customer-quick-view-modal";
import { CustomerDetailView } from "./customer/customer-detail-view";
import { fetchCachedSales, invalidateSalesCache } from "@/lib/sales-cache";

const statusOptions = ["All customers", "Active", "Inactive", "Review"];

export function CustomerDirectory({ initialCustomerId }: { initialCustomerId?: string } = {}) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Active");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [quickViewCustomer, setQuickViewCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const loadOrganization = useCallback(async (orgId?: string, force = false) => {
    setLoading(true);
    setError("");
    try {
      const query = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : "";
      const result = await fetchCachedSales<SalesResponse>(query, { force });
      setOrganizations(result.organizations);
      setIsAdmin(result.isAdmin);
      setCustomers(result.customers);
      setDocuments(result.documents);
      const targetId =
        initialCustomerId ||
        (typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("id") ||
            new URLSearchParams(window.location.search).get("customerId")
          : null);
      if (targetId) {
        const found = result.customers.find((c) => c.id === targetId);
        if (found) setSelectedCustomer(found);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load customers.");
      setCustomers([]);
      setDocuments([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [initialCustomerId]);

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
          const selectedOrganization =
            result.organizations.find((item) => item.id === requestedId) ?? result.organizations[0];
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
          const targetId =
            initialCustomerId ||
            (typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("id") ||
                new URLSearchParams(window.location.search).get("customerId")
              : null);
          if (targetId) {
            const found = result.customers.find((c) => c.id === targetId);
            if (found) setSelectedCustomer(found);
          }
        }
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load customers.");
        setLoading(false);
      }
    }
    void loadInitialData();
    return () => {
      active = false;
    };
  }, [loadOrganization, initialCustomerId]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("id", customer.id);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const handleCloseDetail = () => {
    setSelectedCustomer(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      url.searchParams.delete("customerId");
      window.history.replaceState(null, "", url.toString());
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    invalidateSalesCache();
    void loadOrganization(organizationId, true).finally(() => setIsRefreshing(false));
  };

  const visibleCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = customers.filter((customer) => {
      const matchesStatus = status === "All customers" || customer.status === status;
      const matchesSearch =
        !query ||
        [customer.name, customer.companyName, customer.email, customer.phone, customer.mobile].some((value) =>
          value?.toLowerCase().includes(query)
        );
      return matchesStatus && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "name-desc") return b.name.localeCompare(a.name);
      if (sortBy === "receivable-desc") {
        return (
          calculateCustomerReceivable(b, documents) - calculateCustomerReceivable(a, documents)
        );
      }
      if (sortBy === "credit-desc") return (b.unusedCredits || 0) - (a.unusedCredits || 0);
      if (sortBy === "company-asc") return (a.companyName || "").localeCompare(b.companyName || "");
      return 0;
    });
  }, [customers, search, status, sortBy, documents]);

  const metrics = useMemo(() => {
    const totalCustomers = customers.length;
    const activeCount = customers.filter((c) => c.status === "Active").length;
    const businessCount = customers.filter((c) => c.customerType === "Business").length;
    const individualCount = customers.filter((c) => c.customerType === "Individual").length;

    let totalReceivables = 0;
    let totalUnusedCredits = 0;

    customers.forEach((c) => {
      totalReceivables += calculateCustomerReceivable(c, documents);
      totalUnusedCredits += c.unusedCredits || 0;
    });

    return {
      totalCustomers,
      activeCount,
      businessCount,
      individualCount,
      totalReceivables,
      totalUnusedCredits,
    };
  }, [customers, documents]);

    function toggleCustomer(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  if (selectedCustomer) {
    return (
      <CustomerDetailView
        customers={visibleCustomers.length > 0 ? visibleCustomers : customers}
        selectedCustomer={selectedCustomer}
        documents={documents}
        organizationId={organizationId}
        onSelectCustomer={handleSelectCustomer}
        onClose={handleCloseDetail}
        onCustomerUpdated={(updated) => {
          setSelectedCustomer(updated);
          setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        }}
        onNewCustomer={() =>
          router.push(
            `/sales/customers/new${
              organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""
            }`
          )
        }
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-7rem)] bg-slate-50/50 pb-16">
      {/* Top Banner Header */}
      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                  Sales & CRM
                </span>
                <span className="text-xs text-slate-400">/</span>
                <span className="text-xs font-medium text-slate-500">Customer Directory</span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Customers</h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage accounts, track outstanding receivables, monitor credit terms, and view client histories.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {isAdmin && (
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Building2 className="h-4 w-4 text-slate-400" />
                  </div>
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
                    className="h-10 rounded-xl border border-slate-300 bg-white pl-9 pr-8 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || isRefreshing}
                title="Refresh customer data"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/sales/customers/new${
                      organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""
                    }`
                  )
                }
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>New Customer</span>
              </button>
            </div>
          </div>

          <CustomerKpiCards
            totalCustomers={metrics.totalCustomers}
            activeCount={metrics.activeCount}
            businessCount={metrics.businessCount}
            individualCount={metrics.individualCount}
            totalReceivables={metrics.totalReceivables}
            totalUnusedCredits={metrics.totalUnusedCredits}
          />
        </div>
      </div>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm" role="alert">
            <div className="flex items-center gap-3 text-rose-800">
              <span className="h-2 w-2 rounded-full bg-rose-600" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {isAdmin && organizations.length === 0 && !loading && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
            <p className="text-sm text-amber-800 font-medium">
              No organizations are available. Create an organization before adding customers.
            </p>
          </div>
        )}

        {/* Filter Toolbar Card */}
        <div className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm sm:p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Customer status filters">
              {statusOptions.map((opt) => {
                const count =
                  opt === "All customers"
                    ? customers.length
                    : customers.filter((c) => c.status === opt).length;
                const isSelected = status === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setStatus(opt)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                    }`}
                  >
                    <span>{opt}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        isSelected ? "bg-slate-800 text-slate-200" : "bg-white text-slate-500 border border-slate-200"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Controls: Search, Sort & View Mode */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[240px] flex-1 sm:w-64 sm:flex-initial">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="customer-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, company, email, phone..."
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50/50 pl-3 pr-8 text-xs font-medium text-slate-700 outline-none transition hover:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="name-asc">Sort: Name (A-Z)</option>
                  <option value="name-desc">Sort: Name (Z-A)</option>
                  <option value="company-asc">Sort: Company Name</option>
                  <option value="receivable-desc">Sort: Receivables (High to Low)</option>
                  <option value="credit-desc">Sort: Credits (High to Low)</option>
                </select>
                <ArrowUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>

              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/70 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  title="Table view"
                  className={`rounded-lg p-1.5 transition ${
                    viewMode === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  title="Grid view"
                  className={`rounded-lg p-1.5 transition ${
                    viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50/80 px-3 py-2 text-xs text-blue-900">
              <span className="font-medium">
                {selected.length} customer{selected.length > 1 ? "s" : ""} selected
              </span>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="font-semibold text-blue-700 hover:underline"
              >
                Deselect all
              </button>
            </div>
          )}
        </div>

        {/* Content Section: Table or Grid */}
        {loading ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-16 text-center shadow-sm">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-3 text-sm font-medium text-slate-600">Loading customer directory…</p>
          </div>
        ) : visibleCustomers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">No customers found</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
              {customers.length === 0
                ? "Get started by adding your first customer to manage invoices, quotes, and accounts."
                : "No customer records matched your search query or status filter. Try clearing filters."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              {search || status !== "All customers" ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatus("All customers");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Reset Filters
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/sales/customers/new${
                      organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""
                    }`
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Customer</span>
              </button>
            </div>
          </div>
        ) : viewMode === "table" ? (
          <CustomerTableView
            customers={visibleCustomers}
            allCustomersCount={customers.length}
            documents={documents}
            selected={selected}
            onToggleCustomer={toggleCustomer}
            onSelectAll={(checked) =>
              setSelected(checked ? visibleCustomers.map((c) => c.id) : [])
            }
            onQuickView={(customer) => handleSelectCustomer(customer)}
          />
        ) : (
          <CustomerGridView
            customers={visibleCustomers}
            documents={documents}
            selected={selected}
            onToggleCustomer={toggleCustomer}
            onQuickView={(customer) => handleSelectCustomer(customer)}
          />
        )}
      </div>

      {/* Quick View Modal */}
      {quickViewCustomer && (
        <CustomerQuickViewModal
          customer={quickViewCustomer}
          documents={documents}
          onClose={() => setQuickViewCustomer(null)}
        />
      )}
    </div>
  );
}
