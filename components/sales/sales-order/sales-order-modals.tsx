"use client";

import { Check, Plus, Search, X } from "lucide-react";
import { type CustomerOption, type ItemOption } from "./sales-order-types";

type SearchCustomerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  customerSearchQuery: string;
  setCustomerSearchQuery: (q: string) => void;
  filteredSearchCustomers: CustomerOption[];
  selectedCustomerId: string;
  onSelectCustomer: (id: string) => void;
  onOpenAddModal: () => void;
};

export function SearchCustomerModal({
  isOpen,
  onClose,
  customerSearchQuery,
  setCustomerSearchQuery,
  filteredSearchCustomers,
  selectedCustomerId,
  onSelectCustomer,
  onOpenAddModal,
}: SearchCustomerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Select Customer</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by customer name, email, or phone..."
              value={customerSearchQuery}
              onChange={(e) => setCustomerSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-slate-50/70 focus:bg-white transition"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200/90 rounded-2xl">
            {filteredSearchCustomers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelectCustomer(c.id);
                  onClose();
                }}
                className="w-full text-left px-4 py-3 hover:bg-blue-50/70 transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {c.email || c.phone || "No contact info registered"}
                  </p>
                </div>
                {selectedCustomerId === c.id && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            ))}
            {filteredSearchCustomers.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">
                No matching customers found.
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center pt-3.5 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAddModal();
            }}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Customer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

type QuickAddCustomerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  newCustomerName: string;
  setNewCustomerName: (v: string) => void;
  newCustomerEmail: string;
  setNewCustomerEmail: (v: string) => void;
  newCustomerPhone: string;
  setNewCustomerPhone: (v: string) => void;
};

export function QuickAddCustomerModal({
  isOpen,
  onClose,
  onSubmit,
  newCustomerName,
  setNewCustomerName,
  newCustomerEmail,
  setNewCustomerEmail,
  newCustomerPhone,
  setNewCustomerPhone,
}: QuickAddCustomerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95"
      >
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Add New Customer</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Customer / Business Name<span className="text-rose-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              required
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="e.g. Acme Corporation Pvt Ltd"
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Email Address</label>
            <input
              type="email"
              value={newCustomerEmail}
              onChange={(e) => setNewCustomerEmail(e.target.value)}
              placeholder="billing@acmecorp.com"
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-3.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition cursor-pointer active:scale-98"
          >
            Save Customer
          </button>
        </div>
      </form>
    </div>
  );
}

type BulkAddItemsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  availableItems: ItemOption[];
  bulkSelectedItems: Record<string, number>;
  setBulkSelectedItems: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onConfirm: () => void;
};

export function BulkAddItemsModal({
  isOpen,
  onClose,
  availableItems,
  bulkSelectedItems,
  setBulkSelectedItems,
  onConfirm,
}: BulkAddItemsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Add Items in Bulk</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-2.5">
          Select items from your item catalog and specify order quantities to insert them into this sales order.
        </p>

        <div className="py-3 max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200/90 rounded-2xl mt-3">
          {availableItems.map((item) => {
            const currentQty = bulkSelectedItems[item.id] || 0;
            return (
              <div
                key={item.id}
                className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={currentQty > 0}
                    onChange={(e) => {
                      setBulkSelectedItems((prev) => ({
                        ...prev,
                        [item.id]: e.target.checked ? 1 : 0,
                      }));
                    }}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.sku ? `SKU: ${item.sku} · ` : ""}₹{item.salesPrice}{" "}
                      {item.unit ? `per ${item.unit}` : ""}
                    </p>
                  </div>
                </div>

                {currentQty > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-600 font-semibold">Qty:</label>
                    <input
                      type="number"
                      min="1"
                      value={currentQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        setBulkSelectedItems((prev) => ({ ...prev, [item.id]: val }));
                      }}
                      className="w-16 px-2.5 py-1 text-sm text-right border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-semibold"
                    />
                  </div>
                )}
              </div>
            );
          })}
          {availableItems.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400 font-medium">
              No items available in the catalog.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition cursor-pointer active:scale-98"
          >
            Add Selected Items
          </button>
        </div>
      </div>
    </div>
  );
}

export function SequenceModal({
  isOpen,
  onClose,
  sequencePrefix,
  setSequencePrefix,
  sequenceNextNumber,
  setSequenceNextNumber,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  sequencePrefix: string;
  setSequencePrefix: (v: string) => void;
  sequenceNextNumber: string;
  setSequenceNextNumber: (v: string) => void;
  onSave: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Configure Sales Order Sequence
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Prefix</label>
            <input
              type="text"
              value={sequencePrefix}
              onChange={(e) => setSequencePrefix(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-mono font-semibold"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Next Number</label>
            <input
              type="text"
              value={sequenceNextNumber}
              onChange={(e) => setSequenceNextNumber(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-mono font-semibold"
            />
          </div>

          <div className="p-3.5 bg-slate-50/80 rounded-2xl text-xs text-slate-600 border border-slate-200/80">
            Preview format:{" "}
            <strong className="font-mono text-blue-600 font-bold">
              {sequencePrefix}-{sequenceNextNumber}
            </strong>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-3.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition cursor-pointer active:scale-98"
          >
            Save Sequence
          </button>
        </div>
      </div>
    </div>
  );
}
