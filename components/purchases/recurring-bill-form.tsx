"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RotateCw,
  Search,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import {
  calculateBillTotals,
  calculateDueDate,
  formatDateOnly,
  GST_RATES,
  PAYMENT_TERMS_OPTIONS,
  STANDARD_ACCOUNTS,
} from "@/lib/bill-utils";
import {
  calculateNextBillDate,
  REPEAT_FREQUENCIES,
  type RepeatFrequency,
} from "@/lib/recurring-bill-utils";

interface VendorOption {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  state?: string;
}

interface ItemOption {
  id: string;
  name: string;
  sku?: string;
  rate?: number;
  account?: string;
  unit?: string;
}

interface CustomerOption {
  id: string;
  name: string;
  companyName?: string;
}

export interface RecurringBillItemFormState {
  id: string;
  itemId?: string;
  name: string;
  description: string;
  account: string;
  quantity: number;
  rate: number;
  taxRate: number;
  customerId?: string;
  customerName?: string;
  amount: number;
}

export interface RecurringBillFormData {
  id?: string;
  _id?: string;
  profileName: string;
  vendorId: string;
  vendorName: string;
  repeatEvery: RepeatFrequency;
  startDate: string;
  endsOn: string;
  neverExpires: boolean;
  nextBillDate: string;
  paymentTerms: string;
  accountsPayable: string;
  items: RecurringBillItemFormState[];
  discount: number;
  discountType: "percent" | "amount";
  taxType: "GST" | "TDS" | "None";
  taxRate: number;
  adjustment: number;
  notes: string;
  termsAndConditions: string;
  status: "Active" | "Paused" | "Expired";
}

const ACCOUNTS_PAYABLE_OPTIONS = [
  "Accounts Payable",
  "Trade Creditors",
  "Accrued Expenses",
  "Short-Term Operating Liabilities",
];

const TDS_RATES = [
  { label: "1% TDS (Sec 194C - Contractor Indiv)", rate: 1 },
  { label: "2% TDS (Sec 194C - Contractor Corp)", rate: 2 },
  { label: "5% TDS (Sec 194I - Rent Plant/Machinery)", rate: 5 },
  { label: "10% TDS (Sec 194J - Professional/Technical)", rate: 10 },
];

