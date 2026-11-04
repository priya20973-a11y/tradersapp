"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  FileText,
  CheckCircle2,
  X,
  CreditCard,
  Receipt,
  RotateCw,
  ShoppingBag,
} from "lucide-react";

export type PurchasesSection =
  | "expenses"
  | "recurring-expenses"
  | "purchase-orders"
  | "bills"
  | "recurring-bills"
  | "payments-made"
  | "vendor-credits";

interface PurchasesConfig {
  title: string;
  singular: string;
  subtitle: string;
  icon: typeof FileText;
  metrics: { label: string; value: string; badge: string; badgeColor: string }[];
  columns: string[];
  mockData: Record<string, string | number>[];
}

const sectionConfigs: Record<PurchasesSection, PurchasesConfig> = {
  expenses: {
    title: "Expenses",
    singular: "Expense",
    subtitle: "Track, categorize and manage all operating expenditures",
    icon: Receipt,
    metrics: [
      { label: "Total Expenses (MTD)", value: "₹4,85,200", badge: "+5.2% MoM", badgeColor: "emerald" },
      { label: "Unbilled Expenses", value: "₹62,400", badge: "3 Pending", badgeColor: "amber" },
      { label: "Reimbursable", value: "₹18,500", badge: "2 Claims", badgeColor: "blue" },
    ],
    columns: ["Date", "Expense Account", "Vendor / Merchant", "Reference#", "Paid Through", "Amount", "Status"],
    mockData: [
      {
        id: "EXP-2026-081",
        date: "2026-10-20",
        account: "Freight & Shipping Charges",
        vendor: "Apex Freight Solutions",
        ref: "TRK-98214",
        paidVia: "HDFC Primary Bank",
        amount: "₹18,400",
        status: "Paid",
      },
      {
        id: "EXP-2026-082",
        date: "2026-10-18",
        account: "Warehouse Storage & Handling",
        vendor: "Central Agro Warehousing",
        ref: "WH-1092",
        paidVia: "ICICI Operational",
        amount: "₹45,000",
        status: "Paid",
      },
      {
        id: "EXP-2026-083",
        date: "2026-10-15",
        account: "Quality Testing & Certification",
        vendor: "AgriLab Quality Analysts",
        ref: "LAB-4402",
        paidVia: "Cash in Hand",
        amount: "₹7,200",
        status: "Reimbursable",
      },
      {
        id: "EXP-2026-084",
        date: "2026-10-12",
        account: "Packaging Consumables",
        vendor: "Shree Packaging",
        ref: "PKG-8820",
        paidVia: "HDFC Primary Bank",
        amount: "₹24,500",
        status: "Paid",
      },
    ],
  },
  "recurring-expenses": {
    title: "Recurring Expenses",
    singular: "Recurring Expense",
    subtitle: "Automated scheduled expenses for software, rent and utilities",
    icon: RotateCw,
    metrics: [
      { label: "Active Profiles", value: "6 Profiles", badge: "All Healthy", badgeColor: "emerald" },
      { label: "Monthly Recurring", value: "₹1,15,000", badge: "Auto-charged", badgeColor: "blue" },
      { label: "Next Scheduled", value: "01 Nov 2026", badge: "4 Days Left", badgeColor: "amber" },
    ],
    columns: ["Profile Name", "Frequency", "Expense Account", "Vendor", "Next Run Date", "Amount", "Status"],
    mockData: [
      {
        id: "REC-EXP-01",
        name: "Warehouse Lease - Unit B",
        frequency: "Monthly",
        account: "Rent & Lease Expense",
        vendor: "IndoSpace Properties",
        nextDate: "2026-11-01",
        amount: "₹75,000",
        status: "Active",
      },
      {
        id: "REC-EXP-02",
        name: "Cloud ERP & Inventory License",
        frequency: "Monthly",
        account: "Software & Technology",
        vendor: "TechFlow Systems",
        nextDate: "2026-11-05",
        amount: "₹22,500",
        status: "Active",
      },
      {
        id: "REC-EXP-03",
        name: "Security & Surveillance Retainer",
        frequency: "Monthly",
        account: "Security Services",
        vendor: "Sentinel Security Services",
        nextDate: "2026-11-07",
        amount: "₹17,500",
        status: "Active",
      },
    ],
  },
  "purchase-orders": {
    title: "Purchase Orders",
    singular: "Purchase Order",
    subtitle: "Formal requests sent to vendors for commodity and goods procurement",
    icon: ShoppingBag,
    metrics: [
      { label: "Open POs", value: "4 Orders", badge: "Awaiting Delivery", badgeColor: "amber" },
      { label: "Total PO Value", value: "₹38,20,000", badge: "Current Month", badgeColor: "blue" },
      { label: "Fulfilled Orders", value: "18 Orders", badge: "98% On-time", badgeColor: "emerald" },
    ],
    columns: ["Date", "Purchase Order#", "Vendor Name", "Expected Delivery", "Status", "Total Amount"],
    mockData: [
      {
        id: "PO-2026-0041",
        date: "2026-10-19",
        vendor: "Mohan Traders",
        expected: "2026-10-26",
        status: "Issued",
        amount: "₹12,40,000",
      },
      {
        id: "PO-2026-0040",
        date: "2026-10-16",
        vendor: "Kaveri Agro Industries",
        expected: "2026-10-24",
        status: "Confirmed",
        amount: "₹15,80,000",
      },
      {
        id: "PO-2026-0039",
        date: "2026-10-11",
        vendor: "Shree Packaging",
        expected: "2026-10-18",
        status: "Partially Received",
        amount: "₹3,20,000",
      },
      {
        id: "PO-2026-0038",
        date: "2026-10-04",
        vendor: "Metro Logistics",
        expected: "2026-10-08",
        status: "Fulfilled",
        amount: "₹6,80,000",
      },
    ],
  },
  bills: {
    title: "Bills",
    singular: "Bill",
    subtitle: "Vendor invoices, payment obligations and payable ageing",
    icon: FileText,
    metrics: [
      { label: "Total Payables", value: "₹11,10,000", badge: "+2.1% from last week", badgeColor: "rose" },
      { label: "Due within 30 days", value: "₹8,45,000", badge: "8 Bills", badgeColor: "amber" },
      { label: "Paid This Month", value: "₹24,50,000", badge: "14 Transactions", badgeColor: "emerald" },
    ],
    columns: ["Date", "Bill#", "Vendor Name", "Due Date", "Status", "Amount", "Balance Due"],
    mockData: [
      {
        id: "BILL-4421",
        date: "2026-10-10",
        vendor: "Mohan Traders",
        dueDate: "2026-10-31",
        status: "Pending",
        amount: "₹18,200",
        balance: "₹18,200",
      },
      {
        id: "BILL-4422",
        date: "2026-10-12",
        vendor: "Shree Packaging",
        dueDate: "2026-11-05",
        status: "Pending",
        amount: "₹9,600",
        balance: "₹9,600",
      },
      {
        id: "BILL-4423",
        date: "2026-10-14",
        vendor: "Metro Logistics",
        dueDate: "2026-11-10",
        status: "Partially Paid",
        amount: "₹24,000",
        balance: "₹12,000",
      },
      {
        id: "BILL-4420",
        date: "2026-10-02",
        vendor: "Kaveri Agro Industries",
        dueDate: "2026-10-20",
        status: "Paid",
        amount: "₹45,000",
        balance: "₹0",
      },
    ],
  },
  "recurring-bills": {
    title: "Recurring Bills",
    singular: "Recurring Bill",
    subtitle: "Manage repeating supplier billing schedules and automation",
    icon: RotateCw,
    metrics: [
      { label: "Recurring Profiles", value: "4 Profiles", badge: "Active", badgeColor: "emerald" },
      { label: "Total Monthly Bill", value: "₹88,000", badge: "Committed", badgeColor: "blue" },
      { label: "Next Bill Date", value: "28 Oct 2026", badge: "In 6 days", badgeColor: "amber" },
    ],
    columns: ["Profile Name", "Frequency", "Vendor Name", "Next Bill Date", "Amount", "Status"],
    mockData: [
      {
        id: "REC-BILL-101",
        name: "Security Guard Stationing",
        frequency: "Monthly",
        vendor: "Sentinel Security Services",
        nextDate: "2026-10-28",
        amount: "₹32,000",
        status: "Active",
      },
      {
        id: "REC-BILL-102",
        name: "Warehouse Power & HVAC",
        frequency: "Monthly",
        vendor: "City Industrial Power Corp",
        nextDate: "2026-11-02",
        amount: "₹41,000",
        status: "Active",
      },
      {
        id: "REC-BILL-103",
        name: "Pallet Rental Service",
        frequency: "Monthly",
        vendor: "Shree Packaging",
        nextDate: "2026-11-10",
        amount: "₹15,000",
        status: "Active",
      },
    ],
  },
  "payments-made": {
    title: "Payments Made",
    singular: "Payment",
    subtitle: "History of disbursements, bank remittances and vendor settlements",
    icon: CreditCard,
    metrics: [
      { label: "Disbursed (FY 26-27)", value: "₹82,40,000", badge: "Cleared", badgeColor: "emerald" },
      { label: "Disbursed This Month", value: "₹14,20,000", badge: "12 Transfers", badgeColor: "blue" },
      { label: "Pending Clearing", value: "₹38,000", badge: "1 Cheque", badgeColor: "amber" },
    ],
    columns: ["Date", "Payment#", "Vendor Name", "Payment Mode", "Reference / UTR", "Amount Paid", "Status"],
    mockData: [
      {
        id: "PAY-OUT-890",
        date: "2026-10-20",
        vendor: "Kaveri Agro Industries",
        mode: "NEFT / RTGS",
        ref: "HDFCN2629381920",
        amount: "₹3,50,000",
        status: "Cleared",
      },
      {
        id: "PAY-OUT-889",
        date: "2026-10-18",
        vendor: "Metro Logistics",
        mode: "IMPS",
        ref: "ICICI9928371192",
        amount: "₹12,000",
        status: "Cleared",
      },
      {
        id: "PAY-OUT-888",
        date: "2026-10-15",
        vendor: "Shree Packaging",
        mode: "Cheque #004412",
        ref: "CHQ-004412",
        amount: "₹38,000",
        status: "In Clearing",
      },
      {
        id: "PAY-OUT-887",
        date: "2026-10-09",
        vendor: "Mohan Traders",
        mode: "UPI Corporate",
        ref: "UPI/261009/4412",
        amount: "₹50,000",
        status: "Cleared",
      },
    ],
  },
  "vendor-credits": {
    title: "Vendor Credits",
    singular: "Vendor Credit",
    subtitle: "Credit notes and adjustments received from suppliers",
    icon: Receipt,
    metrics: [
      { label: "Available Credits", value: "₹34,500", badge: "Ready to Apply", badgeColor: "emerald" },
      { label: "Credits Applied", value: "₹1,12,000", badge: "To Open Bills", badgeColor: "blue" },
      { label: "Total Issued", value: "₹1,46,500", badge: "5 Notes", badgeColor: "slate" },
    ],
    columns: ["Date", "Credit Note#", "Vendor Name", "Original Bill#", "Credit Amount", "Balance Remaining", "Status"],
    mockData: [
      {
        id: "VCR-2026-09",
        date: "2026-10-17",
        vendor: "Mohan Traders",
        bill: "BILL-4418",
        amount: "₹14,500",
        balance: "₹14,500",
        status: "Open",
      },
      {
        id: "VCR-2026-08",
        date: "2026-10-11",
        vendor: "Shree Packaging",
        bill: "BILL-4402",
        amount: "₹20,000",
        balance: "₹20,000",
        status: "Open",
      },
      {
        id: "VCR-2026-07",
        date: "2026-09-28",
        vendor: "Kaveri Agro Industries",
        bill: "BILL-4389",
        amount: "₹42,000",
        balance: "₹0",
        status: "Closed",
      },
    ],
  },
};

