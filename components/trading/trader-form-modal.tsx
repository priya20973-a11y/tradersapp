"use client";

import { X } from "lucide-react";
import { type emptyTraderForm } from "./trader-types";

interface TraderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  form: typeof emptyTraderForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyTraderForm>>;
  saving: boolean;
  changeRole: (role: string) => void;
  inputClass: string;
  labelClass: string;
  buttonClass: string;
}

export function TraderFormModal({
  isOpen,
  onClose,
  onSubmit,
  form,
  setForm,
  saving,
  changeRole,
  inputClass,
  labelClass,
  buttonClass,
}: TraderFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8">
      <form
        onSubmit={onSubmit}
        className="my-auto w-full max-w-3xl space-y-5 rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">Add trader</h2>
            <p className="mt-1 text-sm text-slate-500">
              Buyer and seller roles create linked customer/vendor records.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Trader code *</span>
            <input
              required
              maxLength={32}
              className={inputClass}
              value={form.traderCode}
              onChange={(e) => setForm({ ...form, traderCode: e.target.value })}
            />
          </label>
          <label>
            <span className={labelClass}>Legal business name *</span>
            <input
              required
              minLength={2}
              className={inputClass}
              value={form.legalBusinessName}
              onChange={(e) => setForm({ ...form, legalBusinessName: e.target.value })}
            />
          </label>
          <label>
            <span className={labelClass}>Trade name</span>
            <input
              className={inputClass}
              value={form.tradeName}
              onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
            />
          </label>
          <label>
            <span className={labelClass}>Business type</span>
            <select
              className={inputClass}
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
            >
              {[
                "Proprietorship",
                "Partnership",
                "LLP",
                "Private Limited",
                "Public Limited",
                "FPO",
                "Cooperative",
                "Other",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <fieldset className="sm:col-span-2">
            <legend className={labelClass}>Trading roles *</legend>
            <div className="flex flex-wrap gap-4">
              {["Buyer", "Seller", "Broker", "Commission Agent", "Consignment Owner"].map(
                (role) => (
                  <label key={role} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.roles.includes(role)}
                      onChange={() => changeRole(role)}
                    />
                    {role}
                  </label>
                )
              )}
            </div>
          </fieldset>
          <label>
            <span className={labelClass}>Commodities (comma separated)</span>
            <input
              className={inputClass}
              value={form.mainCommodities}
              onChange={(e) => setForm({ ...form, mainCommodities: e.target.value })}
            />
          </label>
          <label>
            <span className={labelClass}>GSTIN</span>
            <input
              maxLength={15}
              className={inputClass}
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
            />
          </label>
          <label>
            <span className={labelClass}>PAN</span>
            <input
              maxLength={10}
              className={inputClass}
              value={form.pan}
              onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
            />
          </label>
          <label>
            <span className={labelClass}>Contact name</span>
            <input
              className={inputClass}
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            />
          </label>
          <label>
            <span className={labelClass}>Mobile</span>
            <input
              className={inputClass}
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            />
          </label>
          <label>
            <span className={labelClass}>Contact email</span>
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            <span className={labelClass}>City</span>
            <input
              className={inputClass}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </label>
          <label>
            <span className={labelClass}>State</span>
            <input
              className={inputClass}
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
          </label>
          <label>
            <span className={labelClass}>Credit limit (₹)</span>
            <input
              type="number"
              min="0"
              className={inputClass}
              value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
            />
          </label>
          <label>
            <span className={labelClass}>Credit period (days)</span>
            <input
              type="number"
              min="0"
              max="3650"
              className={inputClass}
              value={form.creditPeriodDays}
              onChange={(e) => setForm({ ...form, creditPeriodDays: e.target.value })}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Payment terms</span>
            <input
              className={inputClass}
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={buttonClass || "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"}
            disabled={saving || form.roles.length === 0}
          >
            {saving ? "Saving…" : "Create trader"}
          </button>
        </div>
      </form>
    </div>
  );
}
