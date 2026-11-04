"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CreditCard,
  Download,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { type LedgerLine, type LedgerSummary, generateLedgerCsv } from "@/lib/ledger-utils";

interface VendorMeta {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  state?: string;
  openingBalance: number;
  status: string;
}

export function VendorLedgerView() {
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [vendor, setVendor] = useState<VendorMeta | null>(null);
  const [summary, setSummary] = useState<LedgerSummary>({
    openingBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
    closingBalance: 0,
    netOutstanding: 0,
    transactionCount: 0,
  });
  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRangePreset, setDateRangePreset] = useState<"all" | "month" | "quarter" | "custom">("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "Purchase Bill" | "Payment Made" | "Vendor Credit">("all");

  // Transaction view modal
  const [selectedLine, setSelectedLine] = useState<LedgerLine | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchLedgerData = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (selectedVendorId) queryParams.set("vendorId", selectedVendorId);
        if (searchTerm) queryParams.set("search", searchTerm);

        const now = new Date();
        if (dateRangePreset === "month") {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          queryParams.set("startDate", firstDay.toISOString().split("T")[0]);
        } else if (dateRangePreset === "quarter") {
          const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
          const firstDay = new Date(now.getFullYear(), quarterMonth, 1);
          queryParams.set("startDate", firstDay.toISOString().split("T")[0]);
        } else if (dateRangePreset === "custom") {
          if (customStart) queryParams.set("startDate", customStart);
          if (customEnd) queryParams.set("endDate", customEnd);
        }

        const res = await fetch(`/api/purchases/vendor-ledger?${queryParams.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to load vendor ledger.");
        }

        const data = await res.json();
        if (!active) return;
        setVendor(data.vendor);
        setVendors(data.vendors || []);
        setSummary(data.summary);
        setLines(data.lines || []);
        if (!selectedVendorId && data.vendor?.id) {
          setSelectedVendorId(data.vendor.id);
        }
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to fetch vendor ledger.");
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void fetchLedgerData();
    return () => {
      active = false;
    };
  }, [selectedVendorId, searchTerm, dateRangePreset, customStart, customEnd, refreshIndex]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshIndex((prev) => prev + 1);
  }, []);

  const filteredLines = useMemo(() => {
    return lines.filter((l) => {
      if (typeFilter !== "all" && l.type !== "Opening Balance" && l.type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [lines, typeFilter]);

  const handleExportCsv = () => {
    if (!vendor) return;
    const csvData = generateLedgerCsv("Vendor", vendor.name, filteredLines, summary);
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `vendor-ledger-${vendor.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatINR = (val: number) => {
    return `₹${Math.abs(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Purchases</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Payable Account Summary</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">Vendor Account History</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Vendor purchase bills, disbursements, running balance, debit/credit audit, and accounts payable
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || filteredLines.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <Link
            href="/purchases/payments"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </Link>
        </div>
      </div>

      {/* Vendor Selector & Profile Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold text-lg">
              {vendor?.name?.charAt(0) || "V"}
            </div>
            <div>
              <label htmlFor="vendor-select" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Select Vendor / Supplier Account
              </label>
              <div className="mt-0.5">
                <select
                  id="vendor-select"
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {vendor && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              {vendor.gstin && (
                <div className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-slate-700">
                  GSTIN: {vendor.gstin}
                </div>
              )}
              {vendor.state && <div>📍 {vendor.state}</div>}
              {vendor.phone && <div>📞 {vendor.phone}</div>}
              {vendor.email && <div>✉️ {vendor.email}</div>}
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-medium text-emerald-700">{vendor.status}</span>
              </div>
            </div>
          )}
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Opening Balance</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{formatINR(summary.openingBalance)}</p>
            <p className="text-xs text-slate-400 mt-0.5">As of start period</p>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Total Billed (Credit)</p>
              <ArrowUpRight className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xl font-bold text-blue-900 mt-1">{formatINR(summary.totalCredit)}</p>
            <p className="text-xs text-blue-600/70 mt-0.5">Increases payable to vendor</p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Payments Made (Debit)</p>
              <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-xl font-bold text-emerald-900 mt-1">{formatINR(summary.totalDebit)}</p>
            <p className="text-xs text-emerald-600/70 mt-0.5">Disbursements made</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Closing Balance</p>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  summary.closingBalance > 0
                    ? "bg-rose-100 text-rose-800"
                    : summary.closingBalance < 0
                    ? "bg-blue-100 text-blue-800"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {summary.closingBalance > 0 ? "Payable" : summary.closingBalance < 0 ? "Debit Advance" : "Settled"}
              </span>
            </div>
            <p
              className={`text-2xl font-bold mt-1 ${
                summary.closingBalance > 0 ? "text-rose-600" : summary.closingBalance < 0 ? "text-blue-600" : "text-slate-900"
              }`}
            >
              {formatINR(summary.closingBalance)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Net liability outstanding</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search bill#, payment#, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
            {(["all", "Purchase Bill", "Payment Made", "Vendor Credit"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  typeFilter === t
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {t === "all" ? "All Types" : t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <select
            value={dateRangePreset}
            onChange={(e) => setDateRangePreset(e.target.value as "all" | "month" | "quarter" | "custom")}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Dates</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="custom">Custom Range</option>
          </select>

          {dateRangePreset === "custom" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-medium">Calculating vendor ledger running balance…</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">{error}</div>
        ) : filteredLines.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-base font-semibold text-slate-700">No vendor ledger transactions found</p>
            <p className="text-xs text-slate-400 mt-1">There are no records matching your selected vendor and date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">Reference#</th>
                  <th className="px-4 py-3.5">Description</th>
                  <th className="px-4 py-3.5 text-right text-emerald-700">Debit (₹)</th>
                  <th className="px-4 py-3.5 text-right text-blue-700">Credit (₹)</th>
                  <th className="px-5 py-3.5 text-right">Balance (₹)</th>
                  <th className="px-4 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLines.map((line, idx) => {
                  const isOpening = line.type === "Opening Balance";
                  const isBill = line.type === "Purchase Bill";
                  const isPayment = line.type === "Payment Made";

                  return (
                    <tr
                      key={`${line.id}-${idx}`}
                      className={`hover:bg-slate-50/80 transition ${isOpening ? "bg-slate-50/40 font-medium" : ""}`}
                    >
                      <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {new Date(line.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            isOpening
                              ? "bg-slate-100 text-slate-700 border border-slate-200"
                              : isBill
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : isPayment
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-purple-50 text-purple-700 border border-purple-200"
                          }`}
                        >
                          {isBill && <FileText className="h-3 w-3" />}
                          {isPayment && <CreditCard className="h-3 w-3" />}
                          {line.type}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {line.referenceNumber}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title={line.description}>
                        {line.description}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-xs text-emerald-800 whitespace-nowrap">
                        {line.debit > 0 ? formatINR(line.debit) : "—"}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-xs text-blue-800 whitespace-nowrap">
                        {line.credit > 0 ? formatINR(line.credit) : "—"}
                      </td>

                      <td className="px-5 py-3 text-right font-mono text-xs font-bold whitespace-nowrap">
                        <span className={line.balance > 0 ? "text-rose-700" : line.balance < 0 ? "text-blue-700" : "text-slate-600"}>
                          {formatINR(line.balance)} {line.balance > 0 ? "Cr" : line.balance < 0 ? "Dr" : ""}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {!isOpening && (
                          <button
                            type="button"
                            onClick={() => setSelectedLine(line)}
                            className="inline-flex items-center gap-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                            title="View Transaction Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <tr>
                  <td colSpan={4} className="px-5 py-3.5 text-xs uppercase tracking-wider text-slate-600">
                    Period Totals & Closing Balance
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-emerald-800 whitespace-nowrap">
                    {formatINR(summary.totalDebit)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-blue-800 whitespace-nowrap">
                    {formatINR(summary.totalCredit)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                    {formatINR(summary.closingBalance)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {selectedLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  {selectedLine.type}
                </span>
                <h3 className="text-lg font-bold text-slate-900">{selectedLine.referenceNumber}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLine(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Date</span>
                <span className="font-semibold text-slate-800">
                  {new Date(selectedLine.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Vendor</span>
                <span className="font-semibold text-slate-800">{vendor?.name}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Description / Memo</span>
                <span className="font-medium text-slate-700 max-w-[240px] text-right">{selectedLine.description}</span>
              </div>

              {selectedLine.debit > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-emerald-700 font-semibold">Debit Amount (Payment)</span>
                  <span className="font-mono font-bold text-emerald-700">{formatINR(selectedLine.debit)}</span>
                </div>
              )}

              {selectedLine.credit > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-blue-700 font-semibold">Credit Amount (Bill)</span>
                  <span className="font-mono font-bold text-blue-700">{formatINR(selectedLine.credit)}</span>
                </div>
              )}

              <div className="flex justify-between py-1.5 bg-slate-50 rounded-lg px-2 mt-2">
                <span className="font-semibold text-slate-700">Account Balance After Transaction</span>
                <span className="font-mono font-bold text-slate-900">{formatINR(selectedLine.balance)}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLine(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
