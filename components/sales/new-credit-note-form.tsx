"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Calculator,
  HelpCircle,
  Info,
  Layers,
  Loader2,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import {
  ConfigureCnNumberModal,
  type CreditNotePreferencesData,
} from "./configure-cn-number-modal";
import {
  formatCreditNoteNumber,
} from "@/lib/credit-note-numbering";

export interface ItemRow {
  id: string;
  itemId?: string;
  name: string;
  description: string;
  account: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface CustomerOption {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  gstin?: string;
}

interface ProductItemOption {
  id: string;
  name: string;
  sku?: string;
  salesPrice?: number;
  description?: string;
}

const ACCOUNT_OPTIONS = [
  "Sales",
  "Sales Returns",
  "Discount Allowed",
  "General Income",
  "Other Charges",
  "Consulting Income",
  "Cost of Goods Sold",
  "Service Income",
];

const TDS_OPTIONS = [
  { label: "1% TDS (Sec 194C - Contractor Indiv)", rate: 1 },
  { label: "2% TDS (Sec 194C - Contractor Corp)", rate: 2 },
  { label: "5% TDS (Sec 194I - Rent Plant/Machinery)", rate: 5 },
  { label: "10% TDS (Sec 194J - Professional/Technical)", rate: 10 },
  { label: "0.1% TDS (Sec 194Q - Purchase of Goods)", rate: 0.1 },
];

const TCS_OPTIONS = [
  { label: "0.075% TCS (Sec 206C(1H) - Sale of Goods)", rate: 0.075 },
  { label: "0.1% TCS (Sec 206C(1H) - Standard)", rate: 0.1 },
  { label: "1% TCS (Sale of Motor Vehicle / Minerals)", rate: 1 },
  { label: "5% TCS (Foreign Remittance)", rate: 5 },
];

export interface CreditNoteFormInitialData {
  id?: string;
  customerId?: string;
  creditNoteNumber?: string;
  number?: string;
  referenceNumber?: string;
  creditNoteDate?: string;
  issueDate?: string;
  accountsReceivable?: string;
  salesperson?: string;
  subject?: string;
  items?: Array<{
    itemId?: string;
    name?: string;
    description?: string;
    account?: string;
    quantity?: number;
    rate?: number;
  }>;
  discount?: number;
  discountType?: "percent" | "amount";
  tdsTcsType?: "TDS" | "TCS" | "None";
  tdsTcsRate?: number;
  adjustment?: number;
  customerNotes?: string;
  termsAndConditions?: string;
}

interface NewCreditNoteFormProps {
  initialData?: CreditNoteFormInitialData;
  isEditMode?: boolean;
}

export function NewCreditNoteForm({
  initialData,
  isEditMode = false,
}: NewCreditNoteFormProps) {
  const router = useRouter();

  // Master data
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [itemsList, setItemsList] = useState<ProductItemOption[]>([]);

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSearch, setBulkSearch] = useState("");
  const [selectedBulkIds, setSelectedBulkIds] = useState<Record<string, number>>({});

  // Settings
  const [settings, setSettings] = useState<CreditNotePreferencesData | null>(null);

  // Form Fields
  const resolvedInitialData = initialData ?? {};

