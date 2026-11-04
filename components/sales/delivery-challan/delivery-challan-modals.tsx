"use client";

import { useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { type CustomerOption, type ItemOption } from "./delivery-challan-types";

interface SearchCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerOption[];
  onSelectCustomer: (customerId: string) => void;
  onOpenAddModal: () => void;
  selectedCustomerId?: string;
}

export function SearchCustomerModal({
  isOpen,
  onClose,
  customers,
  onSelectCustomer,
  onOpenAddModal,
  selectedCustomerId,
}: SearchCustomerModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  const filtered = customers.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.companyName && c.companyName.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
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
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer name, company, email, or phone..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200/90 rounded-2xl">
            {filtered.map((c) => (
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
                  <p className="text-sm font-semibold text-slate-900">{c.companyName || c.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[c.name !== c.companyName ? c.name : "", c.email, c.phone].filter(Boolean).join(" · ") || "No contact info registered"}
                  </p>
                </div>
                {selectedCustomerId === c.id && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            ))}
            {filtered.length === 0 && (
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

interface QuickAddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  newCustomerName: string;
  setNewCustomerName: (v: string) => void;
  newCustomerEmail: string;
  setNewCustomerEmail: (v: string) => void;
  newCustomerPhone: string;
  setNewCustomerPhone: (v: string) => void;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
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

        <form onSubmit={onSubmit} className="py-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer / Company Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="e.g. Acme Logistics Pvt Ltd"
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={newCustomerEmail}
              onChange={(e) => setNewCustomerEmail(e.target.value)}
              placeholder="billing@acme.com"
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newCustomerName.trim()}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition cursor-pointer"
            >
              Create Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BulkAddItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableItems: ItemOption[];
  bulkSelectedItems: Record<string, number>;
  setBulkSelectedItems: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onConfirm: () => void;
}

export function BulkAddItemsModal({
  isOpen,
  onClose,
  availableItems,
  bulkSelectedItems,
  setBulkSelectedItems,
  onConfirm,
}: BulkAddItemsModalProps) {
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const filteredItems = availableItems.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.sku && i.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedCount = Object.values(bulkSelectedItems).filter((q) => q > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200">
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
          Select items from your catalog and specify dispatch quantities to insert them into this delivery challan.
        </p>

        <div className="mt-3 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items by name or SKU..."
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
          />
        </div>

        <div className="py-3 max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200/90 rounded-2xl mt-3">
          {filteredItems.map((item) => {
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
                      {item.sku ? `SKU: ${item.sku} · ` : ""}₹{item.salesPrice || 0}{" "}
                      {item.unit ? `per ${item.unit}` : ""}
                    </p>
                  </div>
                </div>

                {currentQty > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Qty:</span>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={currentQty}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setBulkSelectedItems((prev) => ({
                          ...prev,
                          [item.id]: val,
                        }));
                      }}
                      className="w-20 px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-right font-semibold"
                    />
                  </div>
                )}
              </div>
            );
          })}
          {filteredItems.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400 font-medium">
              No matching items found.
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4">
          <span className="text-xs text-slate-500 font-medium">
            {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
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
              disabled={selectedCount === 0}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition cursor-pointer"
            >
              Add Selected ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

