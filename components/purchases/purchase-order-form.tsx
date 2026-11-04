"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  Edit2,
  FileText,
  ListPlus,
  Loader2,
  PackageCheck,
  Paperclip,
  Plus,
  Printer,
  Search,
  Send,
  Settings,
  Trash2,
  Truck,
  UploadCloud,
  User,
  X,
  XCircle,
} from "lucide-react";
import type {
  PurchaseOrderItemRecord,
  PurchaseOrderRecord,
  PurchaseOrderStatus,
} from "@/models/purchase-order";
import {
  ConfigurePoNumberModal,
  type PurchaseOrderPreferencesData,
} from "./configure-po-number-modal";

export type PurchaseOrderFormMode = "create" | "edit" | "view";

export interface ItemCatalogOption {
  id: string;
  name: string;
  sku: string;
  unit: string;
  purchasePrice: number;
  purchaseAccount: string;
  purchaseDescription?: string;
}

export interface VendorOption {
  id: string;
  displayName: string;
  companyName: string;
  email: string;
  phone: string;
  gstin?: string;
  pan?: string;
  paymentTerms?: string;
  address?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface CustomerOption {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: {
    attention?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
}

export const accountOptions = [
  "Cost of Goods Sold",
  "Raw Materials Inventory",
  "Finished Goods Inventory",
  "Packaging Supplies",
  "Freight & Shipping Charges",
  "Warehouse & Storage Maintenance",
  "Office Supplies & Stationery",
  "Repairs & Maintenance",
  "Customs & Import Duties",
  "General Operating Expense",
];

export const paymentTermOptions = [
  "Due on Receipt",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
  "Due end of the month",
  "50% Advance, 50% on Delivery",
  "Custom",
];

export const shipmentPreferenceOptions = [
  "Surface Express Freight",
  "Road Transport / Truck Load",
  "Air Cargo",
  "Rail Container",
  "Self Pickup / Ex-Warehouse",
  "Standard Courier",
  "Direct Farmer Gate Collection",
];

export const taxRateOptions = [
  { label: "0% GST (Exempted)", value: 0 },
  { label: "5% GST", value: 5 },
  { label: "12% GST", value: 12 },
  { label: "18% GST (Standard)", value: 18 },
  { label: "28% GST", value: 28 },
];

export const tdsTcsOptions = [
  { label: "None", type: "None", rate: 0, text: "No tax deduction" },
  {
    label: "TDS @ 0.1% (Sec 194Q - Purchase of Goods)",
    type: "TDS",
    rate: 0.1,
    text: "TDS @ 0.1% - Sec 194Q",
  },
  {
    label: "TDS @ 1.0% (Sec 194C - Individual Transporter)",
    type: "TDS",
    rate: 1.0,
    text: "TDS @ 1.0% - Sec 194C",
  },
  {
    label: "TDS @ 2.0% (Sec 194C - Corporate Transporter)",
    type: "TDS",
    rate: 2.0,
    text: "TDS @ 2.0% - Sec 194C",
  },
  {
    label: "TCS @ 0.1% (Sec 206C(1H) - Sale/Receipt of Goods)",
    type: "TCS",
    rate: 0.1,
    text: "TCS @ 0.1% - Sec 206C",
  },
];

const defaultOrgAddress = {
  name: "BharatGodam Central Logistics Depot",
  attention: "Warehouse Manager",
  street1: "Godown 4B, APMC Market Yard",
  street2: "Sector 19, Turbhe",
  city: "Navi Mumbai",
  state: "Maharashtra",
  postalCode: "400705",
  country: "India",
  phone: "+91 22 2789 5400",
};

interface PurchaseOrderFormProps {
  initialData?: Partial<PurchaseOrderRecord>;
  mode?: PurchaseOrderFormMode;
  purchaseOrderId?: string;
  isPrintView?: boolean;
}

export function PurchaseOrderForm({
  initialData,
  mode = "create",
  purchaseOrderId,
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const isViewMode = mode === "view";

  // Options State
  const [vendors, setVendors] = useState<VendorOption[]>([
    {
      id: "V-401",
      displayName: "Mohan Traders",
      companyName: "Mohan Traders Pvt Ltd",
      email: "mohan@traders.in",
      phone: "+91 98201 44521",
      gstin: "27AABCM8421K1ZK",
      pan: "ABCDE1234F",
      paymentTerms: "Net 30",
      address: {
        street1: "Plot 14, APMC Market Yard",
        street2: "Phase 2",
        city: "Navi Mumbai",
        state: "Maharashtra",
        postalCode: "400705",
        country: "India",
      },
    },
    {
      id: "V-402",
      displayName: "Shree Packaging",
      companyName: "Shree Packaging Ltd",
      email: "finance@shreepack.in",
      phone: "+91 22 2490 8812",
      gstin: "27AABCS7712Q1ZX",
      pan: "SHREE1234D",
      paymentTerms: "Due on Receipt",
      address: {
        street1: "Plot 88, Wagle Estate",
        street2: "Road No 16",
        city: "Thane",
        state: "Maharashtra",
        postalCode: "400604",
        country: "India",
      },
    },
    {
      id: "V-403",
      displayName: "Metro Logistics",
      companyName: "Metro Logistics Services",
      email: "payables@metrologistics.in",
      phone: "+91 98200 44111",
      gstin: "27AABCM6612P1ZN",
      pan: "METRO9821K",
      paymentTerms: "Net 15",
      address: {
        street1: "Plot 3, Logistics Park",
        street2: "Panvel Bypass",
        city: "Navi Mumbai",
        state: "Maharashtra",
        postalCode: "410206",
        country: "India",
      },
    },
    {
      id: "V-404",
      displayName: "Kaveri Agro Industries",
      companyName: "Kaveri Agro Industries Ltd",
      email: "orders@kaveriagro.in",
      phone: "+91 98450 12890",
      gstin: "29AABCK1092M1ZN",
      pan: "KAVAG9912P",
      paymentTerms: "Net 15",
      address: {
        street1: "Agro Complex, Post Box 12",
        city: "Belagavi",
        state: "Karnataka",
        postalCode: "590001",
        country: "India",
      },
    },
  ]);

  const [customers] = useState<CustomerOption[]>([
    {
      id: "C-101",
      name: "Astra Foods",
      companyName: "Astra Foods Ltd",
      email: "billing@astrafoods.in",
      phone: "+91 20 2712 9000",
      address: {
        attention: "Plant Incharge",
        street: "Plot 55, MIDC Industrial Area, Chakan",
        city: "Pune",
        state: "Maharashtra",
        postalCode: "410501",
      },
    },
    {
      id: "C-102",
      name: "City Retail",
      companyName: "City Retail Chains Pvt Ltd",
      email: "accounts@cityretail.in",
      phone: "+91 22 2899 4321",
      address: {
        attention: "Central Distribution Center",
        street: "Warehouse Hub 12, Bhiwandi",
        city: "Thane",
        state: "Maharashtra",
        postalCode: "421302",
      },
    },
    {
      id: "C-103",
      name: "Ganga Stores",
      companyName: "Ganga General Stores",
      email: "ap@gangastores.in",
      phone: "+91 79 2650 1199",
      address: {
        attention: "Mr. Ramesh Shah",
        street: "Relief Road Wholesale Market",
        city: "Ahmedabad",
        state: "Gujarat",
        postalCode: "380001",
      },
    },
  ]);

  const [itemsCatalog, setItemsCatalog] = useState<ItemCatalogOption[]>([
    {
      id: "SKU-1001",
      name: "Rice 25kg Premium Bag",
      sku: "SKU-1001",
      unit: "Bag",
      purchasePrice: 2100,
      purchaseAccount: "Cost of Goods Sold",
      purchaseDescription: "Grade A aged basmati rice in woven sacks",
    },
    {
      id: "SKU-1002",
      name: "Milling Wheat Sharbati 50kg",
      sku: "SKU-1002",
      unit: "Bag",
      purchasePrice: 1850,
      purchaseAccount: "Raw Materials Inventory",
      purchaseDescription: "Cleaned milling grade wheat lot",
    },
    {
      id: "SKU-PACK-5PLY",
      name: "Corrugated Master Cartons (5-Ply)",
      sku: "SKU-PACK-5PLY",
      unit: "pcs",
      purchasePrice: 68,
      purchaseAccount: "Packaging Supplies",
      purchaseDescription: "Export specification outer corrugated boxes for food grain packs",
    },
    {
      id: "SKU-PAL-01",
      name: "Standard Wooden Pallets (ISPM-15)",
      sku: "SKU-PAL-01",
      unit: "pcs",
      purchasePrice: 1450,
      purchaseAccount: "Warehouse & Storage Maintenance",
      purchaseDescription: "1200x1000mm four-way entry warehouse storage pallets",
    },
    {
      id: "SKU-CORN-01",
      name: "Yellow Corn Maize 50kg",
      sku: "SKU-CORN-01",
      unit: "Bag",
      purchasePrice: 1100,
      purchaseAccount: "Cost of Goods Sold",
      purchaseDescription: "Poultry feed quality lot",
    },
  ]);

  // Bulk Add Items Modal State
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkItemSearch, setBulkItemSearch] = useState("");
  const [selectedCatalogItemIds, setSelectedCatalogItemIds] = useState<Set<string>>(new Set());

  // Purchase Order Number Preferences State
  const [showNumberConfigModal, setShowNumberConfigModal] = useState(false);
  const [poPreferences, setPoPreferences] = useState<PurchaseOrderPreferencesData | null>(null);
  const [autoGenerateNumbering, setAutoGenerateNumbering] = useState(true);

  // Form Fields State
  const [poNumber, setPoNumber] = useState<string>(() => {
    if (initialData?.purchaseOrderNumber && mode !== "create") {
      return initialData.purchaseOrderNumber;
    }
    return "";
  });
  const [isEditingPONumber, setIsEditingPONumber] = useState(false);

  // Load PO numbering preferences on mount
  useEffect(() => {
    let isMounted = true;
    fetch("/api/purchases/purchase-orders/preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.preferences) return;
        setPoPreferences(data.preferences);
        const isAuto = data.preferences.autoGenerateNumbering !== false;
        setAutoGenerateNumbering(isAuto);

        // Pre-fill next PO number if creating a new order
        if (mode === "create") {
          if (isAuto && data.formattedNextNumber) {
            setPoNumber(data.formattedNextNumber);
            setIsEditingPONumber(false);
          } else if (!isAuto) {
            setIsEditingPONumber(true);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load purchase order numbering preferences:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [mode]);

  const handlePreferencesSaved = (updated: PurchaseOrderPreferencesData) => {
    setPoPreferences(updated);
    const isAuto = updated.autoGenerateNumbering !== false;
    setAutoGenerateNumbering(isAuto);

    if (mode === "create") {
      if (isAuto && updated.formattedNextNumber) {
        setPoNumber(updated.formattedNextNumber);
        setIsEditingPONumber(false);
      } else if (!isAuto) {
        setIsEditingPONumber(true);
      }
    }
  };
  const [referenceNumber, setReferenceNumber] = useState<string>(
    () => initialData?.referenceNumber || "",
  );

  // Vendor State
  const [selectedVendorName, setSelectedVendorName] = useState<string>(
    () => initialData?.vendorName || "Mohan Traders",
  );
  const selectedVendor = useMemo(
    () => vendors.find((v) => v.displayName === selectedVendorName),
    [vendors, selectedVendorName],
  );

  // Delivery Address State
  const [deliveryType, setDeliveryType] = useState<"organization" | "customer">(
    () => initialData?.deliveryAddressType || "organization",
  );
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>(
    () => initialData?.customerName || "",
  );
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.name === selectedCustomerName),
    [customers, selectedCustomerName],
  );

  // Dates and Shipping
  const [orderDate, setOrderDate] = useState<string>(
    () => initialData?.orderDate || new Date().toISOString().split("T")[0],
  );
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    if (initialData?.deliveryDate) return initialData.deliveryDate;
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [paymentTerms, setPaymentTerms] = useState<string>(
    () => initialData?.paymentTerms || selectedVendor?.paymentTerms || "Due on Receipt",
  );
  const [shipmentPreference, setShipmentPreference] = useState<string>(
    () => initialData?.shipmentPreference || "Surface Express Freight",
  );

  // Line Items State
  const [items, setItems] = useState<PurchaseOrderItemRecord[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items;
    }
    return [
      {
        name: "Rice 25kg Premium Bag",
        description: "Grade A aged basmati rice in woven sacks",
        sku: "SKU-1001",
        account: "Cost of Goods Sold",
        quantity: 100,
        receivedQuantity: 0,
        unit: "Bag",
        rate: 2100,
        discount: 0,
        discountType: "percent",
        taxRate: 5,
        taxAmount: 10500,
        amount: 220500,
      },
    ];
  });

  // Summary & Discount / Tax / Adjustment State
  const [orderDiscount, setOrderDiscount] = useState<number>(() => initialData?.discount || 0);
  const [orderDiscountType, setOrderDiscountType] = useState<"percent" | "amount">(
    () => initialData?.discountType || "percent",
  );
  const [selectedTdsTcsOption, setSelectedTdsTcsOption] = useState<string>(() => {
    if (initialData?.taxType === "TDS") return tdsTcsOptions[1].label;
    if (initialData?.taxType === "TCS") return tdsTcsOptions[4].label;
    return tdsTcsOptions[0].label;
  });
  const [adjustment, setAdjustment] = useState<number>(() => initialData?.adjustment || 0);
  const [adjustmentDescription] = useState<string>(
    () => initialData?.adjustmentDescription || "",
  );

  // Notes, Terms & Attachments
  const [notes, setNotes] = useState<string>(
    () => initialData?.notes || "Please inspect packaging seals and deliver with physical duplicate invoice.",
  );
  const [termsAndConditions, setTermsAndConditions] = useState<string>(() => {
    if (initialData?.termsAndConditions) return initialData.termsAndConditions;
    return (
      "1. Delivery must strictly match the agreed schedule.\n" +
      "2. Quality and quantity verification will be completed at receiving dock within 48 hours.\n" +
      "3. The purchase order number must be quoted in all challans, correspondence, and tax invoices."
    );
  });
  const [attachments, setAttachments] = useState<
    Array<{ id: string; name: string; size: number; type: string; uploadedAt: string }>
  >(() => (initialData?.attachments as Array<{ id: string; name: string; size: number; type: string; uploadedAt: string }>) || []);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Status and Receiving Log in View Mode
  const [currentStatus, setCurrentStatus] = useState<PurchaseOrderStatus>(
    () => initialData?.status || "Draft",
  );
  const [receivingLogs, setReceivingLogs] = useState<
    Array<{
      receivedAt: string | Date;
      receivedBy: string;
      notes?: string;
      items: Array<{ name: string; quantityReceived: number }>;
    }>
  >(() => (initialData?.receivingLogs as Array<{
    receivedAt: string | Date;
    receivedBy: string;
    notes?: string;
    items: Array<{ name: string; quantityReceived: number }>;
  }>) || []);

  // Inward Goods Receiving Modal in View Mode
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [inwardQuantities, setInwardQuantities] = useState<Record<string, number>>({});
  const [inwardReceivedBy, setInwardReceivedBy] = useState("Store Manager");
  const [inwardNotes, setInwardNotes] = useState("");
  const [submittingInward, setSubmittingInward] = useState(false);

  // Submission State & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Fetch remote vendors, customers, items if available
  useEffect(() => {
    let mounted = true;
    fetch("/api/vendors")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.vendors?.length) return;
        setVendors((prev) => {
          const names = new Set(prev.map((v) => v.displayName));
          const newOnes = data.vendors
            .filter((v: { displayName?: string; name?: string }) => !names.has(v.displayName || v.name || ""))
            .map((v: { _id?: string; id?: string; displayName?: string; name?: string; email?: string; workPhone?: string; pan?: string }) => ({
              id: v._id || v.id || v.displayName || String(Math.random()),
              displayName: v.displayName || v.name || "Vendor",
              companyName: v.displayName || v.name || "Vendor",
              email: v.email || "",
              phone: v.workPhone || "",
              pan: v.pan || "",
            }));
          return [...prev, ...newOnes];
        });
      })
      .catch(() => {});

    fetch("/api/items")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.items?.length) return;
        setItemsCatalog((prev) => {
          const skus = new Set(prev.map((i) => i.sku));
          const additions = data.items
            .filter((it: { sku?: string }) => it.sku && !skus.has(it.sku))
            .map((it: { id?: string; name: string; sku?: string; unit?: string; purchasePrice?: number; purchaseAccount?: string }) => ({
              id: it.id || it.sku,
              name: it.name,
              sku: it.sku || `SKU-${Date.now()}`,
              unit: it.unit || "pcs",
              purchasePrice: it.purchasePrice || 0,
              purchaseAccount: it.purchaseAccount || "Cost of Goods Sold",
            }));
          return [...prev, ...additions];
        });
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  // Update payment terms when vendor changes
  const handleVendorSelect = (name: string) => {
    setSelectedVendorName(name);
    const match = vendors.find((v) => v.displayName === name);
    if (match?.paymentTerms && mode === "create") {
      setPaymentTerms(match.paymentTerms);
    }
  };