  const [customerId, setCustomerId] = useState(String(resolvedInitialData.customerId || ""));
  const [creditNoteNumber, setCreditNoteNumber] = useState(
    String(resolvedInitialData.creditNoteNumber || resolvedInitialData.number || "CN-00002"),
  );
  const [referenceNumber, setReferenceNumber] = useState(
    String(resolvedInitialData.referenceNumber || ""),
  );
  const [creditNoteDate, setCreditNoteDate] = useState(() => {
    if (resolvedInitialData.creditNoteDate || resolvedInitialData.issueDate) {
      const d = new Date(String(resolvedInitialData.creditNoteDate || resolvedInitialData.issueDate));
      return !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
  });
  const [accountsReceivable, setAccountsReceivable] = useState(
    String(resolvedInitialData.accountsReceivable || "Accounts Receivable"),
  );
  const [salesperson, setSalesperson] = useState(String(resolvedInitialData.salesperson || ""));
  const [subject, setSubject] = useState(String(resolvedInitialData.subject || ""));

  // Items
  const [items, setItems] = useState<ItemRow[]>(() => {
    if (Array.isArray(resolvedInitialData.items) && resolvedInitialData.items.length > 0) {
      return resolvedInitialData.items.map((it, idx: number) => ({
        id: `row-${idx + 1}`,
        itemId: it.itemId ? String(it.itemId) : undefined,
        name: String(it.name || ""),
        description: String(it.description || ""),
        account: String(it.account || "Sales"),
        quantity: Number(it.quantity || 1),
        rate: Number(it.rate || 0),
        amount: Math.round(Number(it.quantity || 1) * Number(it.rate || 0) * 100) / 100,
      }));
    }
    return [
      {
        id: "row-1",
        name: "",
        description: "",
        account: "Sales",
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ];
  });

  // Discount & Tax Calculations
  const [discountVal, setDiscountVal] = useState<string>(
    resolvedInitialData.discount !== undefined ? String(resolvedInitialData.discount) : "0",
  );
  const [discountType, setDiscountType] = useState<"percent" | "amount">(
    resolvedInitialData.discountType || "percent",
  );
  const [taxMode, setTaxMode] = useState<"TDS" | "TCS">(
    resolvedInitialData.tdsTcsType === "TCS" ? "TCS" : "TDS",
  );
  const [selectedTaxRate, setSelectedTaxRate] = useState<number>(
    resolvedInitialData.tdsTcsRate !== undefined ? Number(resolvedInitialData.tdsTcsRate) : 0,
  );
  const [adjustmentStr, setAdjustmentStr] = useState<string>(
    resolvedInitialData.adjustment !== undefined ? String(resolvedInitialData.adjustment) : "0",
  );

  // Notes & Terms
  const [customerNotes, setCustomerNotes] = useState(
    resolvedInitialData.customerNotes || "",
  );
  const [termsAndConditions, setTermsAndConditions] = useState(
    resolvedInitialData.termsAndConditions || "",
  );

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load master data on mount
  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetch("/api/sales?section=customers").then((r) => (r.ok ? r.json() : { customers: [] })),
      fetch("/api/items").then((r) => (r.ok ? r.json() : { items: [] })),
      fetch("/api/sales/credit-notes/preferences").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([custData, itemsData, prefData]) => {
        if (!isMounted) return;

        const custOptions: CustomerOption[] = (custData.customers || []).map((c: Record<string, unknown>) => ({
          id: String(c.id || c._id || ""),
          name: String(c.name || ""),
          companyName: String(c.companyName || ""),
          email: String(c.email || ""),
          phone: String(c.phone || c.mobile || ""),
          gstin: String(c.gstin || ""),
        }));
        setCustomers(custOptions);

        const prodOptions: ProductItemOption[] = (itemsData.items || []).map((i: Record<string, unknown>) => ({
          id: String(i.id || i.sku || ""),
          name: String(i.name || ""),
          sku: typeof i.sku === "string" ? i.sku : undefined,
          salesPrice: Number(i.salesPrice || 0),
          description: String(i.salesDescription || ""),
        }));
        setItemsList(prodOptions);

        const pref = (prefData?.preferences || prefData?.settings) as Record<string, unknown> | undefined;
        if (pref) {
          const prefObj = prefData as Record<string, unknown> | null;
          const normalized: CreditNotePreferencesData = {
            autoGenerateNumbering: pref.autoGenerateNumbering !== false,
            prefix: String(pref.prefix || pref.creditNotePrefix || "CN-"),
            nextNumber: Number(pref.nextNumber || 2),
            numberZeroPadding: Number(pref.numberZeroPadding || 5),
            restartNumberingEachFiscalYear: Boolean(pref.restartNumberingEachFiscalYear),
            lastFiscalYear: pref.lastFiscalYear as string | undefined,
            formattedNextNumber: prefObj?.formattedNextNumber as string | undefined,
          };
          setSettings(normalized);
          if (!isEditMode && !initialData?.number && !initialData?.creditNoteNumber) {
            setCreditNoteNumber(
              (prefObj?.formattedNextNumber as string) ||
                formatCreditNoteNumber(
                  normalized.prefix,
                  normalized.nextNumber,
                  normalized.numberZeroPadding,
                ),
            );
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load initial credit note data:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isEditMode, initialData]);

  // Handle settings update from modal
  const handleSettingsSaved = (updated: CreditNotePreferencesData) => {
    setSettings(updated);
    if (!isEditMode && updated.autoGenerateNumbering !== false) {
      setCreditNoteNumber(
        updated.formattedNextNumber ||
          formatCreditNoteNumber(
            updated.prefix,
            updated.nextNumber,
            updated.numberZeroPadding,
          ),
      );
    }
  };

  // Calculations
  const subTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountVal) || 0;
    if (val <= 0) return 0;
    if (discountType === "percent") {
      return Math.round(((subTotal * val) / 100) * 100) / 100;
    }
    return Math.min(subTotal, val);
  }, [subTotal, discountVal, discountType]);

