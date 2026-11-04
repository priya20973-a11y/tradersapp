"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Globe,
  Info,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Paperclip,
  Phone,
  Plus,
  Save,
  ShieldCheck,
  Sliders,
  Smartphone,
  Tag,
  Trash2,
  UploadCloud,
  Users,
  X,
} from "lucide-react";

export type VendorFormMode = "create" | "edit" | "view";

export interface ContactPerson {
  id: string;
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  workPhone: string;
  mobile: string;
  designation: string;
  department: string;
  isPrimary: boolean;
}

export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface VendorFormData {
  id?: string;
  // Basic Information
  salutation: string;
  firstName: string;
  lastName: string;
  companyName: string;
  displayName: string;
  email: string;
  workPhone: string;
  mobile: string;
  language: string;

  // Other Details
  pan: string;
  msmeRegistered: boolean;
  msmeType: string;
  msmeNumber: string;
  currency: string;
  accountsPayable: string;
  openingBalance: number | string;
  openingBalanceType: "credit" | "debit";
  paymentTerms: string;
  tds: string;
  enablePortal: boolean;
  portalLanguage: string;

  // Billing Address
  billingAttention: string;
  billingCountry: string;
  billingStreet1: string;
  billingStreet2: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingPhone: string;
  billingFax: string;

  // Shipping Address
  shippingAttention: string;
  shippingCountry: string;
  shippingStreet1: string;
  shippingStreet2: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingPhone: string;
  shippingFax: string;

  // Contact Persons
  contactPersons: ContactPerson[];

  // Bank Details
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  branchName: string;

  // Custom Fields
  customFields: CustomField[];

  // Reporting Tags
  reportingTags: string[];

  // Remarks
  remarks: string;

  // Documents
  documents: UploadedDoc[];

  status: "Active" | "Inactive" | "Pending";
}

const defaultFormData: VendorFormData = {
  salutation: "Mr.",
  firstName: "",
  lastName: "",
  companyName: "",
  displayName: "",
  email: "",
  workPhone: "",
  mobile: "",
  language: "English",

  pan: "",
  msmeRegistered: false,
  msmeType: "Micro",
  msmeNumber: "",
  currency: "INR",
  accountsPayable: "Accounts Payable (Sundry Creditors)",
  openingBalance: "0",
  openingBalanceType: "credit",
  paymentTerms: "Due on Receipt",
  tds: "No TDS",
  enablePortal: false,
  portalLanguage: "English",

  billingAttention: "",
  billingCountry: "India",
  billingStreet1: "",
  billingStreet2: "",
  billingCity: "",
  billingState: "",
  billingPostalCode: "",
  billingPhone: "",
  billingFax: "",

  shippingAttention: "",
  shippingCountry: "India",
  shippingStreet1: "",
  shippingStreet2: "",
  shippingCity: "",
  shippingState: "",
  shippingPostalCode: "",
  shippingPhone: "",
  shippingFax: "",

  contactPersons: [
    {
      id: "cp-1",
      salutation: "Mr.",
      firstName: "",
      lastName: "",
      email: "",
      workPhone: "",
      mobile: "",
      designation: "Key Accounts Manager",
      department: "Sales & Supply",
      isPrimary: true,
    },
  ],

  accountHolderName: "",
  bankName: "",
  accountNumber: "",
  confirmAccountNumber: "",
  ifscCode: "",
  branchName: "",

  customFields: [],
  reportingTags: ["Standard Procurement"],
  remarks: "",
  documents: [],
  status: "Active",
};

const indianStates = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
];

const availableCurrencies = [
  { code: "INR", label: "INR - Indian Rupee (₹)" },
  { code: "USD", label: "USD - United States Dollar ($)" },
  { code: "EUR", label: "EUR - Euro (€)" },
  { code: "AED", label: "AED - United Arab Emirates Dirham" },
  { code: "GBP", label: "GBP - British Pound (£)" },
  { code: "SGD", label: "SGD - Singapore Dollar (S$)" },
];

const paymentTermsOptions = [
  "Due on Receipt",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
  "Due end of the month",
  "Due end of next month",
];

const tdsOptions = [
  "No TDS",
  "TDS @ 0.1% - Sec 194Q (Purchase of Goods)",
  "TDS @ 1.0% - Sec 194C (Contractor - Individuals/HUF)",
  "TDS @ 2.0% - Sec 194C (Contractor - Company/Firm)",
  "TDS @ 2.0% - Sec 194J (Technical / Royalty Services)",
  "TDS @ 10.0% - Sec 194J (Professional / Legal Services)",
  "TDS @ 5.0% - Sec 194H (Brokerage & Commission)",
];

type ActiveTab =
  | "other"
  | "address"
  | "contacts"
  | "bank"
  | "custom"
  | "tags"
  | "remarks"
  | "documents";

interface VendorFormProps {
  initialData?: Partial<VendorFormData>;
  mode?: VendorFormMode;
  vendorId?: string;
}

