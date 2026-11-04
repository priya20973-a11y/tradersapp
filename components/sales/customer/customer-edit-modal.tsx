"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  Mail,
  MapPin,
  Phone,
  Save,
  Smartphone,
  User,
  X,
} from "lucide-react";
import { type Customer } from "./customer-types";
import { STANDARD_PAYMENT_TERMS, type PaymentTermItem } from "@/lib/payment-terms";
import { AddPaymentTermModal } from "./add-payment-term-modal";

type CustomerEditModalProps = {
  customer: Customer;
  organizationId?: string;
  onClose: () => void;
  onSaved: (updated: Customer) => void;
};

const inputClass =
  "h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function CustomerEditModal({
  customer,
  organizationId,
  onClose,
  onSaved,
}: CustomerEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isAddTermModalOpen, setIsAddTermModalOpen] = useState(false);
  const [termsList, setTermsList] = useState<PaymentTermItem[]>(() => {
    const list = [...STANDARD_PAYMENT_TERMS];
    if (
      customer.paymentTerms &&
      !list.some((t) => t.name.toLowerCase() === customer.paymentTerms!.toLowerCase())
    ) {
      list.push({ name: customer.paymentTerms, days: 0, isCustom: true });
    }
    return list;
  });

  useEffect(() => {
    let active = true;
    const url = organizationId
      ? `/api/payment-terms?organizationId=${encodeURIComponent(organizationId)}`
      : "/api/payment-terms";

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.terms) return;
        setTermsList(() => {
          const map = new Map<string, PaymentTermItem>();
          for (const t of data.terms) {
            map.set(t.name.toLowerCase(), t);
          }
          if (
            customer.paymentTerms &&
            !map.has(customer.paymentTerms.toLowerCase())
          ) {
            map.set(customer.paymentTerms.toLowerCase(), {
              name: customer.paymentTerms,
              days: 0,
              isCustom: true,
            });
          }
          return Array.from(map.values());
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [organizationId, customer.paymentTerms]);

  const [formData, setFormData] = useState({
    name: customer.name || "",
    customerType: customer.customerType || "Business",
    companyName: customer.companyName || "",
    email: customer.email || "",
    phone: customer.phone || "",
    mobile: customer.mobile || "",
    gstin: customer.gstin || "",
    pan: customer.pan || "",
    state: customer.state || "",
    customerLanguage: customer.customerLanguage || "English",
    currency: customer.currency || "INR",
    paymentTerms: customer.paymentTerms || "Due on Receipt",
    status: customer.status || "Active",
    remarks: customer.remarks || "",
    billingAddress: {
      attention: customer.billingAddress?.attention || "",
      street: customer.billingAddress?.street || "",
      city: customer.billingAddress?.city || "",
      state: customer.billingAddress?.state || "",
      postalCode: customer.billingAddress?.postalCode || "",
      country: customer.billingAddress?.country || "India",
    },
    shippingAddress: {
      attention: customer.shippingAddress?.attention || "",
      street: customer.shippingAddress?.street || "",
      city: customer.shippingAddress?.city || "",
      state: customer.shippingAddress?.state || "",
      postalCode: customer.shippingAddress?.postalCode || "",
      country: customer.shippingAddress?.country || "India",
    },
  });

  const handleCopyBillingToShipping = () => {
    setFormData((prev) => ({
      ...prev,
      shippingAddress: { ...prev.billingAddress },
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Customer name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/sales/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          ...formData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update customer.");
      }

      const updatedCustomer: Customer = {
        ...customer,
        ...formData,
      };

      onSaved(updatedCustomer);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating customer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 font-bold text-xs">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Edit Customer Profile</h2>
              <p className="text-xs text-slate-500">Update business information, contact details, and address records</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Primary Contact & Identity</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputClass}
                    placeholder="Customer Display Name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className={`${inputClass} pl-8`}
                      placeholder="Company Legal Name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Type</label>
                  <select
                    value={formData.customerType}
                    onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                    className={inputClass}
                  >
                    <option value="Business">Business</option>
                    <option value="Individual">Individual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className={inputClass}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Review">Review</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`${inputClass} pl-8`}
                      placeholder="billing@customer.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Work Phone</label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={`${inputClass} pl-8`}
                      placeholder="e.g. 022 2847 1234"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone</label>
                  <div className="relative">
                    <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className={`${inputClass} pl-8`}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Payment Terms</label>
                    <button
                      type="button"
                      onClick={() => setIsAddTermModalOpen(true)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      + Add Term
                    </button>
                  </div>
                  <select
                    value={formData.paymentTerms}
                    onChange={(e) => {
                      if (
                        e.target.value === "__ADD_NEW__" ||
                        e.target.value === "Add New Payment Term" ||
                        e.target.value === "+ Add New Payment Term"
                      ) {
                        setIsAddTermModalOpen(true);
                        return;
                      }
                      setFormData({ ...formData, paymentTerms: e.target.value });
                    }}
                    className={inputClass}
                  >
                    {termsList.map((term) => (
                      <option key={term.name} value={term.name}>
                        {term.name}
                      </option>
                    ))}
                    <option value="__ADD_NEW__" className="font-semibold text-blue-600 bg-blue-50">
                      + Add New Payment Term
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tax & Compliance */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tax & Compliance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    className={inputClass}
                    placeholder="27AAAAA0000A1Z5"
                    maxLength={15}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    className={inputClass}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Place of Supply / State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. Maharashtra"
                  />
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Address Details</h3>
                <button
                  type="button"
                  onClick={handleCopyBillingToShipping}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Copy Billing to Shipping
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Billing Address */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <MapPin className="h-3.5 w-3.5 text-blue-600" />
                    <span>Billing Address</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Attention</label>
                    <input
                      type="text"
                      value={formData.billingAddress.attention}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          billingAddress: { ...formData.billingAddress, attention: e.target.value },
                        })
                      }
                      className={inputClass}
                      placeholder="Contact Person or Department"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Street Address</label>
                    <textarea
                      value={formData.billingAddress.street}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          billingAddress: { ...formData.billingAddress, street: e.target.value },
                        })
                      }
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="Street, Flat/Building, Area"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">City</label>
                      <input
                        type="text"
                        value={formData.billingAddress.city}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            billingAddress: { ...formData.billingAddress, city: e.target.value },
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={formData.billingAddress.postalCode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            billingAddress: { ...formData.billingAddress, postalCode: e.target.value },
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Shipping Address</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Attention</label>
                    <input
                      type="text"
                      value={formData.shippingAddress.attention}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          shippingAddress: { ...formData.shippingAddress, attention: e.target.value },
                        })
                      }
                      className={inputClass}
                      placeholder="Receiving Person or Warehouse"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Street Address</label>
                    <textarea
                      value={formData.shippingAddress.street}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          shippingAddress: { ...formData.shippingAddress, street: e.target.value },
                        })
                      }
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="Destination Street, Dock/Bay"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">City</label>
                      <input
                        type="text"
                        value={formData.shippingAddress.city}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            shippingAddress: { ...formData.shippingAddress, city: e.target.value },
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={formData.shippingAddress.postalCode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            shippingAddress: { ...formData.shippingAddress, postalCode: e.target.value },
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700">Remarks / Internal Notes</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Internal memo or customer preferences (not printed on invoice)"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 transition"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? "Saving Changes…" : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>

      <AddPaymentTermModal
        isOpen={isAddTermModalOpen}
        onClose={() => setIsAddTermModalOpen(false)}
        onCreated={(newTerm) => {
          setTermsList((prev) => {
            const exists = prev.some(
              (t) => t.name.toLowerCase() === newTerm.name.toLowerCase()
            );
            if (exists) return prev;
            return [...prev, newTerm];
          });
          setFormData((prev) => ({ ...prev, paymentTerms: newTerm.name }));
        }}
        organizationId={organizationId}
        existingTerms={termsList.map((t) => t.name)}
      />
    </div>
  );
}

