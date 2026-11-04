"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  FileText,
  Gauge,
  Info,
  Loader2,
  Plus,
  Receipt,
  Save,
  Settings,
  Table,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

export type ExpenseFormTab = "expense" | "mileage" | "bulk";
export type ExpenseFormMode = "create" | "edit" | "view";

export interface ExpenseRowItem {
  id: string;
  expenseAccount: string;
  notes: string;
  amount: number | string;
}

export interface BulkExpenseRow {
  id: string;
  date: string;
  expenseAccount: string;
  amount: number | string;
  paidThrough: string;
  vendor: string;
  customerName: string;
  project: string;
  billable: boolean;
  reportingTags: string;
}

export interface MileagePreferences {
  category: string;
  unit: "KM" | "Mile";
  startDate: string;
  rate: number;
}

export interface ExpenseReceipt {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export const standardAccounts = [
  "Freight & Shipping Charges",
  "Travel & Conveyance",
  "Office Supplies & Stationery",
  "Meals & Entertainment",
  "Warehouse & Storage Maintenance",
  "Vehicle Fuel & Running Expenses",
  "Printing & Courier Services",
  "Quality Inspection & Testing Fees",
  "Advertising & Marketing",
  "Software & Technology Subscriptions",
  "Legal & Professional Charges",
  "Repairs & Maintenance",
  "Utilities - Electricity & Water",
  "Telephone & Internet Charges",
  "Bank & Financial Charges",
];

export const paidThroughAccounts = [
  "Petty Cash Account",
  "HDFC Primary Bank",
  "ICICI Operational Bank",
  "State Bank of India (Current)",
  "Company Corporate Card",
  "Employee Personal Funds (Reimbursable)",
];

const initialPreferences: MileagePreferences = {
  category: "Standard Business Travel",
  unit: "KM",
  startDate: "2026-04-01",
  rate: 12.0,
};

interface ExpenseFormProps {
  initialData?: Record<string, unknown>;
  mode?: ExpenseFormMode;
  expenseId?: string;
  defaultTab?: ExpenseFormTab;
}

export function ExpenseForm({
  initialData,
  mode = "create",
  expenseId,
  defaultTab,
}: ExpenseFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isViewMode = mode === "view";

  const initialTabParam = (searchParams.get("tab") as ExpenseFormTab) || defaultTab || "expense";
  const [activeTab, setActiveTab] = useState<ExpenseFormTab>(() => {
    if (initialData?.expenseType === "mileage") return "mileage";
    if (initialData?.expenseType === "bulk") return "bulk";
    return initialTabParam;
  });

  // Dynamic Options
  const [vendorsList, setVendorsList] = useState<string[]>([
    "Mohan Traders",
    "Shree Packaging",
    "Metro Logistics",
    "Kaveri Agro Industries",
    "Apex Freight Solutions",
  ]);
  const [customersList, setCustomersList] = useState<string[]>([
    "Astra Foods",
    "City Retail",
    "Ganga Stores",
  ]);

  // Preferences Modal State
  const [showPrefModal, setShowPrefModal] = useState(false);
  const [preferences, setPreferences] = useState<MileagePreferences>(initialPreferences);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Form State: Tab 1 — Record Expense
  const [expenseDate, setExpenseDate] = useState<string>(
    () => (initialData?.date as string) || new Date().toISOString().split("T")[0],
  );
  const [expensePaidThrough, setExpensePaidThrough] = useState<string>(
    () => (initialData?.paidThrough as string) || "Petty Cash Account",
  );
  const [expenseCurrency, setExpenseCurrency] = useState<string>(
    () => (initialData?.currency as string) || "INR",
  );
  const [expenseVendor, setExpenseVendor] = useState<string>(
    () => (initialData?.vendor as string) || "",
  );
  const [expenseInvoiceNo, setExpenseInvoiceNo] = useState<string>(
    () => (initialData?.invoiceNumber as string) || "",
  );
  const [expenseCustomer, setExpenseCustomer] = useState<string>(
    () =>
      (initialData?.customerName as string) ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("customerName") ||
          new URLSearchParams(window.location.search).get("customerId") ||
          ""
        : ""),
  );
  const [expenseBillable, setExpenseBillable] = useState<boolean>(
    () => Boolean(initialData?.billable),
  );
  const [expenseProject, setExpenseProject] = useState<string>(
    () => (initialData?.project as string) || "",
  );
  const [expenseTags] = useState<string>(
    () => (initialData?.reportingTags as string[])?.join(", ") || "",
  );
  const [expenseItems, setExpenseItems] = useState<ExpenseRowItem[]>(() => {
    if (Array.isArray(initialData?.items) && initialData.items.length > 0) {
      return (initialData.items as Array<{ expenseAccount: string; notes?: string; amount: number }>).map(
        (it, idx) => ({
          id: `item-${idx + 1}`,
          expenseAccount: it.expenseAccount || standardAccounts[0],
          notes: it.notes || "",
          amount: it.amount || 0,
        }),
      );
    }
    return [
      {
        id: "item-1",
        expenseAccount: standardAccounts[0],
        notes: "",
        amount: "",
      },
    ];
  });
  const [expenseReceipts, setExpenseReceipts] = useState<ExpenseReceipt[]>(
    () => (initialData?.receipts as ExpenseReceipt[]) || [],
  );
  const [isDraggingExpense, setIsDraggingExpense] = useState(false);
  const [isDraggingMileage, setIsDraggingMileage] = useState(false);