export function PurchasesWorkspace({ section }: { section: PurchasesSection }) {
  const config = sectionConfigs[section] ?? sectionConfigs["bills"];
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(() => searchParams.get("new") === "true");
  const [items, setItems] = useState<Record<string, string | number>[]>(config.mockData);

  // Quick create state
  const [recordName, setRecordName] = useState("");
  const [recordAmount, setRecordAmount] = useState("");
  const [recordVendor, setRecordVendor] = useState("Mohan Traders");

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const searchStr = search.toLowerCase();
      const matchesSearch = Object.values(item).some((val) =>
        String(val).toLowerCase().includes(searchStr),
      );
      const matchesStatus =
        statusFilter === "ALL" ||
        String(item.status || "").toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newItem = {
      id: `${config.singular.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split("T")[0],
      name: recordName || `${config.singular} Entry`,
      vendor: recordVendor,
      account: recordName || "General Purchases",
      amount: `₹${parseFloat(recordAmount || "0").toLocaleString("en-IN")}`,
      balance: `₹${parseFloat(recordAmount || "0").toLocaleString("en-IN")}`,
      status: "Active",
      expected: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
      frequency: "Monthly",
      paidVia: "HDFC Primary Bank",
      ref: `REF-${Math.floor(1000 + Math.random() * 9000)}`,
      mode: "NEFT",
      nextDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      bill: "BILL-AUTO",
    };

    setItems([newItem, ...items]);
    setRecordName("");
    setRecordAmount("");
    setShowModal(false);
  };

  const IconComponent = config.icon;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Purchases</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{config.title}</h2>
          <p className="text-xs text-slate-500 mt-1">{config.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition"
        >
          <Plus className="h-4 w-4" />
          New {config.singular}
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {config.metrics.map((metric, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{metric.label}</p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">{metric.value}</span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  metric.badgeColor === "emerald"
                    ? "bg-emerald-50 text-emerald-700"
                    : metric.badgeColor === "rose"
                    ? "bg-rose-50 text-rose-700"
                    : metric.badgeColor === "amber"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {metric.badge}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "Active", "Pending", "Paid", "Open"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === st
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st === "ALL" ? `All ${config.title}` : st}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${config.title.toLowerCase()}...`}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-1.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              {config.columns.map((col, index) => (
                <th key={index} className="px-6 py-3.5">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={config.columns.length} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <IconComponent className="h-8 w-8 text-slate-300" />
                    <span>No records found in {config.title}.</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-slate-50/80 transition">
                  {/* Dynamic cells depending on section */}
                  {section === "expenses" && (
                    <>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">{String(item.date)}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{String(item.account)}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-700">{String(item.vendor)}</td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">{String(item.ref)}</td>
                      <td className="px-6 py-4 text-xs text-slate-600">{String(item.paidVia)}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{String(item.amount)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {String(item.status)}
                        </span>
                      </td>
                    </>
                  )}

                  {section === "recurring-expenses" && (
                    <>
                      <td className="px-6 py-4 font-semibold text-slate-900">{String(item.name)}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600">
                        <span className="rounded bg-slate-100 px-2 py-0.5">{String(item.frequency)}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700">{String(item.account)}</td>
                      <td className="px-6 py-4 text-xs text-slate-700">{String(item.vendor)}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">{String(item.nextDate)}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{String(item.amount)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
                          {String(item.status)}
                        </span>
                      </td>
                    </>
                  )}

                  {section === "purchase-orders" && (
                    <>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">{String(item.date)}</td>
                      <td className="px-6 py-4 font-semibold font-mono text-slate-900">{String(item.id)}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-700">{String(item.vendor)}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">{String(item.expected)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700">
                          {String(item.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{String(item.amount)}</td>
                    </>
                  )}

                  {section === "bills" && (
                    <>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">{String(item.date)}</td>
                      <td className="px-6 py-4 font-semibold font-mono text-slate-900">{String(item.id)}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-700">{String(item.vendor)}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">{String(item.dueDate)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            item.status === "Paid"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {String(item.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{String(item.amount)}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{String(item.balance)}</td>
                    </>
                  )}

                  {section === "recurring-bills" && (
                    <>
                      <td className="px-6 py-4 font-semibold text-slate-900">{String(item.name)}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600">
                        <span className="rounded bg-slate-100 px-2 py-0.5">{String(item.frequency)}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700">{String(item.vendor)}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">{String(item.nextDate)}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{String(item.amount)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
                          {String(item.status)}
                        </span>
                      </td>
                    </>
                  )}

                  {section === "payments-made" && (
                    <>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">{String(item.date)}</td>
                      <td className="px-6 py-4 font-semibold font-mono text-slate-900">{String(item.id)}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-700">{String(item.vendor)}</td>
                      <td className="px-6 py-4 text-xs text-slate-600">{String(item.mode)}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">{String(item.ref)}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{String(item.amount)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {String(item.status)}
                        </span>
                      </td>
                    </>
                  )}

                  {section === "vendor-credits" && (
                    <>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">{String(item.date)}</td>
                      <td className="px-6 py-4 font-semibold font-mono text-slate-900">{String(item.id)}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-700">{String(item.vendor)}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">{String(item.bill)}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{String(item.amount)}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{String(item.balance)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            item.status === "Open"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {String(item.status)}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Record Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">New {config.singular}</h3>
                <p className="text-xs text-slate-500">Record a new {config.singular.toLowerCase()} entry</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vendor / Supplier *
                </label>
                <select
                  value={recordVendor}
                  onChange={(e) => setRecordVendor(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 bg-white"
                >
                  <option value="Mohan Traders">Mohan Traders</option>
                  <option value="Shree Packaging">Shree Packaging</option>
                  <option value="Metro Logistics">Metro Logistics</option>
                  <option value="Kaveri Agro Industries">Kaveri Agro Industries</option>
                  <option value="Apex Freight Solutions">Apex Freight Solutions</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Title / Description *
                </label>
                <input
                  required
                  type="text"
                  placeholder={`e.g. October ${config.singular}`}
                  value={recordName}
                  onChange={(e) => setRecordName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount (₹) *
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="0.00"
                  value={recordAmount}
                  onChange={(e) => setRecordAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition"
                >
                  Save {config.singular}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