  const taxableAmount = Math.max(0, subTotal - discountAmount);

  const taxAmount = useMemo(() => {
    if (selectedTaxRate <= 0) return 0;
    return Math.round(((taxableAmount * selectedTaxRate) / 100) * 100) / 100;
  }, [taxableAmount, selectedTaxRate]);

  const adjustment = useMemo(() => {
    const val = parseFloat(adjustmentStr);
    return isNaN(val) ? 0 : val;
  }, [adjustmentStr]);

  const grandTotal = useMemo(() => {
    let tot = taxableAmount + adjustment;
    if (taxMode === "TCS") {
      tot += taxAmount;
    } else if (taxMode === "TDS") {
      tot -= taxAmount;
    }
    return Math.max(0, Math.round(tot * 100) / 100);
  }, [taxableAmount, adjustment, taxMode, taxAmount]);

  // Row Manipulation
  const handleItemChange = (rowId: string, field: keyof ItemRow, value: string | number) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const updated = { ...row, [field]: value };
        if (field === "quantity" || field === "rate") {
          const qty = field === "quantity" ? Math.max(0, parseFloat(String(value)) || 0) : row.quantity;
          const rate = field === "rate" ? Math.max(0, parseFloat(String(value)) || 0) : row.rate;
          updated.amount = Math.round(qty * rate * 100) / 100;
        }
        return updated;
      }),
    );
  };

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${prev.length + 1}`,
        name: "",
        description: "",
        account: "Sales",
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (items.length <= 1) {
      setItems([
        {
          id: `row-${Date.now()}`,
          name: "",
          description: "",
          account: "Sales",
          quantity: 1,
          rate: 0,
          amount: 0,
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Bulk Items Add
  const handleConfirmBulkAdd = () => {
    const entries = Object.entries(selectedBulkIds).filter(([, qty]) => qty > 0);
    if (entries.length === 0) {
      setShowBulkModal(false);
      return;
    }

    const newRows: ItemRow[] = [];
    for (const [prodId, qty] of entries) {
      const prod = itemsList.find((p) => p.id === prodId);
      if (prod) {
        newRows.push({
          id: `row-bulk-${Date.now()}-${prod.id}`,
          itemId: prod.id,
          name: prod.name,
          description: prod.description || "",
          account: "Sales",
          quantity: qty,
          rate: prod.salesPrice || 0,
          amount: Math.round(qty * (prod.salesPrice || 0) * 100) / 100,
        });
      }
    }

    // Filter out initial empty row if it hasn't been touched
    const cleanCurrent = items.filter((r) => r.name.trim() !== "" || r.rate > 0);
    setItems([...cleanCurrent, ...newRows]);
    setSelectedBulkIds({});
    setShowBulkModal(false);
  };

  // Form Submit
  const handleSubmit = async (targetStatus: "Draft" | "Open") => {
    setError(null);

    if (!customerId) {
      setError("Please select a customer.");
      return;
    }

    if (!creditNoteNumber.trim()) {
      setError("Credit Note Number is required.");
      return;
    }

    const validItems = items.filter((it) => it.name.trim() !== "");
    if (validItems.length === 0) {
      setError("Please add at least one item with a name or description.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerId,
        creditNoteNumber: creditNoteNumber.trim(),
        autoGenerateNumbering: settings ? settings.autoGenerateNumbering !== false : true,
        referenceNumber: referenceNumber.trim(),
        creditNoteDate,
        accountsReceivable,
        salesperson,
        subject,
        status: targetStatus,
        items: validItems.map((it) => ({
          itemId: it.itemId,
          name: it.name,
          description: it.description,
          account: it.account,
          quantity: it.quantity,
          rate: it.rate,
        })),
        discount: parseFloat(discountVal) || 0,
        discountType,
        tdsTcsType: selectedTaxRate > 0 ? taxMode : "None",
        tdsTcsRate: selectedTaxRate,
        adjustment,
        customerNotes,
        termsAndConditions,
      };

      const endpoint = isEditMode && resolvedInitialData.id
        ? `/api/sales/credit-notes/${resolvedInitialData.id}`
        : `/api/sales/credit-notes`;
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save credit note.");
      }

      router.push(`/sales/credit-notes`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save credit note.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-28">
      {/* Configure Number Modal */}
      <ConfigureCnNumberModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        currentSettings={settings}
        onSaved={handleSettingsSaved}
      />

      {/* Bulk Items Modal */}
      {showBulkModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">Add Items in Bulk</h3>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search items by name or SKU…"
                  value={bulkSearch}
                  onChange={(e) => setBulkSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {itemsList
                .filter(
                  (i) =>
                    !bulkSearch ||
                    i.name.toLowerCase().includes(bulkSearch.toLowerCase()) ||
                    (i.sku && i.sku.toLowerCase().includes(bulkSearch.toLowerCase())),
                )
                .map((prod) => {
                  const qty = selectedBulkIds[prod.id] || 0;
                  return (
                    <div
                      key={prod.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{prod.name}</p>
                        <p className="text-xs text-slate-500">
                          {prod.sku ? `SKU: ${prod.sku} • ` : ""}Rate: ₹
                          {(prod.salesPrice || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">Qty:</label>
                        <input
                          type="number"
                          min="0"
                          value={qty || ""}
                          placeholder="0"
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setSelectedBulkIds((prev) => ({ ...prev, [prod.id]: val }));
                          }}
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkAdd}
                className="px-5 py-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
              >
                Add Selected Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Card */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/sales/credit-notes"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </Link>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            {isEditMode ? "Edit Credit Note" : "New Credit Note"}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-xs">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Document Details Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          {/* Row 1: Customer Name */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <label className="text-xs font-semibold text-rose-600">
              Customer Name*
            </label>
            <div className="md:col-span-3 flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                >
                  <option value="">Select or add a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName ? `${c.companyName} (${c.name})` : c.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Focus customer select
                  const el = document.querySelector("select");
                  el?.focus();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer shrink-0"
                title="Search or select customer"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Row 2: Credit Note# */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <label className="text-xs font-semibold text-rose-600">
              Credit Note#*
            </label>
            <div className="md:col-span-3 flex items-center gap-2">
              <input
                type="text"
                value={creditNoteNumber}
                onChange={(e) => setCreditNoteNumber(e.target.value)}
                placeholder="CN-00002"
                className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs sm:text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-blue-600 hover:bg-blue-50 transition cursor-pointer shrink-0"
                title="Configure Credit Note# Preferences"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Row 3: Reference# */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <label className="text-xs font-semibold text-slate-700">
              Reference#
            </label>
            <div className="md:col-span-3">
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder=""
                className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          {/* Row 4: Credit Note Date */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <label className="text-xs font-semibold text-rose-600">
              Credit Note Date*
            </label>
            <div className="md:col-span-3">
              <input
                type="date"
                value={creditNoteDate}
                onChange={(e) => setCreditNoteDate(e.target.value)}
                className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          {/* Row 5: Accounts Receivable */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <div className="flex items-center gap-1">
              <label className="text-xs font-semibold text-slate-700">
                Accounts Receivable
              </label>
              <span
                className="text-slate-400 hover:text-slate-600 cursor-help"
                title="Account representing balance due from customers."
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="md:col-span-3">
              <select
                value={accountsReceivable}
                onChange={(e) => setAccountsReceivable(e.target.value)}
                className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              >
                <option value="Accounts Receivable">Accounts Receivable</option>
                <option value="Trade Debtors">Trade Debtors</option>
                <option value="Customer Credits">Customer Credits</option>
              </select>
            </div>
          </div>

          {/* Row 6: Salesperson */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <label className="text-xs font-semibold text-slate-700">
              Salesperson
            </label>
            <div className="md:col-span-3">
              <input
                type="text"
                value={salesperson}
                onChange={(e) => setSalesperson(e.target.value)}
                placeholder="Select or Add Salesperson"
                className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          {/* Row 7: Subject */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
            <div className="flex items-center gap-1 pt-2">
              <label className="text-xs font-semibold text-slate-700">
                Subject
              </label>
              <span
                className="text-slate-400 hover:text-slate-600 cursor-help"
                title="Let your customer know what this Credit Note is for."
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="md:col-span-3">
              <textarea
                rows={2}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Let your customer know what this Credit Note is for"
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs sm:text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Item Table Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Item Table</h3>
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5" />
              Bulk Actions
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-3 py-2.5 w-[38%]">ITEM DETAILS</th>
                  <th className="px-3 py-2.5 w-[20%]">ACCOUNT</th>
                  <th className="px-3 py-2.5 w-[14%] text-right">QUANTITY</th>
                  <th className="px-3 py-2.5 w-[14%] text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      RATE <Calculator className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="px-3 py-2.5 w-[12%] text-right">AMOUNT</th>
                  <th className="px-2 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition">
                    {/* Item Details */}
                    <td className="px-3 py-2.5 align-top">
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => handleItemChange(row.id, "name", e.target.value)}
                          placeholder="Type or click to select an item."
                          list={`items-datalist-${row.id}`}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <datalist id={`items-datalist-${row.id}`}>
                          {itemsList.map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.sku ? `[${p.sku}] ` : ""}₹{(p.salesPrice || 0).toFixed(2)}
                            </option>
                          ))}
                        </datalist>
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => handleItemChange(row.id, "description", e.target.value)}
                          placeholder="Item description (optional)"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1 text-[11px] text-slate-600 outline-none focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                    </td>

                    {/* Account */}
                    <td className="px-3 py-2.5 align-top">
                      <select
                        value={row.account}
                        onChange={(e) => handleItemChange(row.id, "account", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                      >
                        {ACCOUNT_OPTIONS.map((acc) => (
                          <option key={acc} value={acc}>
                            {acc}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Quantity */}
                    <td className="px-3 py-2.5 align-top text-right">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={row.quantity}
                        onChange={(e) => handleItemChange(row.id, "quantity", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right font-mono text-xs text-slate-900 outline-none focus:border-blue-500"
                      />
                    </td>

                    {/* Rate */}
                    <td className="px-3 py-2.5 align-top text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={row.rate}
                        onChange={(e) => handleItemChange(row.id, "rate", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right font-mono text-xs text-slate-900 outline-none focus:border-blue-500"
                      />
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-2.5 align-top text-right font-mono font-semibold text-slate-900 pt-3">
                      ₹{row.amount.toFixed(2)}
                    </td>

                    {/* Remove */}
                    <td className="px-2 py-2.5 align-top text-center pt-2.5">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                        title="Delete row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Row Buttons */}
          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add New Row
            </button>
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Items in Bulk
            </button>
          </div>

          {/* Calculations Block */}
          <div className="flex flex-col md:flex-row justify-between gap-6 lg:gap-8 pt-6 border-t border-slate-100 items-start">
            {/* Left Column: Customer Notes & Terms */}
            <div className="w-full flex-1 space-y-4 min-w-0">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Notes
                </label>
                <textarea
                  rows={3}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Will be displayed on the credit note"
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  rows={3}
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Right Column: Totals & Tax Calculation Breakdown */}
            <div className="w-full md:w-[420px] lg:w-[440px] shrink-0 space-y-3.5 bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs">
              {/* Sub Total */}
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-semibold text-slate-700">Sub Total</span>
                <span className="font-mono font-bold text-slate-900 w-28 text-right shrink-0">
                  {subTotal.toFixed(2)}
                </span>
              </div>

              {/* Discount */}
              <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                <span className="text-slate-600 shrink-0">Discount</span>
                <div className="flex items-center gap-2 justify-end min-w-0">
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={discountVal}
                      onChange={(e) => setDiscountVal(e.target.value)}
                      className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-xs outline-none focus:border-blue-500"
                    />
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as "percent" | "amount")}
                      className="rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-xs outline-none focus:border-blue-500"
                    >
                      <option value="percent">%</option>
                      <option value="amount">₹</option>
                    </select>
                  </div>
                  <span className="font-mono text-slate-700 w-28 text-right shrink-0">
                    {discountAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* TDS / TCS */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="tax-mode"
                      checked={taxMode === "TDS"}
                      onChange={() => {
                        setTaxMode("TDS");
                        setSelectedTaxRate(0);
                      }}
                      className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500"
                    />
                    <span>TDS</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="tax-mode"
                      checked={taxMode === "TCS"}
                      onChange={() => {
                        setTaxMode("TCS");
                        setSelectedTaxRate(0);
                      }}
                      className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500"
                    />
                    <span>TCS</span>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <select
                    value={selectedTaxRate}
                    onChange={(e) => setSelectedTaxRate(parseFloat(e.target.value) || 0)}
                    className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="0">Select a Tax</option>
                    {(taxMode === "TDS" ? TDS_OPTIONS : TCS_OPTIONS).map((opt) => (
                      <option key={opt.label} value={opt.rate}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="font-mono text-xs text-slate-700 w-28 text-right shrink-0">
                    {taxMode === "TDS" ? `- ${taxAmount.toFixed(2)}` : `+ ${taxAmount.toFixed(2)}`}
                  </span>
                </div>
              </div>

              {/* Adjustment */}
              <div className="flex items-center justify-between text-xs sm:text-sm gap-2 pt-1">
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-slate-600">Adjustment</span>
                  <span
                    className="text-slate-400 hover:text-slate-600 cursor-help"
                    title="Round off or general adjustment amount (+ or -)"
                  >
                    <Info className="h-3 w-3" />
                  </span>
                </div>
                <div className="flex items-center gap-2 justify-end min-w-0">
                  <input
                    type="number"
                    step="any"
                    value={adjustmentStr}
                    onChange={(e) => setAdjustmentStr(e.target.value)}
                    placeholder="0.00"
                    className="w-20 sm:w-24 rounded-lg border border-dashed border-slate-300 bg-white px-2 py-1 text-right text-xs outline-none focus:border-blue-500 shrink-0"
                  />
                  <span className="font-mono text-slate-700 w-28 text-right shrink-0">
                    {adjustment.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Total (₹) */}
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm sm:text-base">
                <span className="font-bold text-slate-900">Total ( ₹ )</span>
                <span className="font-mono font-bold text-slate-900 text-lg w-28 text-right shrink-0">
                  {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white px-6 py-3.5 shadow-lg flex items-center justify-start gap-3">
        <button
          type="button"
          onClick={() => handleSubmit("Draft")}
          disabled={submitting}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          {submitting ? "Saving…" : "Save as Draft"}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit("Open")}
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 transition cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save as Open"
          )}
        </button>
        <button
          type="button"
          onClick={() => router.push("/sales/credit-notes")}
          disabled={submitting}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
