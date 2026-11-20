"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Package,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import {
  calculateInvoiceTotals,
  formatCurrency,
} from "@/lib/invoice-utils";
import {
  GST_RATE_OPTIONS,
  INDIAN_STATES,
  PAYMENT_TERMS_OPTIONS,
  type CustomerOption,
  type InvoiceRecord,
  type InvoiceSettingsData,
  type ItemOption,
} from "./invoice-types";
import { QuickCustomerModal } from "./quick-customer-modal";
import { QuickItemModal } from "./quick-item-modal";
import { ConfigureInvoiceNumberModal } from "./configure-invoice-number-modal";
import { formatInvoiceNumber } from "@/lib/invoice-numbering";
import {
  calculateDueDateFromPaymentTerms,
  type PaymentTermItem,
} from "@/lib/payment-terms";

interface InvoiceFormProps {
  initialData?: InvoiceRecord;
  isEditing?: boolean;
}

interface FormItemRow {
  rowId: string;
  itemId?: string;
  name: string;
  description: string;
  hsnCode: string;
  unit: string;
  quantity: number;
  rate: number;
  discount: number;
  discountType: "percent" | "amount";
  taxRate: number;
}

export function InvoiceForm({
  initialData,
  isEditing = false,
}: InvoiceFormProps) {
  const router = useRouter();

  // Master Data
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [availableItems, setAvailableItems] = useState<ItemOption[]>([]);
  const [activeItemRowId, setActiveItemRowId] = useState<string | null>(null);
  const [itemDropdownPosition, setItemDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const itemInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const itemDropdownRef = useRef<HTMLDivElement>(null);

  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showNumberConfigModal, setShowNumberConfigModal] = useState(false);

  // Settings & Numbering State
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettingsData | null>(null);
  const [autoGenerateNumbering, setAutoGenerateNumbering] = useState(true);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    if (initialData?.customerId) return initialData.customerId;
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("customerId") || "";
    }
    return "";
  });
  const [rows, setRows] = useState<FormItemRow[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items.map((item, idx) => ({
        rowId: `row-${idx + 1}`,
        itemId: item.itemId,
        name: item.name,
        description: item.description || "",
        hsnCode: item.hsnCode || "",
        unit: item.unit || "pcs",
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        discount: item.discount || 0,
        discountType: item.discountType || "percent",
        taxRate: item.taxRate || 18,
      }));
    }
    return [
      {
        rowId: "row-1",
        name: "",
        description: "",
        hsnCode: "",
        unit: "pcs",
        quantity: 1,
        rate: 0,
        discount: 0,
        discountType: "percent",
        taxRate: 18,
      },
    ];
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    }
    if (customerDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [customerDropdownOpen]);

  useEffect(() => {
    if (!activeItemRowId) return;

    const updateDropdownPosition = () => {
      const input = itemInputRefs.current[activeItemRowId];
      if (!input) return;
      const rect = input.getBoundingClientRect();
      setItemDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        (itemInputRefs.current[activeItemRowId]?.contains(target) ||
          itemDropdownRef.current?.contains(target))
      ) {
        return;
      }
      setActiveItemRowId(null);
    };

    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeItemRowId]);
  const [invoiceNumber, setInvoiceNumber] = useState(
    initialData?.number || "",
  );
  const [referenceNumber, setReferenceNumber] = useState(
    initialData?.referenceNumber || "",
  );
  const [invoiceDate, setInvoiceDate] = useState(() => {
    if (initialData?.issueDate) {
      return new Date(initialData.issueDate).toISOString().split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
  });
  const [paymentTerms, setPaymentTerms] = useState(
    initialData?.paymentTerms || "Due on Receipt",
  );
  const [dueDate, setDueDate] = useState(() => {
    if (initialData?.dueDate) {
      return new Date(initialData.dueDate).toISOString().split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
  });
  const [placeOfSupply, setPlaceOfSupply] = useState(
    initialData?.placeOfSupply || "Maharashtra",
  );
  const [salesperson, setSalesperson] = useState(
    initialData?.salesperson || "",
  );
  const [subject, setSubject] = useState(initialData?.subject || "");

  // Stock Location & Inventory State
  const [locations, setLocations] = useState<Array<{ id: string; name: string; type: "Warehouse" | "Shop"; code?: string }>>([]);
  const [stockLocationType, setStockLocationType] = useState<"Warehouse" | "Shop">(
    initialData?.stockLocationType || "Warehouse"
  );
  const [stockLocationId, setStockLocationId] = useState(
    initialData?.stockLocationId || ""
  );
  const [stockLocationName, setStockLocationName] = useState(
    initialData?.stockLocationName || ""
  );
  const [relatedDocumentId, setRelatedDocumentId] = useState<string>(
    initialData?.relatedDocumentId || ""
  );
  const [isLocationLocked, setIsLocationLocked] = useState<boolean>(
    Boolean(initialData?.relatedDocumentId || initialData?.stockLocationId)
  );
  const [stockLevels, setStockLevels] = useState<Record<string, { onHandStock: number; reservedStock: number; availableStock: number; damagedStock: number }>>({});

  useEffect(() => {
    let isMounted = true;
    fetch("/api/inventory/locations")
      .then((r) => (r.ok ? r.json() : { locations: [] }))
      .then((data) => {
        if (!isMounted) return;
        const locs = data.locations || [];
        setLocations(locs);
        if (!stockLocationId && locs.length > 0) {
          const firstWh = locs.find((l: { id: string; name: string; type: string }) => l.type === "Warehouse");
          if (firstWh) {
            setStockLocationType("Warehouse");
            setStockLocationId(firstWh.id);
            setStockLocationName(firstWh.name);
          } else {
            setStockLocationType(locs[0].type);
            setStockLocationId(locs[0].id);
            setStockLocationName(locs[0].name);
          }
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [stockLocationId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const soId = new URLSearchParams(window.location.search).get("salesOrderId");
    if (!soId) return;

    fetch(`/api/sales?id=${soId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !data.document) return;
        const doc = data.document;
        setRelatedDocumentId(doc.id || doc._id || soId);
        setIsLocationLocked(true);
        if (doc.stockLocationType) setStockLocationType(doc.stockLocationType);
        if (doc.stockLocationId) setStockLocationId(doc.stockLocationId);
        if (doc.stockLocationName) setStockLocationName(doc.stockLocationName);
        if (doc.customerId) setSelectedCustomerId(doc.customerId);
        if (Array.isArray(doc.items) && doc.items.length > 0) {
          setRows(
            doc.items.map((it: { itemId?: string; name?: string; description?: string; hsnCode?: string; unit?: string; quantity?: number; rate?: number; discount?: number; discountType?: "percent" | "amount"; taxRate?: number }, idx: number) => ({
              rowId: `row-${idx + 1}`,
              itemId: it.itemId,
              name: it.name || "",
              description: it.description || "",
              hsnCode: it.hsnCode || "",
              unit: it.unit || "pcs",
              quantity: Number(it.quantity) || 1,
              rate: Number(it.rate) || 0,
              discount: Number(it.discount) || 0,
              discountType: it.discountType || "percent",
              taxRate: Number(it.taxRate) || 18,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!stockLocationId) {
      void Promise.resolve().then(() => setStockLevels({}));
      return;
    }
    let isMounted = true;
    fetch(`/api/inventory/stock-levels?locationType=${stockLocationType}&locationId=${stockLocationId}`)
      .then((r) => (r.ok ? r.json() : { stockLevels: [] }))
      .then((data) => {
        if (!isMounted) return;
        const map: Record<string, { onHandStock: number; reservedStock: number; availableStock: number; damagedStock: number }> = {};
        for (const item of data.stockLevels || []) {
          map[item.commodityId] = {
            onHandStock: Number(item.onHandStock) || 0,
            reservedStock: Number(item.reservedStock) || 0,
            availableStock: Number(item.availableStock) || 0,
            damagedStock: Number(item.damagedStock) || 0,
          };
        }
        setStockLevels(map);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [stockLocationType, stockLocationId]);

  // Invoice-level adjustments
  const [invoiceDiscount, setInvoiceDiscount] = useState<string>(
    initialData ? String(initialData.discount || "") : "",
  );
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<
    "percent" | "amount"
  >(initialData?.discountType || "percent");
  const [shippingCharges, setShippingCharges] = useState<string>(
    initialData ? String(initialData.shippingCharges || "") : "",
  );
  const [adjustment, setAdjustment] = useState<string>(
    initialData ? String(initialData.adjustment || "") : "",
  );

  // Notes & terms
  const [customerNotes, setCustomerNotes] = useState(
    initialData?.customerNotes || "Thank you for your business. Please reach out with any questions.",
  );
  const [termsAndConditions, setTermsAndConditions] = useState(
    initialData?.termsAndConditions ||
      "1. Payment is due as per terms specified above.\n2. Please mention the invoice number in your remittance.\n3. Goods once sold will not be returned without authorization.",
  );

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Customers & Items
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch("/api/sales?section=customers").then((r) => (r.ok ? r.json() : { customers: [] })),
      fetch("/api/sales/invoices").then((r) => (r.ok ? r.json() : { customers: [] })),
      fetch("/api/items").then((r) => (r.ok ? r.json() : { items: [] })),
      fetch("/api/sales/invoices/settings").then((r) => (r.ok ? r.json() : { settings: null })),
    ])
      .then(([salesData, invData, itemsData, settingsData]) => {
        if (!isMounted) return;
        const rawCusts: Array<Record<string, unknown>> = [];
        if (Array.isArray(salesData.customers) && salesData.customers.length > 0) {
          rawCusts.push(...salesData.customers);
        }
        if (Array.isArray(invData.customers) && invData.customers.length > 0) {
          const existingIds = new Set(rawCusts.map((c) => String(c.id || c._id)));
          for (const c of invData.customers) {
            const cid = String(c.id || c._id);
            if (cid && !existingIds.has(cid)) {
              rawCusts.push(c);
              existingIds.add(cid);
            }
          }
        }
        const mappedCusts: CustomerOption[] = rawCusts
          .map((c) => ({
            id: String(c.id || c._id || ""),
            name: String(c.displayName || c.name || c.companyName || "Customer"),
            companyName: (c.companyName as string) || "",
            email: (c.email as string) || "",
            phone: (c.phone as string) || (c.mobile as string) || "",
            gstin: (c.gstin as string) || "",
            state: (c.state as string) || (c.billingAddress ? ((c.billingAddress as { state?: string }).state || "") : ""),
            paymentTerms: (c.paymentTerms as string) || "Due on Receipt",
            billingAddress: c.billingAddress as CustomerOption["billingAddress"],
            shippingAddress: c.shippingAddress as CustomerOption["shippingAddress"],
          }))
          .filter((c) => Boolean(c.id && c.name));
        setCustomers(mappedCusts);

        const mappedItems: ItemOption[] = ((itemsData.items || []) as Array<Record<string, unknown>>).map((i) => ({
          id: String(i.id || i.sku || ""),
          name: String(i.name || ""),
          sku: (i.sku as string) || "",
          salesPrice: Number(i.salesPrice || 0),
          salesDescription: (i.salesDescription as string) || "",
          hsnCode: (i.hsnCode as string) || "",
          unit: (i.unit as string) || "pcs",
          gstRate: Number(i.gstRate ?? 18),
        }));
        setAvailableItems(mappedItems);

        // Pre-fill next invoice number if creating new invoice
        if (settingsData.settings) {
          const s = settingsData.settings as InvoiceSettingsData;
          setInvoiceSettings(s);
          const isAuto = s.autoGenerateNumbering !== false;
          setAutoGenerateNumbering(isAuto);

          if (!isEditing && isAuto) {
            const formatted =
              s.formattedNextNumber ||
              formatInvoiceNumber(
                s.invoicePrefix || "INV-",
                s.nextNumber || 1,
                s.numberZeroPadding || 6,
              );
            setInvoiceNumber((current) => current || formatted);
          }
        }
      })
      .catch((err) => {
        console.error("Master data load error:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isEditing]);

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        (c.gstin && c.gstin.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)),
    );
  }, [customers, customerSearch]);

  const handleNumberingSaved = (updated: InvoiceSettingsData) => {
    setInvoiceSettings(updated);
    const isAuto = updated.autoGenerateNumbering !== false;
    setAutoGenerateNumbering(isAuto);

    if (!isEditing && isAuto) {
      const formatted =
        updated.formattedNextNumber ||
        formatInvoiceNumber(
          updated.invoicePrefix || "INV-",
          updated.nextNumber || 1,
          updated.numberZeroPadding || 6,
        );
      setInvoiceNumber(formatted);
    }
  };

  const [customTerms, setCustomTerms] = useState<PaymentTermItem[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/payment-terms")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.terms) return;
        setCustomTerms(data.terms);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const allPaymentTermsOptions = useMemo(() => {
    const list: string[] = [...PAYMENT_TERMS_OPTIONS];
    for (const ct of customTerms) {
      if (ct.name && !list.includes(ct.name)) {
        list.push(ct.name);
      }
    }
    if (paymentTerms && !list.includes(paymentTerms)) {
      list.push(paymentTerms);
    }
    return list;
  }, [customTerms, paymentTerms]);

  // Auto-update due date when invoice date or terms change
  const updateDueDateFromTerms = useCallback((dateStr: string, terms: string) => {
    try {
      const calculated = calculateDueDateFromPaymentTerms(dateStr, terms, customTerms);
      setDueDate(calculated);
    } catch {
      setDueDate(dateStr);
    }
  }, [customTerms]);

  // Handle Customer Selection
  const handleCustomerChange = useCallback((customerId: string) => {
    setSelectedCustomerId(customerId);
    const matched = customers.find((c) => c.id === customerId);
    if (matched) {
      if (matched.state) {
        setPlaceOfSupply(matched.state);
      }
      if (matched.paymentTerms) {
        setPaymentTerms(matched.paymentTerms);
        // Auto-update due date
        updateDueDateFromTerms(invoiceDate, matched.paymentTerms);
      }
    }
  }, [customers, invoiceDate, updateDueDateFromTerms]);

  useEffect(() => {
    if (!isEditing && customers.length > 0) {
      const urlCustomerId =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("customerId")
          : null;
      if (urlCustomerId) {
        const timer = setTimeout(() => {
          handleCustomerChange(urlCustomerId);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [customers, isEditing, handleCustomerChange]);

  // Row Manipulation
  const handleAddRow = () => {
    const newId = `row-${Date.now()}`;
    setRows((prev) => [
      ...prev,
      {
        rowId: newId,
        name: "",
        description: "",
        hsnCode: "",
        unit: "pcs",
        quantity: 1,
        rate: 0,
        discount: 0,
        discountType: "percent",
        taxRate: 18,
      },
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (rows.length === 1) {
      // Clear row instead of deleting last row
      setRows([
        {
          rowId: "row-1",
          name: "",
          description: "",
          hsnCode: "",
          unit: "pcs",
          quantity: 1,
          rate: 0,
          discount: 0,
          discountType: "percent",
          taxRate: 18,
        },
      ]);
      return;
    }
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handleUpdateRow = (rowId: string, updates: Partial<FormItemRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, ...updates } : r)),
    );
  };

  const handleSelectItem = (rowId: string, itemId: string) => {
    const item = availableItems.find((i) => i.id === itemId);
    if (!item) return;

    handleUpdateRow(rowId, {
      itemId: item.id,
      name: item.name,
      description: item.salesDescription || "",
      hsnCode: item.hsnCode || "",
      unit: item.unit || "pcs",
      rate: item.salesPrice || 0,
      taxRate: item.gstRate !== undefined ? item.gstRate : 18,
    });
    setActiveItemRowId(null);
  };

  // Live Calculations
  const calculated = useMemo(() => {
    const calcItems = rows.map((r) => ({
      quantity: r.quantity,
      rate: r.rate,
      discount: r.discount,
      discountType: r.discountType,
      taxRate: r.taxRate,
    }));

    return calculateInvoiceTotals({
      items: calcItems,
      invoiceDiscount: Number(invoiceDiscount) || 0,
      invoiceDiscountType,
      shippingCharges: Number(shippingCharges) || 0,
      adjustment: Number(adjustment) || 0,
      autoRoundOff: true,
      placeOfSupply,
      organizationState: "Maharashtra",
      amountPaid: initialData?.amountPaid || 0,
    });
  }, [
    rows,
    invoiceDiscount,
    invoiceDiscountType,
    shippingCharges,
    adjustment,
    placeOfSupply,
    initialData?.amountPaid,
  ]);

  const activeItemRow = rows.find((row) => row.rowId === activeItemRowId);
  const activeItemQuery = activeItemRow?.name.trim().toLowerCase() || "";
  const itemSuggestions = activeItemRow
    ? availableItems.filter((item) =>
        `${item.name} ${item.sku}`.toLowerCase().includes(activeItemQuery),
      )
    : [];

  // Form Submit
  async function handleSubmit(status: "Draft" | "Sent") {
    if (!selectedCustomerId) {
      setError("Please select a customer.");
      return;
    }

    const hasValidItem = rows.some((r) => r.name.trim() && r.quantity > 0);
    if (!hasValidItem) {
      setError("Please add at least one line item with a name and quantity.");
      return;
    }

    if (!isLocationLocked && !stockLocationId) {
      setError("Please select a stock location (Warehouse or Shop) for this invoice.");
      return;
    }

    // Direct invoice stock validation
    if (!isLocationLocked && status !== "Draft") {
      for (const row of rows.filter((r) => r.name.trim())) {
        if (row.itemId && stockLevels[row.itemId]) {
          const avail = stockLevels[row.itemId].availableStock;
          if (row.quantity > avail) {
            setError(
              `Insufficient available stock for "${row.name}". Available: ${avail}, Invoiced: ${row.quantity}`
            );
            return;
          }
        }
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        number: invoiceNumber.trim() || undefined,
        customerId: selectedCustomerId,
        stockLocationType,
        stockLocationId: stockLocationId || undefined,
        stockLocationName: stockLocationName || locations.find((l) => l.id === stockLocationId)?.name || undefined,
        relatedDocumentId: relatedDocumentId || initialData?.relatedDocumentId || undefined,
        issueDate: invoiceDate,
        dueDate,
        paymentTerms,
        placeOfSupply,
        salesperson: salesperson.trim() || undefined,
        subject: subject.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        customerNotes: customerNotes.trim() || undefined,
        termsAndConditions: termsAndConditions.trim() || undefined,
        status,
        discount: Number(invoiceDiscount) || 0,
        discountType: invoiceDiscountType,
        shippingCharges: Number(shippingCharges) || 0,
        adjustment: Number(adjustment) || 0,
        items: rows
          .filter((r) => r.name.trim())
          .map((r) => ({
            itemId: r.itemId || undefined,
            name: r.name.trim(),
            description: r.description.trim() || undefined,
            hsnCode: r.hsnCode.trim() || undefined,
            unit: r.unit || "pcs",
            quantity: Number(r.quantity) || 1,
            rate: Number(r.rate) || 0,
            discount: Number(r.discount) || 0,
            discountType: r.discountType,
            taxRate: Number(r.taxRate) || 0,
          })),
      };

      const url = isEditing
        ? `/api/sales/invoices/${initialData?.id}`
        : "/api/sales/invoices";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save invoice.");
      }

      const invoiceId = isEditing ? initialData?.id : data.invoice?.id;
      router.push(`/sales/invoices/${invoiceId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save invoice.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12 text-slate-800">
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/sales/invoices"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-xs hover:bg-slate-50 hover:text-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isEditing ? `Edit Invoice ${invoiceNumber}` : "New Invoice"}
            </h1>
            <p className="text-xs text-slate-500">
              Create a compliant commercial tax invoice with live calculations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/sales/invoices"
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => handleSubmit("Draft")}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-xs hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("Sent")}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save & Send"
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-medium text-rose-700 flex items-center justify-between shadow-xs">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-800 font-bold"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Primary Invoice Fields Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Customer Selection with Inline Quick Add Button */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-800">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowCustomerModal(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                New Customer
              </button>
            </div>
            <div className="relative" ref={customerDropdownRef}>
              <button
                type="button"
                onClick={() => setCustomerDropdownOpen((prev) => !prev)}
                className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition text-left cursor-pointer"
              >
                <span className={selectedCustomer ? "font-medium text-slate-900" : "text-slate-400"}>
                  {selectedCustomer
                    ? `${selectedCustomer.name}${selectedCustomer.companyName ? ` (${selectedCustomer.companyName})` : ""}`
                    : "-- Select or search customer --"}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {customerDropdownOpen && (
                <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in duration-150">
                  <input
                    type="text"
                    placeholder="Search by customer name, company, GSTIN, phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full mb-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 focus:bg-white"
                    autoFocus
                  />
                  <div className="divide-y divide-slate-100">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          handleCustomerChange(c.id);
                          setCustomerDropdownOpen(false);
                          setCustomerSearch("");
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 rounded-lg transition flex items-center justify-between cursor-pointer ${
                          c.id === selectedCustomerId ? "bg-blue-50/80 font-semibold text-blue-900" : "text-slate-800"
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {c.name}
                            {c.companyName && (
                              <span className="font-normal text-slate-500 ml-1">({c.companyName})</span>
                            )}
                          </p>
                          {(c.gstin || c.phone) && (
                            <p className="font-mono text-[10px] text-slate-400">
                              {c.gstin ? `GST: ${c.gstin}` : ""}
                              {c.gstin && c.phone ? " • " : ""}
                              {c.phone ? `Phone: ${c.phone}` : ""}
                            </p>
                          )}
                        </div>
                        {c.state && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {c.state}
                          </span>
                        )}
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <p className="p-3 text-center text-xs text-slate-400">No matching customers</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Hidden fallback select for accessibility and form automation */}
            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            >
              <option value="">-- Select or search customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.companyName ? `(${c.companyName})` : ""}
                </option>
              ))}
            </select>

            {/* Selected Customer Snapshot Pill */}
            {selectedCustomer && (
              <div className="mt-2.5 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900">
                    {selectedCustomer.name}
                  </span>
                  {selectedCustomer.companyName && (
                    <span className="text-slate-500 ml-1">
                      • {selectedCustomer.companyName}
                    </span>
                  )}
                  {selectedCustomer.gstin && (
                    <span className="ml-2 font-mono font-medium text-slate-600">
                      GSTIN: {selectedCustomer.gstin}
                    </span>
                  )}
                </div>
                {selectedCustomer.state && (
                  <span className="rounded-md bg-white px-2 py-0.5 font-medium border border-blue-200 text-blue-700">
                    State: {selectedCustomer.state}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Invoice Number with Settings Gear */}
          <div>
            <label className="block text-xs font-semibold text-[#b91c1c] mb-1.5">
              Invoice#<span className="text-[#b91c1c]">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder={autoGenerateNumbering ? "e.g. INV-000001" : "Enter invoice number"}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 font-mono text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
              />
              <button
                type="button"
                id="invoice-number-config-btn"
                onClick={() => setShowNumberConfigModal(true)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                title="Configure Invoice Number Preferences"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
            {autoGenerateNumbering && (
              <p className="mt-1 text-[11px] text-slate-400">
                Auto-generated sequence. Click gear to customize prefix or sequence.
              </p>
            )}
          </div>

          {/* Invoice Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Invoice Date
            </label>
            <input
              type="date"
              required
              value={invoiceDate}
              onChange={(e) => {
                setInvoiceDate(e.target.value);
                updateDueDateFromTerms(e.target.value, paymentTerms);
              }}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          {/* Payment Terms */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Payment Terms
            </label>
            <select
              value={paymentTerms}
              onChange={(e) => {
                setPaymentTerms(e.target.value);
                updateDueDateFromTerms(invoiceDate, e.target.value);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              {allPaymentTermsOptions.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Due Date
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          {/* Place of Supply */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Place of Supply (State)
            </label>
            <select
              value={placeOfSupply}
              onChange={(e) => setPlaceOfSupply(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Reference # / PO # */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Order / Reference #
            </label>
            <input
              type="text"
              placeholder="e.g. PO-8491, Client Ref"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          {/* Salesperson */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Salesperson
            </label>
            <input
              type="text"
              placeholder="e.g. Anita Sharma"
              value={salesperson}
              onChange={(e) => setSalesperson(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
        </div>

        {/* Stock Location */}
        {isLocationLocked ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔒</span>
                <div>
                  <p className="text-xs font-bold text-amber-900">
                    Stock Location: {stockLocationType} - {stockLocationName || stockLocationId}
                  </p>
                  <p className="text-xs text-amber-700">
                    Locked to Sales Order reservation. Invoicing will deduct {stockLocationType} On Hand and Reserved stock automatically.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold bg-amber-200/80 text-amber-900 px-2.5 py-1 rounded-full border border-amber-300">
                SO Reserved
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
                Stock Location <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-medium text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded-md">
                Direct Stock Out Source
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStockLocationType("Warehouse");
                    const firstWh = locations.find((l) => l.type === "Warehouse");
                    if (firstWh) {
                      setStockLocationId(firstWh.id);
                      setStockLocationName(firstWh.name);
                    }
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    stockLocationType === "Warehouse"
                      ? "border-blue-600 bg-white text-blue-700 shadow-xs ring-2 ring-blue-100"
                      : "border-slate-200 bg-white/70 text-slate-600 hover:bg-white"
                  }`}
                >
                  🏢 Warehouse
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStockLocationType("Shop");
                    const firstShop = locations.find((l) => l.type === "Shop");
                    if (firstShop) {
                      setStockLocationId(firstShop.id);
                      setStockLocationName(firstShop.name);
                    }
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    stockLocationType === "Shop"
                      ? "border-blue-600 bg-white text-blue-700 shadow-xs ring-2 ring-blue-100"
                      : "border-slate-200 bg-white/70 text-slate-600 hover:bg-white"
                  }`}
                >
                  🏪 Shop
                </button>
              </div>
              <div className="sm:col-span-2">
                <select
                  value={stockLocationId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setStockLocationId(id);
                    const found = locations.find((l) => l.id === id);
                    setStockLocationName(found ? found.name : "");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
                >
                  <option value="">Select {stockLocationType}...</option>
                  {locations
                    .filter((l) => l.type === stockLocationType)
                    .map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.code ? `(${loc.code})` : ""}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Subject line */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1.5">
            Subject / Project
          </label>
          <input
            type="text"
            placeholder="e.g. Supply of Agro Commodities for Q4 Contract"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
      </div>

      {/* 3. Line Items Grid Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Line Items</h3>
            <p className="text-xs text-slate-500">
              Add products, services, commodities, or custom line items
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowItemModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition cursor-pointer"
          >
            <Package className="h-3.5 w-3.5" />
            + New Product
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase text-[11px]">
                <th className="py-2.5 px-3 min-w-[240px]">Item & Description</th>
                <th className="py-2.5 px-3 w-28">HSN/SAC</th>
                <th className="py-2.5 px-3 w-24">Qty</th>
                <th className="py-2.5 px-3 w-20">Unit</th>
                <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>
                <th className="py-2.5 px-3 w-28 text-right">Disc (%)</th>
                <th className="py-2.5 px-3 w-32 text-right">Tax</th>
                <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => {
                const rowCalc = calculated.items[idx];
                return (
                  <tr key={row.rowId} className="hover:bg-slate-50/40 transition">
                    {/* Item Name / Picker */}
                    <td className="py-3 px-3 align-top">
                      <div className="space-y-1.5">
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="Type item name..."
                            value={row.name}
                            autoComplete="off"
                            role="combobox"
                            aria-expanded={activeItemRowId === row.rowId}
                            aria-controls={`invoice-item-options-${row.rowId}`}
                            ref={(input) => {
                              itemInputRefs.current[row.rowId] = input;
                            }}
                            onFocus={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              setItemDropdownPosition({
                                top: rect.bottom + window.scrollY + 4,
                                left: rect.left + window.scrollX,
                                width: rect.width,
                              });
                              setActiveItemRowId(row.rowId);
                            }}
                            onBlur={(event) => {
                              const nextTarget = event.relatedTarget as Node | null;
                              if (!nextTarget || !itemDropdownRef.current?.contains(nextTarget)) {
                                setActiveItemRowId(null);
                              }
                            }}
                            onChange={(e) => {
                              const updates: Partial<FormItemRow> = { name: e.target.value };
                              if (row.itemId) {
                                updates.itemId = undefined;
                                updates.description = "";
                                updates.hsnCode = "";
                                updates.unit = "pcs";
                                updates.rate = 0;
                                updates.taxRate = 18;
                              }
                              handleUpdateRow(row.rowId, updates);
                              setActiveItemRowId(row.rowId);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-blue-500"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Description (optional)"
                          value={row.description}
                          onChange={(e) =>
                            handleUpdateRow(row.rowId, {
                              description: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200/80 px-2.5 py-1 text-[11px] text-slate-600 outline-none focus:border-blue-500"
                        />
                        {row.itemId && stockLevels[row.itemId] && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] pt-0.5 font-medium">
                            <span className="text-slate-500">
                              On Hand: <strong className="text-slate-800">{stockLevels[row.itemId].onHandStock}</strong>
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-amber-600">
                              Reserved: <strong>{stockLevels[row.itemId].reservedStock}</strong>
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className={stockLevels[row.itemId].availableStock < row.quantity ? "text-rose-600 font-bold" : "text-emerald-700 font-semibold"}>
                              Available: {stockLevels[row.itemId].availableStock}
                            </span>
                            {!isLocationLocked && stockLevels[row.itemId].availableStock < row.quantity && (
                              <span className="text-[9px] bg-rose-50 text-rose-600 border border-rose-200 px-1 py-0.2 rounded">
                                Exceeds Available
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* HSN */}
                    <td className="py-3 px-3 align-top">
                      <input
                        type="text"
                        placeholder="HSN"
                        value={row.hsnCode}
                        onChange={(e) =>
                          handleUpdateRow(row.rowId, { hsnCode: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs text-slate-800 outline-none focus:border-blue-500"
                      />
                    </td>

                    {/* Qty */}
                    <td className="py-3 px-3 align-top">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={row.quantity}
                        onChange={(e) =>
                          handleUpdateRow(row.rowId, {
                            quantity: Number(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-blue-500"
                      />
                    </td>

                    {/* Unit */}
                    <td className="py-3 px-3 align-top">
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) =>
                          handleUpdateRow(row.rowId, { unit: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                      />
                    </td>

                    {/* Rate */}
                    <td className="py-3 px-3 align-top text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={row.rate}
                        onChange={(e) =>
                          handleUpdateRow(row.rowId, {
                            rate: Number(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs font-semibold text-right text-slate-900 outline-none focus:border-blue-500"
                      />
                    </td>

                    {/* Discount */}
                    <td className="py-3 px-3 align-top text-right">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="0"
                        value={row.discount || ""}
                        onChange={(e) =>
                          handleUpdateRow(row.rowId, {
                            discount: Number(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs text-right text-slate-700 outline-none focus:border-blue-500"
                      />
                    </td>

                    {/* Tax Rate */}
                    <td className="py-3 px-3 align-top text-right">
                      <select
                        value={row.taxRate}
                        onChange={(e) =>
                          handleUpdateRow(row.rowId, {
                            taxRate: Number(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                      >
                        {GST_RATE_OPTIONS.map((g) => (
                          <option key={g.rate} value={g.rate}>
                            {g.rate}%
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-3 align-top text-right font-mono font-bold text-slate-900">
                      {formatCurrency(rowCalc?.amount || 0)}
                    </td>

                    {/* Delete Action */}
                    <td className="py-3 px-2 align-top text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.rowId)}
                        title="Delete line item"
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add Row Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Another Line Item
          </button>
        </div>
      </div>

      {/* 4. Totals, Taxes & Notes Card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Notes & Terms */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Customer Notes
            </label>
            <textarea
              rows={3}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Notes for client to see on invoice..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Terms & Conditions
            </label>
            <textarea
              rows={4}
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Terms and conditions..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        {/* Right: Calculations Summary Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-3.5 text-xs">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5">
            Summary & Taxes
          </h3>

          <div className="flex justify-between items-center text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono font-semibold text-slate-900 text-sm">
              {formatCurrency(calculated.subTotal)}
            </span>
          </div>

          {/* Invoice-level Discount Input */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-600">Invoice Discount:</span>
            <div className="flex items-center gap-1.5 w-36">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={invoiceDiscount}
                onChange={(e) => setInvoiceDiscount(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right font-mono text-xs text-slate-900 outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() =>
                  setInvoiceDiscountType((prev) =>
                    prev === "percent" ? "amount" : "percent",
                  )
                }
                className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                {invoiceDiscountType === "percent" ? "%" : "₹"}
              </button>
            </div>
          </div>

          {/* Tax Breakdown */}
          {calculated.cgst > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>CGST (Intra-state 50%):</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCurrency(calculated.cgst)}
              </span>
            </div>
          )}

          {calculated.sgst > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>SGST (Intra-state 50%):</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCurrency(calculated.sgst)}
              </span>
            </div>
          )}

          {calculated.igst > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>IGST (Inter-state 100%):</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCurrency(calculated.igst)}
              </span>
            </div>
          )}

          {/* Shipping Charges */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-600">Shipping Charges:</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={shippingCharges}
              onChange={(e) => setShippingCharges(e.target.value)}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right font-mono text-xs text-slate-900 outline-none focus:border-blue-500"
            />
          </div>

          {/* Adjustment */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-600">Adjustment (+ or -):</span>
            <input
              type="number"
              step="0.01"
              placeholder="0"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right font-mono text-xs text-slate-900 outline-none focus:border-blue-500"
            />
          </div>

          {calculated.roundOff !== 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Round Off:</span>
              <span className="font-mono font-medium">
                {calculated.roundOff > 0 ? "+" : ""}
                {formatCurrency(calculated.roundOff)}
              </span>
            </div>
          )}

          {/* Grand Total */}
          <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-900">Grand Total:</span>
            <span className="text-xl font-extrabold text-blue-600 font-mono">
              {formatCurrency(calculated.grandTotal)}
            </span>
          </div>

          {/* Live Words Preview */}
          <div className="rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600 italic">
            <span className="font-bold text-slate-800 not-italic">In words:</span>{" "}
            {calculated.amountInWords}
          </div>
        </div>
      </div>

      {/* 5. Sticky Bottom Action Bar */}
      <div className="sticky bottom-4 z-40 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Items: {rows.filter((r) => r.name.trim()).length}</span>
          <span>•</span>
          <span>
            Total:{" "}
            <strong className="text-slate-900 font-mono font-bold">
              {formatCurrency(calculated.grandTotal)}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleSubmit("Draft")}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("Sent")}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer active:scale-98"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save & Send Invoice"
            )}
          </button>
        </div>
      </div>

      {/* Inline Quick Modals */}
      {showCustomerModal && (
        <QuickCustomerModal
          isOpen={showCustomerModal}
          onClose={() => setShowCustomerModal(false)}
          onSuccess={(newCustomer) => {
            setCustomers((prev) => [newCustomer, ...prev]);
            handleCustomerChange(newCustomer.id);
          }}
        />
      )}

      {showItemModal && (
        <QuickItemModal
          isOpen={showItemModal}
          onClose={() => setShowItemModal(false)}
          onSuccess={(newItem) => {
            setAvailableItems((prev) => [newItem, ...prev]);
            // Add row with new item
            const newRowId = `row-${Date.now()}`;
            setRows((prev) => [
              ...prev,
              {
                rowId: newRowId,
                itemId: newItem.id,
                name: newItem.name,
                description: newItem.salesDescription || "",
                hsnCode: newItem.hsnCode || "",
                unit: newItem.unit || "pcs",
                quantity: 1,
                rate: newItem.salesPrice || 0,
                discount: 0,
                discountType: "percent",
                taxRate: newItem.gstRate !== undefined ? newItem.gstRate : 18,
              },
            ]);
          }}
        />
      )}

      {/* Invoice Number Configuration Modal */}
      {showNumberConfigModal && (
        <ConfigureInvoiceNumberModal
          isOpen={showNumberConfigModal}
          onClose={() => setShowNumberConfigModal(false)}
          currentSettings={invoiceSettings}
          onSaved={handleNumberingSaved}
        />
      )}
      {activeItemRow && itemDropdownPosition && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={itemDropdownRef}
            id={`invoice-item-options-${activeItemRow.rowId}`}
            role="listbox"
            style={{
              position: "absolute",
              top: itemDropdownPosition.top,
              left: itemDropdownPosition.left,
              width: itemDropdownPosition.width,
              zIndex: 1000,
            }}
            className="rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {itemSuggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={activeItemRow.itemId === item.id}
                onClick={() => handleSelectItem(activeItemRow.rowId, item.id)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
              >
                <span className="font-semibold text-slate-800">{item.name}</span>
                <span className="shrink-0 text-[10px] text-slate-500">
                  {item.sku ? `${item.sku} · ` : ""}
                  {formatCurrency(item.salesPrice)}
                </span>
              </button>
            ))}
            {itemSuggestions.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-500">
                {activeItemQuery
                  ? "No matching product. Continue typing a custom item."
                  : "No products available. Continue with a custom item."}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
