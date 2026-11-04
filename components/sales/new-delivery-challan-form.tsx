"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  CheckCircle2,
  ChevronDown,
  GripVertical,
  HelpCircle,
  Info,
  Loader2,
  Plus,
  PlusCircle,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  type AttachedFile,
  type ChallanItemRow,
  type CustomerOption,
  type DeliveryChallanDocument,
  type DeliveryChallanPreferencesData,
  type ItemOption,
} from "./delivery-challan/delivery-challan-types";
import {
  BulkAddItemsModal,
  QuickAddCustomerModal,
  SearchCustomerModal,
} from "./delivery-challan/delivery-challan-modals";
import { ConfigureDcNumberModal } from "./delivery-challan/configure-dc-number-modal";
import { formatDeliveryChallanNumber } from "@/lib/delivery-challan-numbering";

const CHALLAN_TYPES = [
  "Supply on Approval",
  "Job Work",
  "Removal for Examination",
  "Supply Liquid Gas",
  "Exhibition or Consignment",
  "Others",
];

interface NewDeliveryChallanFormProps {
  initialData?: DeliveryChallanDocument | null;
  isEditMode?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface SalesMasterData {
  customers?: CustomerOption[];
}

interface ItemMasterData {
  items?: Array<{
    id?: string;
    _id?: string;
    name?: string;
    sku?: string;
    salesPrice?: number;
    salesDescription?: string;
    unit?: string;
  }>;
}

interface DeliveryChallanPreferencesResponse {
  settings?: DeliveryChallanPreferencesData;
  formattedNextNumber?: string;
}

export function NewDeliveryChallanForm({
  initialData,
  isEditMode = false,
  onSuccess,
  onCancel,
}: NewDeliveryChallanFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Master Data
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [availableItems, setAvailableItems] = useState<ItemOption[]>([]);

  // Settings & Sequence
  const [dcPreferences, setDcPreferences] = useState<DeliveryChallanPreferencesData | null>(null);
  const [deliveryChallanNumber, setDeliveryChallanNumber] = useState(
    initialData?.deliveryChallanNumber || "DC-00002"
  );
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Form Fields
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialData?.customerId || ""
  );
  const [referenceNumber, setReferenceNumber] = useState(
    initialData?.referenceNumber || ""
  );
  const [deliveryChallanDate, setDeliveryChallanDate] = useState(() => {
    if (initialData?.deliveryChallanDate) {
      try {
        return new Date(initialData.deliveryChallanDate).toISOString().split("T")[0];
      } catch {
        return initialData.deliveryChallanDate;
      }
    }
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [challanType, setChallanType] = useState(
    initialData?.challanType || "Supply on Approval"
  );

  // Modals for Customer & Items
  const [showSearchCustomerModal, setShowSearchCustomerModal] = useState(false);
  const [showQuickAddCustomerModal, setShowQuickAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");

  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkSelectedItems, setBulkSelectedItems] = useState<Record<string, number>>({});
  const [showBulkActionsMenu, setShowBulkActionsMenu] = useState(false);

  // Line items
  const [rows, setRows] = useState<ChallanItemRow[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items.map((it, idx) => ({
        id: it.id || `row-${idx}-${Date.now()}`,
        itemId: it.itemId || "",
        name: it.name || "",
        description: it.description || "",
        unit: it.unit || "pcs",
        quantity: Number(it.quantity) || 1,
        rate: Number(it.rate) || 0,
        amount: Number(it.amount) || 0,
      }));
    }
    return [
      {
        id: `row-init-${Date.now()}`,
        itemId: "",
        name: "",
        description: "",
        unit: "pcs",
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ];
  });

  // Calculations
  const [discountValue, setDiscountValue] = useState<number>(initialData?.discount || 0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">(
    initialData?.discountType || "percent"
  );
  const [adjustmentValue, setAdjustmentValue] = useState<number>(
    initialData?.adjustment || 0
  );

  // Notes & Terms & Attachments
  const [customerNotes, setCustomerNotes] = useState(
    initialData?.customerNotes || ""
  );
  const [termsAndConditions, setTermsAndConditions] = useState(
    initialData?.termsAndConditions || ""
  );
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>(
    initialData?.attachments || []
  );

  // Submit / validation state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch customers, items, and sequence preferences
  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetch("/api/sales")
        .then((r): Promise<SalesMasterData> => (
          r.ok ? r.json() as Promise<SalesMasterData> : Promise.resolve<SalesMasterData>({})
        ))
        .catch((): SalesMasterData => ({})),
      fetch("/api/items")
        .then((r): Promise<ItemMasterData> => (
          r.ok ? r.json() as Promise<ItemMasterData> : Promise.resolve<ItemMasterData>({})
        ))
        .catch((): ItemMasterData => ({})),
      fetch("/api/sales/delivery-challans/preferences")
        .then((r): Promise<DeliveryChallanPreferencesResponse> => (
          r.ok
            ? r.json() as Promise<DeliveryChallanPreferencesResponse>
            : Promise.resolve<DeliveryChallanPreferencesResponse>({})
        ))
        .catch((): DeliveryChallanPreferencesResponse => ({})),
    ])
      .then(([salesData, itemsData, prefData]) => {
        if (!isMounted) return;

        if (salesData?.customers && salesData.customers.length > 0) {
          setCustomers(salesData.customers);
        } else {
          setCustomers([
            { id: "c-101", name: "Astra Foods", email: "billing@astrafoods.in", phone: "+91 98200 11223" },
            { id: "c-102", name: "City Retail & Groceries", email: "accounts@cityretail.in", phone: "+91 98400 44556" },
            { id: "c-103", name: "Ganga Stores Pvt Ltd", email: "ap@gangastores.in", phone: "+91 98765 43210" },
          ]);
        }

        if (itemsData?.items && itemsData.items.length > 0) {
          setAvailableItems(
            itemsData.items.map((i) => ({
              id: i.id || (i._id ? String(i._id) : i.sku || ""),
              name: i.name || "",
              sku: i.sku,
              salesPrice: i.salesPrice || 0,
              salesDescription: i.salesDescription || "",
              unit: i.unit || "pcs",
            }))
          );
        } else {
          setAvailableItems([
            { id: "item-1", name: "Premium Basmati Rice 25kg", sku: "RICE-BAS-25", salesPrice: 2200, unit: "Bag" },
            { id: "item-2", name: "Sharbati Wheat 10kg", sku: "WHEAT-SHAR-10", salesPrice: 1280, unit: "Bag" },
            { id: "item-3", name: "Refined Mustard Oil 15L Tin", sku: "OIL-MUST-15", salesPrice: 2150, unit: "Tin" },
            { id: "item-4", name: "Organic Toor Dal 5kg", sku: "PULSE-TOOR-5", salesPrice: 780, unit: "Pack" },
          ]);
        }

        if (prefData?.settings) {
          setDcPreferences(prefData.settings);
          if (!isEditMode && prefData.formattedNextNumber) {
            setDeliveryChallanNumber(prefData.formattedNextNumber);
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isEditMode]);

  // Derived selected customer
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  // Row Manipulation
  const handleSelectItem = (rowId: string, itemId: string) => {
    const item = availableItems.find((i) => i.id === itemId);
    if (!item) return;

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const rate = item.salesPrice || 0;
        const qty = r.quantity || 1;
        return {
          ...r,
          itemId: item.id,
          name: item.name,
          description: item.salesDescription || r.description,
          unit: item.unit || "pcs",
          rate,
          amount: Math.round(qty * rate * 100) / 100,
        };
      })
    );
  };

  const updateRow = (rowId: string, updates: Partial<ChallanItemRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const merged = { ...r, ...updates };
        const qty = merged.quantity >= 0 ? merged.quantity : 0;
        const rate = merged.rate >= 0 ? merged.rate : 0;
        merged.amount = Math.round(qty * rate * 100) / 100;
        return merged;
      })
    );
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        itemId: "",
        name: "",
        description: "",
        unit: "pcs",
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const removeRow = (rowId: string) => {
    if (rows.length === 1) {
      setRows([
        {
          id: `row-${Date.now()}`,
          itemId: "",
          name: "",
          description: "",
          unit: "pcs",
          quantity: 1,
          rate: 0,
          amount: 0,
        },
      ]);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleConfirmBulkAdd = () => {
    const toAdd: ChallanItemRow[] = [];
    Object.entries(bulkSelectedItems).forEach(([itemId, qty]) => {
      if (qty <= 0) return;
      const item = availableItems.find((i) => i.id === itemId);
      if (!item) return;
      const rate = item.salesPrice || 0;
      toAdd.push({
        id: `row-${item.id}-${Date.now()}`,
        itemId: item.id,
        name: item.name,
        description: item.salesDescription || "",
        unit: item.unit || "pcs",
        quantity: qty,
        rate,
        amount: Math.round(qty * rate * 100) / 100,
      });
    });

    if (toAdd.length > 0) {
      setRows((prev) => {
        const withoutEmpty = prev.filter((r) => r.name.trim() !== "");
        return [...withoutEmpty, ...toAdd];
      });
    }

    setBulkSelectedItems({});
    setShowBulkAddModal(false);
  };

  // Calculations
  const subTotal = useMemo(() => {
    return Math.round(rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) * 100) / 100;
  }, [rows]);

  const discountAmount = useMemo(() => {
    const val = Number(discountValue) || 0;
    if (discountType === "percent") {
      return Math.round((subTotal * (val / 100)) * 100) / 100;
    }
    return Math.min(subTotal, val);
  }, [subTotal, discountValue, discountType]);

  const grandTotal = useMemo(() => {
    const adj = Number(adjustmentValue) || 0;
    return Math.max(0, Math.round((subTotal - discountAmount + adj) * 100) / 100);
  }, [subTotal, discountAmount, adjustmentValue]);

  // Attachment upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - attachedFiles.length;
    if (remainingSlots <= 0) {
      alert("You can upload a maximum of 5 files.");
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    for (const f of filesToProcess) {
      if (f.size > 10 * 1024 * 1024) {
        alert(`File "${f.name}" exceeds the 10MB size limit.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setAttachedFiles((prev) => [
          ...prev,
          {
            name: f.name,
            size: f.size,
            type: f.type,
            data: dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(f);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick Customer Creation
  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "Customer",
          name: newCustName.trim(),
          email: newCustEmail.trim() || undefined,
          phone: newCustPhone.trim() || undefined,
        }),
      });

      const createdId = res.ok ? (await res.json()).id || `temp-${Date.now()}` : `temp-${Date.now()}`;
      const newCust: CustomerOption = {
        id: createdId,
        name: newCustName.trim(),
        email: newCustEmail.trim(),
        phone: newCustPhone.trim(),
      };
      setCustomers((prev) => [newCust, ...prev]);
      setSelectedCustomerId(createdId);
      setShowQuickAddCustomerModal(false);
      setNewCustName("");
      setNewCustEmail("");
      setNewCustPhone("");
    } catch {
      const tempId = `temp-${Date.now()}`;
      setCustomers((prev) => [{ id: tempId, name: newCustName.trim() }, ...prev]);
      setSelectedCustomerId(tempId);
      setShowQuickAddCustomerModal(false);
    }
  };

  // Submit Handler
  const handleSave = async (status: "Draft" | "Delivered" | "Open") => {
    setError(null);

    // Validation
    if (!selectedCustomerId) {
      setError("Please select a customer.");
      return;
    }

    if (!deliveryChallanNumber.trim()) {
      setError("Delivery Challan Number is required.");
      return;
    }

    if (!deliveryChallanDate) {
      setError("Delivery Challan Date is required.");
      return;
    }

    const validRows = rows.filter((r) => r.name.trim().length > 0);
    if (validRows.length === 0) {
      setError("Please select at least one item in the Item Table.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        customerId: selectedCustomerId,
        customerName: selectedCustomer?.companyName || selectedCustomer?.name,
        deliveryChallanNumber: deliveryChallanNumber.trim(),
        referenceNumber: referenceNumber.trim() || undefined,
        deliveryChallanDate,
        challanType,
        status,
        subTotal,
        discount: discountValue,
        discountType,
        adjustment: adjustmentValue,
        total: grandTotal,
        customerNotes: customerNotes.trim() || undefined,
        termsAndConditions: termsAndConditions.trim() || undefined,
        items: validRows.map((r) => ({
          itemId: r.itemId || undefined,
          name: r.name,
          description: r.description || undefined,
          unit: r.unit || "pcs",
          quantity: Number(r.quantity) || 1,
          rate: Number(r.rate) || 0,
          amount: Number(r.amount) || 0,
        })),
        attachments: attachedFiles,
      };

      const url = isEditMode && initialData?.id
        ? `/api/sales/delivery-challans/${initialData.id}`
        : "/api/sales/delivery-challans";

      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || "Failed to save delivery challan");
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/sales/delivery-challans");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save delivery challan.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/sales/delivery-challans");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-28">
      {/* Configure DC Numbering Modal */}
      <ConfigureDcNumberModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        currentSettings={dcPreferences}
        onSaved={(updated) => {
          setDcPreferences(updated);
          if (!isEditMode && updated.prefix && updated.nextNumber) {
            setDeliveryChallanNumber(
              formatDeliveryChallanNumber(updated.prefix, updated.nextNumber, updated.numberZeroPadding)
            );
          }
        }}
      />

      {/* Customer Modals */}
      <SearchCustomerModal
        isOpen={showSearchCustomerModal}
        onClose={() => setShowSearchCustomerModal(false)}
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        onSelectCustomer={(id) => setSelectedCustomerId(id)}
        onOpenAddModal={() => setShowQuickAddCustomerModal(true)}
      />

      <QuickAddCustomerModal
        isOpen={showQuickAddCustomerModal}
        onClose={() => setShowQuickAddCustomerModal(false)}
        onSubmit={handleQuickAddCustomer}
        newCustomerName={newCustName}
        setNewCustomerName={setNewCustName}
        newCustomerEmail={newCustEmail}
        setNewCustomerEmail={setNewCustEmail}
        newCustomerPhone={newCustPhone}
        setNewCustomerPhone={setNewCustPhone}
      />

      {/* Bulk Add Items Modal */}
      <BulkAddItemsModal
        isOpen={showBulkAddModal}
        onClose={() => setShowBulkAddModal(false)}
        availableItems={availableItems}
        bulkSelectedItems={bulkSelectedItems}
        setBulkSelectedItems={setBulkSelectedItems}
        onConfirm={handleConfirmBulkAdd}
      />

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Error notification */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          {/* Top Form Fields */}
          <div className="space-y-4 max-w-3xl">
            {/* Customer Name */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <label className="sm:col-span-3 text-xs font-semibold text-[#d9534f]">
                Customer Name<span className="text-[#d9534f]">*</span>
              </label>
              <div className="sm:col-span-8 flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      if (e.target.value === "__add_new__") {
                        setShowQuickAddCustomerModal(true);
                      } else {
                        setSelectedCustomerId(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-800 transition cursor-pointer appearance-none pr-8"
                  >
                    <option value="">Select or add a customer</option>
                    <option value="__add_new__" className="text-blue-600 font-semibold">
                      + Add New Customer
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName || c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowSearchCustomerModal(true)}
                  title="Search existing customers"
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md transition cursor-pointer shrink-0"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Delivery Challan# */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <label className="sm:col-span-3 text-xs font-semibold text-[#d9534f]">
                Delivery Challan#<span className="text-[#d9534f]">*</span>
              </label>
              <div className="sm:col-span-8">
                <div className="relative">
                  <input
                    type="text"
                    value={deliveryChallanNumber}
                    onChange={(e) => setDeliveryChallanNumber(e.target.value)}
                    placeholder="DC-00002"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-800 transition font-mono pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(true)}
                    title="Configure Delivery Challan sequence prefix & numbering"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-600 cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Reference# */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <label className="sm:col-span-3 text-xs font-semibold text-slate-700">
                Reference#
              </label>
              <div className="sm:col-span-8">
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder=""
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-800 transition"
                />
              </div>
            </div>

            {/* Delivery Challan Date* */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <label className="sm:col-span-3 text-xs font-semibold text-[#d9534f]">
                Delivery Challan Date<span className="text-[#d9534f]">*</span>
              </label>
              <div className="sm:col-span-8">
                <input
                  type="date"
                  value={deliveryChallanDate}
                  onChange={(e) => setDeliveryChallanDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-800 transition"
                />
              </div>
            </div>

            {/* Challan Type* with dashed underline */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1">
              <label className="sm:col-span-3 text-xs font-semibold text-[#d9534f]">
                <span className="border-b border-dashed border-rose-400 pb-0.5">
                  Challan Type
                </span>
                <span className="text-[#d9534f]">*</span>
              </label>
              <div className="sm:col-span-8 relative">
                <select
                  value={challanType}
                  onChange={(e) => setChallanType(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-800 transition cursor-pointer appearance-none pr-8"
                >
                  <option value="">Choose a proper challan type.</option>
                  {CHALLAN_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* ITEM TABLE SECTION */}
          <div className="pt-6 border-t border-slate-100 space-y-3">
            {/* Table Header Bar */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Item Table</h2>

              {/* Bulk Actions Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowBulkActionsMenu((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  Bulk Actions
                </button>

                {showBulkActionsMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1.5 text-xs text-slate-700 animate-in fade-in">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBulkAddModal(true);
                        setShowBulkActionsMenu(false);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-blue-600" />
                      Add Multiple Items
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDiscountValue(5);
                        setDiscountType("percent");
                        setShowBulkActionsMenu(false);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Apply 5% Bulk Discount
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRows([
                          {
                            id: `row-${Date.now()}`,
                            itemId: "",
                            name: "",
                            description: "",
                            unit: "pcs",
                            quantity: 1,
                            rate: 0,
                            amount: 0,
                          },
                        ]);
                        setShowBulkActionsMenu(false);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 font-medium cursor-pointer border-t border-slate-100"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                      Clear Table
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Table structure matching screenshot */}
            <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-semibold tracking-wider uppercase">
                    <th className="w-8 py-2.5 px-2 text-center"></th>
                    <th className="py-2.5 px-3 text-left">ITEM DETAILS</th>
                    <th className="w-32 py-2.5 px-3 text-right">QUANTITY</th>
                    <th className="w-36 py-2.5 px-3 text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        RATE
                        <Calculator className="w-3 h-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="w-32 py-2.5 px-3 text-right">AMOUNT</th>
                    <th className="w-10 py-2.5 px-2 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition">
                      {/* Drag Grip */}
                      <td className="px-2 py-3 text-center text-slate-300">
                        <GripVertical className="w-4 h-4 mx-auto" />
                      </td>

                      {/* Item Details */}
                      <td className="px-3 py-3 space-y-1.5">
                        <select
                          value={row.itemId || ""}
                          onChange={(e) => handleSelectItem(row.id, e.target.value)}
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 transition cursor-pointer"
                        >
                          <option value="">Type or click to select an item.</option>
                          {availableItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <textarea
                          rows={1}
                          value={row.description}
                          onChange={(e) => updateRow(row.id, { description: e.target.value })}
                          placeholder="Add an optional specification or notes to this item..."
                          className="w-full px-3 py-1 text-[11px] border border-slate-200 rounded-md outline-none focus:border-blue-500 bg-slate-50/50 text-slate-700 resize-none transition"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="px-3 py-3 text-right align-top">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={row.quantity}
                          onChange={(e) =>
                            updateRow(row.id, {
                              quantity: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs text-right border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 tabular-nums"
                        />
                      </td>

                      {/* Rate */}
                      <td className="px-3 py-3 text-right align-top">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={row.rate}
                          onChange={(e) =>
                            updateRow(row.id, {
                              rate: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs text-right border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 tabular-nums"
                        />
                      </td>

                      {/* Amount */}
                      <td className="px-3 py-3 text-right align-top pt-3 font-semibold text-slate-900 tabular-nums">
                        {row.amount.toFixed(2)}
                      </td>

                      {/* Delete Row */}
                      <td className="px-2 py-3 text-center align-top pt-2.5">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="text-slate-300 hover:text-rose-500 p-1 rounded transition cursor-pointer"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Buttons under table */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-blue-600 text-xs font-medium cursor-pointer shadow-2xs transition"
              >
                <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                Add New Row
              </button>
              <button
                type="button"
                onClick={() => setShowBulkAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-blue-600 text-xs font-medium cursor-pointer shadow-2xs transition"
              >
                <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                Add Items in Bulk
              </button>
            </div>
          </div>

          {/* TWO-COLUMN SECTION: Customer Notes & Totals */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-slate-100">
            {/* Left: Customer Notes */}
            <div className="lg:col-span-6 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Customer Notes
              </label>
              <textarea
                rows={3}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Enter any notes to be displayed in your transaction"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 transition resize-none"
              />
            </div>

            {/* Right: Calculation Card */}
            <div className="lg:col-span-6 space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
              {/* Sub Total */}
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700">Sub Total</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {subTotal.toFixed(2)}
                </span>
              </div>

              {/* Discount */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Discount</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-slate-300 rounded-md bg-white overflow-hidden">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 text-xs text-right outline-none font-semibold tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDiscountType((prev) => (prev === "percent" ? "amount" : "percent"))
                      }
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 border-l border-slate-300 cursor-pointer"
                      title="Toggle discount format"
                    >
                      {discountType === "percent" ? "%" : "₹"}
                    </button>
                  </div>
                  <span className="w-16 text-right text-slate-700 tabular-nums font-medium">
                    {discountAmount > 0 ? `-${discountAmount.toFixed(2)}` : "0.00"}
                  </span>
                </div>
              </div>

              {/* Adjustment */}
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="px-2.5 py-1 border border-dashed border-slate-300 rounded text-slate-600 bg-white">
                    Adjustment
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={adjustmentValue || ""}
                    onChange={(e) => setAdjustmentValue(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 px-2 py-1 text-xs text-right border border-slate-300 rounded-md outline-none focus:border-blue-500 bg-white tabular-nums"
                  />
                  <div className="group relative">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-pointer" />
                    <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg z-30">
                      Add any other charges or round off / adjustments to this delivery challan.
                    </div>
                  </div>
                  <span className="w-16 text-right text-slate-700 tabular-nums font-medium">
                    {(Number(adjustmentValue) || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200 pt-3">
                {/* Total ( ₹ ) */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-900">Total ( ₹ )</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECOND TWO-COLUMN SECTION: Terms & Conditions & Attachments */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-slate-100">
            {/* Left: Terms & Conditions */}
            <div className="lg:col-span-6 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Terms & Conditions
              </label>
              <textarea
                rows={3}
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 transition resize-none"
              />
            </div>

            {/* Right: Attach File(s) */}
            <div className="lg:col-span-6 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Attach File(s) to Delivery Challan
              </label>
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer shadow-2xs transition"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  Upload File
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                You can upload a maximum of 5 files, 10MB each
              </p>

              {/* Uploaded files preview list */}
              {attachedFiles.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  {attachedFiles.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <span className="font-medium text-slate-700 truncate max-w-xs">
                        {f.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* STICKY BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 sm:px-12 py-3.5 flex items-center justify-between shadow-lg z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("Draft")}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 rounded-lg shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save as Draft"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("Delivered")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save & Deliver
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleCancel}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 rounded-lg shadow-2xs transition cursor-pointer"
          >
            Cancel
          </button>
        </div>

        <div className="text-xs text-slate-500 hidden sm:block">
          Total Amount: <span className="font-bold text-slate-900">₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