  // Calculations for line items
  const updateItemRow = (index: number, field: keyof PurchaseOrderItemRecord, value: unknown) => {
    if (isViewMode) return;
    setItems((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };

      // Recalculate line total
      const base = Number(row.quantity || 0) * Number(row.rate || 0);
      let disc = 0;
      if (row.discountType === "percent") {
        disc = (base * Number(row.discount || 0)) / 100;
      } else {
        disc = Math.min(base, Number(row.discount || 0));
      }
      const taxable = Math.max(0, base - disc);
      const tax = Math.round(((taxable * Number(row.taxRate || 0)) / 100) * 100) / 100;
      row.taxAmount = tax;
      row.amount = Math.round((taxable + tax) * 100) / 100;

      updated[index] = row;
      return updated;
    });
  };

  // Select Item from Catalog for a row
  const handlePickCatalogItem = (index: number, itemId: string) => {
    const catalogItem = itemsCatalog.find((ci) => ci.id === itemId || ci.sku === itemId);
    if (!catalogItem) return;

    setItems((prev) => {
      const updated = [...prev];
      const base = (updated[index].quantity || 1) * catalogItem.purchasePrice;
      const tax = Math.round(((base * (updated[index].taxRate || 18)) / 100) * 100) / 100;

      updated[index] = {
        ...updated[index],
        name: catalogItem.name,
        sku: catalogItem.sku,
        description: catalogItem.purchaseDescription || `${catalogItem.name} procurement`,
        rate: catalogItem.purchasePrice,
        unit: catalogItem.unit,
        account: catalogItem.purchaseAccount || "Cost of Goods Sold",
        taxAmount: tax,
        amount: Math.round((base + tax) * 100) / 100,
      };
      return updated;
    });
  };

  // Add Item Row
  const handleAddRow = () => {
    if (isViewMode) return;
    setItems((prev) => [
      ...prev,
      {
        name: "",
        description: "",
        sku: "",
        account: "Cost of Goods Sold",
        quantity: 1,
        receivedQuantity: 0,
        unit: "pcs",
        rate: 0,
        discount: 0,
        discountType: "percent",
        taxRate: 18,
        taxAmount: 0,
        amount: 0,
      },
    ]);
  };

  // Remove Item Row
  const handleRemoveRow = (index: number) => {
    if (isViewMode || items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Bulk Add Items Modal Handler
  const handleConfirmBulkAdd = () => {
    const selected = itemsCatalog.filter((ci) => selectedCatalogItemIds.has(ci.id));
    if (selected.length === 0) {
      setShowBulkAddModal(false);
      return;
    }

    const newRows: PurchaseOrderItemRecord[] = selected.map((ci) => {
      const qty = 10;
      const base = qty * ci.purchasePrice;
      const taxRate = 18;
      const tax = Math.round(((base * taxRate) / 100) * 100) / 100;

      return {
        name: ci.name,
        description: ci.purchaseDescription || `${ci.name} standard order`,
        sku: ci.sku,
        account: ci.purchaseAccount || "Cost of Goods Sold",
        quantity: qty,
        receivedQuantity: 0,
        unit: ci.unit || "pcs",
        rate: ci.purchasePrice,
        discount: 0,
        discountType: "percent",
        taxRate,
        taxAmount: tax,
        amount: Math.round((base + tax) * 100) / 100,
      };
    });

    setItems((prev) => {
      // If only 1 empty row, replace it
      if (prev.length === 1 && !prev[0].name.trim()) {
        return newRows;
      }
      return [...prev, ...newRows];
    });

    setSelectedCatalogItemIds(new Set());
    setShowBulkAddModal(false);
  };

  // Grand Totals Calculation
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const base = Number(it.quantity || 0) * Number(it.rate || 0);
      let disc = 0;
      if (it.discountType === "percent") {
        disc = (base * Number(it.discount || 0)) / 100;
      } else {
        disc = Math.min(base, Number(it.discount || 0));
      }
      return sum + Math.max(0, base - disc);
    }, 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    if (orderDiscountType === "percent") {
      return (subtotal * Number(orderDiscount || 0)) / 100;
    }
    return Math.min(subtotal, Number(orderDiscount || 0));
  }, [subtotal, orderDiscount, orderDiscountType]);

  const taxTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.taxAmount) || 0), 0);
  }, [items]);

  const tdsTcsConfig = useMemo(() => {
    const opt = tdsTcsOptions.find((o) => o.label === selectedTdsTcsOption);
    return opt || tdsTcsOptions[0];
  }, [selectedTdsTcsOption]);

  const tdsTcsAmount = useMemo(() => {
    if (tdsTcsConfig.type === "None" || tdsTcsConfig.rate === 0) return 0;
    const base = Math.max(0, subtotal - discountAmount);
    return Math.round(((base * tdsTcsConfig.rate) / 100) * 100) / 100;
  }, [subtotal, discountAmount, tdsTcsConfig]);

  const grandTotal = useMemo(() => {
    let tot = subtotal - discountAmount + taxTotal;
    if (tdsTcsConfig.type === "TDS") {
      tot -= tdsTcsAmount;
    } else if (tdsTcsConfig.type === "TCS") {
      tot += tdsTcsAmount;
    }
    tot += Number(adjustment || 0);
    return Math.max(0, Math.round(tot * 100) / 100);
  }, [subtotal, discountAmount, taxTotal, tdsTcsConfig, tdsTcsAmount, adjustment]);

  // Overall Quantities Tracking
  const totalOrderedQty = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }, [items]);

  const totalReceivedQty = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.receivedQuantity) || 0), 0);
  }, [items]);

  const totalPendingQty = Math.max(0, totalOrderedQty - totalReceivedQty);

  // File Upload Handlers
  const handleFilesAdded = (files: File[]) => {
    const newItems = files.map((file) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    }));
    setAttachments((prev) => [...prev, ...newItems]);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (isViewMode || !e.target.files) return;
    handleFilesAdded(Array.from(e.target.files));
    e.target.value = "";
  };

  const handleFileDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    if (isViewMode || !e.dataTransfer.files) return;
    handleFilesAdded(Array.from(e.dataTransfer.files));
  };

  // Submit Handler: Draft vs Sent
  const handleSubmit = async (targetStatus: "Draft" | "Sent") => {
    if (isViewMode) return;
    setErrors({});
    setNotice(null);

    // Validation
    if (!selectedVendorName.trim()) {
      setErrors((prev) => ({ ...prev, vendor: "Please select a vendor" }));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!poNumber.trim()) {
      setErrors((prev) => ({ ...prev, poNumber: "Purchase Order Number is required" }));
      return;
    }

    if (!orderDate) {
      setErrors((prev) => ({ ...prev, orderDate: "Order Date is required" }));
      return;
    }

    const invalidItems = items.some((it) => !it.name.trim() || Number(it.quantity) <= 0);
    if (invalidItems) {
      setNotice({
        type: "error",
        message: "Please enter valid names and quantities greater than 0 for all item rows.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<PurchaseOrderRecord> = {
        purchaseOrderNumber: poNumber.trim(),
        referenceNumber: referenceNumber.trim(),
        vendorName: selectedVendorName,
        vendorId: selectedVendor?.id,
        vendorDetails: {
          companyName: selectedVendor?.companyName || selectedVendorName,
          email: selectedVendor?.email,
          phone: selectedVendor?.phone,
          gstin: selectedVendor?.gstin,
          pan: selectedVendor?.pan,
          address: selectedVendor?.address,
        },
        deliveryAddressType: deliveryType,
        customerId: deliveryType === "customer" ? selectedCustomer?.id : undefined,
        customerName: deliveryType === "customer" ? selectedCustomerName : undefined,
        deliveryAddress:
          deliveryType === "customer"
            ? {
                attention: selectedCustomer?.address?.attention || selectedCustomerName,
                name: selectedCustomer?.companyName || selectedCustomerName,
                street1: selectedCustomer?.address?.street || "",
                city: selectedCustomer?.address?.city || "",
                state: selectedCustomer?.address?.state || "",
                postalCode: selectedCustomer?.address?.postalCode || "",
                country: "India",
                phone: selectedCustomer?.phone || "",
              }
            : defaultOrgAddress,
        orderDate,
        deliveryDate,
        paymentTerms,
        shipmentPreference,
        items,
        subtotal,
        discount: Number(orderDiscount || 0),
        discountType: orderDiscountType,
        discountAmount,
        taxType: tdsTcsConfig.type as "None" | "TDS" | "TCS",
        taxName: tdsTcsConfig.text,
        taxRate: tdsTcsConfig.rate,
        taxDeduction: tdsTcsAmount,
        adjustment: Number(adjustment || 0),
        adjustmentDescription,
        total: grandTotal,
        status: targetStatus,
        notes,
        termsAndConditions,
        attachments,
      };

      const isEdit = mode === "edit" && purchaseOrderId;
      const endpoint = isEdit
        ? `/api/purchases/purchase-orders/${purchaseOrderId}`
        : "/api/purchases/purchase-orders";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to save purchase order");
      }

      setNotice({
        type: "success",
        message:
          targetStatus === "Sent"
            ? `Purchase Order ${poNumber} successfully saved and sent to supplier.`
            : `Purchase Order ${poNumber} successfully saved as draft.`,
      });

      // Redirect back after brief toast
      setTimeout(() => {
        router.push("/purchases/purchase-orders");
      }, 1200);
    } catch (err: unknown) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Error saving purchase order",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Record Inward Goods in View Mode
  const handleOpenReceiveModal = () => {
    const defaults: Record<string, number> = {};
    items.forEach((it) => {
      const pending = Math.max(0, it.quantity - (it.receivedQuantity || 0));
      defaults[it.name] = pending;
    });
    setInwardQuantities(defaults);
    setInwardReceivedBy("Store Incharge");
    setInwardNotes("");
    setShowReceiveModal(true);
  };

  const handleConfirmInwardReceipt = async () => {
    if (!purchaseOrderId) return;
    setSubmittingInward(true);
    try {
      const payloadItems = Object.entries(inwardQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([name, qty]) => ({ name, quantityReceived: Number(qty) }));

      if (payloadItems.length === 0) {
        alert("Please enter a received quantity greater than 0.");
        setSubmittingInward(false);
        return;
      }

      const res = await fetch(
        `/api/purchases/purchase-orders/${purchaseOrderId}/receive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receivedItems: payloadItems,
            receivedBy: inwardReceivedBy,
            notes: inwardNotes,
          }),
        },
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to record receipt");

      // Update local state
      if (result.purchaseOrder) {
        setItems(result.purchaseOrder.items);
        setCurrentStatus(result.purchaseOrder.status);
        if (result.purchaseOrder.receivingLogs) {
          setReceivingLogs(result.purchaseOrder.receivingLogs);
        }
      }
      setShowReceiveModal(false);
      setNotice({
        type: "success",
        message: `Inward goods recorded successfully. PO status updated to ${result.status}.`,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error recording inward goods");
    } finally {
      setSubmittingInward(false);
    }
  };

  return (
    <div className="min-h-screen pb-28 text-slate-900 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumbs */}
      <div className="border-b border-slate-200 bg-white shadow-2xs">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <Link
                href="/purchases/purchase-orders"
                aria-label="Back to Purchase Orders"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Purchases
                  </span>
                  <span className="text-slate-300">/</span>
                  <span className="text-xs font-semibold text-slate-700">
                    {mode === "create" ? "New Purchase Order" : isViewMode ? "PO Summary" : "Edit Order"}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                  {mode === "create"
                    ? "New Purchase Order"
                    : isViewMode
                    ? `Purchase Order ${poNumber}`
                    : `Edit ${poNumber}`}
                </h1>
              </div>
            </div>

            {/* Mode & Quick Actions */}
            <div className="flex items-center gap-2.5">
              {isViewMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-500" />
                    <span>Print / PDF</span>
                  </button>

                  {currentStatus !== "Received" && currentStatus !== "Cancelled" && (
                    <button
                      type="button"
                      onClick={handleOpenReceiveModal}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                    >
                      <PackageCheck className="h-3.5 w-3.5" />
                      <span>Receive Goods</span>
                    </button>
                  )}

                  <Link
                    href={`/purchases/payments?vendorId=${encodeURIComponent(selectedVendor?.id || "")}&search=${encodeURIComponent(poNumber)}&action=record`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 shadow-2xs hover:bg-blue-100 transition"
                  >
                    <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                    <span>Record Payment</span>
                  </Link>

                  <Link
                    href={`/purchases/purchase-orders/${purchaseOrderId}?mode=edit`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit Order</span>
                  </Link>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Status: <strong className="text-slate-700">{currentStatus}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-5">
          <div
            className={`flex items-center justify-between rounded-2xl border p-4 text-xs font-medium shadow-sm animate-in fade-in ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-600" />
              )}
              <span>{notice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
        {/* SECTION 1: Vendor & Delivery Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vendor Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Vendor Information</h2>
                  <p className="text-[11px] text-slate-500">Supplier to fulfill this purchase order</p>
                </div>
              </div>
            </div>

            {isViewMode ? (
              <div className="space-y-2 text-xs">
                <div className="font-bold text-base text-slate-900">{selectedVendorName}</div>
                {selectedVendor?.companyName && (
                  <div className="text-slate-600">{selectedVendor.companyName}</div>
                )}
                {selectedVendor?.email && (
                  <div className="text-slate-500">Email: {selectedVendor.email}</div>
                )}
                {selectedVendor?.phone && (
                  <div className="text-slate-500">Phone: {selectedVendor.phone}</div>
                )}
                {selectedVendor?.gstin && (
                  <div className="font-mono text-slate-500 text-[11px]">GSTIN: {selectedVendor.gstin}</div>
                )}
                {selectedVendor?.address?.street1 && (
                  <div className="text-slate-500 mt-1">
                    {selectedVendor.address.street1}, {selectedVendor.address.city}, {selectedVendor.address.state} - {selectedVendor.address.postalCode}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Select Vendor <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedVendorName}
                    onChange={(e) => handleVendorSelect(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendors.map((v) => (
                      <option key={v.id || v.displayName} value={v.displayName}>
                        {v.displayName} {v.companyName ? `(${v.companyName})` : ""}
                      </option>
                    ))}
                  </select>
                  {errors.vendor && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.vendor}</p>
                  )}
                </div>

                {selectedVendor && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1 text-[11px] text-slate-600">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-500">Company:</span>
                      <span className="font-semibold text-slate-800">{selectedVendor.companyName || selectedVendor.displayName}</span>
                    </div>
                    {selectedVendor.email && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Email:</span>
                        <span>{selectedVendor.email}</span>
                      </div>
                    )}
                    {selectedVendor.gstin && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">GSTIN:</span>
                        <span className="font-mono text-slate-700">{selectedVendor.gstin}</span>
                      </div>
                    )}
                    {selectedVendor.address?.city && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">City / State:</span>
                        <span>
                          {selectedVendor.address.city}, {selectedVendor.address.state}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delivery Address Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Delivery Destination</h2>
                  <p className="text-[11px] text-slate-500">Ship to organization warehouse or direct customer dropship</p>
                </div>
              </div>
            </div>

            {isViewMode ? (
              <div className="space-y-2 text-xs">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 mb-1">
                  {deliveryType === "customer" ? "Customer Dropship" : "Organization Warehouse"}
                </div>
                <div className="font-bold text-slate-900">
                  {deliveryType === "customer" ? selectedCustomerName : defaultOrgAddress.name}
                </div>
                <div className="text-slate-500">
                  {deliveryType === "customer"
                    ? `${selectedCustomer?.address?.street || ""}, ${selectedCustomer?.address?.city || ""}`
                    : `${defaultOrgAddress.street1}, ${defaultOrgAddress.city}, ${defaultOrgAddress.state} - ${defaultOrgAddress.postalCode}`}
                </div>
                <div className="text-slate-500 text-[11px]">
                  Contact:{" "}
                  {deliveryType === "customer"
                    ? selectedCustomer?.address?.attention || selectedCustomerName
                    : defaultOrgAddress.attention}
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Destination Toggle */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100/80">
                  <button
                    type="button"
                    onClick={() => setDeliveryType("organization")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                      deliveryType === "organization"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Organization</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType("customer")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                      deliveryType === "customer"
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>Customer (Dropship)</span>
                  </button>
                </div>

                {deliveryType === "organization" ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-[11px] text-slate-600 space-y-1">
                    <div className="font-bold text-slate-800">{defaultOrgAddress.name}</div>
                    <div>{defaultOrgAddress.street1}, {defaultOrgAddress.street2}</div>
                    <div>{defaultOrgAddress.city}, {defaultOrgAddress.state} - {defaultOrgAddress.postalCode}</div>
                    <div className="text-slate-500">Attention: {defaultOrgAddress.attention} • {defaultOrgAddress.phone}</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-700">
                      Select Customer Destination
                    </label>
                    <select
                      value={selectedCustomerName}
                      onChange={(e) => setSelectedCustomerName(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map((c) => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.name} {c.companyName ? `(${c.companyName})` : ""}
                        </option>
                      ))}
                    </select>

                    {selectedCustomer && (
                      <div className="rounded-xl border border-slate-100 bg-blue-50/40 p-3 text-[11px] text-slate-600 space-y-1 mt-2">
                        <div className="font-semibold text-slate-800">{selectedCustomer.companyName || selectedCustomer.name}</div>
                        <div>{selectedCustomer.address?.street}</div>
                        <div>{selectedCustomer.address?.city}, {selectedCustomer.address?.state} - {selectedCustomer.address?.postalCode}</div>
                        <div className="text-slate-500">Contact: {selectedCustomer.address?.attention || selectedCustomer.name}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: Order Reference & Metadata */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Order Header & Preferences</h2>
            <span className="text-[11px] text-slate-400">PO Number & Shipping Specifications</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* Purchase Order Number */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">
                  Purchase Order# <span className="text-rose-500">*</span>
                </label>
                {!isViewMode && (
                  <button
                    type="button"
                    onClick={() => setShowNumberConfigModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                    title="Configure Purchase Order# Preferences"
                  >
                    <Settings className="h-3 w-3" />
                    <span>Configure</span>
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  disabled={isViewMode || (autoGenerateNumbering && !isEditingPONumber)}
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder={autoGenerateNumbering ? "Auto-generated (e.g. PO-2026-00001)" : "e.g. PO-2026-00001"}
                  className={`w-full h-10 rounded-xl border px-3 pr-16 text-xs font-mono font-bold text-slate-900 outline-none transition ${
                    isEditingPONumber || !autoGenerateNumbering
                      ? "border-blue-500 bg-white ring-1 ring-blue-500"
                      : "border-slate-200 bg-slate-50"
                  }`}
                />
                {!isViewMode && (
                  <div className="absolute right-2 flex items-center gap-0.5">
                    {autoGenerateNumbering && (
                      <button
                        type="button"
                        onClick={() => setIsEditingPONumber((prev) => !prev)}
                        title={isEditingPONumber ? "Lock auto-number" : "Manually edit this PO#"}
                        className="text-slate-400 hover:text-blue-600 p-1 transition cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNumberConfigModal(true)}
                      title="Configure Purchase Order# Preferences"
                      className="text-slate-400 hover:text-blue-600 p-1 transition cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {autoGenerateNumbering ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  Auto-generated sequence. Click gear to customize prefix or sequence.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-blue-600 font-medium">
                  Manual numbering mode. Enter unique purchase order number.
                </p>
              )}
              {errors.poNumber && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.poNumber}</p>
              )}
            </div>

            {/* Reference Number */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reference Number
              </label>
              <input
                type="text"
                disabled={isViewMode}
                placeholder="e.g. QUOTE-2026-99"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            {/* Order Date */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Order Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                disabled={isViewMode}
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
              {errors.orderDate && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.orderDate}</p>
              )}
            </div>

            {/* Expected Delivery Date */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Expected Delivery Date
              </label>
              <input
                type="date"
                disabled={isViewMode}
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            {/* Payment Terms */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Payment Terms
              </label>
              <select
                disabled={isViewMode}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 disabled:bg-slate-50"
              >
                {paymentTermOptions.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>

            {/* Shipment Preference */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Shipment Preference
              </label>
              <select
                disabled={isViewMode}
                value={shipmentPreference}
                onChange={(e) => setShipmentPreference(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 disabled:bg-slate-50"
              >
                {shipmentPreferenceOptions.map((sp) => (
                  <option key={sp} value={sp}>
                    {sp}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 3: Responsive Itemized Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Procurement Items</h2>
              <p className="text-[11px] text-slate-500">
                Specify commodities, quantities, rate per unit, tax rates, and inventory accounts
              </p>
            </div>

            {!isViewMode && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkAddModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  <ListPlus className="h-3.5 w-3.5 text-blue-600" />
                  <span>Bulk Add Items</span>
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-3 w-5/12">Item Details & Account</th>
                  <th className="px-3 py-3 text-right w-2/12">Quantity & Unit</th>
                  <th className="px-3 py-3 text-right w-2/12">Rate (₹)</th>
                  <th className="px-3 py-3 text-right w-1/12">Discount</th>
                  <th className="px-3 py-3 text-right w-1/12">Tax</th>
                  <th className="px-3 py-3 text-right w-2/12">Amount (₹)</th>
                  {!isViewMode && <th className="px-2 py-3 w-8"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition">
                    {/* Item Details */}
                    <td className="px-3 py-3 space-y-1.5">
                      {isViewMode ? (
                        <div>
                          <div className="font-bold text-slate-900">{row.name}</div>
                          {row.description && (
                            <div className="text-[11px] text-slate-500">{row.description}</div>
                          )}
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            SKU: {row.sku || "N/A"} • Account: {row.account}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="Type item name or pick..."
                              value={row.name}
                              onChange={(e) => updateItemRow(idx, "name", e.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                            />
                            {/* Catalog Quick Picker */}
                            <select
                              onChange={(e) => {
                                if (e.target.value) handlePickCatalogItem(idx, e.target.value);
                                e.target.value = "";
                              }}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 outline-none"
                              title="Pick from item catalog"
                            >
                              <option value="">Catalog...</option>
                              {itemsCatalog.map((ci) => (
                                <option key={ci.id} value={ci.id}>
                                  {ci.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Item description / specifications"
                              value={row.description || ""}
                              onChange={(e) => updateItemRow(idx, "description", e.target.value)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 outline-none focus:border-blue-500"
                            />
                            <select
                              value={row.account}
                              onChange={(e) => updateItemRow(idx, "account", e.target.value)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 outline-none focus:border-blue-500"
                            >
                              {accountOptions.map((acc) => (
                                <option key={acc} value={acc}>
                                  {acc}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                    </td>

                    {/* Quantity & Unit */}
                    <td className="px-3 py-3 text-right">
                      {isViewMode ? (
                        <div className="font-semibold text-slate-900">
                          {row.quantity} <span className="text-slate-400 font-normal">{row.unit}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min="0.001"
                            step="0.01"
                            value={row.quantity}
                            onChange={(e) => updateItemRow(idx, "quantity", parseFloat(e.target.value) || 0)}
                            className="w-20 rounded-xl border border-slate-200 px-2 py-1.5 text-right font-semibold text-slate-900 outline-none focus:border-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Unit"
                            value={row.unit}
                            onChange={(e) => updateItemRow(idx, "unit", e.target.value)}
                            className="w-14 rounded-xl border border-slate-200 px-1.5 py-1.5 text-center text-[11px] text-slate-500 outline-none"
                          />
                        </div>
                      )}
                    </td>

                    {/* Rate */}
                    <td className="px-3 py-3 text-right">
                      {isViewMode ? (
                        <span className="font-semibold text-slate-900">
                          ₹{Number(row.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <div className="relative inline-block w-24">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]">
                            ₹
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.rate}
                            onChange={(e) => updateItemRow(idx, "rate", parseFloat(e.target.value) || 0)}
                            className="w-full rounded-xl border border-slate-200 pl-5 pr-2 py-1.5 text-right font-semibold text-slate-900 outline-none focus:border-blue-500"
                          />
                        </div>
                      )}
                    </td>

                    {/* Discount */}
                    <td className="px-3 py-3 text-right">
                      {isViewMode ? (
                        <span className="text-slate-600">
                          {row.discount ? `${row.discount}${row.discountType === "percent" ? "%" : "₹"}` : "0"}
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.discount}
                            onChange={(e) => updateItemRow(idx, "discount", parseFloat(e.target.value) || 0)}
                            className="w-16 rounded-xl border border-slate-200 px-2 py-1.5 text-right text-xs text-slate-800 outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateItemRow(
                                idx,
                                "discountType",
                                row.discountType === "percent" ? "amount" : "percent",
                              )
                            }
                            className="rounded-lg bg-slate-100 px-1.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-200"
                          >
                            {row.discountType === "percent" ? "%" : "₹"}
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Tax */}
                    <td className="px-3 py-3 text-right">
                      {isViewMode ? (
                        <span className="text-slate-600">{row.taxRate}%</span>
                      ) : (
                        <select
                          value={row.taxRate}
                          onChange={(e) => updateItemRow(idx, "taxRate", parseFloat(e.target.value) || 0)}
                          className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-right text-xs outline-none focus:border-blue-500"
                        >
                          {taxRateOptions.map((tr) => (
                            <option key={tr.value} value={tr.value}>
                              {tr.value}%
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-3 text-right font-bold text-slate-900">
                      ₹{Number(row.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    {/* Remove Action */}
                    {!isViewMode && (
                      <td className="px-2 py-3 text-right">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="text-slate-300 hover:text-rose-600 p-1 transition"
                            title="Remove line"
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
            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-blue-600 hover:border-blue-400 hover:bg-blue-50/30 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Row</span>
              </button>

              <div className="text-xs text-slate-500">
                Total Ordered Items: <strong className="text-slate-900">{totalOrderedQty} units</strong>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: Live Totals & Summary Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Notes & Terms on Left (8 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Notes & Terms
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vendor Notes (Visible on Order)
                </label>
                <textarea
                  disabled={isViewMode}
                  rows={2}
                  placeholder="Dispatch instructions, special handling, or receiving window..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  disabled={isViewMode}
                  rows={3}
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-blue-500 disabled:bg-slate-50 font-mono text-[11px]"
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Order Documents & Attachments
                </label>

                {!isViewMode && (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingFile(false);
                    }}
                    onDrop={handleFileDrop}
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition cursor-pointer ${
                      isDraggingFile
                        ? "border-blue-500 bg-blue-50/50 scale-[1.01]"
                        : "border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/20"
                    }`}
                  >
                    <label className="cursor-pointer w-full flex flex-col items-center">
                      <UploadCloud className="h-5 w-5 text-blue-600 mb-1" />
                      <span className="text-xs font-semibold text-slate-800">
                        Drag and drop supplier quotes or specs here, or browse
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        PDF, JPG, PNG, DOCX up to 15MB
                      </span>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {attachments.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-3.5 w-3.5 text-blue-600" />
                          <span className="font-medium text-slate-800">{att.name}</span>
                          <span className="text-[10px] text-slate-400">
                            ({(att.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                        {!isViewMode && (
                          <button
                            type="button"
                            onClick={() =>
                              setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                            }
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Totals Panel on Right (5 Cols) */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>Order Summary</span>
                <span className="text-xs font-normal text-slate-500 font-mono">INR (₹)</span>
              </h2>

              <div className="space-y-3 text-xs">
                {/* Subtotal */}
                <div className="flex justify-between items-center text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-800">
                    ₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Order Discount */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">Order Discount</span>
                  {isViewMode ? (
                    <span className="text-slate-700">
                      -₹{discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 w-32">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={orderDiscount}
                        onChange={(e) => setOrderDiscount(parseFloat(e.target.value) || 0)}
                        className="w-full rounded-xl border border-slate-200 px-2 py-1 text-right text-xs outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setOrderDiscountType((prev) => (prev === "percent" ? "amount" : "percent"))
                        }
                        className="rounded-lg bg-slate-100 px-1.5 py-1 text-[10px] font-bold text-slate-600"
                      >
                        {orderDiscountType === "percent" ? "%" : "₹"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Tax Total */}
                <div className="flex justify-between items-center text-slate-600">
                  <span>Tax (GST)</span>
                  <span className="font-semibold text-slate-800">
                    +₹{taxTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* TDS / TCS */}
                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>TDS / TCS</span>
                    {isViewMode ? (
                      <span className="font-semibold text-slate-700">
                        {tdsTcsConfig.type === "TDS" ? "-" : "+"}₹
                        {tdsTcsAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    ) : null}
                  </div>
                  {!isViewMode && (
                    <select
                      value={selectedTdsTcsOption}
                      onChange={(e) => setSelectedTdsTcsOption(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 outline-none focus:border-blue-500"
                    >
                      {tdsTcsOptions.map((opt) => (
                        <option key={opt.label} value={opt.label}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {tdsTcsConfig.type !== "None" && !isViewMode && (
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Deduction:</span>
                      <span className="font-semibold text-slate-800">
                        {tdsTcsConfig.type === "TDS" ? "-" : "+"}₹
                        {tdsTcsAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Adjustment */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <span className="text-slate-600">Adjustment</span>
                  {isViewMode ? (
                    <span className="text-slate-700">
                      {adjustment >= 0 ? "+" : ""}₹
                      {adjustment.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <div className="w-28">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="± 0.00"
                        value={adjustment}
                        onChange={(e) => setAdjustment(parseFloat(e.target.value) || 0)}
                        className="w-full rounded-xl border border-slate-200 px-2 py-1 text-right text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>

                {/* Grand Total Highlight */}
                <div className="pt-3 border-t-2 border-slate-900 flex items-baseline justify-between">
                  <span className="text-sm font-bold text-slate-900">Grand Total</span>
                  <span className="text-xl font-extrabold text-slate-900">
                    ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Inward Receiving Summary Card in View Mode */}
            {isViewMode && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <PackageCheck className="h-4 w-4 text-emerald-600" />
                    <span>Inward Tracking</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      totalPendingQty === 0
                        ? "bg-emerald-50 text-emerald-700"
                        : totalReceivedQty > 0
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {totalPendingQty === 0
                      ? "Fully Received"
                      : totalReceivedQty > 0
                      ? "Partially Received"
                      : "Pending Delivery"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Ordered</p>
                    <p className="text-sm font-bold text-slate-800">{totalOrderedQty}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-2">
                    <p className="text-[10px] text-emerald-600 uppercase font-semibold">Received</p>
                    <p className="text-sm font-bold text-emerald-700">{totalReceivedQty}</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-2">
                    <p className="text-[10px] text-amber-600 uppercase font-semibold">Pending</p>
                    <p className="text-sm font-bold text-amber-700">{totalPendingQty}</p>
                  </div>
                </div>

                {receivingLogs.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-700">Receipt Logs:</span>
                    {receivingLogs.map((log, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2 text-[11px]">
                        <div className="flex justify-between font-medium text-slate-700">
                          <span>{new Date(log.receivedAt).toLocaleDateString()}</span>
                          <span className="text-slate-500">By {log.receivedBy}</span>
                        </div>
                        {log.notes && <p className="text-slate-500 mt-0.5">{log.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STICKY FOOTER ACTIONS */}
      {!isViewMode && (
        <div className="sticky bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md px-6 py-3.5 shadow-lg lg:left-72">
          <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 hidden sm:block">
              <span>
                Purchase Order Total:{" "}
                <strong className="text-slate-900 font-bold">
                  ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </strong>
                {" "}• {items.length} item(s)
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Link
                href="/purchases/purchase-orders"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </Link>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmit("Draft")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                ) : (
                  <FileText className="h-4 w-4 text-slate-500" />
                )}
                <span>Save as Draft</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmit("Sent")}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Save and Send</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ADD ITEMS MODAL */}
      {showBulkAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <ListPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bulk Add Items</h3>
                  <p className="text-xs text-slate-500">
                    Select multiple inventory items to quickly append to the purchase order
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search items in catalog */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={bulkItemSearch}
                onChange={(e) => setBulkItemSearch(e.target.value)}
                placeholder="Search items by name or SKU..."
                className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>

            {/* Items List with checkboxes */}
            <div className="max-h-72 overflow-y-auto space-y-1.5 divide-y divide-slate-100 pr-1">
              {itemsCatalog
                .filter((ci) => {
                  if (!bulkItemSearch.trim()) return true;
                  const q = bulkItemSearch.toLowerCase();
                  return ci.name.toLowerCase().includes(q) || ci.sku.toLowerCase().includes(q);
                })
                .map((ci) => {
                  const isChecked = selectedCatalogItemIds.has(ci.id);
                  return (
                    <label
                      key={ci.id}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition select-none pt-2 first:pt-0"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setSelectedCatalogItemIds((prev) => {
                              const s = new Set(prev);
                              if (e.target.checked) s.add(ci.id);
                              else s.delete(ci.id);
                              return s;
                            });
                          }}
                          className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div>
                          <div className="font-semibold text-xs text-slate-900">{ci.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            SKU: {ci.sku} • {ci.purchaseAccount}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-xs text-slate-800">
                          ₹{ci.purchasePrice.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-slate-400">per {ci.unit}</div>
                      </div>
                    </label>
                  );
                })}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-500">
                {selectedCatalogItemIds.size} item(s) selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkAdd}
                  className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white shadow-sm hover:bg-slate-800 transition"
                >
                  Add Selected Items
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECORD INWARD GOODS MODAL (IN VIEW MODE) */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Inward Goods</h3>
                  <p className="text-xs text-slate-500">
                    PO: <strong className="font-mono text-slate-800">{poNumber}</strong> • {selectedVendorName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-slate-600 font-semibold mb-1">
                Enter received quantities for this delivery consignment:
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                {items.map((it) => {
                  const pending = Math.max(0, it.quantity - (it.receivedQuantity || 0));
                  return (
                    <div key={it.name} className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800">{it.name}</div>
                        <div className="text-[11px] text-slate-500">
                          Ordered: {it.quantity} {it.unit} | Received so far: {it.receivedQuantity || 0} | Pending: {pending}
                        </div>
                      </div>

                      <div className="w-28 flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max={it.quantity * 2}
                          step="0.01"
                          value={inwardQuantities[it.name] ?? pending}
                          onChange={(e) =>
                            setInwardQuantities((prev) => ({
                              ...prev,
                              [it.name]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-right font-semibold text-slate-900 outline-none focus:border-blue-500"
                        />
                        <span className="text-[11px] text-slate-400">{it.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Received By</label>
                  <input
                    type="text"
                    value={inwardReceivedBy}
                    onChange={(e) => setInwardReceivedBy(e.target.value)}
                    placeholder="e.g. Store Manager"
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Inward Remarks</label>
                  <input
                    type="text"
                    value={inwardNotes}
                    onChange={(e) => setInwardNotes(e.target.value)}
                    placeholder="e.g. Received via Transport Truck"
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingInward}
                onClick={handleConfirmInwardReceipt}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {submittingInward ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PackageCheck className="h-3.5 w-3.5" />
                )}
                <span>Record Inward Goods</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Purchase Order Number Preferences Modal */}
      <ConfigurePoNumberModal
        isOpen={showNumberConfigModal}
        onClose={() => setShowNumberConfigModal(false)}
        currentSettings={poPreferences}
        onSaved={handlePreferencesSaved}
      />
    </div>
  );
}