function formatINR(val: number): string {
  return `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function RecurringBillForm({
  initialId,
  isEditMode = false,
}: {
  initialId?: string;
  isEditMode?: boolean;
}) {
  const router = useRouter();

  // Reference data
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [itemsList, setItemsList] = useState<ItemOption[]>([]);
  const [customersList, setCustomersList] = useState<CustomerOption[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form State
  const [profileName, setProfileName] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);

  const [repeatEvery, setRepeatEvery] = useState<RepeatFrequency>("Month");
  const [startDate, setStartDate] = useState(() => formatDateOnly(new Date()));
  const [endsOn, setEndsOn] = useState("");
  const [neverExpires, setNeverExpires] = useState(true);

  const [paymentTerms, setPaymentTerms] = useState("Due on Receipt");
  const [accountsPayable, setAccountsPayable] = useState("Accounts Payable");

  const [items, setItems] = useState<RecurringBillItemFormState[]>([
    {
      id: "row-1",
      name: "",
      description: "",
      account: "Cost of Goods Sold",
      quantity: 1,
      rate: 0,
      taxRate: 0,
      amount: 0,
    },
  ]);

  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [taxType, setTaxType] = useState<"GST" | "TDS" | "None">("GST");
  const [taxRate, setTaxRate] = useState<number>(18);
  const [adjustment, setAdjustment] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [status, setStatus] = useState<"Active" | "Paused" | "Expired">("Active");

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generatingNow, setGeneratingNow] = useState(false);

  // Quick Add Vendor Modal
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorEmail, setNewVendorEmail] = useState("");
  const [newVendorPhone, setNewVendorPhone] = useState("");
  const [newVendorGstin, setNewVendorGstin] = useState("");
  const [newVendorState, setNewVendorState] = useState("");
  const [savingVendor, setSavingVendor] = useState(false);

  // Fetch vendors, items, and if editing, existing profile
  useEffect(() => {
    async function loadData() {
      setLoadingInitial(true);
      setError(null);
      try {
        const res = await fetch("/api/purchases/recurring-bills");
        let loadedItems: ItemOption[] = [];
        if (res.ok) {
          const data = await res.json();
          setVendors(data.vendors || []);
          loadedItems = data.items || [];
          setCustomersList(data.customers || []);
        }

        if (loadedItems.length === 0) {
          const itemsRes = await fetch("/api/items").catch(() => null);
          if (itemsRes?.ok) {
            const itemsData = (await itemsRes.json()) as { items?: Array<Record<string, unknown>> };
            if (Array.isArray(itemsData.items) && itemsData.items.length > 0) {
              loadedItems = itemsData.items.map((it) => ({
                id: String(it.id || it._id),
                name: String(it.name || ""),
                sku: typeof it.sku === "string" ? it.sku : undefined,
                rate: Number(it.purchasePrice || it.salesPrice || 0),
                account: typeof it.purchaseAccount === "string" ? it.purchaseAccount : "Cost of Goods Sold",
                unit: typeof it.unit === "string" ? it.unit : "unit",
              }));
            }
          }
        }
        setItemsList(loadedItems);

        if (isEditMode && initialId) {
          const profRes = await fetch(`/api/purchases/recurring-bills/${initialId}`);
          if (!profRes.ok) throw new Error("Failed to load recurring bill profile.");
          const profData = await profRes.json();
          const p = profData.profile;

          setProfileName(p.profileName || "");
          setVendorId(p.vendorId || "");
          setRepeatEvery(p.repeatEvery || "Month");
          if (p.startDate) setStartDate(p.startDate.split("T")[0]);
          if (p.endsOn) setEndsOn(p.endsOn.split("T")[0]);
          setNeverExpires(Boolean(p.neverExpires));
          setPaymentTerms(p.paymentTerms || "Due on Receipt");
          setAccountsPayable(p.accountsPayable || "Accounts Payable");
          setDiscount(p.discount || 0);
          setDiscountType(p.discountType || "percent");
          setTaxType(p.taxType || "GST");
          setTaxRate(p.taxRate || 0);
          setAdjustment(p.adjustment || 0);
          setNotes(p.notes || "");
          setTermsAndConditions(p.termsAndConditions || "");
          setStatus(p.status || "Active");

          if (Array.isArray(p.items) && p.items.length > 0) {
            setItems(
              (p.items as Array<Record<string, unknown>>).map((it, idx: number) => ({
                id: `loaded-${idx}-${Date.now()}`,
                itemId: it.itemId ? String(it.itemId) : undefined,
                name: String(it.name || ""),
                description: String(it.description || ""),
                account: String(it.account || "Cost of Goods Sold"),
                quantity: Number(it.quantity) || 1,
                rate: Number(it.rate) || 0,
                taxRate: Number(it.taxRate) || 0,
                customerId: it.customerId ? String(it.customerId) : undefined,
                customerName: String(it.customerName || ""),
                amount: Math.round(Number(it.quantity || 1) * Number(it.rate || 0) * 100) / 100,
              })),
            );
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load required data.");
      } finally {
        setLoadingInitial(false);
      }
    }

    void loadData();
  }, [initialId, isEditMode]);

  // Selected vendor details
  const selectedVendor = useMemo(() => {
    return vendors.find((v) => v.id === vendorId);
  }, [vendors, vendorId]);

  // Filtered vendors for search
  const filteredVendors = useMemo(() => {
    if (!vendorSearch.trim()) return vendors;
    const q = vendorSearch.toLowerCase().trim();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.gstin && v.gstin.toLowerCase().includes(q)),
    );
  }, [vendors, vendorSearch]);

  // Calculated Due Date Preview based on Start Date + Payment Terms
  const calculatedDueDate = useMemo(() => {
    if (!startDate) return "";
    return calculateDueDate(startDate, paymentTerms);
  }, [startDate, paymentTerms]);

  // Next Scheduled Bill Date live preview
  const nextScheduledDate = useMemo(() => {
    if (!startDate) return "";
    return calculateNextBillDate(startDate, repeatEvery);
  }, [startDate, repeatEvery]);

  // Live Totals Calculation
  const totals = useMemo(() => {
    return calculateBillTotals({
      items: items.map((it) => ({
        itemId: it.itemId,
        name: it.name || "Item",
        description: it.description,
        account: it.account,
        quantity: Math.max(0.001, Number(it.quantity) || 1),
        rate: Math.max(0, Number(it.rate) || 0),
        taxRate: Number(it.taxRate) || 0,
        amount: Math.round(Number(it.quantity || 1) * Number(it.rate || 0) * 100) / 100,
      })),
      discount: Number(discount) || 0,
      discountType,
      taxType,
      taxRate: Number(taxRate) || 0,
      adjustment: Number(adjustment) || 0,
    });
  }, [items, discount, discountType, taxType, taxRate, adjustment]);

  // Row Manipulation Handlers
  const handleItemChange = (
    rowId: string,
    field: keyof RecurringBillItemFormState,
    value: RecurringBillItemFormState[keyof RecurringBillItemFormState],
  ) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const updated = { ...row, [field]: value };
        if (field === "quantity" || field === "rate") {
          const qty = field === "quantity" ? Math.max(0.001, Number(value) || 0) : row.quantity;
          const rt = field === "rate" ? Math.max(0, Number(value) || 0) : row.rate;
          updated.amount = Math.round(qty * rt * 100) / 100;
        }
        return updated;
      }),
    );
  };

  const handleSelectItem = (rowId: string, selectedItemId: string) => {
    if (!selectedItemId) {
      setItems((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          return {
            ...row,
            itemId: "",
            name: "",
          };
        }),
      );
      return;
    }
    const matched = itemsList.find((it) => it.id === selectedItemId);
    if (!matched) return;
    setItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const rate = matched.rate !== undefined ? matched.rate : row.rate;
        return {
          ...row,
          itemId: matched.id,
          name: matched.name,
          account: matched.account || row.account,
          rate,
          amount: Math.round(row.quantity * rate * 100) / 100,
        };
      }),
    );
  };

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random()}`,
        name: "",
        description: "",
        account: "Cost of Goods Sold",
        quantity: 1,
        rate: 0,
        taxRate: 0,
        amount: 0,
      },
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (items.length <= 1) {
      // Keep at least one row, just reset it
      setItems([
        {
          id: `row-${Date.now()}`,
          name: "",
          description: "",
          account: "Cost of Goods Sold",
          quantity: 1,
          rate: 0,
          taxRate: 0,
          amount: 0,
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Quick Add Vendor Submission
  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorName.trim()) return;
    setSavingVendor(true);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newVendorName.trim(),
          email: newVendorEmail.trim() || undefined,
          phone: newVendorPhone.trim() || undefined,
          gstin: newVendorGstin.trim() || undefined,
          state: newVendorState.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create vendor.");

      const created = data.vendor || data;
      const newV: VendorOption = {
        id: created.id || created._id,
        name: created.name,
        email: created.email,
        phone: created.phone,
        gstin: created.gstin,
        state: created.state,
      };

      setVendors((prev) => [newV, ...prev]);
      setVendorId(newV.id);
      setShowAddVendorModal(false);
      setNewVendorName("");
      setNewVendorEmail("");
      setNewVendorPhone("");
      setNewVendorGstin("");
      setNewVendorState("");
      setNotice(`Vendor "${newV.name}" created and selected!`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create vendor.");
    } finally {
      setSavingVendor(false);
    }
  };

  // Form Save Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!vendorId) {
      setError("Please select a vendor.");
      return;
    }

    if (!profileName.trim()) {
      setError("Please enter a profile name.");
      return;
    }

    if (!startDate) {
      setError("Please specify a start date.");
      return;
    }

    if (!neverExpires && endsOn && endsOn < startDate) {
      setError("End date cannot be prior to start date.");
      return;
    }

    const validItems = items.filter((it) => it.name.trim().length > 0);
    if (validItems.length === 0) {
      setError("Please add at least one line item with a name.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        profileName: profileName.trim(),
        vendorId,
        vendorName: selectedVendor?.name || "Vendor",
        repeatEvery,
        startDate,
        endsOn: neverExpires ? "" : endsOn,
        neverExpires,
        paymentTerms,
        accountsPayable,
        items: validItems.map((it) => ({
          itemId: it.itemId && it.itemId !== "__custom__" ? it.itemId : undefined,
          name: it.name.trim(),
          description: it.description?.trim() || "",
          account: it.account || "Cost of Goods Sold",
          quantity: Math.max(0.001, Number(it.quantity) || 1),
          rate: Math.max(0, Number(it.rate) || 0),
          taxRate: Number(it.taxRate) || 0,
          customerId: it.customerId,
          customerName: it.customerName || "",
          amount: Math.round(Number(it.quantity || 1) * Number(it.rate || 0) * 100) / 100,
        })),
        discount: Number(discount) || 0,
        discountType,
        taxType,
        taxRate: Number(taxRate) || 0,
        adjustment: Number(adjustment) || 0,
        notes: notes.trim(),
        termsAndConditions: termsAndConditions.trim(),
        status,
      };

      const url = isEditMode && initialId
        ? `/api/purchases/recurring-bills/${initialId}`
        : "/api/purchases/recurring-bills";

      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to save recurring bill profile.");
      }

      router.push("/purchases/recurring-bills");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  // Generate Bill Now Handler (Edit mode)
  const handleGenerateNow = async () => {
    if (!initialId) return;
    setGeneratingNow(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/purchases/recurring-bills/${initialId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate bill.");

      setNotice(`Generated Bill ${data.bill.billNumber} successfully! Next bill date is now ${data.nextBillDate}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate bill.");
    } finally {
      setGeneratingNow(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-500">Loading profile configuration…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/purchases/recurring-bills"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-500">
                Purchases / Recurring Bills
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  status === "Active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : status === "Paused"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {status}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isEditMode ? "Edit Recurring Bill" : "New Recurring Bill"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isEditMode && (
            <button
              type="button"
              onClick={handleGenerateNow}
              disabled={generatingNow || saving}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition shadow-sm"
            >
              {generatingNow ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Generate Bill Now
            </button>
          )}

          <Link
            href="/purchases/recurring-bills"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            {saving ? "Saving…" : isEditMode ? "Save Changes" : "Save Recurring Bill"}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="rounded p-1 hover:bg-rose-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="rounded p-1 hover:bg-emerald-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Details & Recurrence (Two-column layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Vendor & Accounting Details */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Vendor & Profile Details
              </h2>
            </div>

            {/* Vendor Selector */}
            <div className="space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Vendor Name <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddVendorModal(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-3 w-3" /> Add Vendor
                </button>
              </div>

              <div className="relative">
                <div
                  onClick={() => setVendorDropdownOpen((o) => !o)}
                  className="flex items-center justify-between w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 hover:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition"
                >
                  <span className={vendorId ? "font-medium text-slate-900" : "text-slate-400"}>
                    {selectedVendor ? selectedVendor.name : "Select a supplier or vendor…"}
                  </span>
                  <Search className="h-4 w-4 text-slate-400" />
                </div>

                {vendorDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <input
                      type="text"
                      placeholder="Type to filter vendors…"
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                      autoFocus
                    />
                    <div className="mt-1 space-y-0.5">
                      {filteredVendors.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          No matching vendors found.
                        </div>
                      ) : (
                        filteredVendors.map((v) => (
                          <div
                            key={v.id}
                            onClick={() => {
                              setVendorId(v.id);
                              setVendorDropdownOpen(false);
                              setVendorSearch("");
                            }}
                            className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs transition ${
                              v.id === vendorId
                                ? "bg-blue-600 font-semibold text-white"
                                : "text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <span>{v.name}</span>
                            {v.gstin && (
                              <span className={v.id === vendorId ? "text-blue-100 text-[10px]" : "text-slate-400 text-[10px]"}>
                                GST: {v.gstin}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedVendor && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 text-xs text-slate-600 flex flex-wrap gap-4">
                  {selectedVendor.gstin && (
                    <span>
                      <strong className="text-slate-700">GSTIN:</strong> {selectedVendor.gstin}
                    </span>
                  )}
                  {selectedVendor.state && (
                    <span>
                      <strong className="text-slate-700">State:</strong> {selectedVendor.state}
                    </span>
                  )}
                  {selectedVendor.email && (
                    <span>
                      <strong className="text-slate-700">Email:</strong> {selectedVendor.email}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Profile Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Profile Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g. Monthly Warehouse Lease, Weekly Packing Material"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
              <p className="text-[11px] text-slate-400">
                A memorable descriptor for this recurring commitment.
              </p>
            </div>

            {/* Accounts Payable & Payment Terms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Accounts Payable
                </label>
                <select
                  value={accountsPayable}
                  onChange={(e) => setAccountsPayable(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  {ACCOUNTS_PAYABLE_OPTIONS.map((acc) => (
                    <option key={acc} value={acc}>
                      {acc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  {PAYMENT_TERMS_OPTIONS.map((term) => (
                    <option key={term.label} value={term.label}>
                      {term.label}
                    </option>
                  ))}
                </select>
                {calculatedDueDate && (
                  <p className="text-[11px] font-medium text-blue-600 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Due Date: {calculatedDueDate}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Recurrence Schedule */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Recurrence Schedule
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Status:</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "Active" | "Paused" | "Expired")}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>
            </div>

            {/* Repeat Every */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Repeat Every <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {REPEAT_FREQUENCIES.map((freq) => (
                  <button
                    key={freq.value}
                    type="button"
                    onClick={() => setRepeatEvery(freq.value)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold border transition text-center ${
                      repeatEvery === freq.value
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {freq.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 italic mt-1">
                {REPEAT_FREQUENCIES.find((f) => f.value === repeatEvery)?.daysDescription}
              </p>
            </div>

            {/* Start Date & Ends On */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Ends On
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={neverExpires}
                      onChange={(e) => setNeverExpires(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Never Expires
                  </label>
                </div>
                <input
                  type="date"
                  value={endsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                  disabled={neverExpires}
                  className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition ${
                    neverExpires ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white focus:border-blue-500"
                  }`}
                />
              </div>
            </div>

            {/* Next Scheduled Date Badge Card */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                  <RotateCw className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                    Next Scheduled Generation
                  </p>
                  <p className="text-sm font-bold text-emerald-950">
                    {nextScheduledDate ? nextScheduledDate : "Calculated on start date"}
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                Auto-recurring
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Bill Items Table (Full Width Card) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Bill Items & Line Specifications
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Specify quantities, rates, expense accounts, and optional customer assignments
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition"
            >
              <Plus className="h-3.5 w-3.5" /> Add Row
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3 min-w-[240px]">Item Details *</th>
                  <th className="py-2.5 px-3 min-w-[170px]">Account</th>
                  <th className="py-2.5 px-3 w-24">Quantity</th>
                  <th className="py-2.5 px-3 w-32">Rate (₹)</th>
                  <th className="py-2.5 px-3 min-w-[160px]">Customer</th>
                  <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition group">
                    {/* Item Details */}
                    <td className="py-2.5 px-3 align-top space-y-1.5">
                      <select
                        value={
                          row.itemId && row.itemId !== "__custom__"
                            ? row.itemId
                            : (itemsList.find(
                                (it) => it.name.toLowerCase() === (row.name || "").toLowerCase(),
                              )?.id ?? (row.name ? "__custom__" : ""))
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__custom__") {
                            handleItemChange(row.id, "itemId", "__custom__");
                          } else {
                            handleSelectItem(row.id, val);
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition cursor-pointer"
                      >
                        <option value="">Type or select an inventory commodity / item...</option>
                        {itemsList.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                        <option value="__custom__">+ Enter custom item name</option>
                      </select>

                      {/* Custom item name text field */}
                      {(row.itemId === "__custom__" ||
                        (!row.itemId &&
                          row.name &&
                          !itemsList.some(
                            (it) => it.name.toLowerCase() === row.name.toLowerCase(),
                          ))) && (
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleItemChange(row.id, "name", e.target.value)}
                            placeholder="Type custom item name…"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-500"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleItemChange(row.id, "itemId", "");
                              handleItemChange(row.id, "name", "");
                            }}
                            className="text-[11px] text-blue-600 hover:underline shrink-0 font-medium"
                          >
                            Catalog
                          </button>
                        </div>
                      )}

                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => handleItemChange(row.id, "description", e.target.value)}
                        placeholder="Optional line notes or specifications…"
                        className="w-full rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500 outline-none focus:bg-white focus:border-slate-300"
                      />
                    </td>

                    {/* Account */}
                    <td className="py-2.5 px-3 align-top">
                      <select
                        value={row.account}
                        onChange={(e) => handleItemChange(row.id, "account", e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                      >
                        {STANDARD_ACCOUNTS.map((acc) => (
                          <option key={acc} value={acc}>
                            {acc}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Quantity */}
                    <td className="py-2.5 px-3 align-top">
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        value={row.quantity}
                        onChange={(e) => handleItemChange(row.id, "quantity", e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 text-right"
                      />
                    </td>

                    {/* Rate */}
                    <td className="py-2.5 px-3 align-top">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.rate}
                        onChange={(e) => handleItemChange(row.id, "rate", e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 text-right font-medium"
                      />
                    </td>

                    {/* Customer (Optional) */}
                    <td className="py-2.5 px-3 align-top">
                      <select
                        value={row.customerId || ""}
                        onChange={(e) => {
                          const cust = customersList.find((c) => c.id === e.target.value);
                          handleItemChange(row.id, "customerId", e.target.value || undefined);
                          handleItemChange(row.id, "customerName", cust ? cust.name : "");
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                      >
                        <option value="">None (Internal)</option>
                        {customersList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Row Amount */}
                    <td className="py-2.5 px-3 align-top text-right font-semibold text-slate-900 pt-3">
                      {formatINR(row.amount)}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-2 align-top text-center pt-2.5">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        title="Delete item row"
                        className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white hover:border-slate-300 transition"
            >
              <Plus className="h-3.5 w-3.5" /> Add Another Row
            </button>
            <div className="text-xs text-slate-500">
              Subtotal ({items.length} items): <strong className="text-slate-900">{formatINR(totals.subTotal)}</strong>
            </div>
          </div>
        </div>

        {/* Section 3: Notes, Terms & Totals (Two-column layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Notes & Terms */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              Notes & Contract Terms
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Vendor Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Will be displayed on each recurring bill generated…"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Terms & Conditions
              </label>
              <textarea
                rows={3}
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                placeholder="Contractual payment schedule terms, bank clearing details, etc…"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Calculations & Final Payable Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              Amount & Tax Calculations
            </h2>

            <div className="space-y-3 text-xs">
              {/* Subtotal */}
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">{formatINR(totals.subTotal)}</span>
              </div>

              {/* Discount Input */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Discount</span>
                <div className="flex items-center gap-1.5">
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setDiscountType("percent")}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                        discountType === "percent" ? "bg-white shadow text-slate-900" : "text-slate-500"
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("amount")}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                        discountType === "amount" ? "bg-white shadow text-slate-900" : "text-slate-500"
                      }`}
                    >
                      ₹
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs outline-none focus:border-blue-500 font-medium"
                  />
                  <span className="text-rose-600 font-semibold w-24 text-right">
                    -{formatINR(totals.discountAmount)}
                  </span>
                </div>
              </div>

              {/* Tax Type & Tax Rate */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Taxes</span>
                <div className="flex items-center gap-2">
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value as "GST" | "TDS" | "None")}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none"
                  >
                    <option value="GST">GST</option>
                    <option value="TDS">TDS</option>
                    <option value="None">None</option>
                  </select>

                  {taxType === "GST" && (
                    <select
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none"
                    >
                      {GST_RATES.map((g) => (
                        <option key={g.rate} value={g.rate}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {taxType === "TDS" && (
                    <select
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none"
                    >
                      {TDS_RATES.map((t) => (
                        <option key={t.rate} value={t.rate}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  )}

                  <span className="font-semibold text-slate-800 w-24 text-right">
                    {taxType === "TDS" ? `-${formatINR(totals.taxAmount)}` : `+${formatINR(totals.taxAmount)}`}
                  </span>
                </div>
              </div>

              {/* Adjustment */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Adjustment (+/-)</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="any"
                    value={adjustment}
                    onChange={(e) => setAdjustment(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs outline-none focus:border-blue-500 font-medium"
                  />
                  <span className="font-semibold text-slate-800 w-24 text-right">
                    {adjustment >= 0 ? `+${formatINR(adjustment)}` : formatINR(adjustment)}
                  </span>
                </div>
              </div>

              {/* Final Total */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-900">
                    Total Amount per Occurrence
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Frequency: {repeatEvery}
                  </p>
                </div>
                <div className="text-2xl font-bold tracking-tight text-emerald-600">
                  {formatINR(totals.total)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Link
            href="/purchases/recurring-bills"
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            {saving ? "Saving…" : isEditMode ? "Save Changes" : "Save Recurring Bill"}
          </button>
        </div>
      </form>

      {/* Quick Add Vendor Modal */}
      {showAddVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add New Vendor</h3>
              <button
                type="button"
                onClick={() => setShowAddVendorModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVendor} className="mt-4 space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Vendor Name *</label>
                <input
                  type="text"
                  required
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="e.g. Apex Agri Packaging Pvt Ltd"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Email</label>
                  <input
                    type="email"
                    value={newVendorEmail}
                    onChange={(e) => setNewVendorEmail(e.target.value)}
                    placeholder="billing@vendor.com"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Phone</label>
                  <input
                    type="text"
                    value={newVendorPhone}
                    onChange={(e) => setNewVendorPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">GSTIN</label>
                  <input
                    type="text"
                    value={newVendorGstin}
                    onChange={(e) => setNewVendorGstin(e.target.value.toUpperCase())}
                    placeholder="27AAAAA0000A1Z5"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">State</label>
                  <input
                    type="text"
                    value={newVendorState}
                    onChange={(e) => setNewVendorState(e.target.value)}
                    placeholder="Maharashtra"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddVendorModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVendor || !newVendorName.trim()}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingVendor ? "Adding…" : "Save & Select"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
