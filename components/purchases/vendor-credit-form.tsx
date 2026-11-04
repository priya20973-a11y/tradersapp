"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  File,
  FileText,
  Layers,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { formatDateOnly, GST_RATES, STANDARD_ACCOUNTS } from "@/lib/bill-utils";
import {
  calculateCreditTotals,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS_COUNT,
  TCS_RATES,
} from "@/lib/vendor-credit-utils";

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

export interface CreditItemRow {
  id: string;
  itemId?: string;
  name: string;
  description: string;
  account: string;
  quantity: number;
  rate: number;
  taxRate: number;
  amount: number;
}

export interface CreditAttachmentItem {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

const TDS_RATES = [
  { label: "1% TDS (Sec 194C - Contractor Indiv)", rate: 1 },
  { label: "2% TDS (Sec 194C - Contractor Corp)", rate: 2 },
  { label: "5% TDS (Sec 194I - Rent Plant/Machinery)", rate: 5 },
  { label: "10% TDS (Sec 194J - Professional/Technical)", rate: 10 },
];

const ACCOUNTS_PAYABLE_OPTIONS = [
  "Accounts Payable",
  "Trade Creditors",
  "Accrued Expenses",
  "Short-Term Operating Liabilities",
];

function formatINR(val: number): string {
  return `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VendorCreditForm({
  initialId,
  isEditMode = false,
}: {
  initialId?: string;
  isEditMode?: boolean;
}) {
  const router = useRouter();

  // Reference lists
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [itemsList, setItemsList] = useState<ItemOption[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form Details
  const [vendorId, setVendorId] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);

  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [vendorCreditDate, setVendorCreditDate] = useState(() => formatDateOnly(new Date()));
  const [subject, setSubject] = useState("");
  const [accountsPayable, setAccountsPayable] = useState("Accounts Payable");

  // Items
  const [items, setItems] = useState<CreditItemRow[]>([
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

  // Calculations
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [taxType, setTaxType] = useState<"GST" | "TDS" | "TCS" | "None">("GST");
  const [taxRate, setTaxRate] = useState<number>(18);
  const [adjustment, setAdjustment] = useState<number>(0);
  const [notes, setNotes] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState<CreditAttachmentItem[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Add Vendor Modal
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorEmail, setNewVendorEmail] = useState("");
  const [newVendorPhone, setNewVendorPhone] = useState("");
  const [newVendorGstin, setNewVendorGstin] = useState("");
  const [newVendorState, setNewVendorState] = useState("");
  const [savingVendor, setSavingVendor] = useState(false);

  // Bulk Item Picker Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSearch, setBulkSearch] = useState("");
  const [selectedBulkItemIds, setSelectedBulkItemIds] = useState<Set<string>>(new Set());

  // Load vendors, items, and credit note if edit mode
  useEffect(() => {
    async function loadData() {
      setLoadingInitial(true);
      setError(null);
      try {
        const res = await fetch("/api/purchases/vendor-credits");
        if (res.ok) {
          const data = await res.json();
          setVendors(data.vendors || []);
          setItemsList(data.items || []);
        }

        if (isEditMode && initialId) {
          const credRes = await fetch(`/api/purchases/vendor-credits/${initialId}`);
          if (!credRes.ok) throw new Error("Failed to load vendor credit details.");
          const credData = await credRes.json();
          const c = credData.credit;

          setVendorId(c.vendorId || "");
          setCreditNoteNumber(c.creditNoteNumber || "");
          setOrderNumber(c.orderNumber || "");
          if (c.vendorCreditDate) setVendorCreditDate(c.vendorCreditDate.split("T")[0]);
          setSubject(c.subject || "");
          setAccountsPayable(c.accountsPayable || "Accounts Payable");
          setDiscount(c.discount || 0);
          setDiscountType(c.discountType || "percent");
          setTaxType(c.taxType || "GST");
          setTaxRate(c.taxRate || 0);
          setAdjustment(c.adjustment || 0);
          setNotes(c.notes || "");
          if (Array.isArray(c.attachments)) {
            setAttachments(c.attachments);
          }

          if (Array.isArray(c.items) && c.items.length > 0) {
            setItems(
              (c.items as Array<Record<string, unknown>>).map((it, idx: number) => ({
                id: `loaded-${idx}-${Date.now()}`,
                itemId: it.itemId ? String(it.itemId) : undefined,
                name: String(it.name || ""),
                description: String(it.description || ""),
                account: String(it.account || "Cost of Goods Sold"),
                quantity: Number(it.quantity) || 1,
                rate: Number(it.rate) || 0,
                taxRate: Number(it.taxRate) || 0,
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

  // Selected vendor
  const selectedVendor = useMemo(() => {
    return vendors.find((v) => v.id === vendorId);
  }, [vendors, vendorId]);

  // Filtered vendors for dropdown
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

  // Filtered catalog items for bulk modal
  const filteredCatalogItems = useMemo(() => {
    if (!bulkSearch.trim()) return itemsList;
    const q = bulkSearch.toLowerCase().trim();
    return itemsList.filter(
      (it) => it.name.toLowerCase().includes(q) || (it.sku && it.sku.toLowerCase().includes(q)),
    );
  }, [itemsList, bulkSearch]);

  // Real-time Credit Calculations
  const totals = useMemo(() => {
    return calculateCreditTotals({
      items: items.map((it) => ({
        quantity: Math.max(0.001, Number(it.quantity) || 1),
        rate: Math.max(0, Number(it.rate) || 0),
        taxRate: Number(it.taxRate) || 0,
      })),
      discount: Number(discount) || 0,
      discountType,
      taxType,
      taxRate: Number(taxRate) || 0,
      adjustment: Number(adjustment) || 0,
    });
  }, [items, discount, discountType, taxType, taxRate, adjustment]);

  // Row Manipulation
  const handleItemChange = (
    rowId: string,
    field: keyof CreditItemRow,
    value: CreditItemRow[keyof CreditItemRow],
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

  // Bulk Items Add
  const handleConfirmBulkAdd = () => {
    const selected = itemsList.filter((it) => selectedBulkItemIds.has(it.id));
    if (selected.length === 0) {
      setShowBulkModal(false);
      return;
    }

    // Filter out initial empty row if not modified
    const currentValid = items.filter((it) => it.name.trim().length > 0 || it.rate > 0);

    const newRows: CreditItemRow[] = selected.map((it) => ({
      id: `bulk-${it.id}-${Date.now()}-${Math.random()}`,
      itemId: it.id,
      name: it.name,
      description: it.sku ? `SKU: ${it.sku}` : "",
      account: it.account || "Cost of Goods Sold",
      quantity: 1,
      rate: it.rate || 0,
      taxRate: 0,
      amount: Math.round((it.rate || 0) * 100) / 100,
    }));

    setItems([...currentValid, ...newRows]);
    setSelectedBulkItemIds(new Set());
    setShowBulkModal(false);
    setNotice(`Added ${selected.length} items from catalog.`);
  };

  // File Upload Handlers (max 5, max 10MB)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > MAX_ATTACHMENTS_COUNT) {
      setError(`Maximum ${MAX_ATTACHMENTS_COUNT} attachments permitted.`);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setError(`File "${file.name}" exceeds the maximum limit of 10 MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            dataUrl: event.target?.result as string,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
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

  // Save Submission
  const handleSubmit = async (targetStatus: "Draft" | "Open") => {
    setError(null);
    setNotice(null);

    if (!vendorId) {
      setError("Please select a vendor.");
      return;
    }

    if (!vendorCreditDate) {
      setError("Please choose a credit note date.");
      return;
    }

    const validItems = items.filter((it) => it.name.trim().length > 0);
    if (validItems.length === 0) {
      setError("Please add at least one line item with a valid name.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        creditNoteNumber: creditNoteNumber.trim() || undefined,
        vendorId,
        vendorName: selectedVendor?.name || "Vendor",
        orderNumber: orderNumber.trim(),
        vendorCreditDate,
        subject: subject.trim().slice(0, 250),
        accountsPayable,
        items: validItems.map((it) => ({
          itemId: it.itemId,
          name: it.name.trim(),
          description: it.description?.trim() || "",
          account: it.account || "Cost of Goods Sold",
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
        notes: notes.trim(),
        status: targetStatus,
        attachments,
      };

      const url = isEditMode && initialId
        ? `/api/purchases/vendor-credits/${initialId}`
        : "/api/purchases/vendor-credits";

      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to save vendor credit.");
      }

      router.push("/purchases/vendor-credits");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-500">Loading credit note configuration…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/purchases/vendor-credits"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-500">
                Purchases / Vendor Credits
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Accounts Payable Credit Note
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isEditMode ? `Edit Vendor Credit ${creditNoteNumber || ""}` : "New Vendor Credit"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/purchases/vendor-credits"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => handleSubmit("Draft")}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("Open")}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {saving ? "Saving…" : "Save and Open"}
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

      {/* Details (Two-column layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Vendor Selection & Accounts Payable */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Supplier / Vendor Details
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
                  {selectedVendor ? selectedVendor.name : "Select a vendor for this credit note…"}
                </span>
                <Search className="h-4 w-4 text-slate-400" />
              </div>

              {vendorDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  <input
                    type="text"
                    placeholder="Search vendor name, GSTIN…"
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

          {/* Accounts Payable */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Accounts Payable
            </label>
            <select
              value={accountsPayable}
              onChange={(e) => setAccountsPayable(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {ACCOUNTS_PAYABLE_OPTIONS.map((acc) => (
                <option key={acc} value={acc}>
                  {acc}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              The liability account that will be credited/debited upon credit note application.
            </p>
          </div>
        </div>

        {/* Right Column: Credit Note Details */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Credit Note Specifications
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Credit Note Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Credit Note Number *
              </label>
              <input
                type="text"
                value={creditNoteNumber}
                onChange={(e) => setCreditNoteNumber(e.target.value)}
                placeholder="Auto-generated (e.g. VCR-0001)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="text-[10px] text-slate-400">Leave blank for auto-numbering</p>
            </div>

            {/* Order Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Order Number
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="e.g. PO-2026-0042"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Vendor Credit Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Vendor Credit Date *
            </label>
            <input
              type="date"
              value={vendorCreditDate}
              onChange={(e) => setVendorCreditDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Subject
              </label>
              <span className="text-[10px] text-slate-400">{subject.length}/250 chars</span>
            </div>
            <input
              type="text"
              maxLength={250}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description or return reason (max 250 characters)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* Item Table Card (Full Width) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Credited Line Items
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Specify items returned, discount claims, damaged goods, or billing adjustments
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition shadow-sm"
            >
              <Layers className="h-3.5 w-3.5" /> Add Items in Bulk
            </button>
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> Add Row
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3 min-w-[280px]">Item Details *</th>
                <th className="py-2.5 px-3 min-w-[180px]">Account</th>
                <th className="py-2.5 px-3 w-28 text-right">Quantity</th>
                <th className="py-2.5 px-3 w-36 text-right">Rate (₹)</th>
                <th className="py-2.5 px-3 w-36 text-right">Amount (₹)</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60 transition group">
                  {/* Item Details */}
                  <td className="py-2.5 px-3 align-top space-y-1">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => handleItemChange(row.id, "name", e.target.value)}
                        placeholder="Item name or commodity details…"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-500"
                      />
                      {itemsList.length > 0 && (
                        <select
                          value={row.itemId || ""}
                          onChange={(e) => handleSelectItem(row.id, e.target.value)}
                          title="Pick item from catalog"
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 outline-none hover:bg-white"
                        >
                          <option value="">Catalog</option>
                          {itemsList.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} (₹{it.rate || 0})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => handleItemChange(row.id, "description", e.target.value)}
                      placeholder="Optional return reason or spec details…"
                      className="w-full rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500 outline-none focus:bg-white focus:border-slate-300"
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

                  {/* Amount */}
                  <td className="py-2.5 px-3 align-top text-right font-semibold text-slate-900 pt-3">
                    {formatINR(row.amount)}
                  </td>

                  {/* Delete Row */}
                  <td className="py-2.5 px-2 align-top text-center pt-2.5">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      title="Remove row"
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white hover:border-slate-300 transition"
            >
              <Plus className="h-3.5 w-3.5" /> Add New Row
            </button>
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white hover:border-slate-300 transition"
            >
              <Layers className="h-3.5 w-3.5 text-slate-500" /> Add Items in Bulk
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Subtotal ({items.length} items): <strong className="text-slate-900">{formatINR(totals.subTotal)}</strong>
          </div>
        </div>
      </div>

      {/* Section: Notes, Attachments & Credit Calculations (Two-column layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Notes & Attachments */}
        <div className="space-y-6">
          {/* Notes */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              Customer / Vendor Notes
            </h2>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for vendor credit note, damaged stock details, RMA reference…"
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          {/* Attachments Card (Max 5, max 10MB) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Attachments
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                {attachments.length}/{MAX_ATTACHMENTS_COUNT} files (max 10MB each)
              </span>
            </div>

            {/* Upload Area */}
            {attachments.length < MAX_ATTACHMENTS_COUNT && (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center hover:bg-slate-100/70 transition">
                <Upload className="h-5 w-5 text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-blue-600">Upload Files</span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  PDF, PNG, JPG, or spreadsheets up to 10 MB
                </span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                />
              </label>
            )}

            {/* Attachments List */}
            {attachments.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <File className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="truncate font-medium text-slate-800">{att.name}</span>
                      <span className="text-[10px] text-slate-400">({formatBytes(att.size)})</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {att.dataUrl && (
                        <a
                          href={att.dataUrl}
                          download={att.name}
                          title="Download attachment"
                          className="p-1 text-slate-500 hover:text-blue-600 rounded"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        title="Remove attachment"
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Calculations & Credit Amount Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
            Credit Calculations & Total
          </h2>

          <div className="space-y-3 text-xs">
            {/* Subtotal */}
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">{formatINR(totals.subTotal)}</span>
            </div>

            {/* Discount */}
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

            {/* Tax Selection (GST, TDS, TCS, None) */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600">Tax Type & Rate</span>
              <div className="flex items-center gap-2">
                <select
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value as "GST" | "TDS" | "TCS" | "None")}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none"
                >
                  <option value="GST">GST</option>
                  <option value="TDS">TDS</option>
                  <option value="TCS">TCS</option>
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

                {taxType === "TCS" && (
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none"
                  >
                    {TCS_RATES.map((tc) => (
                      <option key={tc.rate} value={tc.rate}>
                        {tc.label}
                      </option>
                    ))}
                  </select>
                )}

                <span className="font-semibold text-slate-800 w-24 text-right">
                  {totals.taxAmount >= 0 ? `+${formatINR(totals.taxAmount)}` : formatINR(totals.taxAmount)}
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

            {/* Total Credit Note Value */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-slate-900">
                  Total Vendor Credit
                </p>
                <p className="text-[11px] text-slate-400">Available to offset against supplier bills</p>
              </div>
              <div className="text-2xl font-bold tracking-tight text-blue-600">
                {formatINR(totals.total)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-md shadow-lg flex items-center justify-between lg:pl-76">
        <div className="text-xs text-slate-500">
          Total Credit: <strong className="text-slate-900 font-bold">{formatINR(totals.total)}</strong>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/purchases/vendor-credits"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => handleSubmit("Draft")}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("Open")}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save and Open"}
          </button>
        </div>
      </div>

      {/* Bulk Item Picker Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Items in Bulk</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select commodity items from your catalog to insert simultaneously
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter catalog items by name or SKU…"
                  value={bulkSearch}
                  onChange={(e) => setBulkSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs outline-none focus:bg-white focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="mt-3 overflow-y-auto flex-1 divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {filteredCatalogItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No catalog items found matching search.
                </div>
              ) : (
                filteredCatalogItems.map((it) => {
                  const isChecked = selectedBulkItemIds.has(it.id);
                  return (
                    <div
                      key={it.id}
                      onClick={() => {
                        const next = new Set(selectedBulkItemIds);
                        if (isChecked) next.delete(it.id);
                        else next.add(it.id);
                        setSelectedBulkItemIds(next);
                      }}
                      className={`flex cursor-pointer items-center justify-between px-4 py-2.5 text-xs transition select-none ${
                        isChecked ? "bg-blue-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <p className="font-semibold text-slate-900">{it.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {it.sku ? `SKU: ${it.sku}` : ""} {it.unit ? `• Unit: ${it.unit}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-slate-900">{formatINR(it.rate || 0)}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {selectedBulkItemIds.size} {selectedBulkItemIds.size === 1 ? "item" : "items"} selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkAdd}
                  disabled={selectedBulkItemIds.size === 0}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Add Selected Items
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  placeholder="e.g. Bharat Agricultural Products Ltd"
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
                    placeholder="accounts@vendor.in"
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
