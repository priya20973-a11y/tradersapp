"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BadgeDollarSign,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Download,
  Edit2,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Loader2,
  Package,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Users,
  WalletCards,
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
  formatCellValue,
} from "@/lib/custom-reports/export-utils";
import type { CustomReportColumn, CustomReportFilters, CustomReportRecord, CustomReportSort } from "@/models/custom-report";

interface ReportBuilderProps {
  initialConfig?: CustomReportRecord | null;
  onSavedSuccess?: () => void;
  onCancel?: () => void;
}

export function ReportBuilder({ initialConfig, onSavedSuccess, onCancel }: ReportBuilderProps) {
  // Current active workflow step (1: Module, 2: Columns, 3: Filters, 4: Preview & Export)
  const [currentStep, setCurrentStep] = useState<number>(initialConfig ? 4 : 1);

  // Selected module
  const [selectedModuleId, setSelectedModuleId] = useState<ReportModuleId>(
    initialConfig?.module || "Sales"
  );
  const activeModuleDef = useMemo(() => {
    return getModuleDefinition(selectedModuleId) || REPORT_MODULES[0];
  }, [selectedModuleId]);

  // Selected Columns with custom labels and order
  const [columns, setColumns] = useState<CustomReportColumn[]>(() => {
    if (initialConfig?.columns && initialConfig.columns.length > 0) {
      return initialConfig.columns;
    }
    const def = getModuleDefinition(initialConfig?.module || "Sales") || REPORT_MODULES[0];
    return def.fields
      .filter((f) => f.defaultSelected !== false)
      .map((f) => ({
        key: f.key,
        label: f.label,
        visible: true,
        format: f.format,
      }));
  });

  // When module changes, reset columns to that module's default if not editing existing config
  const handleModuleSelect = (moduleId: ReportModuleId) => {
    setSelectedModuleId(moduleId);
    const def = getModuleDefinition(moduleId);
    if (def) {
      setColumns(
        def.fields
          .filter((f) => f.defaultSelected !== false)
          .map((f) => ({
            key: f.key,
            label: f.label,
            visible: true,
            format: f.format,
          }))
      );
      setSort({ field: def.defaultSort.field, direction: def.defaultSort.direction });
      setFilters({});
    }
    setCurrentStep(2);
  };

  // Column search inside Step 2
  const [columnSearch, setColumnSearch] = useState("");
  const [editingColumnKey, setEditingColumnKey] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState("");

  // Filters State (Step 3)
  const [filters, setFilters] = useState<CustomReportFilters>(
    initialConfig?.filters || {}
  );
  const [dateRangePreset, setDateRangePreset] = useState<string>("all");

  // Sorting & Grouping
  const [sort, setSort] = useState<CustomReportSort>(
    initialConfig?.sort || { field: activeModuleDef.defaultSort.field, direction: activeModuleDef.defaultSort.direction }
  );
  const [groupBy, setGroupBy] = useState<string>(initialConfig?.groupBy || "");

  // Report Data Fetching (Step 4 Preview)
  const [loadingData, setLoadingData] = useState(false);
  const [dataRows, setDataRows] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [summaryData, setSummaryData] = useState<{ totalRecords: number; totalAmount: number }>({
    totalRecords: 0,
    totalAmount: 0,
  });
  const [dataRefreshIndex, setDataRefreshIndex] = useState(0);

  // Preview Pagination
  const [previewPage, setPreviewPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Save Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [reportName, setReportName] = useState(initialConfig?.name || "");
  const [reportDescription, setReportDescription] = useState(initialConfig?.description || "");
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const handleRefreshData = () => {
    setDataRefreshIndex((prev) => prev + 1);
  };

  useEffect(() => {
    if (currentStep !== 4) return;
    let isCancelled = false;
    void Promise.resolve().then(() => {
      if (!isCancelled) setLoadingData(true);
    });
    async function load() {
      try {
        const res = await fetch("/api/reports/custom/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            module: selectedModuleId,
            filters,
            sort,
          }),
        });
        const data = await res.json();
        if (data.ok && !isCancelled) {
          setDataRows(data.rows || []);
          setTotalCount(data.totalCount || 0);
          setSummaryData(data.summary || { totalRecords: 0, totalAmount: 0 });
        }
      } catch (err) {
        console.error("Failed to fetch report preview data:", err);
      } finally {
        if (!isCancelled) {
          setLoadingData(false);
        }
      }
    }
    void load();
    return () => {
      isCancelled = true;
    };
  }, [currentStep, selectedModuleId, filters, sort, dataRefreshIndex]);

  // Date Preset handler
  const handleDatePresetChange = (preset: string) => {
    setDateRangePreset(preset);
    const today = new Date();
    const toDateStr = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "all") {
      setFilters((prev) => ({ ...prev, startDate: undefined, endDate: undefined }));
    } else if (preset === "today") {
      const str = toDateStr(today);
      setFilters((prev) => ({ ...prev, startDate: str, endDate: str }));
    } else if (preset === "this_week") {
      const first = new Date(today.setDate(today.getDate() - today.getDay()));
      const last = new Date(today.setDate(today.getDate() - today.getDay() + 6));
      setFilters((prev) => ({ ...prev, startDate: toDateStr(first), endDate: toDateStr(last) }));
    } else if (preset === "this_month") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFilters((prev) => ({ ...prev, startDate: toDateStr(first), endDate: toDateStr(last) }));
    } else if (preset === "this_quarter") {
      const quarter = Math.floor(today.getMonth() / 3);
      const first = new Date(today.getFullYear(), quarter * 3, 1);
      const last = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
      setFilters((prev) => ({ ...prev, startDate: toDateStr(first), endDate: toDateStr(last) }));
    } else if (preset === "this_year") {
      const first = new Date(today.getFullYear(), 0, 1);
      const last = new Date(today.getFullYear(), 11, 31);
      setFilters((prev) => ({ ...prev, startDate: toDateStr(first), endDate: toDateStr(last) }));
    }
  };

  // Column management actions
  const toggleColumn = (key: string) => {
    const exists = columns.find((c) => c.key === key);
    if (exists) {
      if (columns.length === 1) return; // Keep at least one column
      setColumns((prev) => prev.filter((c) => c.key !== key));
    } else {
      const fieldDef = activeModuleDef.fields.find((f) => f.key === key);
      if (fieldDef) {
        setColumns((prev) => [
          ...prev,
          {
            key: fieldDef.key,
            label: fieldDef.label,
            visible: true,
            format: fieldDef.format,
          },
        ]);
      }
    }
  };

  const moveColumn = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === columns.length - 1)
    ) {
      return;
    }
    const newCols = [...columns];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const temp = newCols[index];
    newCols[index] = newCols[targetIdx];
    newCols[targetIdx] = temp;
    setColumns(newCols);
  };

  const startRenameColumn = (key: string, currentLabel: string) => {
    setEditingColumnKey(key);
    setEditLabelValue(currentLabel);
  };

  const saveRenameColumn = (key: string) => {
    if (editLabelValue.trim()) {
      setColumns((prev) =>
        prev.map((c) => (c.key === key ? { ...c, label: editLabelValue.trim() } : c))
      );
    }
    setEditingColumnKey(null);
  };

  const selectAllColumns = () => {
    setColumns(
      activeModuleDef.fields.map((f) => ({
        key: f.key,
        label: f.label,
        visible: true,
        format: f.format,
      }))
    );
  };

  const clearAllColumns = () => {
    // Keep first column as minimal fallback
    const first = activeModuleDef.fields[0];
    setColumns([{ key: first.key, label: first.label, visible: true, format: first.format }]);
  };

  const resetToDefaultColumns = () => {
    setColumns(
      activeModuleDef.fields
        .filter((f) => f.defaultSelected !== false)
        .map((f) => ({
          key: f.key,
          label: f.label,
          visible: true,
          format: f.format,
        }))
    );
  };

  // Export handlers
  const handleExport = (format: "excel" | "csv" | "pdf") => {
    const filterSummaryParts = [];
    if (filters.startDate || filters.endDate) {
      filterSummaryParts.push(`Date: ${filters.startDate || "—"} to ${filters.endDate || "—"}`);
    }
    if (filters.status && filters.status !== "all") {
      filterSummaryParts.push(`Status: ${filters.status}`);
    }
    if (filters.minAmount || filters.maxAmount) {
      filterSummaryParts.push(`Amount: ₹${filters.minAmount || 0} - ₹${filters.maxAmount || "Max"}`);
    }

    const exportOptions = {
      moduleName: activeModuleDef.shortName,
      reportTitle: reportName || `${activeModuleDef.label} Report`,
      columns,
      rows: dataRows,
      filterSummary: filterSummaryParts.join(" · "),
    };

    if (format === "excel") exportToExcel(exportOptions);
    if (format === "csv") exportToCSV(exportOptions);
    if (format === "pdf") exportToPDF(exportOptions);
  };

  // Save report configuration to database
  const handleSaveReportConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportName.trim()) return;

    setSavingConfig(true);
    try {
      const url = initialConfig?.id
        ? `/api/reports/custom/configs/${initialConfig.id}`
        : "/api/reports/custom/configs";
      const method = initialConfig?.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: reportName.trim(),
          description: reportDescription.trim(),
          module: selectedModuleId,
          columns,
          filters,
          sort,
          groupBy,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSaveSuccessMessage("Report configuration saved!");
        setTimeout(() => {
          setSaveSuccessMessage(null);
          setShowSaveModal(false);
          if (onSavedSuccess) onSavedSuccess();
        }, 1200);
      }
    } catch (err) {
      console.error("Failed to save report configuration:", err);
    } finally {
      setSavingConfig(false);
    }
  };

  // Paginated Preview Rows
  const paginatedRows = useMemo(() => {
    const start = (previewPage - 1) * pageSize;
    return dataRows.slice(start, start + pageSize);
  }, [dataRows, previewPage, pageSize]);

  const totalPages = Math.ceil(dataRows.length / pageSize) || 1;

  // Icon resolver
  const renderModuleIcon = (iconName: string) => {
    switch (iconName) {
      case "ShoppingCart": return <ShoppingCart className="w-5 h-5" />;
      case "FileSpreadsheet": return <FileSpreadsheet className="w-5 h-5" />;
      case "Truck": return <Truck className="w-5 h-5" />;
      case "ReceiptText": return <ReceiptText className="w-5 h-5" />;
      case "WalletCards": return <WalletCards className="w-5 h-5" />;
      case "BadgeDollarSign": return <BadgeDollarSign className="w-5 h-5" />;
      case "Users": return <Users className="w-5 h-5" />;
      case "Building2": return <Building2 className="w-5 h-5" />;
      case "Package": return <Package className="w-5 h-5" />;
      case "Layers": return <Layers className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Workflow Stepper Navigation */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            {[
              { step: 1, label: "Select Module", desc: activeModuleDef.shortName },
              { step: 2, label: "Choose Columns", desc: `${columns.length} Selected` },
              { step: 3, label: "Apply Filters", desc: dateRangePreset !== "all" ? "Filtered" : "All Data" },
              { step: 4, label: "Preview & Export", desc: `${totalCount} Records` },
            ].map(({ step, label, desc }) => {
              const isCurrent = currentStep === step;
              const isPast = currentStep > step;
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => setCurrentStep(step)}
                  className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-left transition cursor-pointer shrink-0 ${
                    isCurrent
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : isPast
                      ? "bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/60"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                      isCurrent
                        ? "bg-white text-blue-700"
                        : isPast
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {isPast ? <Check className="w-3.5 h-3.5" /> : step}
                  </div>
                  <div>
                    <div className="text-xs font-semibold leading-tight">{label}</div>
                    <div className={`text-[10px] ${isCurrent ? "text-blue-100" : "text-slate-400"}`}>
                      {desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Step Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
            )}
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition cursor-pointer"
              >
                Next Step <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-xs transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-emerald-400" /> Save Report Config
              </button>
            )}
          </div>
        </div>
      </div>

      {/* STEP 1: MODULE SELECTION */}
      {currentStep === 1 && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">Step 1: Choose Source Module</h3>
            <p className="text-xs text-slate-500">
              Select any of the 10 core enterprise modules to build your customized tabular report.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
            {REPORT_MODULES.map((mod) => {
              const isSelected = selectedModuleId === mod.id;
              return (
                <div
                  key={mod.id}
                  onClick={() => handleModuleSelect(mod.id)}
                  className={`group relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/20"
                      : "border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-sm"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div
                        className={`p-2.5 rounded-xl transition ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700"
                        }`}
                      >
                        {renderModuleIcon(mod.icon)}
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {mod.category}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{mod.label}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {mod.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium text-[11px]">
                      {mod.fields.length} available fields
                    </span>
                    <span
                      className={`font-semibold text-xs flex items-center gap-1 ${
                        isSelected ? "text-blue-600" : "text-slate-500 group-hover:text-blue-600"
                      }`}
                    >
                      {isSelected ? "Selected" : "Select"}
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: CHOOSE & ORDER COLUMNS */}
      {currentStep === 2 && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Step 2: Choose, Order & Rename Columns
              </h3>
              <p className="text-xs text-slate-500">
                Pick the exact fields to display in your report. Move them up/down to set export order, or rename any column header.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllColumns}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={resetToDefaultColumns}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
              <button
                type="button"
                onClick={clearAllColumns}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Selected Columns with ordering & rename */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <span>Selected Columns ({columns.length})</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Drag/Move to order
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                {columns.map((col, index) => {
                  const isEditing = editingColumnKey === col.key;
                  return (
                    <div
                      key={col.key}
                      className="group flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-blue-300 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="w-5 text-center text-xs font-bold text-slate-400">
                          {index + 1}
                        </span>

                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              value={editLabelValue}
                              onChange={(e) => setEditLabelValue(e.target.value)}
                              autoFocus
                              className="px-2 py-1 text-xs border border-blue-500 rounded-lg outline-none bg-white flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => saveRenameColumn(col.key)}
                              className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingColumnKey(null)}
                              className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-semibold text-xs text-slate-800 truncate">
                              {col.label}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              ({col.key})
                            </span>
                            <button
                              type="button"
                              onClick={() => startRenameColumn(col.key, col.label)}
                              title="Rename column label"
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium">
                          {col.format}
                        </span>

                        {/* Move Up */}
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveColumn(index, "up")}
                          className="p-1 rounded hover:bg-slate-200 disabled:opacity-20 text-slate-600 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Move Down */}
                        <button
                          type="button"
                          disabled={index === columns.length - 1}
                          onClick={() => moveColumn(index, "down")}
                          className="p-1 rounded hover:bg-slate-200 disabled:opacity-20 text-slate-600 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Remove */}
                        <button
                          type="button"
                          disabled={columns.length === 1}
                          onClick={() => toggleColumn(col.key)}
                          className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 disabled:opacity-20 cursor-pointer"
                          title="Remove column"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Available Fields Library */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Available Fields ({activeModuleDef.fields.length})
                </span>
              </div>

              {/* Search input */}
              <div className="relative flex items-center border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 focus-within:bg-white focus-within:border-blue-500">
                <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={columnSearch}
                  onChange={(e) => setColumnSearch(e.target.value)}
                  className="w-full bg-transparent outline-none text-xs text-slate-800"
                />
              </div>

              {/* Field chips */}
              <div className="space-y-1 max-h-[390px] overflow-y-auto pr-1">
                {activeModuleDef.fields
                  .filter((f) => {
                    const q = columnSearch.toLowerCase();
                    return f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q);
                  })
                  .map((field) => {
                    const isSelected = columns.some((c) => c.key === field.key);
                    return (
                      <div
                        key={field.key}
                        onClick={() => toggleColumn(field.key)}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition ${
                          isSelected
                            ? "bg-blue-50/70 border-blue-200 text-blue-900 font-medium"
                            : "bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span>{field.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          {field.format}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: APPLY FILTERS */}
      {currentStep === 3 && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">Step 3: Filter, Sort & Group Data</h3>
            <p className="text-xs text-slate-500">
              Refine your dataset with date ranges, status filters, value thresholds, and sort preferences.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Filter Card 1: Date Range */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" /> Date Filtering
                </span>
              </div>

              {/* Date Field Target */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Target Date Column
                </label>
                <select
                  value={filters.dateField || activeModuleDef.dateFieldOptions[0]?.key || "issueDate"}
                  onChange={(e) => setFilters((p) => ({ ...p, dateField: e.target.value }))}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white text-slate-800 outline-none"
                >
                  {activeModuleDef.dateFieldOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Presets */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                  Quick Period Preset
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {[
                    { id: "all", label: "All Time" },
                    { id: "today", label: "Today" },
                    { id: "this_week", label: "This Week" },
                    { id: "this_month", label: "This Month" },
                    { id: "this_quarter", label: "This Qtr" },
                    { id: "this_year", label: "This Year" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleDatePresetChange(p.id)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                        dateRangePreset === p.id
                          ? "bg-blue-600 text-white font-semibold"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Inputs */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">From Date</label>
                  <input
                    type="date"
                    value={filters.startDate || ""}
                    onChange={(e) => {
                      setDateRangePreset("custom");
                      setFilters((p) => ({ ...p, startDate: e.target.value }));
                    }}
                    className="w-full text-xs p-1.5 border border-slate-300 rounded-lg outline-none bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">To Date</label>
                  <input
                    type="date"
                    value={filters.endDate || ""}
                    onChange={(e) => {
                      setDateRangePreset("custom");
                      setFilters((p) => ({ ...p, endDate: e.target.value }));
                    }}
                    className="w-full text-xs p-1.5 border border-slate-300 rounded-lg outline-none bg-white text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Filter Card 2: Status & Amount Limits */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-blue-600" /> Status & Amount
                </span>
              </div>

              {/* Status Filter */}
              {activeModuleDef.statusOptions && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Record Status
                  </label>
                  <select
                    value={filters.status || "all"}
                    onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white text-slate-800 outline-none"
                  >
                    <option value="all">All Statuses</option>
                    {activeModuleDef.statusOptions.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Min and Max Amount Range */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Amount Range (₹)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Min ₹"
                    value={filters.minAmount ?? ""}
                    onChange={(e) =>
                      setFilters((p) => ({
                        ...p,
                        minAmount: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    className="w-full text-xs p-2 border border-slate-300 rounded-xl outline-none bg-white text-slate-800"
                  />
                  <input
                    type="number"
                    placeholder="Max ₹"
                    value={filters.maxAmount ?? ""}
                    onChange={(e) =>
                      setFilters((p) => ({
                        ...p,
                        maxAmount: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    className="w-full text-xs p-2 border border-slate-300 rounded-xl outline-none bg-white text-slate-800"
                  />
                </div>
              </div>

              {/* General Text Search */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Keyword Search
                </label>
                <div className="relative flex items-center border border-slate-300 rounded-xl bg-white px-2.5 py-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search name, ref, notes..."
                    value={filters.searchTerm || ""}
                    onChange={(e) => setFilters((p) => ({ ...p, searchTerm: e.target.value }))}
                    className="w-full bg-transparent outline-none text-xs text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Filter Card 3: Sorting & Grouping */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" /> Sorting & Grouping
                </span>
              </div>

              {/* Primary Sort Column */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Sort By Column
                </label>
                <select
                  value={sort.field}
                  onChange={(e) => setSort((p) => ({ ...p, field: e.target.value }))}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white text-slate-800 outline-none"
                >
                  {columns.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Direction */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Sort Direction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSort((p) => ({ ...p, direction: "desc" }))}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      sort.direction === "desc"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" /> Descending
                  </button>
                  <button
                    type="button"
                    onClick={() => setSort((p) => ({ ...p, direction: "asc" }))}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      sort.direction === "asc"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" /> Ascending
                  </button>
                </div>
              </div>

              {/* Group By Option */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Group Records By (Optional)
                </label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white text-slate-800 outline-none"
                >
                  <option value="">No Grouping (Flat Table)</option>
                  {activeModuleDef.fields
                    .filter((f) => f.groupable)
                    .map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: PREVIEW & EXPORT */}
      {currentStep === 4 && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          {/* Top Actions & Summary Banner */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                {renderModuleIcon(activeModuleDef.icon)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-900">
                    {reportName || `${activeModuleDef.label} Custom Report`}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">
                    {totalCount} Matching Records
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Columns: {columns.map((c) => c.label).join(", ")}
                </p>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport("excel")}
                disabled={loadingData || dataRows.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition disabled:opacity-40 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export Excel (.xlsx)
              </button>

              <button
                type="button"
                onClick={() => handleExport("csv")}
                disabled={loadingData || dataRows.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition disabled:opacity-40 cursor-pointer"
              >
                <FileText className="w-4 h-4" /> Export CSV (.csv)
              </button>

              <button
                type="button"
                onClick={() => handleExport("pdf")}
                disabled={loadingData || dataRows.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition disabled:opacity-40 cursor-pointer"
              >
                <Download className="w-4 h-4 text-rose-400" /> Export PDF (.pdf)
              </button>

              <button
                type="button"
                onClick={handleRefreshData}
                title="Refresh preview data"
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Aggregate Totals Summary */}
          {summaryData.totalAmount > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Matching
                </span>
                <span className="text-lg font-bold text-slate-900 mt-1 block">
                  {summaryData.totalRecords} Records
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Aggregate Total Value
                </span>
                <span className="text-lg font-bold text-emerald-600 mt-1 block">
                  {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
                    summaryData.totalAmount
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Interactive Preview Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-bold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-[11px] w-12 text-center">#</th>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={`px-4 py-3 text-[11px] ${
                          col.format === "currency" || col.format === "number" ? "text-right" : ""
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {loadingData ? (
                    <tr>
                      <td colSpan={columns.length + 1} className="p-8 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                          <span>Generating live report preview…</span>
                        </div>
                      </td>
                    </tr>
                  ) : dataRows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 1} className="p-8 text-center text-slate-400">
                        No records match the selected filters. Try adjusting your date range or status criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, rIdx) => {
                      const absoluteIdx = (previewPage - 1) * pageSize + rIdx + 1;
                      return (
                        <tr key={rIdx} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-2.5 text-center text-slate-400 font-mono text-[11px]">
                            {absoluteIdx}
                          </td>
                          {columns.map((col) => {
                            const raw = row[col.key];
                            const isNumeric = col.format === "currency" || col.format === "number";
                            const formatted = formatCellValue(raw, col.format);

                            return (
                              <td
                                key={col.key}
                                className={`px-4 py-2.5 ${isNumeric ? "text-right font-medium" : ""}`}
                              >
                                {col.format === "badge" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    {String(raw || "—")}
                                  </span>
                                ) : (
                                  formatted
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {dataRows.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs">
                <div className="text-slate-500">
                  Showing {(previewPage - 1) * pageSize + 1} to{" "}
                  {Math.min(previewPage * pageSize, dataRows.length)} of {dataRows.length} records
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPreviewPage(1);
                    }}
                    className="p-1 border border-slate-300 rounded-lg bg-white text-slate-700 outline-none text-xs"
                  >
                    <option value={10}>10 rows</option>
                    <option value={15}>15 rows</option>
                    <option value={25}>25 rows</option>
                    <option value={50}>50 rows</option>
                  </select>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={previewPage <= 1}
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 border border-slate-300 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="px-2 text-slate-600 font-medium">
                      Page {previewPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={previewPage >= totalPages}
                      onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                      className="px-2.5 py-1 border border-slate-300 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Report Modal Dialog */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">Save Report Configuration</h3>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReportConfig} className="p-6 space-y-4 text-xs">
              {saveSuccessMessage && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{saveSuccessMessage}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Report Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Sales & Tax Invoices Report"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description / Purpose (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Filtered for accepted customer orders with GST breakdown."
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-slate-900 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div>
                  <span className="font-semibold text-slate-700">Module:</span> {activeModuleDef.label}
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Selected Columns:</span> {columns.length} columns configured
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConfig || !reportName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {savingConfig ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Save Configuration
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
