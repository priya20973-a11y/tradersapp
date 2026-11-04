"use client";

import { useState } from "react";
import {
  ChevronRight,
  FileSpreadsheet,
  Layers,
  LayoutDashboard,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { ReportBuilder } from "./report-builder";
import { SavedReportsList, type SavedReportItem } from "./saved-reports-list";

interface CustomReportsViewProps {
  initialTab?: "builder" | "saved" | "overview";
}

export function CustomReportsView({ initialTab = "saved" }: CustomReportsViewProps) {
  const [activeTab, setActiveTab] = useState<"builder" | "saved" | "overview">(initialTab);
  const [editingReport, setEditingReport] = useState<SavedReportItem | null>(null);
  const [savedRefreshTrigger, setSavedRefreshTrigger] = useState(0);

  const handleEditReport = (report: SavedReportItem) => {
    setEditingReport(report);
    setActiveTab("builder");
  };

  const handleCreateNew = () => {
    setEditingReport(null);
    setActiveTab("builder");
  };

  const handleSavedSuccess = () => {
    setSavedRefreshTrigger((prev) => prev + 1);
    setActiveTab("saved");
    setEditingReport(null);
  };

  const handleCancelBuilder = () => {
    setActiveTab("saved");
    setEditingReport(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              Analytics & Intelligence
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              Custom Engine
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Reports & Custom Builder
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate customized cross-module reports, pick exact fields, order columns, and export to Excel, CSV, or PDF.
          </p>
        </div>

        {/* Action Button */}
        {activeTab !== "builder" && (
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition"
          >
            <Plus className="h-4 w-4" />
            Build Custom Report
          </button>
        )}
      </div>

      {/* Tabs Switcher Navigation */}
      <div className="flex items-center border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab("saved");
              setEditingReport(null);
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === "saved"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Saved Reports
          </button>

          <button
            onClick={() => {
              setActiveTab("builder");
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === "builder"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            <Layers className="h-4 w-4" />
            {editingReport ? (
              <span className="flex items-center gap-1.5">
                <span>Edit: {editingReport.name}</span>
                <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-700">
                  Modifying
                </span>
              </span>
            ) : (
              <span>Report Builder</span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab("overview");
              setEditingReport(null);
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === "overview"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Profit & Loss Overview
          </button>
        </div>
      </div>

      {/* Tab 1: Saved Reports List */}
      {activeTab === "saved" && (
        <SavedReportsList
          onEditReport={handleEditReport}
          onCreateNew={handleCreateNew}
          refreshTrigger={savedRefreshTrigger}
        />
      )}

      {/* Tab 2: Interactive Report Builder */}
      {activeTab === "builder" && (
        <div>
          {editingReport && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-xs text-blue-900">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Editing Configuration:</span>
                <span className="font-bold underline">{editingReport.name}</span>
                <span>({editingReport.module})</span>
              </div>
              <button
                onClick={handleCreateNew}
                className="font-semibold text-blue-600 hover:underline"
              >
                Clear & Start New Report
              </button>
            </div>
          )}

          <ReportBuilder
            initialConfig={editingReport}
            onSavedSuccess={handleSavedSuccess}
            onCancel={handleCancelBuilder}
          />
        </div>
      )}

      {/* Tab 3: Profit & Loss Overview (Preserved original cards with elevated aesthetic) */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Financial Snapshot</h3>
              <p className="text-xs text-slate-500">Overall fiscal performance and net profitability.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900">₹1,48,50,000</p>
              <p className="mt-1 text-xs text-emerald-600 font-medium">+14.2% from last quarter</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Expenses</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <TrendingDown className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900">₹1,13,60,000</p>
              <p className="mt-1 text-xs text-slate-500 font-medium">Bills, operational & logistics</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Profit</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-emerald-600">₹34,90,000</p>
              <p className="mt-1 text-xs text-emerald-700 font-medium">23.5% Operating Margin</p>
            </div>
          </div>

          {/* Quick Shortcuts to Custom Reports */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900">Pre-configured Module Reports</h4>
            <p className="mt-1 text-xs text-slate-500">
              Jump straight into custom report creation for any business area:
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { name: "Sales Orders", module: "Sales", desc: "Invoices, items & margins" },
                { name: "Purchase Orders", module: "Purchase", desc: "Vendors & purchase bills" },
                { name: "Customer Aging", module: "Customers", desc: "Outstanding balances" },
                { name: "Inventory Valuation", module: "Inventory", desc: "Stock lots & valuation" },
                { name: "Expense Breakdown", module: "Expenses", desc: "Categories & tax claims" },
              ].map((item) => (
                <button
                  key={item.name}
                  onClick={() => {
                    setEditingReport(null);
                    setActiveTab("builder");
                  }}
                  className="flex flex-col text-left rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 hover:border-blue-200 hover:bg-blue-50/30 transition group"
                >
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition">
                    {item.name}
                  </span>
                  <span className="mt-1 text-[11px] text-slate-500">{item.desc}</span>
                  <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                    <span>Create</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
