import { useEffect, useState } from "react";
import { Info, MapPin, Plus, ShieldCheck, Tag } from "lucide-react";
import { FormRow } from "./form-row";
import { STANDARD_PAYMENT_TERMS, type PaymentTermItem } from "@/lib/payment-terms";
import { AddPaymentTermModal } from "./add-payment-term-modal";

export const tabs = [
  "Other Details",
  "Address",
  "Contact Persons",
  "Custom Fields",
  "Reporting Tags",
  "Remarks",
] as const;

export type FormTab = (typeof tabs)[number];

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const textareaClass =
  "w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

type CustomerFormTabsProps = {
  tab: FormTab;
  onTabChange: (tab: FormTab) => void;
  organizationId?: string;
  paymentTerms?: string;
  onPaymentTermsChange?: (terms: string) => void;
};

export function CustomerFormTabs({
  tab,
  onTabChange,
  organizationId,
  paymentTerms,
  onPaymentTermsChange,
}: CustomerFormTabsProps) {
  const [showShipping, setShowShipping] = useState(false);
  const [termsList, setTermsList] = useState<PaymentTermItem[]>([...STANDARD_PAYMENT_TERMS]);
  const [selectedTermState, setSelectedTermState] = useState({
    sourceTerm: paymentTerms,
    value: paymentTerms || "Due on Receipt",
  });
  const selectedTerm = selectedTermState.sourceTerm === paymentTerms
    ? selectedTermState.value
    : paymentTerms || "Due on Receipt";
  const setSelectedTerm = (value: string) => {
    setSelectedTermState({ sourceTerm: paymentTerms, value });
  };
  const [isAddTermModalOpen, setIsAddTermModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const url = organizationId
      ? `/api/payment-terms?organizationId=${encodeURIComponent(organizationId)}`
      : "/api/payment-terms";

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.terms) return;
        setTermsList(data.terms);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [organizationId]);

  const handleSelectTerm = (value: string) => {
    if (
      value === "__ADD_NEW__" ||
      value === "Add New Payment Term" ||
      value === "+ Add New Payment Term"
    ) {
      setIsAddTermModalOpen(true);
      return;
    }
    setSelectedTerm(value);
    onPaymentTermsChange?.(value);
  };

  const handleTermCreated = (newTerm: PaymentTermItem) => {
    setTermsList((prev) => {
      const exists = prev.some(
        (t) => t.name.toLowerCase() === newTerm.name.toLowerCase()
      );
      if (exists) return prev;
      return [...prev, newTerm];
    });
    setSelectedTerm(newTerm.name);
    onPaymentTermsChange?.(newTerm.name);
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
      {/* Tab Navigation Strip */}
      <div className="border-b border-slate-200 pb-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Customer details">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              onClick={() => onTabChange(item)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                tab === item
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Other Details */}
      <div role="tabpanel" hidden={tab !== "Other Details"} className="mt-5 space-y-4">
        <FormRow label="GSTIN" htmlFor="gstin">
          <div className="relative">
            <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="gstin"
              name="gstin"
              placeholder="e.g. 27AAAAA0000A1Z5"
              className={`${inputClass} pl-9 uppercase`}
              maxLength={20}
            />
          </div>
        </FormRow>

        <FormRow label="PAN" htmlFor="pan">
          <input
            id="pan"
            name="pan"
            placeholder="e.g. ABCDE1234F"
            className={`${inputClass} uppercase`}
            maxLength={10}
          />
        </FormRow>

        <FormRow label="Currency" htmlFor="currency">
          <select id="currency" name="currency" className={inputClass} defaultValue="INR">
            <option value="INR">INR - Indian Rupee (₹)</option>
            <option value="USD">USD - US Dollar ($)</option>
            <option value="EUR">EUR - Euro (€)</option>
            <option value="GBP">GBP - British Pound (£)</option>
          </select>
        </FormRow>

        <FormRow label="Opening Balance" htmlFor="openingBalance">
          <div className="flex">
            <span className="flex h-10 items-center rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 px-3.5 text-xs font-bold text-slate-600">
              INR (₹)
            </span>
            <input
              id="openingBalance"
              name="openingBalance"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className={`${inputClass} rounded-l-none`}
            />
          </div>
        </FormRow>

        <FormRow label="Payment Terms" htmlFor="paymentTerms">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                id="paymentTerms"
                name="paymentTerms"
                className={inputClass}
                value={selectedTerm}
                onChange={(e) => handleSelectTerm(e.target.value)}
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
            <button
              type="button"
              onClick={() => setIsAddTermModalOpen(true)}
              title="Add New Payment Term"
              className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Term</span>
            </button>
          </div>
        </FormRow>

        <FormRow label="Portal Access">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            <Info className="h-4 w-4 text-slate-400" />
            <span>Customer self-service portal access is currently in invitation-only preview.</span>
          </div>
        </FormRow>
      </div>

      {/* Tab 2: Address */}
      <div role="tabpanel" hidden={tab !== "Address"} className="mt-5 space-y-6">
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span>Billing Address</span>
          </div>
          <FormRow label="Attention" htmlFor="billingAttention">
            <input
              id="billingAttention"
              name="billingAttention"
              placeholder="Recipient / Department"
              className={inputClass}
            />
          </FormRow>
          <FormRow label="Street Address" htmlFor="billingStreet">
            <textarea
              id="billingStreet"
              name="billingStreet"
              placeholder="Floor, building, street, landmark"
              className={`${textareaClass} h-20`}
            />
          </FormRow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormRow label="City" htmlFor="billingCity">
              <input id="billingCity" name="billingCity" placeholder="City" className={inputClass} />
            </FormRow>
            <FormRow label="State / Province" htmlFor="billingState">
              <input
                id="billingState"
                name="billingState"
                placeholder="State (e.g. Maharashtra)"
                className={inputClass}
              />
            </FormRow>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormRow label="Postal Code" htmlFor="billingPostalCode">
              <input
                id="billingPostalCode"
                name="billingPostalCode"
                placeholder="PIN / Postal Code"
                className={inputClass}
              />
            </FormRow>
            <FormRow label="Country" htmlFor="billingCountry">
              <input
                id="billingCountry"
                name="billingCountry"
                className={inputClass}
                defaultValue="India"
              />
            </FormRow>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <MapPin className="h-4 w-4 text-emerald-600" />
              <span>Shipping Address</span>
            </div>
            <button
              type="button"
              onClick={() => setShowShipping((prev) => !prev)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              {showShipping ? "Hide shipping address" : "+ Add separate shipping address"}
            </button>
          </div>

          {showShipping && (
            <div className="mt-4 space-y-3.5 border-t border-slate-200/80 pt-4">
              <FormRow label="Attention" htmlFor="shippingAttention">
                <input
                  id="shippingAttention"
                  name="shippingAttention"
                  placeholder="Warehouse manager / site attention"
                  className={inputClass}
                />
              </FormRow>
              <FormRow label="Street Address" htmlFor="shippingStreet">
                <textarea
                  id="shippingStreet"
                  name="shippingStreet"
                  placeholder="Delivery gate, unit, street"
                  className={`${textareaClass} h-20`}
                />
              </FormRow>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormRow label="City" htmlFor="shippingCity">
                  <input id="shippingCity" name="shippingCity" placeholder="City" className={inputClass} />
                </FormRow>
                <FormRow label="State" htmlFor="shippingState">
                  <input id="shippingState" name="shippingState" placeholder="State" className={inputClass} />
                </FormRow>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormRow label="Postal Code" htmlFor="shippingPostalCode">
                  <input
                    id="shippingPostalCode"
                    name="shippingPostalCode"
                    placeholder="PIN / Postal Code"
                    className={inputClass}
                  />
                </FormRow>
                <FormRow label="Country" htmlFor="shippingCountry">
                  <input id="shippingCountry" name="shippingCountry" className={inputClass} placeholder="Country" />
                </FormRow>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab 3: Contact Persons */}
      <div role="tabpanel" hidden={tab !== "Contact Persons"} className="mt-5 space-y-4">
        <p className="text-xs text-slate-500">
          The primary contact details entered in the top card are automatically associated with this account. You can specify secondary contact channels below.
        </p>
        <FormRow label="Contact Email" htmlFor="contactEmail">
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            placeholder="secondary@customer.com"
            className={inputClass}
          />
        </FormRow>
        <FormRow label="Work Phone" htmlFor="contactPhone">
          <input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            placeholder="Direct desk phone"
            className={inputClass}
          />
        </FormRow>
        <FormRow label="Mobile" htmlFor="contactMobile">
          <input
            id="contactMobile"
            name="contactMobile"
            type="tel"
            placeholder="Alternative mobile number"
            className={inputClass}
          />
        </FormRow>
      </div>

      {/* Tab 4: Custom Fields */}
      <div role="tabpanel" hidden={tab !== "Custom Fields"} className="mt-5 space-y-4">
        <p className="text-xs text-slate-500">
          Add an optional custom property or tracking key specific to your organization workflow.
        </p>
        <FormRow label="Field Name" htmlFor="customFieldLabel">
          <input
            id="customFieldLabel"
            name="customFieldLabel"
            placeholder="e.g. Internal Account ID, Region Code"
            className={inputClass}
            maxLength={80}
          />
        </FormRow>
        <FormRow label="Value" htmlFor="customFieldValue">
          <input
            id="customFieldValue"
            name="customFieldValue"
            placeholder="e.g. WEST-ZONE-44"
            className={inputClass}
            maxLength={250}
          />
        </FormRow>
      </div>

      {/* Tab 5: Reporting Tags */}
      <div role="tabpanel" hidden={tab !== "Reporting Tags"} className="mt-5 space-y-4">
        <FormRow label="Reporting Tags" htmlFor="reportingTags">
          <div className="relative">
            <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="reportingTags"
              name="reportingTags"
              className={`${inputClass} pl-9`}
              placeholder="Wholesale, High Priority, Q3-Campaign (comma separated)"
            />
          </div>
        </FormRow>
        <p className="text-[11px] text-slate-400">
          Tags help filter customer groups in financial reports, ledger statements, and receivables aging reports.
        </p>
      </div>

      {/* Tab 6: Remarks */}
      <div role="tabpanel" hidden={tab !== "Remarks"} className="mt-5 space-y-4">
        <FormRow label="Internal Remarks" htmlFor="remarks">
          <textarea
            id="remarks"
            name="remarks"
            placeholder="Add any internal credit notes, special terms, or billing remarks for internal staff reference (not printed on client invoices)."
            className={`${textareaClass} h-28`}
            maxLength={2000}
          />
        </FormRow>
      </div>

      <AddPaymentTermModal
        isOpen={isAddTermModalOpen}
        onClose={() => setIsAddTermModalOpen(false)}
        onCreated={handleTermCreated}
        organizationId={organizationId}
        existingTerms={termsList.map((t) => t.name)}
      />
    </div>
  );
}
