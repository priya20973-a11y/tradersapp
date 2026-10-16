"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";

type Organization = { id: string; name: string };
type SalesResponse = {
  organizations: Organization[];
  isAdmin: boolean;
  error?: string;
};

const tabs = ["Other Details", "Address", "Contact Persons", "Custom Fields", "Reporting Tags", "Remarks"] as const;
type FormTab = (typeof tabs)[number];

const inputClass = "h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const labelClass = "text-xs font-medium text-slate-700";

export function NewCustomerForm() {
  const router = useRouter();
  const [tab, setTab] = useState<FormTab>("Other Details");
  const [customerType, setCustomerType] = useState<"Business" | "Individual">("Business");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/sales", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as SalesResponse;
        if (!response.ok) throw new Error(data.error ?? "Unable to load customer setup.");
        if (!active) return;
        setOrganizations(data.organizations);
        setIsAdmin(data.isAdmin);
        if (data.isAdmin) {
          const requestedId = new URLSearchParams(window.location.search).get("organizationId");
          const selectedOrganization = data.organizations.find((item) => item.id === requestedId)
            ?? data.organizations[0];
          setOrganizationId(selectedOrganization?.id ?? "");
        } else {
          setOrganizationId(data.organizations[0]?.id ?? "");
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load customer setup.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    const text = (key: string) => String(fields.get(key) ?? "").trim();
    const contactPerson = [text("firstName"), text("lastName")].filter(Boolean).join(" ");
    const contactEmail = text("contactEmail");
    const contactPhone = text("contactPhone");
    const contactMobile = text("contactMobile");
    const customLabel = text("customFieldLabel");
    const customValue = text("customFieldValue");
    const tags = text("reportingTags").split(",").map((value) => value.trim()).filter(Boolean);
    const payload = {
      type: "Customer",
      name: text("displayName"),
      customerType,
      salutation: text("salutation"),
      firstName: text("firstName"),
      lastName: text("lastName"),
      companyName: text("companyName"),
      contactPerson,
      email: text("email"),
      phone: text("workPhone"),
      mobile: text("mobile"),
      gstin: text("gstin"),
      pan: text("pan"),
      state: text("billingState"),
      customerLanguage: text("customerLanguage") || "English",
      currency: text("currency") || "INR",
      openingBalance: Number(text("openingBalance") || 0),
      paymentTerms: text("paymentTerms") || "Due on Receipt",
      allowPortal: false,
      billingAddress: {
        attention: text("billingAttention"),
        street: text("billingStreet"),
        city: text("billingCity"),
        state: text("billingState"),
        postalCode: text("billingPostalCode"),
        country: text("billingCountry"),
      },
      shippingAddress: {
        attention: text("shippingAttention"),
        street: text("shippingStreet"),
        city: text("shippingCity"),
        state: text("shippingState"),
        postalCode: text("shippingPostalCode"),
        country: text("shippingCountry"),
      },
      contactPersons: contactPerson || contactEmail || contactPhone || contactMobile
        ? [{ name: contactPerson, email: contactEmail, phone: contactPhone, mobile: contactMobile }]
        : [],
      customFields: customLabel || customValue ? [{ label: customLabel, value: customValue }] : [],
      reportingTags: tags,
      remarks: text("remarks"),
      ...(isAdmin ? { organizationId } : {}),
    };

    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to create customer.");
      router.push("/sales/customers");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-7rem)] bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/sales/customers")}
            aria-label="Back to customers"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-semibold text-slate-900">New Customer</h1>
        </div>
        {isAdmin && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Organization
            <select
              aria-label="Select organization"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="max-w-56 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              required
            >
              <option value="">Select organization</option>
              {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <form onSubmit={handleSubmit} className="max-w-5xl px-5 pb-8 pt-4 sm:px-8">
        <div className="mb-5 flex items-center gap-2 bg-blue-50 px-3 py-2.5 text-xs text-blue-900">
          <Check className="h-4 w-4 shrink-0 text-blue-700" />
          Add the customer&apos;s GSTIN and address details to keep sales documents accurate.
        </div>

        {isAdmin && organizations.length === 0 && !loading && (
          <p role="alert" className="mb-4 rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            No organizations are available. Create an organization before adding customers.
          </p>
        )}
        {error && <p role="alert" className="mb-4 rounded-md bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p>}

        <div className="space-y-3">
          <FormRow label="Customer Type">
            <div className="flex h-9 items-center gap-5 text-xs text-slate-800">
              {(["Business", "Individual"] as const).map((value) => (
                <label key={value} className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="customerType"
                    value={value}
                    checked={customerType === value}
                    onChange={() => setCustomerType(value)}
                    className="accent-blue-600"
                  />
                  {value}
                </label>
              ))}
            </div>
          </FormRow>
          <FormRow label="Primary Contact">
            <div className="grid grid-cols-[92px_1fr_1fr] gap-2">
              <select name="salutation" aria-label="Salutation" className={inputClass}>
                <option value="">Salutation</option><option>Mr.</option><option>Ms.</option><option>Mrs.</option><option>Dr.</option>
              </select>
              <input name="firstName" aria-label="First name" placeholder="First Name" className={inputClass} />
              <input name="lastName" aria-label="Last name" placeholder="Last Name" className={inputClass} />
            </div>
          </FormRow>
          {customerType === "Business" && (
            <FormRow label="Company Name" htmlFor="companyName">
              <input id="companyName" name="companyName" className={inputClass} maxLength={160} />
            </FormRow>
          )}
          <FormRow label="Display Name" required htmlFor="displayName">
            <input id="displayName" name="displayName" aria-label="Display Name" className={inputClass} required minLength={2} maxLength={120} placeholder="Customer name shown on transactions" />
          </FormRow>
          <FormRow label="Email Address" htmlFor="email">
            <input id="email" name="email" type="email" className={inputClass} />
          </FormRow>
          <FormRow label="Phone">
            <div className="grid grid-cols-2 gap-2">
              <input name="workPhone" type="tel" className={inputClass} maxLength={30} placeholder="Work Phone" />
              <input name="mobile" type="tel" className={inputClass} maxLength={30} placeholder="Mobile" />
            </div>
          </FormRow>
          <FormRow label="Customer Language" htmlFor="customerLanguage">
            <select id="customerLanguage" name="customerLanguage" className={inputClass} defaultValue="English">
              {["English", "Hindi", "Gujarati", "Marathi", "Punjabi", "Tamil", "Telugu", "Kannada", "Bengali"].map((language) => <option key={language}>{language}</option>)}
            </select>
          </FormRow>
        </div>

        <div className="mt-7 border-b border-slate-200">
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Customer details">
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                onClick={() => setTab(item)}
                className={`whitespace-nowrap border-b-2 px-2.5 py-2 text-xs font-medium ${
                  tab === item ? "border-blue-600 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <section role="tabpanel" hidden={tab !== "Other Details"} className="space-y-3 pt-4">
          <FormRow label="GSTIN" htmlFor="gstin">
            <input id="gstin" name="gstin" className={inputClass} maxLength={20} />
          </FormRow>
          <FormRow label="PAN" htmlFor="pan">
            <input id="pan" name="pan" className={inputClass} maxLength={10} />
          </FormRow>
          <FormRow label="Currency" htmlFor="currency">
            <select id="currency" name="currency" className={inputClass} defaultValue="INR">
              <option value="INR">INR - Indian Rupee</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </select>
          </FormRow>
          <FormRow label="Opening Balance" htmlFor="openingBalance">
            <div className="flex">
              <span className="flex h-9 items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-xs text-slate-600">INR</span>
              <input id="openingBalance" name="openingBalance" type="number" min="0" step="0.01" defaultValue="0" className={`${inputClass} rounded-l-none`} />
            </div>
          </FormRow>
          <FormRow label="Payment Terms" htmlFor="paymentTerms">
            <select id="paymentTerms" name="paymentTerms" className={inputClass} defaultValue="Due on Receipt">
              {["Due on Receipt", "Net 15", "Net 30", "Net 45", "Net 60"].map((term) => <option key={term}>{term}</option>)}
            </select>
          </FormRow>
          <FormRow label="Portal Access">
            <p className="py-2 text-xs text-slate-500">Customer portal access is not configured for this workspace.</p>
          </FormRow>
        </section>

        <section role="tabpanel" hidden={tab !== "Address"} className="space-y-3 pt-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Billing Address</h2>
          <FormRow label="Attention" htmlFor="billingAttention"><input id="billingAttention" name="billingAttention" className={inputClass} /></FormRow>
          <FormRow label="Street" htmlFor="billingStreet"><textarea id="billingStreet" name="billingStreet" className={`${inputClass} h-16 py-2`} /></FormRow>
          <FormRow label="City" htmlFor="billingCity"><input id="billingCity" name="billingCity" className={inputClass} /></FormRow>
          <FormRow label="State" htmlFor="billingState"><input id="billingState" name="billingState" className={inputClass} /></FormRow>
          <FormRow label="Postal Code" htmlFor="billingPostalCode"><input id="billingPostalCode" name="billingPostalCode" className={inputClass} /></FormRow>
          <FormRow label="Country" htmlFor="billingCountry"><input id="billingCountry" name="billingCountry" className={inputClass} defaultValue="India" /></FormRow>
          <details className="pt-3">
            <summary className="cursor-pointer text-sm font-medium text-blue-700">Add shipping address</summary>
            <div className="mt-4 space-y-3">
              <FormRow label="Attention" htmlFor="shippingAttention"><input id="shippingAttention" name="shippingAttention" className={inputClass} /></FormRow>
              <FormRow label="Street" htmlFor="shippingStreet"><textarea id="shippingStreet" name="shippingStreet" className={`${inputClass} h-16 py-2`} /></FormRow>
              <FormRow label="City" htmlFor="shippingCity"><input id="shippingCity" name="shippingCity" className={inputClass} /></FormRow>
              <FormRow label="State" htmlFor="shippingState"><input id="shippingState" name="shippingState" className={inputClass} /></FormRow>
              <FormRow label="Postal Code" htmlFor="shippingPostalCode"><input id="shippingPostalCode" name="shippingPostalCode" className={inputClass} /></FormRow>
              <FormRow label="Country" htmlFor="shippingCountry"><input id="shippingCountry" name="shippingCountry" className={inputClass} /></FormRow>
            </div>
          </details>
        </section>

        <section role="tabpanel" hidden={tab !== "Contact Persons"} className="space-y-3 pt-4">
          <p className="mb-3 text-xs text-slate-500">The primary contact details entered above will be saved with this customer.</p>
          <FormRow label="Contact Email" htmlFor="contactEmail"><input id="contactEmail" name="contactEmail" type="email" className={inputClass} /></FormRow>
          <FormRow label="Work Phone" htmlFor="contactPhone"><input id="contactPhone" name="contactPhone" type="tel" className={inputClass} /></FormRow>
          <FormRow label="Mobile" htmlFor="contactMobile"><input id="contactMobile" name="contactMobile" type="tel" className={inputClass} /></FormRow>
        </section>

        <section role="tabpanel" hidden={tab !== "Custom Fields"} className="space-y-3 pt-4">
          <p className="mb-3 text-xs text-slate-500">Add one optional custom field for this customer.</p>
          <FormRow label="Field Name" htmlFor="customFieldLabel"><input id="customFieldLabel" name="customFieldLabel" className={inputClass} maxLength={80} /></FormRow>
          <FormRow label="Value" htmlFor="customFieldValue"><input id="customFieldValue" name="customFieldValue" className={inputClass} maxLength={250} /></FormRow>
        </section>

        <section role="tabpanel" hidden={tab !== "Reporting Tags"} className="space-y-3 pt-4">
          <FormRow label="Reporting Tags" htmlFor="reportingTags">
            <input id="reportingTags" name="reportingTags" className={inputClass} placeholder="Separate tags with commas" />
          </FormRow>
          <p className="text-xs text-slate-500">Tags can be used to group customers in reports.</p>
        </section>

        <section role="tabpanel" hidden={tab !== "Remarks"} className="space-y-3 pt-4">
          <FormRow label="Remarks" htmlFor="remarks"><textarea id="remarks" name="remarks" className={`${inputClass} h-28 py-2`} maxLength={2000} /></FormRow>
        </section>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => router.push("/sales/customers")} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading || (isAdmin && !organizationId)}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Customer"}
            </button>
          </div>
        </div>
        <p className="mt-7 text-xs text-slate-500">
          <span className="font-semibold">Customer Owner:</span> Customer ownership is not configured for this workspace.
        </p>
      </form>
    </main>
  );
}

function FormRow({ label, required, htmlFor, children }: { label: string; required?: boolean; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center sm:gap-3">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}{required && <span className="ml-1 text-rose-600">*</span>}
        </label>
      ) : (
        <div className={labelClass} role="group" aria-label={label}>
          {label}{required && <span className="ml-1 text-rose-600">*</span>}
        </div>
      )}
      <div className="max-w-md">{children}</div>
    </div>
  );
}
