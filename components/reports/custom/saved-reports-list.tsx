"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  Check,
  ChevronDown,
  Copy,
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  getModuleDefinition,
  REPORT_MODULES,
  type ReportModuleId,
} from "@/lib/custom-reports/modules";
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
} from "@/lib/custom-reports/export-utils";
import type { CustomReportRecord } from "@/models/custom-report";

export interface SavedReportItem extends CustomReportRecord {
  id: string;
}

interface SavedReportsListProps {
  onEditReport: (report: SavedReportItem, openStep?: number) => void;
  onCreateNew: () => void;
  refreshTrigger?: number;
}

export function SavedReportsList({
  onEditReport,
  onCreateNew,
  refreshTrigger = 0,
}: SavedReportsListProps) {
  const [reports, setReports] = useState<SavedReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [exportingReportId, setExportingReportId] = useState<string | null>(null);
  const [, setExportFormat] = useState<"excel" | "csv" | "pdf" | null>(null);
  const [deletingReport, setDeletingReport] = useState<SavedReportItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [openExportMenuId, setOpenExportMenuId] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch("/api/reports/custom/configs");
        const data = await res.json();
        if (data.ok && Array.isArray(data.reports) && isMounted) {
          setReports(data.reports);
        }
      } catch (err) {
        console.error("Failed to load saved reports:", err);
        if (isMounted) {
          showToast("Failed to fetch saved reports.", "error");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, [refreshTrigger, refreshIndex]);

  const fetchSavedReports = () => {
    setLoading(true);
    setRefreshIndex((p) => p + 1);
  };

  // Filtered reports based on search & module tab
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.module.toLowerCase().includes(searchQuery.toLowerCase());

      const matchModule =
        selectedModuleFilter === "all" || r.module === selectedModuleFilter;

      return matchSearch && matchModule;
    });
  }, [reports, searchQuery, selectedModuleFilter]);

  // One-Click Export Handler
  const handleOneClickExport = async (
    report: SavedReportItem,
    format: "excel" | "csv" | "pdf"
  ) => {
    setExportingReportId(report.id);
    setExportFormat(format);
    setOpenExportMenuId(null);

    try {
      // 1. Fetch live records for this report's config
      const res = await fetch("/api/reports/custom/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: report.module,
          filters: report.filters || {},
          sort: report.sort || { field: "createdAt", direction: "desc" },
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "Failed to fetch report data");
      }

      const rows = data.rows || [];

      // 2. Format filter summary string
      const f = report.filters || {};
      const filterParts: string[] = [];
      if (f.startDate || f.endDate) {
        filterParts.push(`Date: ${f.startDate || "Start"} to ${f.endDate || "Present"}`);
      }
      if (f.status && f.status !== "all") {
        filterParts.push(`Status: ${f.status}`);
      }
      if (f.paymentStatus && f.paymentStatus !== "all") {
        filterParts.push(`Payment: ${f.paymentStatus}`);
      }
      if (f.minAmount || f.maxAmount) {
        filterParts.push(`Amount: ₹${f.minAmount || 0} - ₹${f.maxAmount || "Max"}`);
      }

      const exportOptions = {
        moduleName: report.module,
        reportTitle: report.name,
        columns: report.columns,
        rows,
        filterSummary: filterParts.join(" · "),
      };

      // 3. Trigger download in requested format
      if (format === "excel") exportToExcel(exportOptions);
      else if (format === "csv") exportToCSV(exportOptions);
      else if (format === "pdf") exportToPDF(exportOptions);

      // 4. Increment run count on server
      fetch(`/api/reports/custom/configs/${report.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incrementRun: true }),
      }).catch((e) => console.warn("Failed to increment run count:", e));

      // 5. Update local state
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? { ...r, runCount: (r.runCount || 0) + 1, lastRunAt: new Date() }
            : r
        )
      );

      showToast(`Exported "${report.name}" (${rows.length} records) as ${format.toUpperCase()}`);
    } catch (err: unknown) {
      console.error("Export error:", err);
      showToast(err instanceof Error ? err.message : "Failed to export report.", "error");
    } finally {
      setExportingReportId(null);
      setExportFormat(null);
    }
  };

  // Duplicate report handler
  const handleDuplicate = async (report: SavedReportItem) => {
    try {
      const res = await fetch(`/api/reports/custom/configs/${report.id}/duplicate`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Report duplicated as "${data.report?.name || "Copy"}"`);
        fetchSavedReports();
      } else {
        showToast(data.error || "Failed to duplicate report", "error");
      }
    } catch {
      showToast("Error duplicating report", "error");
    }
  };

  // Delete report handler
  const confirmDelete = async () => {
    if (!deletingReport) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/reports/custom/configs/${deletingReport.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Report "${deletingReport.name}" deleted.`);
        setReports((prev) => prev.filter((r) => r.id !== deletingReport.id));
        setDeletingReport(null);
      } else {
        showToast(data.error || "Failed to delete report", "error");
      }
    } catch {
      showToast("Error deleting report", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Module Icon & Badge resolver
  const getModuleBadge = (moduleName: string) => {
    const def = getModuleDefinition(moduleName as ReportModuleId);
    const color = def?.accentColor || "slate";

    const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
      blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
      indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
      amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
      rose: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
      orange: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
      emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
      cyan: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
      purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
      teal: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
      violet: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
      slate: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
    };

    const scheme = colorClasses[color] || colorClasses.slate;

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${scheme.bg} ${scheme.text} ${scheme.border}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {def?.label || moduleName}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast feedback */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-xl border animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === "success"
              ? "bg-slate-900 text-white border-slate-800"
              : "bg-rose-600 text-white border-rose-700"
          }`}
        >
          {toast.type === "success" ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-white" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-slate-900">Saved Custom Reports</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              {reports.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Reopen, edit, duplicate, or instantly export previously configured reports with one click.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchSavedReports}
            title="Refresh List"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition"
          >
            <Plus className="h-4 w-4" />
            Build New Report
          </button>
        </div>
      </div>

      {/* Search & Module Filters Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved reports by name or module..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Module Filter Tabs / Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedModuleFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                selectedModuleFilter === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Modules
            </button>
            {REPORT_MODULES.slice(0, 5).map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModuleFilter(m.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                  selectedModuleFilter === m.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {m.shortName}
              </button>
            ))}
            {/* More modules dropdown */}
            <div className="relative group">
              <select
                value={
                  REPORT_MODULES.slice(5).some((m) => m.id === selectedModuleFilter)
                    ? selectedModuleFilter
                    : ""
                }
                onChange={(e) => {
                  if (e.target.value) setSelectedModuleFilter(e.target.value);
                }}
                className="appearance-none rounded-lg bg-slate-100 pl-2.5 pr-7 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="" disabled>
                  More...
                </option>
                {REPORT_MODULES.slice(5).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.shortName}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="ml-auto flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={`rounded-lg p-1.5 text-slate-600 transition ${
                viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="Table View"
              className={`rounded-lg p-1.5 text-slate-600 transition ${
                viewMode === "table" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-3 text-sm font-medium text-slate-600">Loading saved reports...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner">
            <FileSpreadsheet className="h-8 w-8" />
          </div>
          <h4 className="mt-4 text-lg font-semibold text-slate-900">
            {reports.length === 0 ? "No Saved Reports Yet" : "No Matching Reports"}
          </h4>
          <p className="mt-1.5 max-w-md text-sm text-slate-500">
            {reports.length === 0
              ? "Build custom multi-module reports, pick exact columns, apply filters, and save your configurations for quick one-click exports."
              : `No custom reports match "${searchQuery || selectedModuleFilter}". Try clearing your filters.`}
          </p>
          <div className="mt-6 flex items-center gap-3">
            {reports.length > 0 && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedModuleFilter("all");
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear Search & Filters
              </button>
            )}
            <button
              onClick={onCreateNew}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Build New Custom Report
            </button>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredReports.map((report) => {
            const isCurrentlyExporting = exportingReportId === report.id;
            const filtersRecord = (report.filters || {}) as Record<string, unknown>;
            const filterCount = Object.keys(filtersRecord).filter(
              (k) => filtersRecord[k] !== undefined && filtersRecord[k] !== ""
            ).length;

            return (
              <div
                key={report.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200"
              >
                {/* Card Top: Module Badge & Options */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    {getModuleBadge(report.module)}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                      <button
                        onClick={() => handleDuplicate(report)}
                        title="Duplicate Configuration"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onEditReport(report, 1)}
                        title="Edit Report"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingReport(report)}
                        title="Delete Report"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h4 className="mt-3 text-base font-semibold text-slate-900 group-hover:text-blue-600 transition">
                    {report.name}
                  </h4>
                  {report.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {report.description}
                    </p>
                  )}

                  {/* Spec Metadata Chips */}
                  <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium">
                      <Layers className="h-3 w-3 text-slate-500" />
                      {report.columns?.length || 0} Columns
                    </span>
                    {filterCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                        <Filter className="h-3 w-3 text-blue-500" />
                        {filterCount} {filterCount === 1 ? "Filter" : "Filters"}
                      </span>
                    )}
                    {report.sort && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        {report.sort.field} ({report.sort.direction})
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer: Run Stats & One-Click Export Actions */}
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <span>
                      {report.runCount && report.runCount > 0
                        ? `Run ${report.runCount} ${report.runCount === 1 ? "time" : "times"}`
                        : "Never run"}
                    </span>
                    <span>
                      {report.lastRunAt
                        ? `Last: ${new Date(report.lastRunAt).toLocaleDateString()}`
                        : "Ready"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Live Preview / Run in Builder */}
                    <button
                      onClick={() => onEditReport(report, 4)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-white hover:border-slate-300 shadow-sm transition"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                      Live Preview
                    </button>

                    {/* Instant 1-Click Export Dropdown / Buttons */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenExportMenuId(openExportMenuId === report.id ? null : report.id)
                        }
                        disabled={isCurrentlyExporting}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        {isCurrentlyExporting ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Exporting...</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5" />
                            <span>Export</span>
                            <ChevronDown className="h-3 w-3 opacity-70" />
                          </>
                        )}
                      </button>

                      {/* Dropdown Menu */}
                      {openExportMenuId === report.id && (
                        <div
                          className="absolute right-0 bottom-full mb-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-20 animate-in fade-in zoom-in-95"
                          onMouseLeave={() => setOpenExportMenuId(null)}
                        >
                          <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            1-Click Export As:
                          </p>
                          <button
                            onClick={() => handleOneClickExport(report, "excel")}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                            Excel (.xlsx)
                          </button>
                          <button
                            onClick={() => handleOneClickExport(report, "csv")}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"
                          >
                            <FileText className="h-3.5 w-3.5 text-blue-600" />
                            CSV (.csv)
                          </button>
                          <button
                            onClick={() => handleOneClickExport(report, "pdf")}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition"
                          >
                            <Download className="h-3.5 w-3.5 text-rose-600" />
                            PDF Document (.pdf)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Report Name</th>
                  <th className="px-4 py-3.5">Module</th>
                  <th className="px-4 py-3.5">Columns</th>
                  <th className="px-4 py-3.5">Active Filters</th>
                  <th className="px-4 py-3.5">Run Count</th>
                  <th className="px-4 py-3.5">Last Run</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((report) => {
                  const isCurrentlyExporting = exportingReportId === report.id;
                  const filtersRecord = (report.filters || {}) as Record<string, unknown>;
                  const filterCount = Object.keys(filtersRecord).filter(
                    (k) => filtersRecord[k] !== undefined && filtersRecord[k] !== ""
                  ).length;

                  return (
                    <tr key={report.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{report.name}</div>
                        {report.description && (
                          <div className="text-xs text-slate-400 line-clamp-1">
                            {report.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">{getModuleBadge(report.module)}</td>
                      <td className="px-4 py-4">
                        <span className="font-medium text-slate-700">
                          {report.columns?.length || 0}
                        </span>{" "}
                        <span className="text-xs text-slate-400">fields</span>
                      </td>
                      <td className="px-4 py-4">
                        {filterCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {filterCount} active
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">None</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-600">
                        {report.runCount || 0}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {report.lastRunAt
                          ? new Date(report.lastRunAt).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Live Preview */}
                          <button
                            onClick={() => onEditReport(report, 4)}
                            title="Preview Data"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Quick 1-Click Exports */}
                          <button
                            onClick={() => handleOneClickExport(report, "excel")}
                            disabled={isCurrentlyExporting}
                            title="1-Click Export Excel (.xlsx)"
                            className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 transition disabled:opacity-40"
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOneClickExport(report, "csv")}
                            disabled={isCurrentlyExporting}
                            title="1-Click Export CSV"
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 transition disabled:opacity-40"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOneClickExport(report, "pdf")}
                            disabled={isCurrentlyExporting}
                            title="1-Click Export PDF"
                            className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                          >
                            <Download className="h-4 w-4" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => onEditReport(report, 1)}
                            title="Edit Configuration"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          {/* Duplicate */}
                          <button
                            onClick={() => handleDuplicate(report)}
                            title="Duplicate"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                          >
                            <Copy className="h-4 w-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeletingReport(report)}
                            title="Delete"
                            className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <h4 className="mt-4 text-lg font-bold text-slate-900">
              Delete Report Configuration?
            </h4>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-800">
                &ldquo;{deletingReport.name}&rdquo;
              </span>
              ? This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingReport(null)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition"
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
