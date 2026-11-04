"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Settings, ShoppingCart, X } from "lucide-react";
import {
  type CustomerOption,
  type AttachedFile,
  type NewSalesOrderFormProps,
} from "./sales-order/sales-order-types";
import {
  BulkAddItemsModal,
  QuickAddCustomerModal,
  SearchCustomerModal,
  SequenceModal,
} from "./sales-order/sales-order-modals";
import { SalesOrderHeaderFields } from "./sales-order/sales-order-header-fields";
import { SalesOrderItemsTable } from "./sales-order/sales-order-items-table";
import { SalesOrderTotalsCard } from "./sales-order/sales-order-totals-card";
import { SalesOrderBottomBar } from "./sales-order/sales-order-bottom-bar";
import { useSalesOrderMasterData } from "./sales-order/use-sales-order-master-data";
import { useSalesOrderRows } from "./sales-order/use-sales-order-rows";

export function NewSalesOrderForm({
  onSuccess,
  onCancel,
}: NewSalesOrderFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    customers,
    setCustomers,
    availableItems,
    salesOrderNumber,
    setSalesOrderNumber,
    sequencePrefix,
    setSequencePrefix,
    sequenceNextNumber,
    setSequenceNextNumber,
  } = useSalesOrderMasterData();

  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("customerId") || "";
    }
    return "";
  });

  const [referenceNumber, setReferenceNumber] = useState("");
  const [salesOrderDate, setSalesOrderDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [expectedShipmentDate, setExpectedShipmentDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Due on Receipt");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [salesperson, setSalesperson] = useState("");

  // Line items & calculations from hook
  const {
    rows,
    setRows,
    updateRow,
    handleSelectItem,
    addRow,
    removeRow,
    clearRows,
    showBulkAddModal,
    setShowBulkAddModal,
    bulkSelectedItems,
    setBulkSelectedItems,
    handleConfirmBulkAdd,
    showBulkActionsMenu,
    setShowBulkActionsMenu,
    discountValue,
    setDiscountValue,
    discountType,
    setDiscountType,
    taxMode,
    setTaxMode,
    selectedTaxIndex,
    setSelectedTaxIndex,
    selectedTax,
    adjustmentValue,
    setAdjustmentValue,
    subTotal,
    totalQuantity,
    discountAmount,
    taxRate,
    rawTaxAmount,
    taxAmount,
    adjustment,
    total,
  } = useSalesOrderRows(availableItems);

  // Bottom notes
  const [customerNotes, setCustomerNotes] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  // Modals & UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [showSearchCustomerModal, setShowSearchCustomerModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [showSaveSplitMenu, setShowSaveSplitMenu] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  // File upload handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (attachedFiles.length + newFiles.length >= 10) {
        setError("Maximum 10 files allowed.");
        break;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds the 5MB limit.`);
        continue;
      }
      newFiles.push({ name: file.name, size: file.size });
    }

    if (newFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...newFiles]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick Customer Creation
  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "Customer",
          name: newCustomerName.trim(),
          email: newCustomerEmail.trim() || undefined,
          phone: newCustomerPhone.trim() || undefined,
        }),
      });

      const createdId = res.ok ? (await res.json()).id || `temp-${Date.now()}` : `temp-${Date.now()}`;
      const newCustomer: CustomerOption = {
        id: createdId,
        name: newCustomerName.trim(),
        email: newCustomerEmail.trim(),
        phone: newCustomerPhone.trim(),
      };
      setCustomers((prev) => [newCustomer, ...prev]);
      setSelectedCustomerId(createdId);
      setShowAddCustomerModal(false);
      setNewCustomerName("");
      setNewCustomerEmail("");
      setNewCustomerPhone("");
    } catch {
      const createdId = `temp-${Date.now()}`;
      const newCustomer: CustomerOption = {
        id: createdId,
        name: newCustomerName.trim(),
        email: newCustomerEmail.trim(),
        phone: newCustomerPhone.trim(),
      };
      setCustomers((prev) => [newCustomer, ...prev]);
      setSelectedCustomerId(createdId);
      setShowAddCustomerModal(false);
    }
  };

  // Save handler
  const handleSave = async (status: "Draft" | "Confirmed" | "Print" | "CreateNew") => {
    if (!selectedCustomerId) {
      setError("Please select a customer for this sales order.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const validRows = rows.filter((r) => r.name.trim() !== "");
    if (validRows.length === 0) {
      setError("Please add at least one line item with a name.");
      return;
    }

    setLoading(true);
    setError(null);

    const orderStatus = status === "Draft" ? "Draft" : "Confirmed";

    try {
      const payload = {
        type: "Sales Order",
        customerId: selectedCustomerId,
        number: salesOrderNumber.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        issueDate: salesOrderDate || undefined,
        expectedShipmentDate: expectedShipmentDate || undefined,
        paymentTerms: paymentTerms || undefined,
        deliveryMethod: deliveryMethod || undefined,
        salesperson: salesperson || undefined,
        customerNotes: customerNotes.trim() || undefined,
        termsAndConditions: termsAndConditions.trim() || undefined,
        subTotal,
        discount: discountAmount,
        discountType,
        taxType: taxMode,
        taxName: selectedTax?.label || undefined,
        taxRate,
        taxAmount,
        adjustment,
        total,
        status: orderStatus,
        items: validRows.map((r) => ({
          itemId: r.itemId || undefined,
          name: r.name,
          description: r.description || undefined,
          quantity: Number(r.quantity) || 1,
          rate: Number(r.rate) || 0,
          amount: Number(r.amount) || 0,
        })),
        notes: customerNotes.trim() || undefined,
      };

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save Sales Order");
      }

      if (status === "Print") {
        window.print();
      }

      if (status === "CreateNew") {
        clearRows();
        setCustomerNotes("");
        setTermsAndConditions("");
        setReferenceNumber("");
        setAttachedFiles([]);
        const nextNum = parseInt(sequenceNextNumber, 10) + 1;
        const formattedNext = `${sequencePrefix}-${String(nextNum).padStart(5, "0")}`;
        setSalesOrderNumber(formattedNext);
        setSequenceNextNumber(String(nextNum).padStart(5, "0"));
        setLoading(false);
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/sales/orders");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong saving the sales order.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/sales/orders");
    }
  };

  const filteredSearchCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(customerSearchQuery.toLowerCase())) ||
      (c.phone && c.phone.includes(customerSearchQuery))
  );

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden text-slate-800 pb-24 relative">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">New Sales Order</h1>
            <p className="text-xs text-slate-500">Record customer commercial terms, commodities, and fulfillment schedule.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSequenceModal(true)}
            title="Configure Number Sequence"
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 font-medium flex items-center justify-between shadow-2xs">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="p-1 text-red-500 hover:text-red-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Form Fields */}
      <div className="p-6 space-y-6">
        <SalesOrderHeaderFields
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          salesOrderNumber={salesOrderNumber}
          setSalesOrderNumber={setSalesOrderNumber}
          referenceNumber={referenceNumber}
          setReferenceNumber={setReferenceNumber}
          salesOrderDate={salesOrderDate}
          setSalesOrderDate={setSalesOrderDate}
          expectedShipmentDate={expectedShipmentDate}
          setExpectedShipmentDate={setExpectedShipmentDate}
          paymentTerms={paymentTerms}
          setPaymentTerms={setPaymentTerms}
          deliveryMethod={deliveryMethod}
          setDeliveryMethod={setDeliveryMethod}
          salesperson={salesperson}
          setSalesperson={setSalesperson}
          onOpenSearchCustomer={() => setShowSearchCustomerModal(true)}
          onOpenAddCustomer={() => setShowAddCustomerModal(true)}
          onOpenSequenceModal={() => setShowSequenceModal(true)}
        />

        {/* Item Table Section */}
        <SalesOrderItemsTable
          rows={rows}
          availableItems={availableItems}
          showBulkActionsMenu={showBulkActionsMenu}
          setShowBulkActionsMenu={setShowBulkActionsMenu}
          handleSelectItem={handleSelectItem}
          updateRow={updateRow}
          removeRow={removeRow}
          addRow={addRow}
          onOpenBulkAddModal={() => setShowBulkAddModal(true)}
          onApplyBulkDiscount={() => setDiscountValue("5")}
          onClearTable={clearRows}
        />

        {/* Bottom Two Columns (Notes & Calculations) */}
        <SalesOrderTotalsCard
          customerNotes={customerNotes}
          setCustomerNotes={setCustomerNotes}
          termsAndConditions={termsAndConditions}
          setTermsAndConditions={setTermsAndConditions}
          attachedFiles={attachedFiles}
          onFileUpload={handleFileUpload}
          onRemoveFile={removeAttachedFile}
          fileInputRef={fileInputRef}
          subTotal={subTotal}
          discountValue={discountValue}
          setDiscountValue={setDiscountValue}
          discountType={discountType}
          setDiscountType={setDiscountType}
          discountAmount={discountAmount}
          taxMode={taxMode}
          setTaxMode={setTaxMode}
          selectedTaxIndex={selectedTaxIndex}
          setSelectedTaxIndex={setSelectedTaxIndex}
          rawTaxAmount={rawTaxAmount}
          adjustmentValue={adjustmentValue}
          setAdjustmentValue={setAdjustmentValue}
          adjustment={adjustment}
          total={total}
        />
      </div>

      {/* Sticky Bottom Actions Bar */}
      <SalesOrderBottomBar
        loading={loading}
        handleSave={handleSave}
        handleCancel={handleCancel}
        showSaveSplitMenu={showSaveSplitMenu}
        setShowSaveSplitMenu={setShowSaveSplitMenu}
        total={total}
        totalQuantity={totalQuantity}
      />

      <SequenceModal
        isOpen={showSequenceModal}
        onClose={() => setShowSequenceModal(false)}
        sequencePrefix={sequencePrefix}
        setSequencePrefix={setSequencePrefix}
        sequenceNextNumber={sequenceNextNumber}
        setSequenceNextNumber={setSequenceNextNumber}
        onSave={() => {
          setSalesOrderNumber(`${sequencePrefix}-${sequenceNextNumber}`);
          setShowSequenceModal(false);
        }}
      />

      <SearchCustomerModal
        isOpen={showSearchCustomerModal}
        onClose={() => setShowSearchCustomerModal(false)}
        customerSearchQuery={customerSearchQuery}
        setCustomerSearchQuery={setCustomerSearchQuery}
        filteredSearchCustomers={filteredSearchCustomers}
        selectedCustomerId={selectedCustomerId}
        onSelectCustomer={(id) => setSelectedCustomerId(id)}
        onOpenAddModal={() => setShowAddCustomerModal(true)}
      />

      <QuickAddCustomerModal
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        onSubmit={handleQuickAddCustomer}
        newCustomerName={newCustomerName}
        setNewCustomerName={setNewCustomerName}
        newCustomerEmail={newCustomerEmail}
        setNewCustomerEmail={setNewCustomerEmail}
        newCustomerPhone={newCustomerPhone}
        setNewCustomerPhone={setNewCustomerPhone}
      />

      <BulkAddItemsModal
        isOpen={showBulkAddModal}
        onClose={() => setShowBulkAddModal(false)}
        availableItems={availableItems}
        bulkSelectedItems={bulkSelectedItems}
        setBulkSelectedItems={setBulkSelectedItems}
        onConfirm={handleConfirmBulkAdd}
      />
    </div>
  );
}
