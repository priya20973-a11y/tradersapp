"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Filter,
  Grid,
  List,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { NewQuoteForm } from "@/components/sales/new-quote-form";
import {
  type CustomerRecord,
  type QuoteDocument,
  type SalesApiResponse,
} from "./quote/quote-types";
import { QuoteKpiCards } from "./quote/quote-kpi-cards";
import { QuoteTableView } from "./quote/quote-table-view";
import { QuoteGridView } from "./quote/quote-grid-view";
import { QuoteDetailModal } from "./quote/quote-detail-modal";
import { generateQuotePdf } from "./quote/quote-pdf-generator";
import { fetchCachedSales, invalidateSalesCache } from "@/lib/sales-cache";

export function QuotesDirectory() {
  const [data, setData] = useState<{
    customers: CustomerRecord[];
    quotes: QuoteDocument[];
    isAdmin: boolean;
  }>({
    customers: [],
    quotes: [],
    isAdmin: false,
  });

  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [organizationId, setOrganizationId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuoteDocument | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);
  const [quickViewQuote, setQuickViewQuote] = useState<QuoteDocument | null>(null);

  const loadQuotes = useCallback(async (force = false, orgOverride?: string) => {
    setLoading(true);
    setError(null);
    try {
      const activeOrg =
        orgOverride !== undefined
          ? orgOverride
          : organizationId ||
            (typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("organizationId") || ""
              : "");

      const query = activeOrg ? `?section=quotes&organizationId=${encodeURIComponent(activeOrg)}` : "?section=quotes";
      const json = await fetchCachedSales<SalesApiResponse>(query, { force });

      if (json.organizations) {
        setOrganizations(json.organizations);
      }

      let quoteDocs = (json.documents || []).filter((d) => d.type === "Quote");
      let customerList = json.customers || [];

      // If admin with organizations but no quotes returned yet (because no org was in query), load first org
      if (json.isAdmin && !activeOrg && json.organizations?.length > 0) {
        const defaultOrg = json.organizations[0].id;
        setOrganizationId(defaultOrg);
        const subJson = await fetchCachedSales<SalesApiResponse>(
          `?section=quotes&organizationId=${encodeURIComponent(defaultOrg)}`,
          { force: true }
        );
        quoteDocs = (subJson.documents || []).filter((d) => d.type === "Quote");
        customerList = subJson.customers || [];
      } else if (activeOrg) {
        setOrganizationId(activeOrg);
      }

      setData({
        customers: customerList,
        quotes: quoteDocs,
        isAdmin: json.isAdmin || false,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading quotes");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (active) {
        await loadQuotes();
      }
    })();
    return () => {
      active = false;
    };
  }, [loadQuotes]);

  const handleOrgChange = (newOrgId: string) => {
    setOrganizationId(newOrgId);
    loadQuotes(true, newOrgId);
  };

  const customerMap = new Map(data.customers.map((c) => [c.id, c]));

  const convertQuoteToOrder = async (quoteId: string) => {
    try {
      setActionNotice(null);
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert-quote",
          documentId: quoteId,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to convert quote");
      invalidateSalesCache();
      setActionNotice(`Successfully converted to Sales Order ${result.number || ""}`);
      await loadQuotes(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to convert quote");
    }
  };

  const updateQuoteStatus = async (documentId: string, status: string) => {
    try {
      setActionNotice(null);
      const res = await fetch("/api/sales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, status }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.error || "Failed to update status");
      }
      invalidateSalesCache();
      setActionNotice(`Quote status updated to ${status}`);
      await loadQuotes(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedQuotes.length === filteredQuotes.length) {
      setSelectedQuotes([]);
    } else {
      setSelectedQuotes(filteredQuotes.map((q) => q.id));
    }
  };

  const handleToggleSelectQuote = (id: string) => {
    setSelectedQuotes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDownloadPdf = async (quote: QuoteDocument) => {
    const doc = await generateQuotePdf(quote, customerMap.get(quote.customerId));
    doc.save(`${quote.number}.pdf`);
  };

  const handleEditQuote = (quote: QuoteDocument) => {
    setEditingQuote(quote);
    setShowForm(true);
  };

  if (showForm) {
    return (
      <div className="max-w-5xl mx-auto py-2">
        <NewQuoteForm
          initialData={editingQuote || undefined}
          onSuccess={() => {
            setShowForm(false);
            setEditingQuote(null);
            loadQuotes(true);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingQuote(null);
          }}
        />
      </div>
    );
  }

  const filteredQuotes = data.quotes.filter((q) => {
    const cust = customerMap.get(q.customerId);
    const custName = cust?.name.toLowerCase() || "";
    const matchesSearch =
      q.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      custName.includes(searchTerm.toLowerCase()) ||
      (q.referenceNumber && q.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus =
      statusFilter === "all" || q.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const draftCount = data.quotes.filter((q) => q.status === "Draft").length;
  const sentCount = data.quotes.filter((q) => q.status === "Sent").length;
  const acceptedCount = data.quotes.filter((q) => q.status === "Accepted").length;
  const convertedCount = data.quotes.filter((q) => q.status === "Converted").length;
  const rejectedCount = data.quotes.filter((q) => q.status === "Rejected").length;

  return (
    <div className="space-y-6 text-slate-800">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            <span>Sales & Pipeline</span>
            <span className="text-slate-300">/</span>
            <span className="text-blue-600">Quotations & Proposals</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Quotes
            </h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
              {data.quotes.length} total
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Create, track, and convert client price estimates and commercial proposals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {data.isAdmin && organizations.length > 0 && (
            <select
              value={organizationId}
              onChange={(e) => handleOrgChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs outline-none focus:border-blue-500 cursor-pointer"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => loadQuotes(true)}
            title="Refresh quotations"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            href={organizationId ? `/sales/quotes/new?organizationId=${encodeURIComponent(organizationId)}` : "/sales/quotes/new"}
            className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer active:scale-98"
          >
            <Plus className="h-4 w-4" />
            New Quote
          </Link>

          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex sm:hidden items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Quote
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-800 font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-1 text-emerald-600 hover:text-emerald-800 rounded-lg hover:bg-emerald-100/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 font-medium flex items-center justify-between shadow-xs">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-100/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Overview Metrics */}
      <QuoteKpiCards quotes={data.quotes} />

      {/* Controls & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {[
            { id: "all", label: "All", count: data.quotes.length },
            { id: "draft", label: "Draft", count: draftCount },
            { id: "sent", label: "Sent", count: sentCount },
            { id: "accepted", label: "Accepted", count: acceptedCount },
            { id: "converted", label: "Converted", count: convertedCount },
            { id: "rejected", label: "Rejected", count: rejectedCount },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isActive
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Search & View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 sm:flex-initial items-center gap-2 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50/70 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by quote#, customer, ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-60 text-xs sm:text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Table vs Grid View Switcher */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/70 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Card Grid View"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Active Filter Pill indicator */}
      {(searchTerm || statusFilter !== "all") && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span>Showing results for:</span>
          {statusFilter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              Status: {statusFilter}
              <button type="button" onClick={() => setStatusFilter("all")}>
                <X className="h-3 w-3 hover:text-red-500" />
              </button>
            </span>
          )}
          {searchTerm && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              Search: &ldquo;{searchTerm}&rdquo;
              <button type="button" onClick={() => setSearchTerm("")}>
                <X className="h-3 w-3 hover:text-red-500" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
            }}
            className="text-xs text-blue-600 hover:underline ml-1"
          >
            Reset all filters
          </button>
        </div>
      )}

      {/* Main Content: Table or Grid */}
      {viewMode === "table" ? (
        <QuoteTableView
          quotes={filteredQuotes}
          customerMap={customerMap}
          loading={loading}
          searchTerm={searchTerm}
          selectedQuotes={selectedQuotes}
          onToggleSelectAll={handleToggleSelectAll}
          onToggleSelectQuote={handleToggleSelectQuote}
          onQuickView={(quote) => setQuickViewQuote(quote)}
          onConvert={convertQuoteToOrder}
          onStatusChange={updateQuoteStatus}
          onOpenCreate={() => {
            setEditingQuote(null);
            setShowForm(true);
          }}
          onEdit={handleEditQuote}
          onDownloadPdf={handleDownloadPdf}
        />
      ) : (
        <QuoteGridView
          quotes={filteredQuotes}
          customerMap={customerMap}
          onQuickView={(quote) => setQuickViewQuote(quote)}
          onConvert={convertQuoteToOrder}
          onStatusChange={updateQuoteStatus}
          onEdit={handleEditQuote}
          onDownloadPdf={handleDownloadPdf}
        />
      )}

      {/* Quick View Modal */}
      {quickViewQuote && (
        <QuoteDetailModal
          quote={quickViewQuote}
          customer={customerMap.get(quickViewQuote.customerId)}
          onClose={() => setQuickViewQuote(null)}
          onConvert={convertQuoteToOrder}
          onStatusChange={updateQuoteStatus}
          onEdit={handleEditQuote}
        />
      )}
    </div>
  );
}
