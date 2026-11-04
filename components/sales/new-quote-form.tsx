"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  CheckCircle2,
  Search,
  X,
} from "lucide-react";
import {
  type CustomerOption,
  type DirectTaxOption,
  type ItemOption,
  type NewQuoteFormProps,
  type QuoteItemRow,
} from "./quote/quote-types";
import { QuoteHeaderFields } from "./quote/quote-header-fields";
import { QuoteItemsTable } from "./quote/quote-items-table";
import { QuoteTotalsCard } from "./quote/quote-totals-card";
import { calculateQuoteTotals } from "@/lib/quote-tax-utils";
import { invalidateSalesCache } from "@/lib/sales-cache";

export function NewQuoteForm({ initialData, onSuccess, onCancel }: NewQuoteFormProps) {
  const router = useRouter();

  // Organization & Master data
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [organizationId, setOrganizationId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [availableItems, setAvailableItems] = useState<ItemOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialData?.customerId || "");
  const [quoteNumber, setQuoteNumber] = useState(initialData?.number || "QT-000001");
  const [referenceNumber, setReferenceNumber] = useState(initialData?.referenceNumber || "");
  const [quoteDate, setQuoteDate] = useState(() => {
    if (initialData?.issueDate) {
      try {
        return new Date(initialData.issueDate).toISOString().split("T")[0];
      } catch {}
    }
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [expiryDate, setExpiryDate] = useState(() => {
    if (initialData?.expiryDate) {
      try {
        return new Date(initialData.expiryDate).toISOString().split("T")[0];
      } catch {}
    }
    return "";
  });
  const [subject, setSubject] = useState(initialData?.subject || "");

  // Line items
  const [rows, setRows] = useState<QuoteItemRow[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items.map((item, idx) => ({
        id: `row-${idx + 1}`,
        name: item.name,
        description: item.description || "",
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
      }));
    }
    return [
      {
        id: "row-1",
        name: "",
        description: "",
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ];
  });

  // Calculations state
  const [discountType, setDiscountType] = useState<"percent" | "amount">(
    initialData?.discountType || "percent"
  );
  const [discountValue, setDiscountValue] = useState(() => {
    if (initialData?.discount !== undefined && initialData.discount !== null && initialData.discount > 0) {
      return String(initialData.discount);
    }
    return "";
  });
  const [gstRate, setGstRate] = useState<string>(() => {
    if (initialData?.taxRate !== undefined && initialData.taxRate !== null) {
      return String(initialData.taxRate);
    }
    if (initialData?.taxName) {
      const match = initialData.taxName.match(/(\d+(?:\.\d+)?)/);
      if (match) return match[1];
    }
    return "18";
  });
  const [adjustmentValue, setAdjustmentValue] = useState(() => {
    if (initialData?.adjustment !== undefined && initialData.adjustment !== 0) {
      return String(initialData.adjustment);
    }
    return "";
  });

  // TDS / TCS direct tax states
  const [tdsTcsMode, setTdsTcsMode] = useState<"TDS" | "TCS">(() => {
    if (initialData?.tdsTcsType === "TCS" || initialData?.taxType === "TCS") return "TCS";
    return "TDS";
  });
  const [selectedTdsTcsTax, setSelectedTdsTcsTax] = useState<DirectTaxOption | null>(() => {
    if (
      initialData?.tdsTcsType &&
      initialData.tdsTcsType !== "None" &&
      initialData.tdsTcsRate !== undefined
    ) {
      return {
        id: "initial-tds-tcs",
        name: initialData.tdsTcsName || `${initialData.tdsTcsType} Tax`,
        rate: initialData.tdsTcsRate,
      };
    }
    if (initialData?.taxType === "TDS" || initialData?.taxType === "TCS") {
      return {
        id: "initial-legacy-tax",
        name: initialData.taxName || `${initialData.taxType} Tax`,
        rate: initialData.taxRate || 0,
      };
    }
    return null;
  });

  // Terms and notes
  const [customerNotes, setCustomerNotes] = useState(
    initialData?.customerNotes || "Thanks for your business."
  );
  const [termsAndConditions, setTermsAndConditions] = useState(
    initialData?.termsAndConditions || ""
  );

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle organization switch
  const handleOrganizationChange = async (newOrgId: string) => {
    setOrganizationId(newOrgId);
    setSelectedCustomerId("");
    try {
      const res = await fetch(`/api/sales?organizationId=${encodeURIComponent(newOrgId)}`);
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.customers || []).map((c: { id: string; name: string; email?: string }) => ({
          id: c.id,
          name: c.name,
          email: c.email,
        }));
        setCustomers(mapped);
      }
    } catch (e) {
      console.error("Error switching organization:", e);
    }
  };

  // Fetch initial data
  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        let initialOrgId = "";
        let initialCid = "";
        let initialQid = "";

        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          initialOrgId = params.get("organizationId") || "";
          initialCid = params.get("customerId") || "";
          initialQid = params.get("id") || params.get("quoteId") || "";
        }

        const salesParams = new URLSearchParams();
        if (initialOrgId) salesParams.set("organizationId", initialOrgId);
        if (initialCid) salesParams.set("customerId", initialCid);
        const queryStr = salesParams.toString() ? `?${salesParams.toString()}` : "";

        const salesRes = await fetch(`/api/sales${queryStr}`, { cache: "no-store" });
        const salesData = salesRes.ok ? await salesRes.json() : { customers: [], organizations: [] };

        if (!isMounted) return;

        const orgList = salesData.organizations || [];
        setOrganizations(orgList);
        setIsAdmin(Boolean(salesData.isAdmin));

        let activeOrgId = initialOrgId;
        if (!activeOrgId && orgList.length > 0) {
          activeOrgId = orgList[0].id;
        }
        setOrganizationId(activeOrgId);

        let customerList = salesData.customers || [];
        let docList = salesData.documents || [];

        // If admin and activeOrgId was determined but no customers returned yet, fetch for that org
        if (salesData.isAdmin && activeOrgId && customerList.length === 0) {
          const orgRes = await fetch(`/api/sales?organizationId=${encodeURIComponent(activeOrgId)}`, { cache: "no-store" });
          if (orgRes.ok) {
            const orgData = await orgRes.json();
            customerList = orgData.customers || [];
            docList = orgData.documents || [];
          }
        }

        const mapped = customerList.map((c: { id: string; name: string; email?: string }) => ({
          id: c.id,
          name: c.name,
          email: c.email,
        }));
        setCustomers(mapped);

        if (initialCid) {
          setSelectedCustomerId(initialCid);
        }

        if (initialQid && !initialData) {
          const found = docList.find((d: { id: string; [key: string]: unknown }) => d.id === initialQid);
          if (found) {
            setSelectedCustomerId(typeof found.customerId === "string" ? found.customerId : "");
            setQuoteNumber(typeof found.number === "string" ? found.number : "");
            setReferenceNumber(typeof found.referenceNumber === "string" ? found.referenceNumber : "");
            if (found.issueDate) {
              try {
                setQuoteDate(new Date(String(found.issueDate)).toISOString().split("T")[0]);
              } catch {}
            }
            if (found.expiryDate) {
              try {
                setExpiryDate(new Date(String(found.expiryDate)).toISOString().split("T")[0]);
              } catch {}
            }
            setSubject(typeof found.subject === "string" ? found.subject : "");
            setCustomerNotes(typeof found.customerNotes === "string" ? found.customerNotes : "Thanks for your business.");
            setTermsAndConditions(typeof found.termsAndConditions === "string" ? found.termsAndConditions : "");
            setDiscountType(found.discountType === "amount" ? "amount" : "percent");
            setDiscountValue(found.discount ? String(found.discount) : "");
            if (found.taxRate !== undefined && found.taxRate !== null) {
              setGstRate(String(found.taxRate));
            } else if (typeof found.taxName === "string") {
              const match = found.taxName.match(/(\d+(?:\.\d+)?)/);
              if (match) setGstRate(match[1]);
            }
            if (found.tdsTcsType && found.tdsTcsType !== "None") {
              setTdsTcsMode(found.tdsTcsType === "TCS" ? "TCS" : "TDS");
              setSelectedTdsTcsTax({
                id: `loaded-${found.tdsTcsType}`,
                name: typeof found.tdsTcsName === "string" ? found.tdsTcsName : `${found.tdsTcsType} Tax`,
                rate: Number(found.tdsTcsRate) || 0,
              });
            } else if (found.taxType === "TDS" || found.taxType === "TCS") {
              setTdsTcsMode(found.taxType);
              setSelectedTdsTcsTax({
                id: `loaded-${found.taxType}`,
                name: typeof found.taxName === "string" ? found.taxName : `${found.taxType} Tax`,
                rate: Number(found.taxRate) || 0,
              });
            }
            setAdjustmentValue(found.adjustment ? String(found.adjustment) : "");
            if (Array.isArray(found.items) && found.items.length > 0) {
              setRows(
                found.items.map((item: { name: string; description?: string; quantity: number; rate: number; amount: number }, idx: number) => ({
                  id: `row-${idx + 1}`,
                  name: item.name,
                  description: item.description || "",
                  quantity: item.quantity,
                  rate: item.rate,
                  amount: item.amount,
                }))
              );
            }
          }
        }
      } catch (err) {
        console.error("Error loading quote master data:", err);
      }
    }

    loadInitialData();

    // Load items
    fetch("/api/items")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (!isMounted) return;
        const mapped = (data.items || []).map((i: { id?: string; sku?: string; name: string; salesPrice?: number; salesDescription?: string; unit?: string }) => ({
          id: i.id || i.sku || "",
          name: i.name,
          sku: i.sku,
          salesPrice: i.salesPrice || 0,
          salesDescription: i.salesDescription || "",
          unit: i.unit || "pcs",
        }));
        setAvailableItems(mapped);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [initialData]);

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
          description: item.salesDescription || "",
          rate,
          amount: Math.round(qty * rate * 100) / 100,
        };
      })
    );
  };

  const updateRow = (id: string, updates: Partial<QuoteItemRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...updates };
        if (updates.quantity !== undefined || updates.rate !== undefined) {
          const qty = updated.quantity || 0;
          const rate = updated.rate || 0;
          updated.amount = Math.round(qty * rate * 100) / 100;
        }
        return updated;
      })
    );
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        name: "",
        description: "",
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      setRows([
        {
          id: `row-${Date.now()}`,
          name: "",
          description: "",
          quantity: 1,
          rate: 0,
          amount: 0,
        },
      ]);
    }
  };

  // Calculations
  const subTotal = rows.reduce((acc, row) => acc + (row.amount || 0), 0);
  const totals = calculateQuoteTotals({
    subTotal,
    discountValue,
    discountType,
    gstRate,
    tdsTcsType: selectedTdsTcsTax ? tdsTcsMode : "None",
    tdsTcsRate: selectedTdsTcsTax ? selectedTdsTcsTax.rate : 0,
    adjustmentValue,
  });

  const {
    discountAmount,
    gstAmount,
    tdsTcsAmount,
    adjustment,
    total,
  } = totals;
  const gstRateNum = totals.gstRate;

  const handleSave = async (status: "Draft" | "Sent") => {
    if (!selectedCustomerId) {
      setError("Please select a customer for this quote.");
      return;
    }

    const validRows = rows.filter((r) => r.name.trim() !== "");
    if (validRows.length === 0) {
      setError("Please add at least one line item with a name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        id: initialData?.id,
        organizationId: organizationId || undefined,
        type: "Quote",
        customerId: selectedCustomerId,
        number: quoteNumber.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        issueDate: quoteDate || undefined,
        expiryDate: expiryDate || undefined,
        subject: subject.trim() || undefined,
        customerNotes: customerNotes.trim() || undefined,
        termsAndConditions: termsAndConditions.trim() || undefined,
        subTotal,
        discount: discountAmount,
        discountType,
        taxType: "GST",
        taxName: `GST ${gstRateNum}%`,
        taxRate: gstRateNum,
        taxAmount: gstAmount,
        tdsTcsType: selectedTdsTcsTax ? tdsTcsMode : "None",
        tdsTcsName: selectedTdsTcsTax ? selectedTdsTcsTax.name : undefined,
        tdsTcsRate: selectedTdsTcsTax ? selectedTdsTcsTax.rate : 0,
        tdsTcsAmount,
        adjustment,
        total,
        status,
        items: validRows.map((r) => ({
          itemId: r.itemId && /^[0-9a-fA-F]{24}$/.test(r.itemId) ? r.itemId : undefined,
          name: r.name,
          description: r.description || undefined,
          quantity: Number(r.quantity) || 1,
          rate: Number(r.rate) || 0,
          amount: Number(r.amount) || 0,
        })),
        notes: customerNotes.trim() || undefined,
      };

      const res = await fetch("/api/sales", {
        method: initialData?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save Quote");
      }

      invalidateSalesCache();

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/sales/quotes");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong saving the quote.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/sales/quotes");
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {initialData ? `Edit Quote (${initialData.number})` : "New Quotation"}
            </h2>
            <p className="text-xs text-slate-500">
              {initialData
                ? "Update pricing estimate and GST details for this quote"
                : "Provide pricing estimate for products or services"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Top Details Form */}
        <div className="space-y-4 max-w-4xl">
          {/* Organization (Admin only) */}
          {isAdmin && organizations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] items-center gap-2">
              <label className="text-sm font-semibold text-slate-800">
                Organization<span className="text-red-500 ml-0.5">*</span>
              </label>
              <div className="relative flex-1">
                <select
                  value={organizationId}
                  onChange={(e) => handleOrganizationChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white text-slate-700 shadow-xs transition"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Customer Name */}
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] items-center gap-2">
            <label className="text-sm font-semibold text-slate-800">
              Customer Name<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white text-slate-700 shadow-xs transition"
                >
                  <option value="">Select or add a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.email ? `(${c.email})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                title="Search customers"
                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          <QuoteHeaderFields
            quoteNumber={quoteNumber}
            setQuoteNumber={setQuoteNumber}
            referenceNumber={referenceNumber}
            setReferenceNumber={setReferenceNumber}
            quoteDate={quoteDate}
            setQuoteDate={setQuoteDate}
            expiryDate={expiryDate}
            setExpiryDate={setExpiryDate}
            subject={subject}
            setSubject={setSubject}
          />
        </div>

        {/* Item Table Section */}
        <QuoteItemsTable
          rows={rows}
          availableItems={availableItems}
          onSelectItem={handleSelectItem}
          onUpdateRow={updateRow}
          onAddRow={addRow}
          onRemoveRow={removeRow}
        />

        {/* Bottom Two Columns (Notes & Calculations) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
          {/* Left Column: Notes & Terms */}
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Customer Notes</label>
              <textarea
                rows={3}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white resize-y shadow-xs transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Terms & Conditions</label>
              <textarea
                rows={4}
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                placeholder="Enter standard business terms and payment conditions..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white resize-y shadow-xs transition"
              />
            </div>

            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Additional Fields:</span> Customize proposal fields in{" "}
              <span className="font-medium text-blue-600">Settings ➔ Sales ➔ Quotes</span>.
            </p>
          </div>

          {/* Right Column: Calculations & File Upload */}
          <QuoteTotalsCard
            subTotal={subTotal}
            discountValue={discountValue}
            setDiscountValue={setDiscountValue}
            discountType={discountType}
            setDiscountType={setDiscountType}
            discountAmount={discountAmount}
            gstRate={gstRate}
            setGstRate={setGstRate}
            gstAmount={gstAmount}
            tdsTcsMode={tdsTcsMode}
            setTdsTcsMode={setTdsTcsMode}
            selectedTax={selectedTdsTcsTax}
            setSelectedTax={setSelectedTdsTcsTax}
            tdsTcsAmount={tdsTcsAmount}
            adjustmentValue={adjustmentValue}
            setAdjustmentValue={setAdjustmentValue}
            adjustment={adjustment}
            total={total}
          />
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-slate-50/80 border-t border-slate-200">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave("Draft")}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 rounded-xl shadow-xs transition cursor-pointer"
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave("Sent")}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            {loading ? "Saving..." : "Save and Send"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl shadow-xs transition cursor-pointer"
          >
            Cancel
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Template: <span className="font-medium text-slate-700">&apos;Standard Proposal&apos;</span>
        </div>
      </div>
    </div>
  );
}
