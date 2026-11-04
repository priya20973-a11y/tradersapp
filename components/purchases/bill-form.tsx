"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Copy,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import {
  calculateBillTotals,
  calculateDueDate,
  formatDateOnly,
  GST_RATES,
  PAYMENT_TERMS_OPTIONS,
  STANDARD_ACCOUNTS,
  type BillItemInput,
} from "@/lib/bill-utils";

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
  rate: number;
  account?: string;
  unit?: string;
}

interface CustomerOption {
  id: string;
  name: string;
  companyName?: string;
}

interface AttachmentFile {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

interface BillFormProps {
  initialId?: string;
  isEditMode?: boolean;
}

export function BillForm({ initialId, isEditMode = false }: BillFormProps) {
  const router = useRouter();

  // Loading states
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Dropdown options
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [itemsList, setItemsList] = useState<ItemOption[]>([]);
  const [customersList, setCustomersList] = useState<CustomerOption[]>([]);

  // Bill Details fields
  const [vendorId, setVendorId] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);

  const [billNumber, setBillNumber] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [billDate, setBillDate] = useState(() => formatDateOnly(new Date()));
  const [dueDate, setDueDate] = useState(() => formatDateOnly(new Date()));
  const [paymentTerms, setPaymentTerms] = useState("Due on Receipt");
  const [accountsPayable, setAccountsPayable] = useState("Accounts Payable");
  const [subject, setSubject] = useState("");

  // Item Table
  const [items, setItems] = useState<BillItemInput[]>([
    {
      id: "row-1",
      name: "",
      description: "",
      account: "Cost of Goods Sold",
      quantity: 1,
      rate: 0,
      taxRate: 18,
      amount: 0,
    },
  ]);

  // Calculations fields
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [taxType, setTaxType] = useState<"GST" | "TDS" | "None">("GST");
  const [taxRate, setTaxRate] = useState<number>(18);
  const [isIntraState, setIsIntraState] = useState(true);
  const [adjustment, setAdjustment] = useState<number>(0);

  // Notes and Attachments
  const [notes, setNotes] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState(
    "1. Payment will be disbursed in accordance with the agreed purchase credit terms.\n2. Goods received are subject to quality inspection and warehouse verification.",
  );
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [status, setStatus] = useState<"Draft" | "Pending">("Pending");