  // Form State: Tab 2 — Record Mileage
  const [mileageDate, setMileageDate] = useState<string>(
    () => (initialData?.date as string) || new Date().toISOString().split("T")[0],
  );
  const [mileageEmployee, setMileageEmployee] = useState<string>(
    () => (initialData?.mileageDetails as { employee?: string })?.employee || "Rajesh Sharma",
  );
  const [calcMethod, setCalcMethod] = useState<"distance" | "odometer">(
    () => (initialData?.mileageDetails as { calculationMethod?: "distance" | "odometer" })?.calculationMethod || "distance",
  );
  const [mileageDistance, setMileageDistance] = useState<number | string>(
    () => (initialData?.mileageDetails as { distance?: number })?.distance ?? 45,
  );
  const [startOdo, setStartOdo] = useState<number | string>(
    () => (initialData?.mileageDetails as { startOdometer?: number })?.startOdometer ?? 12400,
  );
  const [endOdo, setEndOdo] = useState<number | string>(
    () => (initialData?.mileageDetails as { endOdometer?: number })?.endOdometer ?? 12445,
  );
  const [mileagePaidThrough, setMileagePaidThrough] = useState<string>(
    () => (initialData?.paidThrough as string) || "Petty Cash Account",
  );
  const [mileageVendor, setMileageVendor] = useState<string>(
    () => (initialData?.vendor as string) || "",
  );
  const [mileageInvoiceNo, setMileageInvoiceNo] = useState<string>(
    () => (initialData?.invoiceNumber as string) || "",
  );
  const [mileageNotes, setMileageNotes] = useState<string>(
    () => (initialData?.notes as string) || "",
  );
  const [mileageCustomer] = useState<string>(
    () => (initialData?.customerName as string) || "",
  );
  const [mileageBillable, setMileageBillable] = useState<boolean>(
    () => Boolean(initialData?.billable),
  );
  const [mileageReceipts, setMileageReceipts] = useState<ExpenseReceipt[]>(
    () => (initialData?.receipts as ExpenseReceipt[]) || [],
  );

  // Form State: Tab 3 — Bulk Add Expenses
  const [bulkRows, setBulkRows] = useState<BulkExpenseRow[]>([
    {
      id: "bulk-1",
      date: new Date().toISOString().split("T")[0],
      expenseAccount: "Travel & Conveyance",
      amount: "1200",
      paidThrough: "Petty Cash Account",
      vendor: "Mohan Traders",
      customerName: "Astra Foods",
      project: "Field Trip",
      billable: true,
      reportingTags: "Travel",
    },
    {
      id: "bulk-2",
      date: new Date().toISOString().split("T")[0],
      expenseAccount: "Office Supplies & Stationery",
      amount: "850",
      paidThrough: "Petty Cash Account",
      vendor: "Shree Packaging",
      customerName: "",
      project: "Admin",
      billable: false,
      reportingTags: "Stationery",
    },
    {
      id: "bulk-3",
      date: new Date().toISOString().split("T")[0],
      expenseAccount: "Meals & Entertainment",
      amount: "1500",
      paidThrough: "Company Corporate Card",
      vendor: "Metro Logistics",
      customerName: "City Retail",
      project: "Client Dinner",
      billable: true,
      reportingTags: "Hospitality",
    },
    {
      id: "bulk-4",
      date: new Date().toISOString().split("T")[0],
      expenseAccount: "Telephone & Internet Charges",
      amount: "2100",
      paidThrough: "HDFC Primary Bank",
      vendor: "Apex Freight Solutions",
      customerName: "",
      project: "Telecom",
      billable: false,
      reportingTags: "Utilities",
    },
  ]);

  // Submission & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [, setErrors] = useState<Record<string, string>>({});

