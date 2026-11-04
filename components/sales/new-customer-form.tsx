"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Globe,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  Smartphone,
  UserCheck,
} from "lucide-react";
import { CustomerClassificationCards } from "./customer/customer-classification-cards";
import { CustomerFormTabs, type FormTab } from "./customer/customer-form-tabs";
import { FormRow } from "./customer/form-row";

type Organization = { id: string; name: string };
type SalesResponse = {
  organizations: Organization[];
  isAdmin: boolean;
  error?: string;
};

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

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
  const [companyName, setCompanyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sameAsCompanyName, setSameAsCompanyName] = useState(false);

  const handleSameAsCompanyChange = (checked: boolean) => {
    setSameAsCompanyName(checked);
    if (checked && companyName.trim().length > 0) {
      setDisplayName(companyName);
    }
  };

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setCompanyName(nextVal);
    if (sameAsCompanyName && nextVal.trim().length > 0) {
      setDisplayName(nextVal);
    }
  };

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (sameAsCompanyName) return;
    setDisplayName(e.target.value);
  };

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
          const selectedOrganization =
            data.organizations.find((item) => item.id === requestedId) ?? data.organizations[0];
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
    return () => {
      active = false;
    };
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
    const tags = text("reportingTags")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

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
      contactPersons:
        contactPerson || contactEmail || contactPhone || contactMobile
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
    <div className="min-h-[calc(100vh-7rem)] bg-slate-50/50 pb-20">
      {/* Top Header */}
      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/sales/customers")}
                aria-label="Back to customers"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-2xs transition hover:bg-slate-50 hover:text-slate-800"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-blue-600">Customers</span>
                  <span className="text-xs text-slate-400">/</span>
                  <span className="text-xs text-slate-500">Create New</span>
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">New Customer Profile</h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {isAdmin && (
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Building2 className="h-4 w-4 text-slate-400" />
                  </div>
                  <select
                    aria-label="Select organization"
                    value={organizationId}
                    onChange={(event) => setOrganizationId(event.target.value)}
                    className="h-10 rounded-xl border border-slate-300 bg-white pl-9 pr-8 text-xs font-medium text-slate-700 shadow-2xs transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  >
                    <option value="">Select organization</option>
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={() => router.push("/sales/customers")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Body */}
      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 p-4 text-xs text-blue-900 shadow-xs">
            <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-950">GST Compliance & Commercial Records</p>
              <p className="mt-0.5 text-blue-800/90 leading-relaxed">
                Add accurate customer GSTIN, PAN, and billing address to ensure automated GST calculation on invoices and quotes.
              </p>
            </div>
          </div>

          {isAdmin && organizations.length === 0 && !loading && (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs font-medium text-amber-800 shadow-xs">
              No organizations are available. Create an organization before adding customers.
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs font-medium text-rose-800 shadow-xs">
              {error}
            </div>
          )}

          <CustomerClassificationCards
            customerType={customerType}
            onSelectType={(type) => {
              setCustomerType(type);
              if (type === "Individual") {
                setSameAsCompanyName(false);
              }
            }}
          />

          {/* Primary Profile Details Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserCheck className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Primary Contact & Identity</h2>
            </div>

            <div className="mt-4 space-y-4">
              <FormRow label="Primary Contact">
                <div className="grid grid-cols-[100px_1fr_1fr] gap-2.5">
                  <select name="salutation" aria-label="Salutation" className={inputClass}>
                    <option value="">Salutation</option>
                    <option>Mr.</option>
                    <option>Ms.</option>
                    <option>Mrs.</option>
                    <option>Dr.</option>
                  </select>
                  <input
                    name="firstName"
                    aria-label="First name"
                    placeholder="First Name"
                    className={inputClass}
                  />
                  <input
                    name="lastName"
                    aria-label="Last name"
                    placeholder="Last Name"
                    className={inputClass}
                  />
                </div>
              </FormRow>

              {customerType === "Business" && (
                <FormRow label="Company Name" htmlFor="companyName">
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="companyName"
                      name="companyName"
                      value={companyName}
                      onChange={handleCompanyNameChange}
                      placeholder="e.g. Reliance Industries Ltd"
                      className={`${inputClass} pl-9`}
                      maxLength={160}
                    />
                  </div>
                </FormRow>
              )}

              <FormRow label="Display Name" required htmlFor="displayName">
                <div className="space-y-1.5">
                  <input
                    id="displayName"
                    name="displayName"
                    aria-label="Display Name"
                    value={displayName}
                    onChange={handleDisplayNameChange}
                    readOnly={sameAsCompanyName}
                    className={`${inputClass} ${
                      sameAsCompanyName ? "bg-slate-50 text-slate-600 cursor-not-allowed" : ""
                    }`}
                    required
                    minLength={2}
                    maxLength={120}
                    placeholder="Customer name shown on invoices, quotes, and ledger"
                  />
                  {customerType === "Business" && (
                    <label
                      htmlFor="sameAsCompanyName"
                      className="flex items-center gap-2 cursor-pointer select-none pt-0.5"
                    >
                      <input
                        type="checkbox"
                        id="sameAsCompanyName"
                        name="sameAsCompanyName"
                        checked={sameAsCompanyName}
                        onChange={(e) => handleSameAsCompanyChange(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-700">
                        Display Name same as Company Name
                      </span>
                    </label>
                  )}
                  <p className="text-[11px] text-slate-400">
                    This name will be printed on all sales transactions and client vouchers.
                  </p>
                </div>
              </FormRow>

              <FormRow label="Email Address" htmlFor="email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="billing@customer.com"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </FormRow>

              <FormRow label="Phone Numbers">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      name="workPhone"
                      type="tel"
                      className={`${inputClass} pl-9`}
                      maxLength={30}
                      placeholder="Work Phone (e.g. 022 2847 1234)"
                    />
                  </div>
                  <div className="relative">
                    <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      name="mobile"
                      type="tel"
                      className={`${inputClass} pl-9`}
                      maxLength={30}
                      placeholder="Mobile Phone (e.g. +91 98765 43210)"
                    />
                  </div>
                </div>
              </FormRow>

              <FormRow label="Customer Language" htmlFor="customerLanguage">
                <div className="relative">
                  <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    id="customerLanguage"
                    name="customerLanguage"
                    className={`${inputClass} pl-9`}
                    defaultValue="English"
                  >
                    {[
                      "English",
                      "Hindi",
                      "Gujarati",
                      "Marathi",
                      "Punjabi",
                      "Tamil",
                      "Telugu",
                      "Kannada",
                      "Bengali",
                    ].map((language) => (
                      <option key={language}>{language}</option>
                    ))}
                  </select>
                </div>
              </FormRow>
            </div>
          </div>

          <CustomerFormTabs
            tab={tab}
            onTabChange={(t) => setTab(t)}
            organizationId={organizationId}
          />

          {/* Form Actions Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 pt-4">
            <button
              type="button"
              onClick={() => router.push("/sales/customers")}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || loading || (isAdmin && !organizationId)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? "Saving Customer…" : "Save Customer"}</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            FinanceOS · LedgerFlow Enterprise CRM · Customer profile saved securely under organization scope.
          </p>
        </form>
      </main>
    </div>
  );
}