  // Quick Add Vendor Modal
  const [showQuickVendorModal, setShowQuickVendorModal] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorEmail, setNewVendorEmail] = useState("");
  const [newVendorPhone, setNewVendorPhone] = useState("");
  const [newVendorGstin, setNewVendorGstin] = useState("");
  const [quickVendorSaving, setQuickVendorSaving] = useState(false);

  // Load dropdown options & existing bill if editing
  useEffect(() => {
    async function loadInitial() {
      try {
        const res = await fetch("/api/purchases/bills");
        if (res.ok) {
          const data = await res.json();
          setVendors(data.vendors || []);
          setItemsList(data.items || []);
          setCustomersList(data.customers || []);
        }

        if (isEditMode && initialId) {
          const billRes = await fetch(`/api/purchases/bills/${initialId}`);
          if (!billRes.ok) throw new Error("Failed to load bill for editing.");
          const billData = await billRes.json();
          const b = billData.bill;

          setVendorId(b.vendorId || "");
          setBillNumber(b.billNumber || "");
          setOrderNumber(b.orderNumber || "");
          if (b.billDate) setBillDate(b.billDate.split("T")[0]);
          if (b.dueDate) setDueDate(b.dueDate.split("T")[0]);
          setPaymentTerms(b.paymentTerms || "Due on Receipt");
          setAccountsPayable(b.accountsPayable || "Accounts Payable");
          setSubject(b.subject || "");
          setNotes(b.notes || "");
          setTermsAndConditions(b.termsAndConditions || "");
          setDiscount(b.discount || 0);
          setDiscountType(b.discountType || "percent");
          setTaxType(b.taxType || "GST");
          setTaxRate(b.taxRate || 0);
          setAdjustment(b.adjustment || 0);
          setStatus(b.status === "Draft" ? "Draft" : "Pending");

          if (Array.isArray(b.items) && b.items.length > 0) {
            setItems(
              b.items.map((it: Partial<BillItemInput> & { customerName?: string }, idx: number) => ({
                id: `row-${idx + 1}`,
                itemId: it.itemId,
                name: it.name || "",
                description: it.description || "",
                account: it.account || "Cost of Goods Sold",
                quantity: Number(it.quantity) || 1,
                rate: Number(it.rate) || 0,
                taxRate: Number(it.taxRate) || 0,
                customerId: it.customerId,
                customerName: it.customerName || "",
                amount: Number(it.amount) || 0,
              })),
            );
          }

          if (Array.isArray(b.attachments)) {
            setAttachments(
              b.attachments.map((a: AttachmentFile) => ({
                name: a.name,
                size: a.size,
                type: a.type,
                dataUrl: a.dataUrl,
              })),
            );
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to initialize bill form.");
      } finally {
        setLoadingData(false);
      }
    }

    void loadInitial();
  }, [isEditMode, initialId]);

  // Selected vendor metadata
  const selectedVendor = useMemo(() => {
    return vendors.find((v) => v.id === vendorId);
  }, [vendors, vendorId]);

  // Auto-calculate Due Date when payment terms or bill date change
  const handlePaymentTermsChange = (newTerm: string) => {
    setPaymentTerms(newTerm);
    const calculated = calculateDueDate(billDate, newTerm);
    if (calculated) {
      setDueDate(calculated);
    }
  };

  const handleBillDateChange = (newDate: string) => {
    setBillDate(newDate);
    const calculated = calculateDueDate(newDate, paymentTerms);
    if (calculated) {
      setDueDate(calculated);
    }
  };

  // Real-time calculation output
  const totals = useMemo(() => {
    return calculateBillTotals({
      items,
      discount,
      discountType,
      taxType,
      taxRate,
      isIntraState,
      adjustment,
    });
  }, [items, discount, discountType, taxType, taxRate, isIntraState, adjustment]);

  // Row operations
  const updateRow = (index: number, patch: Partial<BillItemInput>) => {
    setItems((prev) => {
      const next = [...prev];
      const current = next[index];
      const merged = { ...current, ...patch };

      if ("quantity" in patch || "rate" in patch) {
        merged.amount = Math.round(merged.quantity * merged.rate * 100) / 100;
      }
      next[index] = merged;
      return next;
    });
  };

  const handleSelectItem = (index: number, itemId: string) => {
    const selected = itemsList.find((it) => it.id === itemId);
    if (selected) {
      updateRow(index, {
        itemId: selected.id,
        name: selected.name,
        rate: selected.rate || 0,
        account: selected.account || "Cost of Goods Sold",
      });
    } else {
      updateRow(index, { itemId: undefined });
    }
  };

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        name: "",
        description: "",
        account: "Cost of Goods Sold",
        quantity: 1,
        rate: 0,
        taxRate: 18,
        amount: 0,
      },
    ]);
  };

  const duplicateRow = (index: number) => {
    const source = items[index];
    setItems((prev) => [
      ...prev.slice(0, index + 1),
      { ...source, id: `row-${Date.now()}` },
      ...prev.slice(index + 1),
    ]);
  };

  const removeRow = (index: number) => {
    if (items.length <= 1) {
      // Clear instead of removing last row
      setItems([
        {
          id: `row-${Date.now()}`,
          name: "",
          description: "",
          account: "Cost of Goods Sold",
          quantity: 1,
          rate: 0,
          taxRate: 18,
          amount: 0,
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllRows = () => {
    setItems([
      {
        id: `row-${Date.now()}`,
        name: "",
        description: "",
        account: "Cost of Goods Sold",
        quantity: 1,
        rate: 0,
        taxRate: 18,
        amount: 0,
      },
    ]);
  };

  // Attachment upload handler
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > 5) {
      setError("You can upload a maximum of 5 attachments per bill.");
      return;
    }

    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds the maximum 10 MB limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: event.target?.result as string,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick Add Vendor
  const handleQuickAddVendor = async (e: FormEvent) => {
    e.preventDefault();
    if (!newVendorName.trim()) return;

    setQuickVendorSaving(true);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newVendorName.trim(),
          email: newVendorEmail.trim() || undefined,
          phone: newVendorPhone.trim() || undefined,
          gstin: newVendorGstin.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create vendor.");

      const created = data.vendor || {
        id: data.id,
        name: newVendorName.trim(),
        email: newVendorEmail.trim(),
        phone: newVendorPhone.trim(),
        gstin: newVendorGstin.trim(),
      };

      setVendors((prev) => [created, ...prev]);
      setVendorId(created.id || created._id);
      setShowQuickVendorModal(false);
      setNewVendorName("");
      setNewVendorEmail("");
      setNewVendorPhone("");
      setNewVendorGstin("");
      setNotice(`Vendor "${created.name}" created and selected.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add vendor.");
    } finally {
      setQuickVendorSaving(false);
    }
  };

  // Main Submit Handler
  const handleSaveBill = async (targetStatus: "Draft" | "Pending") => {
    setError(null);

    if (!vendorId) {
      setError("Please select a vendor.");
      return;
    }

    const validItems = items.filter((it) => it.name.trim() !== "" || Number(it.amount || 0) > 0);
    if (validItems.length === 0) {
      setError("Please add at least one line item with a name or amount.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        vendorId,
        billNumber: billNumber.trim() || undefined,
        orderNumber: orderNumber.trim() || undefined,
        billDate,
        dueDate,
        paymentTerms,
        accountsPayable,
        subject: subject.trim() || undefined,
        items: validItems,
        discount,
        discountType,
        taxType,
        taxRate,
        adjustment,
        notes: notes.trim(),
        termsAndConditions: termsAndConditions.trim(),
        attachments,
        status: targetStatus,
      };

      const url = isEditMode && initialId ? `/api/purchases/bills/${initialId}` : "/api/purchases/bills";
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save bill.");
      }

      router.push("/purchases/bills");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const filteredVendors = useMemo(() => {
    if (!vendorSearch) return vendors;
    const q = vendorSearch.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.gstin && v.gstin.toLowerCase().includes(q)) ||
        (v.email && v.email.toLowerCase().includes(q)),
    );
  }, [vendors, vendorSearch]);

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-medium">Loading bill data…</p>
      </div>
    );
  }

  return (
    <div className="pb-28 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/purchases/bills"
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Purchases</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                {isEditMode ? "Edit Bill" : "New Purchase Bill"}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
              {isEditMode ? `Edit Bill ${billNumber}` : "New Bill"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              status === "Draft" ? "bg-slate-100 text-slate-700" : "bg-blue-50 text-blue-700 border border-blue-200"
            }`}
          >
            {isEditMode ? "Editing" : "Draft Profile"}
          </span>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 animate-in fade-in">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Section 1: Bill Details Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">1. Bill Details</h2>
          <p className="text-xs text-slate-500">Specify supplier credentials, billing sequence, and payment schedule</p>
        </div>

        {/* 2-Column Grid on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Vendor & Basic Meta */}
          <div className="space-y-4">
            {/* Vendor Selector with Search & Quick-Add */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Vendor Name <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickVendorModal(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  + Add Vendor
                </button>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setVendorDropdownOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none hover:bg-slate-100/70 focus:border-blue-500 focus:bg-white transition text-left cursor-pointer"
                >
                  <span className={selectedVendor ? "font-medium text-slate-900" : "text-slate-400"}>
                    {selectedVendor ? selectedVendor.name : "Select or search a vendor..."}
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>

                {vendorDropdownOpen && (
                  <div className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in duration-150">
                    <input
                      type="text"
                      placeholder="Type vendor name or GSTIN..."
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      className="w-full mb-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                    />
                    <div className="divide-y divide-slate-100">
                      {filteredVendors.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setVendorId(v.id);
                            setVendorDropdownOpen(false);
                            setVendorSearch("");
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 rounded-lg transition flex items-center justify-between"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{v.name}</p>
                            {v.gstin && <p className="font-mono text-[10px] text-slate-400">GST: {v.gstin}</p>}
                          </div>
                          {v.state && <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{v.state}</span>}
                        </button>
                      ))}
                      {filteredVendors.length === 0 && (
                        <p className="p-3 text-center text-xs text-slate-400">No matching vendors</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedVendor && (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {selectedVendor.gstin && <span className="font-mono">GSTIN: {selectedVendor.gstin}</span>}
                  {selectedVendor.phone && <span>📞 {selectedVendor.phone}</span>}
                  {selectedVendor.email && <span>✉️ {selectedVendor.email}</span>}
                </div>
              )}
            </div>

            {/* Bill Number & Order Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Bill Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Auto-generated if blank (e.g. BILL-0042)"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-mono text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Order Number (PO#)
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO-2026-081"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Subject
              </label>
              <input
                type="text"
                placeholder="Brief summary or project reference (optional)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Right Column: Dates, Terms, Accounts Payable */}
          <div className="space-y-4">
            {/* Bill Date & Payment Terms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Bill Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={billDate}
                  onChange={(e) => handleBillDateChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => handlePaymentTermsChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                >
                  {PAYMENT_TERMS_OPTIONS.map((t) => (
                    <option key={t.label} value={t.label}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due Date & Accounts Payable */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Due Date
                  </label>
                  <span className="text-[10px] text-blue-600 font-medium">Auto-calculated</span>
                </div>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Accounts Payable
                </label>
                <select
                  value={accountsPayable}
                  onChange={(e) => setAccountsPayable(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                >
                  <option value="Accounts Payable">Accounts Payable</option>
                  <option value="Sundry Creditors">Sundry Creditors</option>
                  <option value="Other Current Liabilities">Other Current Liabilities</option>
                </select>
              </div>
            </div>

            {/* Tax Regime & Place of Supply */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">GST Supply Location</span>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      name="supply"
                      checked={isIntraState}
                      onChange={() => setIsIntraState(true)}
                      className="text-blue-600"
                    />
                    Intra-State (CGST + SGST)
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      name="supply"
                      checked={!isIntraState}
                      onChange={() => setIsIntraState(false)}
                      className="text-blue-600"
                    />
                    Inter-State (IGST)
                  </label>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Taxes will be calculated and accounted based on supplier and destination billing state.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Item Table Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">2. Item Table</h2>
            <p className="text-xs text-slate-500">
              Select catalog inventory items or enter manual expense descriptions and account allocations
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearAllRows}
              className="rounded-lg px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 transition cursor-pointer"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </button>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 w-8 text-center">#</th>
                <th className="px-3 py-3 min-w-[220px]">Item Details</th>
                <th className="px-3 py-3 min-w-[170px]">Account</th>
                <th className="px-3 py-3 w-24 text-right">Quantity</th>
                <th className="px-3 py-3 w-32 text-right">Rate (₹)</th>
                <th className="px-3 py-3 min-w-[160px]">Customer Details</th>
                <th className="px-3 py-3 w-32 text-right">Amount (₹)</th>
                <th className="px-3 py-3 w-16 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row, index) => (
                <tr key={row.id || index} className="hover:bg-slate-50/50 transition">
                  <td className="px-3 py-2 text-center text-xs font-mono text-slate-400">{index + 1}</td>

                  {/* Item Details */}
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      {/* Catalog item picker */}
                      <select
                        value={row.itemId || ""}
                        onChange={(e) => handleSelectItem(index, e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-500"
                      >
                        <option value="">-- Choose from Catalog or Type Below --</option>
                        {itemsList.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} {it.sku ? `(${it.sku})` : ""} • ₹{it.rate}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Item name / expense description *"
                        value={row.name}
                        onChange={(e) => updateRow(index, { name: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-900 outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Optional description / memo"
                        value={row.description || ""}
                        onChange={(e) => updateRow(index, { description: e.target.value })}
                        className="w-full rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-0.5 text-[11px] text-slate-500 outline-none focus:border-blue-500"
                      />
                    </div>
                  </td>

                  {/* Account */}
                  <td className="px-3 py-2 align-top">
                    <select
                      value={row.account}
                      onChange={(e) => updateRow(index, { account: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                    >
                      {STANDARD_ACCOUNTS.map((acc) => (
                        <option key={acc} value={acc}>
                          {acc}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Quantity */}
                  <td className="px-3 py-2 align-top">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={row.quantity}
                      onChange={(e) => updateRow(index, { quantity: Number(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-right font-medium text-slate-900 outline-none focus:border-blue-500"
                    />
                  </td>

                  {/* Rate */}
                  <td className="px-3 py-2 align-top">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.rate}
                      onChange={(e) => updateRow(index, { rate: Number(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-right font-medium text-slate-900 outline-none focus:border-blue-500"
                    />
                  </td>

                  {/* Customer Details */}
                  <td className="px-3 py-2 align-top">
                    <select
                      value={row.customerId || ""}
                      onChange={(e) => {
                        const custId = e.target.value;
                        const c = customersList.find((cust) => cust.id === custId);
                        updateRow(index, {
                          customerId: custId || undefined,
                          customerName: c ? c.name : "",
                        });
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                    >
                      <option value="">No Customer Allocation</option>
                      {customersList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.companyName ? `(${c.companyName})` : ""}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Line Total */}
                  <td className="px-3 py-2 align-top text-right font-mono text-xs font-bold text-slate-900 pt-3">
                    ₹{Number(row.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Row Actions */}
                  <td className="px-3 py-2 align-top text-center">
                    <div className="flex items-center justify-center gap-1 pt-1.5">
                      <button
                        type="button"
                        onClick={() => duplicateRow(index)}
                        title="Duplicate Row"
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        title="Delete Row"
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition pt-1 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Another Line Item
        </button>
      </div>

      {/* Section 3 & 4: Calculations & Notes/Attachments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Notes & Terms & Attachments */}
        <div className="space-y-6">
          {/* Notes and Terms Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Notes & Terms</h3>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Vendor Notes / Internal Memo
              </label>
              <textarea
                rows={3}
                placeholder="Will be displayed on payment receipts and audit trail..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Terms & Conditions
              </label>
              <textarea
                rows={3}
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition resize-none"
              />
            </div>
          </div>

          {/* Attachments Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Attachments</h3>
              <span className="text-[11px] text-slate-500 font-medium">Max 5 files (10 MB each)</span>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 transition bg-slate-50/50">
              <Upload className="h-6 w-6 text-slate-400 mx-auto mb-1.5" />
              <label className="inline-block text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">
                <span>Upload bill scans, delivery slips, or invoices</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,application/pdf"
                />
              </label>
              <p className="text-[10px] text-slate-400 mt-1">PDF, PNG, JPG accepted</p>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="font-medium text-slate-800 truncate">{att.name}</span>
                      <span className="text-[10px] text-slate-400">
                        ({(att.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Calculations Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4 h-fit">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900">3. Bill Calculations</h3>
            <p className="text-xs text-slate-500">Breakdown of line subtotal, discounts, GST, and final payables</p>
          </div>

          <div className="space-y-3.5 text-sm">
            {/* Subtotal */}
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Subtotal</span>
              <span className="font-mono font-bold text-slate-900">
                ₹{totals.subTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Discount */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">Discount</span>
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setDiscountType("percent")}
                    className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                      discountType === "percent" ? "bg-blue-600 text-white" : "text-slate-600"
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("amount")}
                    className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                      discountType === "amount" ? "bg-blue-600 text-white" : "text-slate-600"
                    }`}
                  >
                    ₹
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs font-mono font-medium outline-none focus:border-blue-500"
                />
                <span className="font-mono text-xs text-slate-700 min-w-[70px] text-right">
                  -₹{totals.discountAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Taxable Amount */}
            <div className="flex justify-between items-center py-1 text-xs text-slate-500 border-b border-slate-50">
              <span>Taxable Amount</span>
              <span className="font-mono">₹{totals.taxableAmount.toFixed(2)}</span>
            </div>

            {/* GST / Tax selection */}
            <div className="space-y-2 py-1 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">Tax Selection</span>
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value as "GST" | "TDS" | "None")}
                    className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs font-medium outline-none"
                  >
                    <option value="GST">GST</option>
                    <option value="TDS">TDS Deducted</option>
                    <option value="None">None (0%)</option>
                  </select>
                </div>

                {taxType === "GST" && (
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                    className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs font-medium outline-none"
                  >
                    {GST_RATES.map((g) => (
                      <option key={g.rate} value={g.rate}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tax Breakup Display */}
              {taxType === "GST" && totals.taxAmount > 0 && (
                <div className="bg-blue-50/50 p-2.5 rounded-lg space-y-1 text-xs font-mono">
                  {isIntraState ? (
                    <>
                      <div className="flex justify-between text-blue-900">
                        <span>CGST ({taxRate / 2}%)</span>
                        <span>₹{totals.cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-blue-900">
                        <span>SGST ({taxRate / 2}%)</span>
                        <span>₹{totals.sgst.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-blue-900">
                      <span>IGST ({taxRate}%)</span>
                      <span>₹{totals.igst.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {taxType === "TDS" && (
                <div className="flex justify-between text-xs text-purple-900 bg-purple-50 p-2 rounded-lg font-mono">
                  <span>TDS Withholding ({taxRate}%)</span>
                  <span>-₹{Math.abs(totals.taxAmount).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Adjustment */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Adjustment (+ / -)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={adjustment}
                  onChange={(e) => setAdjustment(Number(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs font-mono font-medium outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Final Total */}
            <div className="flex justify-between items-center py-3 bg-slate-900 text-white p-4 rounded-xl shadow-xs mt-2">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-300 font-semibold">Total Payable</span>
                <p className="text-[11px] text-slate-400">Includes all items, taxes & adjustments</p>
              </div>
              <span className="text-2xl font-bold font-mono">
                ₹{totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200 p-4 backdrop-blur-md shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Vendor: </span>
            <span className="font-bold text-slate-900">{selectedVendor?.name || "Not selected"}</span>
            <span className="text-slate-300">•</span>
            <span>Total: </span>
            <span className="font-bold text-blue-700 font-mono">
              ₹{totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => router.push("/purchases/bills")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveBill("Draft")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save as Draft
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveBill("Pending")}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save and Open
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Vendor Modal */}
      {showQuickVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Quick Create</span>
                <h3 className="text-lg font-bold text-slate-900">New Vendor</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickVendorModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddVendor} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Vendor Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Commodities Pvt Ltd"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  placeholder="e.g. 27AABCA1234F1Z8"
                  value={newVendorGstin}
                  onChange={(e) => setNewVendorGstin(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="billing@vendor.com"
                    value={newVendorEmail}
                    onChange={(e) => setNewVendorEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98..."
                    value={newVendorPhone}
                    onChange={(e) => setNewVendorPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickVendorModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickVendorSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {quickVendorSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
