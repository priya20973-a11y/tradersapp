"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  Tag,
  User,
  Users,
  X,
  AlertCircle,
} from "lucide-react";

export const standardExpenseAccounts = [
  "Rent & Lease Expense",
  "Software & Technology Subscriptions",
  "Security Services",
  "Warehouse & Storage Maintenance",
  "Freight & Shipping Charges",
  "Utilities - Electricity & Water",
  "Quality Inspection & Testing Fees",
  "Advertising & Marketing",
  "Office Supplies & Stationery",
  "Legal & Professional Charges",
  "Telephone & Internet Charges",
  "Vehicle Fuel & Running Expenses",
  "Repairs & Maintenance",
  "Bank & Financial Charges",
  "Travel & Conveyance",
  "Meals & Entertainment",
];

export const paidThroughAccountsList = [
  "HDFC Primary Bank",
  "ICICI Operational Bank",
  "Petty Cash Account",
  "State Bank of India (Current)",
  "Company Corporate Card",
  "Employee Personal Funds (Reimbursable)",
];

export const currenciesList = [
  { code: "INR", symbol: "₹", label: "INR (₹)" },
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
  { code: "GBP", symbol: "£", label: "GBP (£)" },
  { code: "AED", symbol: "د.إ", label: "AED (د.إ)" },
];

export const repeatFrequencies = [
  { label: "Week", value: "Week", daysDescription: "Every 7 days" },
  { label: "2 Weeks", value: "2 Weeks", daysDescription: "Every 14 days" },
  { label: "Month", value: "Month", daysDescription: "Every month on the same day" },
  { label: "2 Months", value: "2 Months", daysDescription: "Every 2 months" },
  { label: "3 Months", value: "3 Months", daysDescription: "Every quarter" },
  { label: "6 Months", value: "6 Months", daysDescription: "Twice a year" },
  { label: "Year", value: "Year", daysDescription: "Annually on the same date" },
];

export const suggestedTags = [
  "Lease",
  "HQ",
  "Warehouse",
  "Operations",
  "IT & Cloud",
  "Security",
  "Logistics",
  "Compliance",
  "Tax Deductible",
  "Administrative",
];