  // Fetch preferences and vendors/customers on mount
  useEffect(() => {
    let mounted = true;

    // Load Mileage Preferences
    fetch("/api/expenses/preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.preferences) return;
        setPreferences(data.preferences);
      })
      .catch(() => {});

    // Load Vendors
    fetch("/api/vendors")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.vendors?.length) return;
        const names = data.vendors.map((v: { displayName?: string; name?: string }) => v.displayName || v.name).filter(Boolean);
        if (names.length) setVendorsList(names);
      })
      .catch(() => {});

    // Load Customers
    fetch("/api/sales?section=customers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.customers?.length) return;
        const names = data.customers.map((c: { name?: string }) => c.name).filter(Boolean);
        if (names.length) setCustomersList(names);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  // Calculate Subtotals
  const totalExpenseAmount = expenseItems.reduce(
    (sum, row) => sum + (parseFloat(String(row.amount)) || 0),
    0,
  );

  const activeDistance = useMemo(() => {
    if (calcMethod === "odometer") {
      const s = Number(startOdo) || 0;
      const e = Number(endOdo) || 0;
      return e >= s ? e - s : 0;
    }
    return parseFloat(String(mileageDistance)) || 0;
  }, [calcMethod, startOdo, endOdo, mileageDistance]);

  const totalMileageAmount = Math.round(activeDistance * preferences.rate * 100) / 100;

  const totalBulkAmount = bulkRows.reduce(
    (sum, row) => sum + (parseFloat(String(row.amount)) || 0),
    0,
  );

  // Row Manipulation: Tab 1
  const handleAddExpenseRow = () => {
    if (isViewMode) return;
    setExpenseItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        expenseAccount: standardAccounts[0],
        notes: "",
        amount: "",
      },
    ]);
  };

  const handleRemoveExpenseRow = (id: string) => {
    if (isViewMode || expenseItems.length <= 1) return;
    setExpenseItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateExpenseRow = (id: string, field: keyof ExpenseRowItem, val: unknown) => {
    if (isViewMode) return;
    setExpenseItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: val } : it)),
    );
  };

  // Row Manipulation: Tab 3 (Bulk)
  const handleAddBulkRow = () => {
    if (isViewMode) return;
    setBulkRows((prev) => [
      ...prev,
      {
        id: `bulk-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        expenseAccount: standardAccounts[0],
        amount: "",
        paidThrough: paidThroughAccounts[0],
        vendor: "",
        customerName: "",
        project: "",
        billable: false,
        reportingTags: "",
      },
    ]);
  };

  const handleRemoveBulkRow = (id: string) => {
    if (isViewMode || bulkRows.length <= 1) return;
    setBulkRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateBulkRow = (id: string, field: keyof BulkExpenseRow, val: unknown) => {
    if (isViewMode) return;
    setBulkRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)),
    );
  };

  // Receipt File Upload handler (files processing)
  const processReceiptFiles = (files: File[], target: "expense" | "mileage") => {
    const newReceipts: ExpenseReceipt[] = files.map((file) => ({
      id: `rc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    }));

    if (target === "expense") {
      setExpenseReceipts((prev) => [...prev, ...newReceipts]);
    } else {
      setMileageReceipts((prev) => [...prev, ...newReceipts]);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>, target: "expense" | "mileage") => {
    if (isViewMode || !e.target.files) return;
    processReceiptFiles(Array.from(e.target.files), target);
    e.target.value = "";
  };

  const handleFileDrop = (e: React.DragEvent<HTMLElement>, target: "expense" | "mileage") => {
    e.preventDefault();
    e.stopPropagation();
    if (target === "expense") setIsDraggingExpense(false);
    else setIsDraggingMileage(false);
    if (isViewMode || !e.dataTransfer.files) return;
    processReceiptFiles(Array.from(e.dataTransfer.files), target);
  };

  // Save Mileage Preferences
  const handleSavePreferences = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/expenses/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      setShowPrefModal(false);
      setNotice({ type: "success", message: "Mileage calculation rate updated successfully!" });
    } catch {
      setNotice({ type: "error", message: "Unable to update mileage preferences" });
    } finally {
      setSavingPrefs(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (andNew = false) => {
    if (isViewMode) return;
    setErrors({});
    setNotice(null);

    // Validation
    if (activeTab === "expense") {
      if (!expenseDate) {
        setErrors((prev) => ({ ...prev, expenseDate: "Date is required" }));
        return;
      }
      if (totalExpenseAmount <= 0) {
        setNotice({ type: "error", message: "Please specify an amount greater than 0 on expense rows." });
        return;
      }
    } else if (activeTab === "mileage") {
      if (!mileageDate) {
        setErrors((prev) => ({ ...prev, mileageDate: "Date is required" }));
        return;
      }
      if (activeDistance <= 0) {
        setNotice({ type: "error", message: "Distance must be greater than 0 to record mileage." });
        return;
      }
    } else if (activeTab === "bulk") {
      const validRows = bulkRows.filter((r) => parseFloat(String(r.amount)) > 0);
      if (validRows.length === 0) {
        setNotice({ type: "error", message: "Please enter at least one valid row with an amount." });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let payload: Record<string, unknown>;

      if (activeTab === "bulk") {
        const validRows = bulkRows.filter((r) => parseFloat(String(r.amount)) > 0);
        payload = {
          bulk: true,
          expenses: validRows.map((row) => ({
            expenseType: "bulk",
            date: row.date,
            paidThrough: row.paidThrough,
            currency: "INR",
            vendor: row.vendor,
            customerName: row.customerName,
            notes: `${row.expenseAccount} - ${row.project || "General"}`,
            amount: parseFloat(String(row.amount)),
            status: "Paid",
            billable: row.billable,
            project: row.project,
            reportingTags: row.reportingTags ? row.reportingTags.split(",").map((t) => t.trim()) : [],
            items: [
              {
                expenseAccount: row.expenseAccount,
                notes: row.project || "",
                amount: parseFloat(String(row.amount)),
              },
            ],
            receipts: [],
          })),
        };
      } else if (activeTab === "mileage") {
        payload = {
          expenseType: "mileage",
          date: mileageDate,
          paidThrough: mileagePaidThrough,
          currency: "INR",
          vendor: mileageVendor,
          invoiceNumber: mileageInvoiceNo,
          customerName: mileageCustomer,
          notes: mileageNotes,
          amount: totalMileageAmount,
          status: mileagePaidThrough.includes("Reimbursable") ? "Reimbursable" : "Paid",
          billable: mileageBillable,
          reportingTags: ["Mileage", preferences.unit],
          items: [
            {
              expenseAccount: "Vehicle Fuel & Running Expenses",
              notes: `${activeDistance} ${preferences.unit} @ ₹${preferences.rate}/${preferences.unit} (${mileageEmployee})`,
              amount: totalMileageAmount,
            },
          ],
          mileageDetails: {
            employee: mileageEmployee,
            calculationMethod: calcMethod,
            distance: activeDistance,
            unit: preferences.unit,
            rate: preferences.rate,
            startOdometer: calcMethod === "odometer" ? Number(startOdo) : 0,
            endOdometer: calcMethod === "odometer" ? Number(endOdo) : 0,
          },
          receipts: mileageReceipts,
        };
      } else {
        // Standard Expense
        payload = {
          expenseType: "standard",
          date: expenseDate,
          paidThrough: expensePaidThrough,
          currency: expenseCurrency,
          vendor: expenseVendor,
          invoiceNumber: expenseInvoiceNo,
          customerName: expenseCustomer,
          notes: expenseItems.map((it) => it.notes).filter(Boolean).join("; ") || "Standard Business Expense",
          amount: totalExpenseAmount,
          status: expensePaidThrough.includes("Reimbursable") ? "Reimbursable" : "Paid",
          billable: expenseBillable,
          project: expenseProject,
          reportingTags: expenseTags ? expenseTags.split(",").map((t) => t.trim()) : [],
          items: expenseItems.map((it) => ({
            expenseAccount: it.expenseAccount,
            notes: it.notes,
            amount: parseFloat(String(it.amount)) || 0,
          })),
          receipts: expenseReceipts,
        };
      }

      const endpoint = mode === "edit" && expenseId ? `/api/expenses/${expenseId}` : "/api/expenses";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save expense");

      setNotice({
        type: "success",
        message:
          activeTab === "bulk"
            ? "Bulk expenses recorded successfully!"
            : `${activeTab === "mileage" ? "Mileage expense" : "Expense"} ${mode === "edit" ? "updated" : "recorded"} successfully!`,
      });

      if (andNew) {
        // Reset fields
        if (activeTab === "expense") {
          setExpenseItems([{ id: "item-1", expenseAccount: standardAccounts[0], notes: "", amount: "" }]);
          setExpenseInvoiceNo("");
          setExpenseReceipts([]);
        } else if (activeTab === "mileage") {
          setMileageDistance(0);
          setMileageNotes("");
          setMileageReceipts([]);
        } else {
          setBulkRows([
            {
              id: "bulk-1",
              date: new Date().toISOString().split("T")[0],
              expenseAccount: standardAccounts[0],
              amount: "",
              paidThrough: paidThroughAccounts[0],
              vendor: "",
              customerName: "",
              project: "",
              billable: false,
              reportingTags: "",
            },
          ]);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setTimeout(() => {
          router.push("/purchases/expenses");
        }, 900);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred while saving.";
      setNotice({ type: "error", message: msg });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-28 text-slate-900 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb */}
      <div className="border-b border-slate-200 bg-white shadow-2xs">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <Link
                href="/purchases/expenses"
                aria-label="Back to Expenses"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Link href="/purchases/expenses" className="hover:text-blue-600 transition">
                    Purchases
                  </Link>
                  <span>/</span>
                  <Link href="/purchases/expenses" className="hover:text-blue-600 transition">
                    Expenses
                  </Link>
                  <span>/</span>
                  <span className="text-slate-900 font-semibold">
                    {mode === "create" ? "New Expense" : mode === "edit" ? "Edit Expense" : "Expense Details"}
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                  {mode === "create" ? "Record Operating Expense" : `Expense ${initialData?.referenceNumber || ""}`}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowPrefModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
              >
                <Settings className="h-3.5 w-3.5 text-slate-500" />
                Mileage Preferences
              </button>
              <Link
                href="/purchases/expenses"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 space-y-6">
        {/* Notice Alert */}
        {notice && (
          <div
            className={`flex items-center justify-between gap-3 rounded-2xl p-4 text-sm font-medium shadow-xs transition ${
              notice.type === "success"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : "bg-rose-50 text-rose-900 border border-rose-200"
            }`}
          >
            <div className="flex items-center gap-3">
              {notice.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <Info className="h-5 w-5 text-rose-600 shrink-0" />
              )}
              <span>{notice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 1. Main Navigation Tabs */}
        {!isViewMode && (
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("expense")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                activeTab === "expense"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <Receipt className="h-4 w-4" />
              <span>Record Expense</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("mileage")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                activeTab === "mileage"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <Gauge className="h-4 w-4" />
              <span>Record Mileage</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("bulk")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                activeTab === "bulk"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <Table className="h-4 w-4" />
              <span>Bulk Add Expenses</span>
            </button>
          </div>
        )}

        {/* TAB 1: RECORD EXPENSE */}
        {activeTab === "expense" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Primary Details Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="date"
                      disabled={isViewMode}
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Paid Through <span className="text-rose-500">*</span>
                  </label>
                  <select
                    disabled={isViewMode}
                    value={expensePaidThrough}
                    onChange={(e) => setExpensePaidThrough(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                  >
                    {paidThroughAccounts.map((acc) => (
                      <option key={acc} value={acc}>
                        {acc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Currency
                  </label>
                  <select
                    disabled={isViewMode}
                    value={expenseCurrency}
                    onChange={(e) => setExpenseCurrency(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                  >
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="AED">AED - UAE Dirham</option>
                  </select>
                </div>
              </div>

              {/* Itemized Expense Rows Table */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Expense Line Items
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">
                    Subtotal:{" "}
                    <strong className="text-slate-900 text-sm">
                      ₹{totalExpenseAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </strong>
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="px-4 py-3 w-12 text-center">#</th>
                        <th className="px-4 py-3 w-1/3">Expense Account *</th>
                        <th className="px-4 py-3">Notes / Description</th>
                        <th className="px-4 py-3 w-44">Amount (₹) *</th>
                        {!isViewMode && <th className="px-3 py-3 w-12 text-center"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-xs">
                      {expenseItems.map((item, index) => (
                        <tr key={item.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 text-center text-slate-400 font-mono">
                            {index + 1}
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              disabled={isViewMode}
                              value={item.expenseAccount}
                              onChange={(e) =>
                                handleUpdateExpenseRow(item.id, "expenseAccount", e.target.value)
                              }
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-blue-500"
                            >
                              {standardAccounts.map((acc) => (
                                <option key={acc} value={acc}>
                                  {acc}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              disabled={isViewMode}
                              placeholder="e.g. October logistics charges"
                              value={item.notes}
                              onChange={(e) =>
                                handleUpdateExpenseRow(item.id, "notes", e.target.value)
                              }
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                ₹
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                disabled={isViewMode}
                                placeholder="0.00"
                                value={item.amount}
                                onChange={(e) =>
                                  handleUpdateExpenseRow(item.id, "amount", e.target.value)
                                }
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-6 pr-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-blue-500"
                              />
                            </div>
                          </td>
                          {!isViewMode && (
                            <td className="px-3 py-2.5 text-center">
                              {expenseItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveExpenseRow(item.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 transition"
                                  title="Delete Line"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!isViewMode && (
                  <button
                    type="button"
                    onClick={handleAddExpenseRow}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-blue-600 hover:border-blue-400 hover:bg-blue-50/30 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add another line</span>
                  </button>
                )}
              </div>
            </div>

            {/* Associated Details & Receipt Card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Vendor & Customer */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Vendor & Bill Reference
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Vendor / Merchant
                    </label>
                    <input
                      type="text"
                      list="expense-vendors"
                      disabled={isViewMode}
                      placeholder="Select or enter vendor name"
                      value={expenseVendor}
                      onChange={(e) => setExpenseVendor(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                    />
                    <datalist id="expense-vendors">
                      {vendorsList.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Invoice / Receipt#
                      </label>
                      <input
                        type="text"
                        disabled={isViewMode}
                        placeholder="e.g. INV-98214"
                        value={expenseInvoiceNo}
                        onChange={(e) => setExpenseInvoiceNo(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Project / Cost Center
                      </label>
                      <input
                        type="text"
                        disabled={isViewMode}
                        placeholder="e.g. Q4 Expansion"
                        value={expenseProject}
                        onChange={(e) => setExpenseProject(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Customer Name (for billing)
                    </label>
                    <input
                      type="text"
                      list="expense-customers"
                      disabled={isViewMode}
                      placeholder="Assign to customer if billable"
                      value={expenseCustomer}
                      onChange={(e) => setExpenseCustomer(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                    />
                    <datalist id="expense-customers">
                      {customersList.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="expense-billable"
                      disabled={isViewMode}
                      checked={expenseBillable}
                      onChange={(e) => setExpenseBillable(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <label htmlFor="expense-billable" className="text-xs font-semibold text-slate-700 cursor-pointer">
                      Billable to customer (invoiceable)
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Receipt Upload */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Attach Receipts
                </h3>

                {!isViewMode && (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingExpense(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingExpense(false);
                    }}
                    onDrop={(e) => handleFileDrop(e, "expense")}
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 transition ${
                      isDraggingExpense
                        ? "border-blue-500 bg-blue-50/50 scale-[1.01]"
                        : "border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/20"
                    }`}
                  >
                    <label className="flex flex-col items-center justify-center cursor-pointer w-full text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100/60 text-blue-600 mb-2">
                        <UploadCloud className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-800">
                        Drag and drop receipt files here, or browse
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        PDF, JPG, PNG up to 10MB
                      </p>
                      <input
                        type="file"
                        multiple
                        onChange={(e) => handleFileInput(e, "expense")}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* Uploaded Receipts */}
                <div className="space-y-2">
                  {expenseReceipts.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      No receipts attached yet.
                    </p>
                  ) : (
                    expenseReceipts.map((rc) => (
                      <div
                        key={rc.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{rc.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {(rc.size / 1024).toFixed(1)} KB • {rc.uploadedAt}
                            </p>
                          </div>
                        </div>

                        {!isViewMode && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpenseReceipts((prev) => prev.filter((r) => r.id !== rc.id))
                            }
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RECORD MILEAGE */}
        {activeTab === "mileage" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Mileage Calculator Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Gauge className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Vehicle Mileage Calculator</h2>
                    <p className="text-xs text-slate-500">
                      Standard reimbursement: <strong className="text-slate-800">₹{preferences.rate.toFixed(2)}</strong> per {preferences.unit}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPrefModal(true)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Change Rate
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="date"
                      disabled={isViewMode}
                      value={mileageDate}
                      onChange={(e) => setMileageDate(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Employee / Driver <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={isViewMode}
                    placeholder="e.g. Rajesh Sharma"
                    value={mileageEmployee}
                    onChange={(e) => setMileageEmployee(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Paid Through
                  </label>
                  <select
                    disabled={isViewMode}
                    value={mileagePaidThrough}
                    onChange={(e) => setMileagePaidThrough(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {paidThroughAccounts.map((acc) => (
                      <option key={acc} value={acc}>
                        {acc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Calculation Method Toggle */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                <div className="flex items-center gap-6">
                  <span className="text-xs font-bold text-slate-800">Calculation Method:</span>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="calcMethod"
                      disabled={isViewMode}
                      checked={calcMethod === "distance"}
                      onChange={() => setCalcMethod("distance")}
                      className="text-blue-600"
                    />
                    <span>Distance Travelled</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="calcMethod"
                      disabled={isViewMode}
                      checked={calcMethod === "odometer"}
                      onChange={() => setCalcMethod("odometer")}
                      className="text-blue-600"
                    />
                    <span>Odometer Reading</span>
                  </label>
                </div>

                {calcMethod === "distance" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Distance ({preferences.unit}) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        disabled={isViewMode}
                        placeholder="0"
                        value={mileageDistance}
                        onChange={(e) => setMileageDistance(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mileage Rate (₹ / {preferences.unit})
                      </label>
                      <input
                        type="text"
                        disabled
                        value={`₹${preferences.rate.toFixed(2)}`}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Total Amount (Calculated)
                      </label>
                      <div className="h-10 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800">Reimbursement</span>
                        <span className="text-sm font-bold text-emerald-700">
                          ₹{totalMileageAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 animate-in fade-in">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Start Odometer ({preferences.unit})
                      </label>
                      <input
                        type="number"
                        min="0"
                        disabled={isViewMode}
                        placeholder="0"
                        value={startOdo}
                        onChange={(e) => setStartOdo(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        End Odometer ({preferences.unit})
                      </label>
                      <input
                        type="number"
                        min="0"
                        disabled={isViewMode}
                        placeholder="0"
                        value={endOdo}
                        onChange={(e) => setEndOdo(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Net Distance ({preferences.unit})
                      </label>
                      <input
                        type="text"
                        disabled
                        value={`${activeDistance} ${preferences.unit}`}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Total Claim (₹)
                      </label>
                      <div className="h-10 rounded-xl border border-emerald-200 bg-emerald-50 px-3 flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800">Total</span>
                        <span className="text-sm font-bold text-emerald-700">
                          ₹{totalMileageAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Associated Trip Details & Receipt */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Notes / Trip Description
                    </label>
                    <textarea
                      rows={3}
                      disabled={isViewMode}
                      placeholder="e.g. Travel to farmer fields in Nashik for commodity quality sampling"
                      value={mileageNotes}
                      onChange={(e) => setMileageNotes(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Fuel / Service Station
                      </label>
                      <input
                        type="text"
                        disabled={isViewMode}
                        placeholder="e.g. HP Petrol Pump"
                        value={mileageVendor}
                        onChange={(e) => setMileageVendor(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Trip / Invoice Ref#
                      </label>
                      <input
                        type="text"
                        disabled={isViewMode}
                        placeholder="e.g. TRIP-441"
                        value={mileageInvoiceNo}
                        onChange={(e) => setMileageInvoiceNo(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="mileage-billable"
                      disabled={isViewMode}
                      checked={mileageBillable}
                      onChange={(e) => setMileageBillable(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <label htmlFor="mileage-billable" className="text-xs font-semibold text-slate-700 cursor-pointer">
                      Billable to customer
                    </label>
                  </div>
                </div>

                {/* Receipt upload for mileage */}
                <div className="space-y-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Attach Toll / Fuel Slips
                  </label>
                  {!isViewMode && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingMileage(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingMileage(false);
                      }}
                      onDrop={(e) => handleFileDrop(e, "mileage")}
                      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 transition ${
                        isDraggingMileage
                          ? "border-blue-500 bg-blue-50/50 scale-[1.01]"
                          : "border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/20"
                      }`}
                    >
                      <label className="flex flex-col items-center justify-center cursor-pointer w-full text-center">
                        <UploadCloud className="h-6 w-6 text-blue-600 mb-1" />
                        <span className="text-xs font-semibold text-slate-800">
                          Drag and drop receipt files here, or browse
                        </span>
                        <span className="text-[11px] text-slate-400">PDF, JPG, PNG</span>
                        <input
                          type="file"
                          multiple
                          onChange={(e) => handleFileInput(e, "mileage")}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  <div className="space-y-2">
                    {mileageReceipts.map((rc) => (
                      <div
                        key={rc.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span className="text-xs font-semibold text-slate-800">{rc.name}</span>
                        </div>
                        {!isViewMode && (
                          <button
                            type="button"
                            onClick={() =>
                              setMileageReceipts((prev) => prev.filter((r) => r.id !== rc.id))
                            }
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BULK ADD EXPENSES */}
        {activeTab === "bulk" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Bulk Expense Entry Sheet</h2>
                  <p className="text-xs text-slate-500">
                    Quickly log multiple operating expenses in a spreadsheet grid with auto-calculation
                  </p>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  Total Bulk Expenses:{" "}
                  <span className="text-emerald-600 text-base">
                    ₹{totalBulkAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Spreadsheet Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-3 py-3 w-10 text-center">#</th>
                      <th className="px-3 py-3 min-w-[130px]">Date *</th>
                      <th className="px-3 py-3 min-w-[200px]">Expense Account *</th>
                      <th className="px-3 py-3 min-w-[120px]">Amount (₹) *</th>
                      <th className="px-3 py-3 min-w-[170px]">Paid Through</th>
                      <th className="px-3 py-3 min-w-[150px]">Vendor</th>
                      <th className="px-3 py-3 min-w-[140px]">Customer</th>
                      <th className="px-3 py-3 min-w-[120px]">Project</th>
                      <th className="px-3 py-3 text-center">Billable</th>
                      <th className="px-3 py-3 min-w-[120px]">Tags</th>
                      {!isViewMode && <th className="px-3 py-3 w-10 text-center"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-xs">
                    {bulkRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="date"
                            disabled={isViewMode}
                            value={row.date}
                            onChange={(e) => handleUpdateBulkRow(row.id, "date", e.target.value)}
                            className="w-full h-8 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            disabled={isViewMode}
                            value={row.expenseAccount}
                            onChange={(e) =>
                              handleUpdateBulkRow(row.id, "expenseAccount", e.target.value)
                            }
                            className="w-full h-8 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500"
                          >
                            {standardAccounts.map((acc) => (
                              <option key={acc} value={acc}>
                                {acc}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            disabled={isViewMode}
                            placeholder="0.00"
                            value={row.amount}
                            onChange={(e) => handleUpdateBulkRow(row.id, "amount", e.target.value)}
                            className="w-full h-8 rounded-lg border border-slate-200 px-2 text-xs font-semibold outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            disabled={isViewMode}
                            value={row.paidThrough}
                            onChange={(e) =>
                              handleUpdateBulkRow(row.id, "paidThrough", e.target.value)
                            }
                            className="w-full h-8 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500"
                          >
                            {paidThroughAccounts.map((acc) => (
                              <option key={acc} value={acc}>
                                {acc}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            disabled={isViewMode}
                            placeholder="Vendor Name"
                            value={row.vendor}
                            onChange={(e) => handleUpdateBulkRow(row.id, "vendor", e.target.value)}
                            className="w-full h-8 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            disabled={isViewMode}
                            placeholder="Customer Name"
                            value={row.customerName}
                            onChange={(e) =>
                              handleUpdateBulkRow(row.id, "customerName", e.target.value)
                            }
                            className="w-full h-8 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            disabled={isViewMode}
                            placeholder="Project"
                            value={row.project}
                            onChange={(e) => handleUpdateBulkRow(row.id, "project", e.target.value)}
                            className="w-full h-8 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            disabled={isViewMode}
                            checked={row.billable}
                            onChange={(e) =>
                              handleUpdateBulkRow(row.id, "billable", e.target.checked)
                            }
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            disabled={isViewMode}
                            placeholder="Tags"
                            value={row.reportingTags}
                            onChange={(e) =>
                              handleUpdateBulkRow(row.id, "reportingTags", e.target.value)
                            }
                            className="w-full h-8 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500"
                          />
                        </td>
                        {!isViewMode && (
                          <td className="px-2 py-2 text-center">
                            {bulkRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveBulkRow(row.id)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!isViewMode && (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleAddBulkRow}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-blue-600 hover:border-blue-400 hover:bg-blue-50/30 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Row</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sticky Footer Actions */}
        {!isViewMode && (
          <div className="sticky bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md px-6 py-3.5 shadow-lg lg:left-72">
            <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500 hidden sm:block">
                <span>
                  Active Mode: <strong className="text-slate-800 capitalize">{activeTab} Entry</strong> • Total:{" "}
                  <strong className="text-slate-900 font-bold">
                    ₹
                    {(activeTab === "expense"
                      ? totalExpenseAmount
                      : activeTab === "mileage"
                      ? totalMileageAmount
                      : totalBulkAmount
                    ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <Link
                  href="/purchases/expenses"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </Link>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>Save & Add New</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(false)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{mode === "edit" ? "Update Expense" : "Save Expense"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MILEAGE PREFERENCES MODAL */}
      {showPrefModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Gauge className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Mileage Preferences</h3>
                  <p className="text-xs text-slate-500">Configure vehicle rate and unit defaults</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrefModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePreferences} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Vehicle / Travel Category
                </label>
                <select
                  value={preferences.category}
                  onChange={(e) =>
                    setPreferences((prev) => ({ ...prev, category: e.target.value }))
                  }
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                >
                  <option value="Standard Business Travel">Standard Business Travel</option>
                  <option value="Commodity Field Inspection Vehicle">
                    Commodity Field Inspection Vehicle
                  </option>
                  <option value="Two Wheeler / Motorcycle Delivery">
                    Two Wheeler / Motorcycle Delivery
                  </option>
                  <option value="Heavy Freight / Truck Hauling">
                    Heavy Freight / Truck Hauling
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Distance Unit
                  </label>
                  <select
                    value={preferences.unit}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        unit: e.target.value as "KM" | "Mile",
                      }))
                    }
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="KM">Kilometers (KM)</option>
                    <option value="Mile">Miles</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Start Effective Date
                  </label>
                  <input
                    type="date"
                    value={preferences.startDate}
                    onChange={(e) =>
                      setPreferences((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mileage Rate (₹ / {preferences.unit}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.25"
                    required
                    value={preferences.rate}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        rate: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs font-semibold text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPrefModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPrefs}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition disabled:opacity-50"
                >
                  {savingPrefs ? "Saving..." : "Save Preferences"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