export function VendorForm({
  initialData,
  mode: initialMode = "create",
  vendorId,
}: VendorFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<VendorFormMode>(initialMode);
  const isViewMode = mode === "view";

  const [formData, setFormData] = useState<VendorFormData>({
    ...defaultFormData,
    ...initialData,
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>("other");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // New tag input state
  const [newTagInput, setNewTagInput] = useState("");
  // Copy address feedback
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Field change handler
  const handleChange = (
    field: keyof VendorFormData,
    value: unknown,
  ) => {
    if (isViewMode) return;
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      // Auto-suggestion for Display Name if user hasn't explicitly set it
      if (
        (field === "companyName" || field === "firstName" || field === "lastName") &&
        (!prev.displayName || prev.displayName === prev.companyName || prev.displayName === `${prev.firstName} ${prev.lastName}`.trim())
      ) {
        if (field === "companyName" && typeof value === "string" && value.trim()) {
          next.displayName = value.trim();
        } else if ((field === "firstName" || field === "lastName") && !next.companyName) {
          const fn = field === "firstName" ? String(value) : prev.firstName;
          const ln = field === "lastName" ? String(value) : prev.lastName;
          const combined = `${fn} ${ln}`.trim();
          if (combined) next.displayName = combined;
        }
      }

      return next;
    });

    // Clear inline error if field is modified
    if (errors[field]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  // Validate form fields
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.displayName.trim()) {
      newErrors.displayName = "Display Name is required.";
    }

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (formData.pan.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(formData.pan.trim())) {
      newErrors.pan = "PAN should be 10 characters (e.g. ABCDE1234F).";
    }

    if (
      formData.accountNumber.trim() &&
      formData.confirmAccountNumber.trim() &&
      formData.accountNumber.trim() !== formData.confirmAccountNumber.trim()
    ) {
      newErrors.confirmAccountNumber = "Bank account numbers do not match.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      // Auto-switch to tab containing error if not in basic information
      if (newErrors.pan) {
        setActiveTab("other");
      } else if (newErrors.confirmAccountNumber) {
        setActiveTab("bank");
      }
      return false;
    }

    return true;
  };

  // Copy Billing Address to Shipping Address
  const handleCopyBillingAddress = () => {
    if (isViewMode) return;
    setFormData((prev) => ({
      ...prev,
      shippingAttention: prev.billingAttention || `${prev.firstName} ${prev.lastName}`.trim(),
      shippingCountry: prev.billingCountry,
      shippingStreet1: prev.billingStreet1,
      shippingStreet2: prev.billingStreet2,
      shippingCity: prev.billingCity,
      shippingState: prev.billingState,
      shippingPostalCode: prev.billingPostalCode,
      shippingPhone: prev.billingPhone,
      shippingFax: prev.billingFax,
    }));
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Contact Persons handlers
  const handleAddContact = () => {
    if (isViewMode) return;
    const newId = `cp-${Date.now()}`;
    setFormData((prev) => ({
      ...prev,
      contactPersons: [
        ...prev.contactPersons,
        {
          id: newId,
          salutation: "Mr.",
          firstName: "",
          lastName: "",
          email: "",
          workPhone: "",
          mobile: "",
          designation: "",
          department: "",
          isPrimary: prev.contactPersons.length === 0,
        },
      ],
    }));
  };

  const handleRemoveContact = (id: string) => {
    if (isViewMode) return;
    setFormData((prev) => ({
      ...prev,
      contactPersons: prev.contactPersons.filter((c) => c.id !== id),
    }));
  };

  const handleUpdateContact = (id: string, key: keyof ContactPerson, value: unknown) => {
    if (isViewMode) return;
    setFormData((prev) => ({
      ...prev,
      contactPersons: prev.contactPersons.map((c) => {
        if (c.id !== id) {
          if (key === "isPrimary" && value === true) return { ...c, isPrimary: false };
          return c;
        }
        return { ...c, [key]: value };
      }),
    }));
  };

  // Custom Fields handlers
  const handleAddCustomField = () => {
    if (isViewMode) return;
    setFormData((prev) => ({
      ...prev,
      customFields: [
        ...prev.customFields,
        { id: `cf-${Date.now()}`, label: "", value: "" },
      ],
    }));
  };

  const handleRemoveCustomField = (id: string) => {
    if (isViewMode) return;
    setFormData((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((cf) => cf.id !== id),
    }));
  };

  const handleUpdateCustomField = (id: string, key: "label" | "value", val: string) => {
    if (isViewMode) return;
    setFormData((prev) => ({
      ...prev,
      customFields: prev.customFields.map((cf) =>
        cf.id === id ? { ...cf, [key]: val } : cf,
      ),
    }));
  };

  // Reporting tags handlers
  const handleAddTag = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isViewMode) return;
    const tag = newTagInput.trim();
    if (!tag || formData.reportingTags.includes(tag)) return;
    setFormData((prev) => ({
      ...prev,
      reportingTags: [...prev.reportingTags, tag],
    }));
    setNewTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (isViewMode) return;
    setFormData((prev) => ({
      ...prev,
      reportingTags: prev.reportingTags.filter((t) => t !== tagToRemove),
    }));
  };

  // Document upload handler
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (isViewMode || !e.target.files) return;
    const files = Array.from(e.target.files);
    const newDocs: UploadedDoc[] = files.map((file) => ({
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      uploadedAt: new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    }));

    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, ...newDocs],
    }));
    // Reset file input
    e.target.value = "";
  };

  const handleRemoveDoc = (docId: string) => {
    if (isViewMode) return;
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== docId),
    }));
  };

  // Submit Handler
  const handleSubmit = async (e: FormEvent, andNew = false) => {
    e.preventDefault();
    if (isViewMode) return;

    if (!validateForm()) {
      setNotice({
        type: "error",
        message: "Please correct the highlighted errors before saving.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    const payload = {
      salutation: formData.salutation,
      firstName: formData.firstName,
      lastName: formData.lastName,
      companyName: formData.companyName,
      displayName: formData.displayName,
      email: formData.email,
      workPhone: formData.workPhone,
      mobile: formData.mobile,
      language: formData.language,
      pan: formData.pan.toUpperCase(),
      msmeRegistered: formData.msmeRegistered,
      msmeType: formData.msmeType,
      msmeNumber: formData.msmeNumber,
      currency: formData.currency,
      accountsPayable: formData.accountsPayable,
      openingBalance: Number(formData.openingBalance) || 0,
      openingBalanceType: formData.openingBalanceType,
      paymentTerms: formData.paymentTerms,
      tds: formData.tds,
      enablePortal: formData.enablePortal,
      portalLanguage: formData.portalLanguage,
      billingAddress: {
        attention: formData.billingAttention,
        country: formData.billingCountry,
        street1: formData.billingStreet1,
        street2: formData.billingStreet2,
        city: formData.billingCity,
        state: formData.billingState,
        postalCode: formData.billingPostalCode,
        phone: formData.billingPhone,
        fax: formData.billingFax,
      },
      shippingAddress: {
        attention: formData.shippingAttention,
        country: formData.shippingCountry,
        street1: formData.shippingStreet1,
        street2: formData.shippingStreet2,
        city: formData.shippingCity,
        state: formData.shippingState,
        postalCode: formData.shippingPostalCode,
        phone: formData.shippingPhone,
        fax: formData.shippingFax,
      },
      contactPersons: formData.contactPersons,
      bankDetails: {
        accountHolderName: formData.accountHolderName,
        bankName: formData.bankName,
        accountNumber: formData.accountNumber,
        ifscCode: formData.ifscCode.toUpperCase(),
        branchName: formData.branchName,
      },
      customFields: formData.customFields,
      reportingTags: formData.reportingTags,
      remarks: formData.remarks,
      documents: formData.documents,
      status: formData.status,
    };

    try {
      const endpoint = mode === "edit" && vendorId ? `/api/vendors/${vendorId}` : "/api/vendors";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Unable to save vendor profile.");
      }

      setNotice({
        type: "success",
        message: `Vendor "${formData.displayName}" ${mode === "edit" ? "updated" : "created"} successfully!`,
      });

      if (andNew) {
        // Reset form for next entry
        setFormData({
          ...defaultFormData,
          contactPersons: [
            {
              id: `cp-${Date.now()}`,
              salutation: "Mr.",
              firstName: "",
              lastName: "",
              email: "",
              workPhone: "",
              mobile: "",
              designation: "Key Accounts Manager",
              department: "Sales & Supply",
              isPrimary: true,
            },
          ],
        });
        setActiveTab("other");
        setErrors({});
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setTimeout(() => {
          router.push("/purchases/vendors");
        }, 900);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setNotice({ type: "error", message: msg });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabsConfig = [
    { id: "other", label: "Other Details", icon: FileSpreadsheet },
    { id: "address", label: "Address", icon: MapPin },
    {
      id: "contacts",
      label: "Contact Persons",
      icon: Users,
      count: formData.contactPersons.length,
    },
    { id: "bank", label: "Bank Details", icon: CreditCard },
    {
      id: "custom",
      label: "Custom Fields",
      icon: Sliders,
      count: formData.customFields.length,
    },
    {
      id: "tags",
      label: "Reporting Tags",
      icon: Tag,
      count: formData.reportingTags.length,
    },
    { id: "remarks", label: "Remarks", icon: MessageSquare },
    {
      id: "documents",
      label: "Documents",
      icon: Paperclip,
      count: formData.documents.length,
    },
  ];

  return (
    <div className="min-h-screen pb-28 text-slate-900 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb */}
      <div className="border-b border-slate-200 bg-white shadow-2xs">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <Link
                href="/purchases/vendors"
                aria-label="Back to Vendors"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Link href="/purchases/vendors" className="hover:text-blue-600 transition">
                    Purchases
                  </Link>
                  <span>/</span>
                  <Link href="/purchases/vendors" className="hover:text-blue-600 transition">
                    Vendors
                  </Link>
                  <span>/</span>
                  <span className="text-slate-900 font-semibold">
                    {mode === "create" ? "New Vendor" : mode === "edit" ? "Edit Vendor" : "Vendor Profile"}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {mode === "create"
                      ? "Add New Vendor"
                      : formData.displayName || "Vendor Details"}
                  </h1>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      formData.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {formData.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2.5">
              {isViewMode ? (
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
                >
                  Edit Vendor
                </button>
              ) : (
                <Link
                  href="/purchases/vendors"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  Cancel
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 space-y-6">
        {/* Notice Banner */}
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

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          {/* SECTION 1: Basic Information Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Basic Information</h2>
                  <p className="text-xs text-slate-500">
                    Supplier identity, primary contact person, and communication channels
                  </p>
                </div>
              </div>
            </div>

            {/* Two-Column Responsive Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
              {/* Left Column: Names & Entity */}
              <div className="space-y-4">
                {/* Primary Contact Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Primary Contact
                  </label>
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-3">
                      <select
                        disabled={isViewMode}
                        value={formData.salutation}
                        onChange={(e) => handleChange("salutation", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                      >
                        <option value="Mr.">Mr.</option>
                        <option value="Mrs.">Mrs.</option>
                        <option value="Ms.">Ms.</option>
                        <option value="Miss">Miss</option>
                        <option value="Dr.">Dr.</option>
                      </select>
                    </div>
                    <div className="col-span-4 sm:col-span-4">
                      <input
                        type="text"
                        disabled={isViewMode}
                        placeholder="First Name"
                        value={formData.firstName}
                        onChange={(e) => handleChange("firstName", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-5">
                      <input
                        type="text"
                        disabled={isViewMode}
                        placeholder="Last Name"
                        value={formData.lastName}
                        onChange={(e) => handleChange("lastName", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Company Name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      disabled={isViewMode}
                      placeholder="e.g. Balaji Agro Exports Pvt Ltd"
                      value={formData.companyName}
                      onChange={(e) => handleChange("companyName", e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                    />
                  </div>
                </div>

                {/* Vendor Display Name (Required) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Display Name <span className="text-rose-500">*</span>
                    </label>
                    {!isViewMode && (formData.companyName || formData.firstName) && (
                      <div className="flex items-center gap-1.5 text-[11px] text-blue-600">
                        <span>Fill from:</span>
                        {formData.companyName && (
                          <button
                            type="button"
                            onClick={() => handleChange("displayName", formData.companyName)}
                            className="underline hover:text-blue-800"
                          >
                            Company
                          </button>
                        )}
                        {formData.firstName && (
                          <button
                            type="button"
                            onClick={() =>
                              handleChange(
                                "displayName",
                                `${formData.firstName} ${formData.lastName}`.trim(),
                              )
                            }
                            className="underline hover:text-blue-800"
                          >
                            Name
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    disabled={isViewMode}
                    placeholder="Name shown on purchase orders and bills"
                    value={formData.displayName}
                    onChange={(e) => handleChange("displayName", e.target.value)}
                    className={`w-full h-10 rounded-xl border bg-white px-3 text-xs text-slate-900 font-medium outline-none transition disabled:bg-slate-50 ${
                      errors.displayName
                        ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                        : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    }`}
                  />
                  {errors.displayName && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{errors.displayName}</p>
                  )}
                </div>
              </div>

              {/* Right Column: Contact Details & Language */}
              <div className="space-y-4">
                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      disabled={isViewMode}
                      placeholder="accounts@vendor.com"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      className={`w-full h-10 rounded-xl border bg-white pl-9 pr-3 text-xs text-slate-800 outline-none transition disabled:bg-slate-50 ${
                        errors.email
                          ? "border-rose-400 focus:border-rose-500"
                          : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      }`}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{errors.email}</p>
                  )}
                </div>

                {/* Phones: Work Phone & Mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Work Phone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="tel"
                        disabled={isViewMode}
                        placeholder="+91 22 2490 0000"
                        value={formData.workPhone}
                        onChange={(e) => handleChange("workPhone", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="tel"
                        disabled={isViewMode}
                        placeholder="+91 98200 00000"
                        value={formData.mobile}
                        onChange={(e) => handleChange("mobile", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Vendor Language & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Vendor Language
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <select
                        disabled={isViewMode}
                        value={formData.language}
                        onChange={(e) => handleChange("language", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                      >
                        <option value="English">English</option>
                        <option value="Hindi">Hindi (हिंदी)</option>
                        <option value="Gujarati">Gujarati (ગુજરાતી)</option>
                        <option value="Marathi">Marathi (मराठी)</option>
                        <option value="Tamil">Tamil (தமிழ்)</option>
                        <option value="Telugu">Telugu (తెలుగు)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Status
                    </label>
                    <select
                      disabled={isViewMode}
                      value={formData.status}
                      onChange={(e) =>
                        handleChange("status", e.target.value as VendorFormData["status"])
                      }
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                    >
                      <option value="Active">Active</option>
                      <option value="Pending">Pending Review</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Additional Details Tabs Card */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Accessible Tab Navigation */}
            <div
              role="tablist"
              aria-label="Additional Details Tabs"
              className="flex items-center gap-1 border-b border-slate-200 bg-slate-50/70 p-2 overflow-x-auto no-scrollbar"
            >
              {tabsConfig.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-controls={`panel-${tab.id}`}
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id as ActiveTab)}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "bg-white text-blue-600 shadow-sm border border-slate-200/80"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                    <span>{tab.label}</span>
                    {typeof tab.count === "number" && tab.count > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          isActive
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Panels */}
            <div className="p-6">
              {/* TAB 1: Other Details */}
              {activeTab === "other" && (
                <div
                  role="tabpanel"
                  id="panel-other"
                  aria-labelledby="tab-other"
                  className="space-y-6 animate-in fade-in duration-150"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
                    {/* PAN & MSME */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          PAN (Permanent Account Number)
                        </label>
                        <input
                          type="text"
                          maxLength={10}
                          disabled={isViewMode}
                          placeholder="ABCDE1234F"
                          value={formData.pan}
                          onChange={(e) => handleChange("pan", e.target.value.toUpperCase())}
                          className={`w-full h-10 rounded-xl border bg-white px-3 text-xs font-mono tracking-wider outline-none transition disabled:bg-slate-50 ${
                            errors.pan
                              ? "border-rose-400 focus:border-rose-500"
                              : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          }`}
                        />
                        {errors.pan && (
                          <p className="mt-1 text-xs text-rose-600 font-medium">{errors.pan}</p>
                        )}
                      </div>

                      {/* MSME Registered Toggle Card */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-900">
                              MSME Registered
                            </span>
                            <p className="text-[11px] text-slate-500">
                              Micro, Small & Medium Enterprises Development Act
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={isViewMode}
                              checked={formData.msmeRegistered}
                              onChange={(e) => handleChange("msmeRegistered", e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>

                        {formData.msmeRegistered && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 animate-in fade-in">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                MSME Category
                              </label>
                              <select
                                disabled={isViewMode}
                                value={formData.msmeType}
                                onChange={(e) => handleChange("msmeType", e.target.value)}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="Micro">Micro Enterprise</option>
                                <option value="Small">Small Enterprise</option>
                                <option value="Medium">Medium Enterprise</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Udyam Reg. Number
                              </label>
                              <input
                                type="text"
                                disabled={isViewMode}
                                placeholder="UDYAM-XX-00-0000000"
                                value={formData.msmeNumber}
                                onChange={(e) => handleChange("msmeNumber", e.target.value)}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Currency */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Currency
                        </label>
                        <select
                          disabled={isViewMode}
                          value={formData.currency}
                          onChange={(e) => handleChange("currency", e.target.value)}
                          className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                        >
                          {availableCurrencies.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Accounts Payable */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Accounts Payable
                        </label>
                        <select
                          disabled={isViewMode}
                          value={formData.accountsPayable}
                          onChange={(e) => handleChange("accountsPayable", e.target.value)}
                          className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                        >
                          <option value="Accounts Payable (Sundry Creditors)">
                            Accounts Payable (Sundry Creditors)
                          </option>
                          <option value="Trade Creditors - Raw Materials">
                            Trade Creditors - Raw Materials
                          </option>
                          <option value="Trade Creditors - Packaging">
                            Trade Creditors - Packaging
                          </option>
                          <option value="Expenses Payable - Freight">
                            Expenses Payable - Freight & Logistics
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* Right Column: Balance, Terms, TDS & Portal */}
                    <div className="space-y-4">
                      {/* Opening Balance */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Opening Balance
                        </label>
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-8">
                            <input
                              type="number"
                              disabled={isViewMode}
                              min="0"
                              placeholder="0.00"
                              value={formData.openingBalance}
                              onChange={(e) => handleChange("openingBalance", e.target.value)}
                              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                            />
                          </div>
                          <div className="col-span-4">
                            <select
                              disabled={isViewMode}
                              value={formData.openingBalanceType}
                              onChange={(e) =>
                                handleChange(
                                  "openingBalanceType",
                                  e.target.value as "credit" | "debit",
                                )
                              }
                              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                            >
                              <option value="credit">Credit (Payable)</option>
                              <option value="debit">Debit (Advance)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Payment Terms */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Payment Terms
                        </label>
                        <select
                          disabled={isViewMode}
                          value={formData.paymentTerms}
                          onChange={(e) => handleChange("paymentTerms", e.target.value)}
                          className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                        >
                          {paymentTermsOptions.map((term) => (
                            <option key={term} value={term}>
                              {term}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* TDS (Tax Deducted at Source) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          TDS Preference
                        </label>
                        <select
                          disabled={isViewMode}
                          value={formData.tds}
                          onChange={(e) => handleChange("tds", e.target.value)}
                          className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                        >
                          {tdsOptions.map((tds) => (
                            <option key={tds} value={tds}>
                              {tds}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Enable Portal Access */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-900">
                              Enable Vendor Portal
                            </span>
                            <p className="text-[11px] text-slate-500">
                              Allow supplier to view POs, submit bills, and track payment receipts
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={isViewMode}
                              checked={formData.enablePortal}
                              onChange={(e) => handleChange("enablePortal", e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>

                        {formData.enablePortal && (
                          <div className="pt-2 border-t border-slate-200 animate-in fade-in">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Portal Language
                            </label>
                            <select
                              disabled={isViewMode}
                              value={formData.portalLanguage}
                              onChange={(e) => handleChange("portalLanguage", e.target.value)}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                            >
                              <option value="English">English</option>
                              <option value="Hindi">Hindi</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Address */}
              {activeTab === "address" && (
                <div
                  role="tabpanel"
                  id="panel-address"
                  aria-labelledby="tab-address"
                  className="space-y-6 animate-in fade-in duration-150"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Billing Address Card */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          <h3 className="text-sm font-bold text-slate-900">Billing Address</h3>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Attention
                          </label>
                          <input
                            type="text"
                            disabled={isViewMode}
                            placeholder="Name or department"
                            value={formData.billingAttention}
                            onChange={(e) => handleChange("billingAttention", e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Country / Region
                          </label>
                          <input
                            type="text"
                            disabled={isViewMode}
                            value={formData.billingCountry}
                            onChange={(e) => handleChange("billingCountry", e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Street Address
                          </label>
                          <input
                            type="text"
                            disabled={isViewMode}
                            placeholder="Street Address Line 1"
                            value={formData.billingStreet1}
                            onChange={(e) => handleChange("billingStreet1", e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 mb-2"
                          />
                          <input
                            type="text"
                            disabled={isViewMode}
                            placeholder="Street Address Line 2 (Optional)"
                            value={formData.billingStreet2}
                            onChange={(e) => handleChange("billingStreet2", e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              City
                            </label>
                            <input
                              type="text"
                              disabled={isViewMode}
                              placeholder="City"
                              value={formData.billingCity}
                              onChange={(e) => handleChange("billingCity", e.target.value)}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              State
                            </label>
                            <input
                              type="text"
                              list="billing-states-list"
                              disabled={isViewMode}
                              placeholder="State / UT"
                              value={formData.billingState}
                              onChange={(e) => handleChange("billingState", e.target.value)}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                            />
                            <datalist id="billing-states-list">
                              {indianStates.map((st) => (
                                <option key={st} value={st} />
                              ))}
                            </datalist>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              PIN / Postal Code
                            </label>
                            <input
                              type="text"
                              disabled={isViewMode}
                              placeholder="PIN Code"
                              value={formData.billingPostalCode}
                              onChange={(e) => handleChange("billingPostalCode", e.target.value)}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Phone
                            </label>
                            <input
                              type="tel"
                              disabled={isViewMode}
                              placeholder="Phone"
                              value={formData.billingPhone}
                              onChange={(e) => handleChange("billingPhone", e.target.value)}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Shipping Address Card */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-emerald-600" />
                          <h3 className="text-sm font-bold text-slate-900">Shipping Address</h3>
                        </div>

                        {!isViewMode && (
                          <button
                            type="button"
                            onClick={handleCopyBillingAddress}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 transition"
                          >
                            {copiedAddress ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy from Billing</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Attention
                          </label>
                          <input
                            type="text"
                            disabled={isViewMode}
                            placeholder="Name or warehouse contact"
                            value={formData.shippingAttention}
                            onChange={(e) => handleChange("shippingAttention", e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Country / Region
                          </label>
                          <input
                            type="text"
                            disabled={isViewMode}
                            value={formData.shippingCountry}
                            onChange={(e) => handleChange("shippingCountry", e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Street Address
                          </label>
                          <input
                            type="text"
                            disabled={isViewMode}
                            placeholder="Street Address Line 1"
                            value={formData.shippingStreet1}
                            onChange={(e) => handleChange("shippingStreet1", e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 mb-2"
                          />
                          <input
                            type="text"
                            disabled={isViewMode}
                            placeholder="Street Address Line 2 (Optional)"
                            value={formData.shippingStreet2}
                            onChange={(e) => handleChange("shippingStreet2", e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              City
                            </label>
                            <input
                              type="text"
                              disabled={isViewMode}
                              placeholder="City"
                              value={formData.shippingCity}
                              onChange={(e) => handleChange("shippingCity", e.target.value)}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              State
                            </label>
                            <input
                              type="text"
                              list="shipping-states-list"
                              disabled={isViewMode}
                              placeholder="State / UT"
                              value={formData.shippingState}
                              onChange={(e) => handleChange("shippingState", e.target.value)}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                            />
                            <datalist id="shipping-states-list">
                              {indianStates.map((st) => (
                                <option key={st} value={st} />
                              ))}
                            </datalist>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              PIN / Postal Code
                            </label>
                            <input
                              type="text"
                              disabled={isViewMode}
                              placeholder="PIN Code"
                              value={formData.shippingPostalCode}
                              onChange={(e) => handleChange("shippingPostalCode", e.target.value)}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Phone
                            </label>
                            <input
                              type="tel"
                              disabled={isViewMode}
                              placeholder="Phone"
                              value={formData.shippingPhone}
                              onChange={(e) => handleChange("shippingPhone", e.target.value)}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Contact Persons */}
              {activeTab === "contacts" && (
                <div
                  role="tabpanel"
                  id="panel-contacts"
                  aria-labelledby="tab-contacts"
                  className="space-y-4 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Contact Persons</h3>
                      <p className="text-xs text-slate-500">
                        Add representatives, billing coordinators or sales executives from this vendor
                      </p>
                    </div>

                    {!isViewMode && (
                      <button
                        type="button"
                        onClick={handleAddContact}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Contact Person
                      </button>
                    )}
                  </div>

                  {formData.contactPersons.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                      <Users className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                      <p className="text-xs font-medium">No contact persons added yet.</p>
                      {!isViewMode && (
                        <button
                          type="button"
                          onClick={handleAddContact}
                          className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                        >
                          + Add a contact person
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {formData.contactPersons.map((contact, idx) => (
                        <div
                          key={contact.id}
                          className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 relative group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-800">
                                {contact.firstName || contact.lastName
                                  ? `${contact.salutation} ${contact.firstName} ${contact.lastName}`
                                  : `Contact Person #${idx + 1}`}
                              </span>
                              {contact.isPrimary && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.2 text-[10px] font-bold text-blue-700">
                                  Primary Contact
                                </span>
                              )}
                            </div>

                            {!isViewMode && (
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={contact.isPrimary}
                                    onChange={(e) =>
                                      handleUpdateContact(contact.id, "isPrimary", e.target.checked)
                                    }
                                    className="rounded border-slate-300 text-blue-600"
                                  />
                                  <span>Make Primary</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveContact(contact.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 transition"
                                  title="Remove Contact"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Salutation & Name
                              </label>
                              <div className="flex gap-1.5">
                                <select
                                  disabled={isViewMode}
                                  value={contact.salutation}
                                  onChange={(e) =>
                                    handleUpdateContact(contact.id, "salutation", e.target.value)
                                  }
                                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
                                >
                                  <option value="Mr.">Mr.</option>
                                  <option value="Mrs.">Mrs.</option>
                                  <option value="Ms.">Ms.</option>
                                </select>
                                <input
                                  type="text"
                                  disabled={isViewMode}
                                  placeholder="First"
                                  value={contact.firstName}
                                  onChange={(e) =>
                                    handleUpdateContact(contact.id, "firstName", e.target.value)
                                  }
                                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
                                />
                                <input
                                  type="text"
                                  disabled={isViewMode}
                                  placeholder="Last"
                                  value={contact.lastName}
                                  onChange={(e) =>
                                    handleUpdateContact(contact.id, "lastName", e.target.value)
                                  }
                                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Email Address
                              </label>
                              <input
                                type="email"
                                disabled={isViewMode}
                                placeholder="contact@supplier.com"
                                value={contact.email}
                                onChange={(e) =>
                                  handleUpdateContact(contact.id, "email", e.target.value)
                                }
                                className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Mobile / Phone
                              </label>
                              <input
                                type="tel"
                                disabled={isViewMode}
                                placeholder="+91 98000 00000"
                                value={contact.mobile}
                                onChange={(e) =>
                                  handleUpdateContact(contact.id, "mobile", e.target.value)
                                }
                                className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Designation & Dept
                              </label>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  disabled={isViewMode}
                                  placeholder="Designation"
                                  value={contact.designation}
                                  onChange={(e) =>
                                    handleUpdateContact(contact.id, "designation", e.target.value)
                                  }
                                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
                                />
                                <input
                                  type="text"
                                  disabled={isViewMode}
                                  placeholder="Department"
                                  value={contact.department}
                                  onChange={(e) =>
                                    handleUpdateContact(contact.id, "department", e.target.value)
                                  }
                                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Bank Details */}
              {activeTab === "bank" && (
                <div
                  role="tabpanel"
                  id="panel-bank"
                  aria-labelledby="tab-bank"
                  className="space-y-6 animate-in fade-in duration-150"
                >
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-600 flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-900">Direct Vendor Settlement & Wire Transfers</p>
                      <p className="text-slate-600 mt-0.5">
                        Bank details entered here will be utilized for automated payout reconciliation, NEFT/RTGS generation and remittance advice.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Account Holder Name
                        </label>
                        <input
                          type="text"
                          disabled={isViewMode}
                          placeholder="As registered in the bank passbook"
                          value={formData.accountHolderName}
                          onChange={(e) => handleChange("accountHolderName", e.target.value)}
                          className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          disabled={isViewMode}
                          placeholder="e.g. HDFC Bank, State Bank of India, ICICI"
                          value={formData.bankName}
                          onChange={(e) => handleChange("bankName", e.target.value)}
                          className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Branch Name
                        </label>
                        <input
                          type="text"
                          disabled={isViewMode}
                          placeholder="e.g. Nariman Point Branch, Mumbai"
                          value={formData.branchName}
                          onChange={(e) => handleChange("branchName", e.target.value)}
                          className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Account Number
                        </label>
                        <input
                          type="text"
                          disabled={isViewMode}
                          placeholder="Enter Bank Account Number"
                          value={formData.accountNumber}
                          onChange={(e) => handleChange("accountNumber", e.target.value)}
                          className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Confirm Account Number
                        </label>
                        <input
                          type="text"
                          disabled={isViewMode}
                          placeholder="Re-enter Bank Account Number"
                          value={formData.confirmAccountNumber}
                          onChange={(e) => handleChange("confirmAccountNumber", e.target.value)}
                          className={`w-full h-10 rounded-xl border bg-white px-3 text-xs font-mono outline-none transition disabled:bg-slate-50 ${
                            errors.confirmAccountNumber
                              ? "border-rose-400 focus:border-rose-500"
                              : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          }`}
                        />
                        {errors.confirmAccountNumber && (
                          <p className="mt-1 text-xs text-rose-600 font-medium">
                            {errors.confirmAccountNumber}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          IFSC Code
                        </label>
                        <input
                          type="text"
                          maxLength={11}
                          disabled={isViewMode}
                          placeholder="e.g. HDFC0000123"
                          value={formData.ifscCode}
                          onChange={(e) => handleChange("ifscCode", e.target.value.toUpperCase())}
                          className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-mono tracking-wider outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Custom Fields */}
              {activeTab === "custom" && (
                <div
                  role="tabpanel"
                  id="panel-custom"
                  aria-labelledby="tab-custom"
                  className="space-y-4 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Custom Fields</h3>
                      <p className="text-xs text-slate-500">
                        Add organizational specific fields like certifications, license numbers, or audit ratings
                      </p>
                    </div>

                    {!isViewMode && (
                      <button
                        type="button"
                        onClick={handleAddCustomField}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Field
                      </button>
                    )}
                  </div>

                  {formData.customFields.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                      <Sliders className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                      <p className="text-xs font-medium">No custom fields defined for this vendor.</p>
                      {!isViewMode && (
                        <button
                          type="button"
                          onClick={handleAddCustomField}
                          className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                        >
                          + Add custom field
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.customFields.map((cf) => (
                        <div key={cf.id} className="flex items-center gap-3">
                          <input
                            type="text"
                            disabled={isViewMode}
                            placeholder="Field Label (e.g. FSSAI License No)"
                            value={cf.label}
                            onChange={(e) => handleUpdateCustomField(cf.id, "label", e.target.value)}
                            className="flex-1 h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                          />
                          <input
                            type="text"
                            disabled={isViewMode}
                            placeholder="Field Value"
                            value={cf.value}
                            onChange={(e) => handleUpdateCustomField(cf.id, "value", e.target.value)}
                            className="flex-1 h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                          />
                          {!isViewMode && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomField(cf.id)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: Reporting Tags */}
              {activeTab === "tags" && (
                <div
                  role="tabpanel"
                  id="panel-tags"
                  aria-labelledby="tab-tags"
                  className="space-y-5 animate-in fade-in duration-150"
                >
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Reporting Tags</h3>
                    <p className="text-xs text-slate-500">
                      Categorize this supplier across cost centers, business divisions, or commodity lines
                    </p>
                  </div>

                  {!isViewMode && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type a tag name and click Add (e.g. Grain Division, Import)"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        className="flex-1 h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddTag()}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                      >
                        Add Tag
                      </button>
                    </div>
                  )}

                  {/* Active Tags */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {formData.reportingTags.length === 0 ? (
                      <span className="text-xs text-slate-400">No tags assigned.</span>
                    ) : (
                      formData.reportingTags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700"
                        >
                          <Tag className="h-3 w-3 text-blue-500" />
                          {t}
                          {!isViewMode && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(t)}
                              className="text-blue-400 hover:text-blue-800"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      ))
                    )}
                  </div>

                  {/* Suggested tags */}
                  {!isViewMode && (
                    <div className="pt-4 border-t border-slate-100 space-y-2">
                      <p className="text-xs font-semibold text-slate-500">Quick suggestions:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "Preferred Supplier",
                          "Raw Commodities",
                          "Packaging Material",
                          "High Volume",
                          "ISO Certified",
                          "Logistics Partner",
                        ]
                          .filter((st) => !formData.reportingTags.includes(st))
                          .map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  reportingTags: [...prev.reportingTags, st],
                                }))
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 transition"
                            >
                              + {st}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: Remarks */}
              {activeTab === "remarks" && (
                <div
                  role="tabpanel"
                  id="panel-remarks"
                  aria-labelledby="tab-remarks"
                  className="space-y-4 animate-in fade-in duration-150"
                >
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Internal Remarks</h3>
                    <p className="text-xs text-slate-500">
                      Confidential notes for internal finance, procurement and audit teams (never visible to vendor)
                    </p>
                  </div>

                  <textarea
                    rows={5}
                    disabled={isViewMode}
                    placeholder="Enter any negotiation terms, delivery preferences, or credit notes..."
                    value={formData.remarks}
                    onChange={(e) => handleChange("remarks", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50 leading-relaxed"
                  />
                </div>
              )}

              {/* TAB 8: Documents */}
              {activeTab === "documents" && (
                <div
                  role="tabpanel"
                  id="panel-documents"
                  aria-labelledby="tab-documents"
                  className="space-y-5 animate-in fade-in duration-150"
                >
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Vendor Documents</h3>
                    <p className="text-xs text-slate-500">
                      Upload GST certificate, cancelled cheque, PAN card, or vendor agreement files
                    </p>
                  </div>

                  {/* Dropzone */}
                  {!isViewMode && (
                    <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100/60 text-blue-600 mb-3">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <p className="text-xs font-semibold text-slate-800">
                        Click to browse or drag and drop files here
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        PDF, PNG, JPG, or DOCX (max 10MB per document)
                      </p>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}

                  {/* Uploaded Documents List */}
                  {formData.documents.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No documents attached yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {formData.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:border-slate-300 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{doc.name}</p>
                              <p className="text-[10px] text-slate-400">
                                {(doc.size / 1024).toFixed(1)} KB • Uploaded {doc.uploadedAt}
                              </p>
                            </div>
                          </div>

                          {!isViewMode && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDoc(doc.id)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 transition"
                              title="Delete file"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer Actions */}
          {!isViewMode && (
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md px-6 py-3.5 shadow-lg lg:left-72">
              <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500 hidden sm:block">
                  {formData.displayName ? (
                    <span>
                      Vendor: <strong className="text-slate-800">{formData.displayName}</strong>
                    </span>
                  ) : (
                    <span>Fill required fields marked with *</span>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <Link
                    href="/purchases/vendors"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </Link>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={(e) => handleSubmit(e, true)}
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
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span>{mode === "edit" ? "Update Vendor" : "Save Vendor"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