export function calculateNextScheduledDate(startDateStr: string, repeatEvery: string): string {
  if (!startDateStr) return "";
  const d = new Date(startDateStr);
  if (isNaN(d.getTime())) return "";

  const next = new Date(d);
  switch (repeatEvery) {
    case "Week":
      next.setDate(next.getDate() + 7);
      break;
    case "2 Weeks":
      next.setDate(next.getDate() + 14);
      break;
    case "Month":
      next.setMonth(next.getMonth() + 1);
      break;
    case "2 Months":
      next.setMonth(next.getMonth() + 2);
      break;
    case "3 Months":
      next.setMonth(next.getMonth() + 3);
      break;
    case "6 Months":
      next.setMonth(next.getMonth() + 6);
      break;
    case "Year":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString().split("T")[0];
}

export function formatDateLocale(dateStr: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    // Return DD/MM/YYYY
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDatePretty(dateStr: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface RecurringExpenseData {
  _id?: string;
  id?: string;
  profileName: string;
  repeatEvery: string;
  startDate: string;
  endsOn: string;
  neverExpires: boolean;
  nextDate?: string;
  expenseAccount: string;
  amount: number | string;
  currency: string;
  paidThrough: string;
  vendor: string;
  notes: string;
  customerName: string;
  reportingTags: string[];
  status?: string;
}

interface RecurringExpenseFormProps {
  initialData?: RecurringExpenseData;
  mode?: "create" | "edit";
  id?: string;
  onSaved?: (saved: RecurringExpenseData) => void;
  onCancel?: () => void;
}

export function RecurringExpenseForm({
  initialData,
  mode = "create",
  id,
  onSaved,
  onCancel,
}: RecurringExpenseFormProps) {
  const router = useRouter();

  // Form fields
  const [profileName, setProfileName] = useState(initialData?.profileName || "");
  const [repeatEvery, setRepeatEvery] = useState(initialData?.repeatEvery || "Week");
  const [startDate, setStartDate] = useState(
    initialData?.startDate || new Date().toISOString().split("T")[0],
  );
  const [endsOn, setEndsOn] = useState(initialData?.endsOn || "");
  const [neverExpires, setNeverExpires] = useState(
    initialData ? Boolean(initialData.neverExpires) : true,
  );
  const [expenseAccount, setExpenseAccount] = useState(initialData?.expenseAccount || "");
  const [amount, setAmount] = useState(initialData?.amount?.toString() || "");
  const [currency, setCurrency] = useState(initialData?.currency || "INR");
  const [paidThrough, setPaidThrough] = useState(initialData?.paidThrough || "HDFC Primary Bank");
  const [vendor, setVendor] = useState(initialData?.vendor || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [customerName, setCustomerName] = useState(initialData?.customerName || "");
  const [reportingTags, setReportingTags] = useState<string[]>(
    initialData?.reportingTags || [],
  );
  const [status, setStatus] = useState(initialData?.status || "Active");

  // Auxiliary UI state
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState("");
  const [serverError, setServerError] = useState("");

  // Vendor & Customer Modal Search
  const [vendorsList, setVendorsList] = useState<string[]>([
    "IndoSpace Properties",
    "TechFlow Systems",
    "Sentinel Security Services",
    "Shree Packaging",
    "Metro Logistics",
    "Kaveri Agro Industries",
    "Mohan Traders",
    "Apex Freight Solutions",
  ]);
  const [customersList] = useState<string[]>([
    "Astra Foods",
    "City Retail",
    "Ganga Stores",
    "Bharat Commodities",
    "Agro Traders Co.",
  ]);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorSearchQuery, setVendorSearchQuery] = useState("");
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");

  // Fetch profile if id is provided without initialData (direct route access)
  useEffect(() => {
    if (!id || initialData) return;
    let active = true;
    fetch(`/api/purchases/recurring-expenses/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.profile) return;
        const p = data.profile;
        setProfileName(p.profileName || "");
        setRepeatEvery(p.repeatEvery || "Month");
        setStartDate(p.startDate || "");
        setEndsOn(p.endsOn || "");
        setNeverExpires(Boolean(p.neverExpires));
        setExpenseAccount(p.expenseAccount || "");
        setAmount(p.amount ? String(p.amount) : "");
        setCurrency(p.currency || "INR");
        setPaidThrough(p.paidThrough || "HDFC Primary Bank");
        setVendor(p.vendor || "");
        setNotes(p.notes || "");
        setCustomerName(p.customerName || "");
        setReportingTags(p.reportingTags || []);
        setStatus(p.status || "Active");
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [id, initialData]);

  // Fetch real vendors if available
  useEffect(() => {
    let active = true;
    fetch("/api/vendors")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.vendors) return;
        const names = data.vendors
          .map((v: { displayName?: string; companyName?: string }) => v.displayName || v.companyName)
          .filter(Boolean);
        if (names.length > 0) {
          setVendorsList((prev) => Array.from(new Set([...names, ...prev])));
        }
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  // Compute Next Expense Date dynamically
  const nextScheduledDate = useMemo(() => {
    return calculateNextScheduledDate(startDate, repeatEvery);
  }, [startDate, repeatEvery]);

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!profileName.trim()) {
      newErrors.profileName = "Profile Name is required";
    }
    if (!repeatEvery) {
      newErrors.repeatEvery = "Frequency is required";
    }
    if (!startDate) {
      newErrors.startDate = "Start Date is required";
    }
    if (!neverExpires && endsOn) {
      if (new Date(endsOn) < new Date(startDate)) {
        newErrors.endsOn = "End date cannot be earlier than start date";
      }
    }
    if (!expenseAccount.trim()) {
      newErrors.expenseAccount = "Expense Account is required";
    }
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      newErrors.amount = "Please enter a valid amount greater than 0";
    }
    if (!paidThrough.trim()) {
      newErrors.paidThrough = "Paid Through account is required";
    }
    if (notes.length > 500) {
      newErrors.notes = "Notes cannot exceed 500 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;
    if (!reportingTags.includes(trimmed)) {
      setReportingTags([...reportingTags, trimmed]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setReportingTags(reportingTags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setSuccessNotice("");

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const payload = {
      profileName: profileName.trim(),
      repeatEvery,
      startDate,
      endsOn: neverExpires ? "" : endsOn,
      neverExpires,
      nextDate: nextScheduledDate,
      expenseAccount,
      amount: parseFloat(amount),
      currency,
      paidThrough,
      vendor: vendor.trim(),
      notes: notes.trim(),
      customerName: customerName.trim(),
      reportingTags,
      status,
    };

    try {
      const endpoint =
        mode === "edit" && id
          ? `/api/purchases/recurring-expenses/${id}`
          : "/api/purchases/recurring-expenses";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save recurring expense");
      }

      const savedRecord = data.recurringExpense || data.profile || { ...payload, id };
      setSuccessNotice(
        mode === "edit"
          ? "Recurring expense profile updated successfully!"
          : "Recurring expense profile created successfully!",
      );

      if (onSaved) {
        onSaved(savedRecord);
      } else {
        setTimeout(() => {
          router.push("/purchases/recurring-expenses");
        }, 800);
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/purchases/recurring-expenses");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            title="Back to Recurring Expenses"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                <RotateCw className="h-3 w-3" />
                Purchases Automation
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-medium text-slate-500">
                {mode === "edit" ? "Edit Profile" : "New Profile"}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {mode === "edit"
                ? `Edit: ${profileName || "Recurring Expense"}`
                : "New Recurring Expense"}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Schedule repeating operational expenses to be recorded automatically.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Save Recurring Expense
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successNotice && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="font-medium">{successNotice}</p>
        </div>
      )}
      {serverError && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <p className="font-medium">{serverError}</p>
        </div>
      )}

      {/* Form Content: Modern Card Layout (Two columns on desktop, one column on mobile) */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Column 1: Recurrence Details */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Recurrence Details</h2>
                <p className="text-xs text-slate-500">
                  Set the schedule, repetition rule, and active duration
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Profile Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Profile Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => {
                    setProfileName(e.target.value);
                    if (errors.profileName) setErrors({ ...errors, profileName: "" });
                  }}
                  placeholder="e.g. Warehouse Lease - Unit B"
                  className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                    errors.profileName
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10"
                      : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/10"
                  }`}
                />
                {errors.profileName && (
                  <p className="mt-1 text-xs text-rose-600">{errors.profileName}</p>
                )}
              </div>

              {/* Repeat Every */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Repeat Every <span className="text-rose-500">*</span>
                </label>
                <select
                  value={repeatEvery}
                  onChange={(e) => setRepeatEvery(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                >
                  {repeatFrequencies.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label} ({f.daysDescription})
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date & Next Date Live Banner */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Start Date</label>
                <div className="relative mt-1.5">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (errors.startDate) setErrors({ ...errors, startDate: "" });
                    }}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                      errors.startDate
                        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10"
                        : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/10"
                    }`}
                  />
                </div>
                {errors.startDate && (
                  <p className="mt-1 text-xs text-rose-600">{errors.startDate}</p>
                )}

                {/* Next scheduled expense date highlight - exactly as shown in screenshot */}
                {nextScheduledDate && (
                  <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-900">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                    <span>
                      The recurring expense will be created on{" "}
                      <strong className="font-semibold text-blue-700">
                        {formatDateLocale(nextScheduledDate)}
                      </strong>{" "}
                      ({formatDatePretty(nextScheduledDate)})
                    </span>
                  </div>
                )}
              </div>

              {/* Ends On and Never Expires Checkbox */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Ends On</label>
                <input
                  type="date"
                  value={endsOn}
                  disabled={neverExpires}
                  onChange={(e) => {
                    setEndsOn(e.target.value);
                    if (errors.endsOn) setErrors({ ...errors, endsOn: "" });
                  }}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
                    errors.endsOn
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10"
                      : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/10"
                  }`}
                />
                {errors.endsOn && (
                  <p className="text-xs text-rose-600">{errors.endsOn}</p>
                )}

                {/* Never Expires checkbox */}
                <label className="flex cursor-pointer items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={neverExpires}
                    onChange={(e) => {
                      setNeverExpires(e.target.checked);
                      if (e.target.checked) setEndsOn("");
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 accent-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-slate-700 select-none">
                    Never Expires
                  </span>
                  <span className="text-[11px] text-slate-400">
                    (Expense will repeat indefinitely until paused)
                  </span>
                </label>
              </div>

              {/* Expense Account */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Expense Account <span className="text-rose-500">*</span>
                </label>
                <select
                  value={expenseAccount}
                  onChange={(e) => {
                    setExpenseAccount(e.target.value);
                    if (errors.expenseAccount) setErrors({ ...errors, expenseAccount: "" });
                  }}
                  className={`mt-1.5 w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                    errors.expenseAccount
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10"
                      : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/10"
                  }`}
                >
                  <option value="">Select an account</option>
                  {standardExpenseAccounts.map((acc) => (
                    <option key={acc} value={acc}>
                      {acc}
                    </option>
                  ))}
                </select>
                {errors.expenseAccount && (
                  <p className="mt-1 text-xs text-rose-600">{errors.expenseAccount}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Expense Details & Additional Information */}
        <div className="space-y-6">
          {/* Card: Expense Details */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Expense Details</h2>
                <p className="text-xs text-slate-500">
                  Transaction amount, disbursement source, and vendor
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Amount with Currency Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Amount <span className="text-rose-500">*</span>
                </label>
                <div className="mt-1.5 flex rounded-xl border border-slate-300 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="rounded-l-xl border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none"
                  >
                    {currenciesList.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      if (errors.amount) setErrors({ ...errors, amount: "" });
                    }}
                    placeholder="0.00"
                    className="w-full rounded-r-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
                {errors.amount && <p className="mt-1 text-xs text-rose-600">{errors.amount}</p>}
              </div>

              {/* Paid Through Account */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Paid Through <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paidThrough}
                  onChange={(e) => {
                    setPaidThrough(e.target.value);
                    if (errors.paidThrough) setErrors({ ...errors, paidThrough: "" });
                  }}
                  className={`mt-1.5 w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                    errors.paidThrough
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10"
                      : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/10"
                  }`}
                >
                  <option value="">Select an account</option>
                  {paidThroughAccountsList.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {errors.paidThrough && (
                  <p className="mt-1 text-xs text-rose-600">{errors.paidThrough}</p>
                )}
              </div>

              {/* Vendor with Search */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Vendor</label>
                <div className="mt-1.5 flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      list="vendor-options"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      placeholder="Select or enter vendor name"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    />
                    <datalist id="vendor-options">
                      {vendorsList.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVendorModalOpen(true)}
                    className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-3.5 py-2.5 text-white shadow-sm transition hover:bg-blue-700"
                    title="Search Vendors"
                    aria-label="Search Vendors"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">Notes</label>
                  <span
                    className={`text-[11px] ${
                      notes.length > 500 ? "font-bold text-rose-600" : "text-slate-400"
                    }`}
                  >
                    {notes.length} / 500 characters
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Max. 500 characters"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            </div>
          </div>

          {/* Card: Additional Information */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Tag className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Additional Information</h2>
                <p className="text-xs text-slate-500">
                  Assign customer reference and accounting reporting tags
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Customer Name with Search */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Customer Name</label>
                <div className="mt-1.5 flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      list="customer-options"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Select or enter customer name"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    />
                    <datalist id="customer-options">
                      {customersList.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomerModalOpen(true)}
                    className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-3.5 py-2.5 text-white shadow-sm transition hover:bg-blue-700"
                    title="Search Customers"
                    aria-label="Search Customers"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Reporting Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Reporting Tags</label>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {reportingTags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                    >
                      <Tag className="h-3 w-3" />
                      {t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="rounded hover:text-blue-900"
                        title="Remove tag"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag(tagInput);
                      }
                    }}
                    placeholder="Type a tag & press Enter"
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag(tagInput)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>

                {/* Quick Tag Recommendations */}
                <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                  <span className="font-medium text-slate-400">Suggestions:</span>
                  {suggestedTags
                    .filter((st) => !reportingTags.includes(st))
                    .slice(0, 5)
                    .map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleAddTag(st)}
                        className="rounded bg-slate-100 px-2 py-0.5 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        + {st}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Full-width Schedule Summary Card */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/60 via-slate-50/70 to-blue-50/40 p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <RotateCw className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                    Execution Summary
                  </p>
                  <p className="mt-0.5 text-sm text-slate-700">
                    {amount && parseFloat(amount) > 0 ? (
                      <>
                        <strong className="font-semibold text-slate-900">
                          {currency} {parseFloat(amount).toLocaleString("en-IN")}
                        </strong>{" "}
                        will be recorded to{" "}
                        <strong className="font-semibold text-slate-900">
                          {expenseAccount || "[Expense Account]"}
                        </strong>{" "}
                        paid via{" "}
                        <strong className="font-semibold text-slate-900">{paidThrough}</strong> every{" "}
                        <strong className="font-semibold text-blue-700">{repeatEvery}</strong>.
                      </>
                    ) : (
                      "Complete profile name, frequency, account, and amount to preview automated schedule."
                    )}
                  </p>
                </div>
              </div>

              {nextScheduledDate && (
                <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span>
                    Next run:{" "}
                    <strong className="font-semibold text-blue-700">
                      {formatDateLocale(nextScheduledDate)}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-2 lg:col-span-2">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Save Recurring Expense
              </>
            )}
          </button>
        </div>
      </form>

      {/* Vendor Search Modal */}
      {vendorModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
          onClick={() => setVendorModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">Select Vendor</h3>
              </div>
              <button
                type="button"
                onClick={() => setVendorModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={vendorSearchQuery}
                  onChange={(e) => setVendorSearchQuery(e.target.value)}
                  placeholder="Search vendors..."
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="mt-3 max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                {vendorsList
                  .filter((v) =>
                    v.toLowerCase().includes(vendorSearchQuery.toLowerCase().trim()),
                  )
                  .map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setVendor(v);
                        setVendorModalOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      <span className="font-medium">{v}</span>
                      {vendor === v && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                    </button>
                  ))}
                {vendorsList.filter((v) =>
                  v.toLowerCase().includes(vendorSearchQuery.toLowerCase().trim()),
                ).length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No vendor matches found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Search Modal */}
      {customerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
          onClick={() => setCustomerModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">Select Customer</h3>
              </div>
              <button
                type="button"
                onClick={() => setCustomerModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  placeholder="Search customers..."
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="mt-3 max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                {customersList
                  .filter((c) =>
                    c.toLowerCase().includes(customerSearchQuery.toLowerCase().trim()),
                  )
                  .map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCustomerName(c);
                        setCustomerModalOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      <span className="font-medium">{c}</span>
                      {customerName === c && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                    </button>
                  ))}
                {customersList.filter((c) =>
                  c.toLowerCase().includes(customerSearchQuery.toLowerCase().trim()),
                ).length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No customer matches found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
