"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileUp, Plus, Search, X } from "lucide-react";

type OrganizationOption = { id: string; name: string };
type TraderRow = {
  id: string;
  traderCode: string;
  legalBusinessName: string;
  tradeName: string;
  businessType: string;
  tradingStatus: string;
  roles: string[];
  mainCommodities: string[];
  primaryContact: string;
  city: string;
  state: string;
  gstin: string;
  kycStatus: string;
  creditLimit: number;
  receivable: number;
  payable: number;
  creditUtilization: number;
};
type TraderDetail = TraderRow & Record<string, unknown> & {
  billingAddress?: { city?: string; state?: string; line1?: string; postalCode?: string };
  contacts?: { name: string; mobile?: string; email?: string }[];
  bankAccounts?: { id: string; bankName: string; accountHolderName: string; maskedAccountNumber: string; verificationStatus: string }[];
  creditPeriodDays?: number;
  paymentTerms?: string;
  creditApprovalStatus?: string;
  notes?: string;
  mainCommodities?: string[];
};

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const labelClass = "mb-1 block text-xs font-medium text-slate-600";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";
const emptyForm = {
  traderCode: "",
  legalBusinessName: "",
  tradeName: "",
  businessType: "Proprietorship",
  roles: ["Buyer", "Seller"],
  mainCommodities: "",
  contactName: "",
  mobile: "",
  email: "",
  city: "",
  state: "",
  gstin: "",
  pan: "",
  creditLimit: "0",
  creditPeriodDays: "0",
  paymentTerms: "",
};

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

export function TraderDirectory() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<TraderRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<TraderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ legalBusinessName: "", tradeName: "", gstin: "", pan: "", commodities: "", city: "", state: "" });
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/trading/organizations")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load organizations.");
        if (!active) return;
        const options = data.organizations as OrganizationOption[];
        setOrganizations(options);
        setIsAdmin(Boolean(data.isAdmin));
        if (options.length === 1) setOrganizationId(options[0].id);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load organizations.");
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const loadTraders = useCallback(async () => {
    if (!organizationId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      organizationId,
      page: String(page),
      limit: "25",
      search,
    });
    if (status) query.set("status", status);
    try {
      const response = await fetch(`/api/traders?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load traders.");
      setRows(data.rows);
      setTotal(data.total);
      setPages(Math.max(1, data.pages));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load traders.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTraders(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTraders]);

  const openDetail = async (id: string) => {
    setDetail(null);
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/traders/${id}?organizationId=${encodeURIComponent(organizationId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load trader.");
      setDetail(data.trader);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load trader.");
    } finally {
      setDetailLoading(false);
    }
  };

  const saveTrader = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const contacts = form.contactName.trim()
      ? [{ name: form.contactName, mobile: form.mobile, email: form.email }]
      : [];
    const payload = {
      ...form,
      organizationId,
      roles: form.roles,
      mainCommodities: form.mainCommodities.split(",").map((value) => value.trim()).filter(Boolean),
      contacts,
      billingAddress: { city: form.city, state: form.state },
      creditLimit: Number(form.creditLimit),
      creditPeriodDays: Number(form.creditPeriodDays),
      openingReceivable: 0,
      openingPayable: 0,
      securityDeposit: 0,
      preferredPaymentMethods: [],
      riskCategory: "Low",
      branches: [],
      operatingMarkets: [],
    };
    try {
      const response = await fetch("/api/traders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create trader.");
      setNotice(`Trader ${data.traderCode} created.`);
      setForm(emptyForm);
      setFormOpen(false);
      await loadTraders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create trader.");
    } finally {
      setSaving(false);
    }
  };

  const traderAction = async (action: string, data: Record<string, unknown>) => {
    if (!detail) return;
    setError("");
    try {
      const response = await fetch(`/api/traders/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, action, data }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update trader.");
      setNotice(result.message || "Trader record updated.");
      await openDetail(detail.id);
      await loadTraders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update trader.");
    }
  };

  const changeRole = (role: string) => setForm((current) => ({
    ...current,
    roles: current.roles.includes(role) ? current.roles.filter((item) => item !== role) : [...current.roles, role],
  }));

  const parseImportFile = async (file?: File) => {
    if (!file) return;
    setImportErrors([]);
    setImportRows([]);
    setError("");
    try {
      const spreadsheet = await import("xlsx");
      const workbook = spreadsheet.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("The file does not contain a worksheet.");
      const rawRows = spreadsheet.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (rawRows.length === 0) throw new Error("The selected file has no data rows.");
      if (rawRows.length > 100) throw new Error("Import up to 100 traders per file.");
      const normalizedKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, "");
      const valueFor = (row: Record<string, unknown>, ...aliases: string[]) => {
        const target = aliases.map(normalizedKey);
        const entry = Object.entries(row).find(([key]) => target.includes(normalizedKey(key)));
        return entry ? String(entry[1] ?? "").trim() : "";
      };
      const csvList = (value: string) => value.split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
      const rows = rawRows.map((row, index) => {
        const contactName = valueFor(row, "contact name", "primary contact");
        const email = valueFor(row, "email", "contact email");
        const mobile = valueFor(row, "mobile", "phone", "contact mobile");
        const creditLimit = valueFor(row, "credit limit");
        const creditPeriodDays = valueFor(row, "credit period days", "credit days");
        return {
          _sourceRow: index + 2,
          traderCode: valueFor(row, "trader code", "code", "trader id"),
          legalBusinessName: valueFor(row, "legal business name", "business name", "name"),
          tradeName: valueFor(row, "trade name"),
          businessType: valueFor(row, "business type") || "Other",
          roles: csvList(valueFor(row, "roles", "role")).map((role) =>
            ["Buyer", "Seller", "Broker", "Commission Agent", "Consignment Owner"]
              .find((allowed) => allowed.toLowerCase() === role.trim().toLowerCase()) ?? role.trim(),
          ),
          mainCommodities: csvList(valueFor(row, "commodities", "main commodities", "commodity")),
          gstin: valueFor(row, "gstin", "gst number").toUpperCase(),
          pan: valueFor(row, "pan").toUpperCase(),
          contacts: contactName ? [{ name: contactName, email, mobile }] : [],
          billingAddress: {
            city: valueFor(row, "city"),
            state: valueFor(row, "state"),
            postalCode: valueFor(row, "postal code", "pincode"),
            line1: valueFor(row, "address"),
          },
          creditLimit: creditLimit ? Number(creditLimit) : 0,
          creditPeriodDays: creditPeriodDays ? Number(creditPeriodDays) : 0,
          openingReceivable: Number(valueFor(row, "opening receivable") || 0),
          openingPayable: Number(valueFor(row, "opening payable") || 0),
          securityDeposit: Number(valueFor(row, "security deposit") || 0),
          preferredPaymentMethods: [],
          riskCategory: "Low",
          branches: [],
          operatingMarkets: [],
          tags: [],
        };
      });
      const errors = rows.flatMap((row, index) => {
        const rowErrors: string[] = [];
        if (typeof row.traderCode !== "string" || row.traderCode.length < 2) rowErrors.push(`Row ${index + 2}: trader code is required.`);
        if (typeof row.legalBusinessName !== "string" || row.legalBusinessName.length < 2) rowErrors.push(`Row ${index + 2}: legal business name is required.`);
        if (!Array.isArray(row.roles) || row.roles.length === 0) rowErrors.push(`Row ${index + 2}: at least one role is required.`);
        if (!Number.isFinite(row.creditLimit) || Number(row.creditLimit) < 0) rowErrors.push(`Row ${index + 2}: credit limit must be a valid non-negative number.`);
        if (!Number.isFinite(row.openingReceivable) || Number(row.openingReceivable) < 0) rowErrors.push(`Row ${index + 2}: opening receivable must be a valid non-negative number.`);
        if (!Number.isFinite(row.openingPayable) || Number(row.openingPayable) < 0) rowErrors.push(`Row ${index + 2}: opening payable must be a valid non-negative number.`);
        return rowErrors;
      });
      const codeRows = new Map<string, number>();
      rows.forEach((row, index) => {
        const code = String(row.traderCode).toUpperCase();
        if (codeRows.has(code)) errors.push(`Row ${index + 2}: trader code duplicates row ${(codeRows.get(code) ?? 0) + 2}.`);
        else codeRows.set(code, index);
      });
      setImportRows(rows);
      setImportErrors(errors);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to parse the import file.");
    }
  };

  const importTraders = async () => {
    if (!organizationId || importRows.length === 0 || importErrors.length > 0) return;
    setImporting(true);
    setError("");
    const results: string[] = [];
    let imported = 0;
    for (const row of importRows) {
      const { _sourceRow, ...payload } = row;
      try {
        const response = await fetch("/api/traders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, organizationId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Import failed.");
        imported += 1;
      } catch (cause) {
        results.push(`Row ${String(_sourceRow)}: ${cause instanceof Error ? cause.message : "Import failed."}`);
      }
    }
    setImportErrors(results);
    setNotice(`${imported} of ${importRows.length} traders imported.`);
    setImporting(false);
    if (imported > 0) await loadTraders();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Trading / Masters</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Trader directory</h1>
          <p className="mt-1 text-sm text-slate-600">Organization-scoped buyer, seller, broker and consignment-owner records.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInput} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => { void parseImportFile(event.target.files?.[0]); event.target.value = ""; }} />
          <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={!organizationId} onClick={() => fileInput.current?.click()}>
            <FileUp className="h-4 w-4" /> Import CSV/XLSX
          </button>
          {organizationId && (
            <a
              href={`/api/traders/export?organizationId=${encodeURIComponent(organizationId)}`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </a>
          )}
          <button type="button" className={buttonClass} disabled={!organizationId} onClick={() => { setError(""); setNotice(""); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add trader
          </button>
        </div>
      </div>

      {isAdmin && (
        <label className="block max-w-md">
          <span className={labelClass}>Organization scope</span>
          <select className={inputClass} value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setPage(1); }}>
            <option value="">Select an organization</option>
            {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
        </label>
      )}

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {importRows.length > 0 && <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Import preview</h2><p className="text-sm text-slate-500">{importRows.length} rows · codes and GST/PAN values will be checked by the server on import.</p></div><button type="button" className={buttonClass} disabled={importing || importErrors.length > 0} onClick={() => void importTraders()}>{importing ? "Importing…" : `Import ${importRows.length} traders`}</button></div>
        {importErrors.length > 0 && <ul className="max-h-32 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-800">{importErrors.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul>}
        <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="px-2 py-2">Code</th><th className="px-2 py-2">Business name</th><th className="px-2 py-2">Roles</th><th className="px-2 py-2">Commodities</th></tr></thead><tbody>{importRows.slice(0, 5).map((row, index) => <tr key={`${String(row.traderCode)}-${index}`} className="border-b"><td className="px-2 py-2">{String(row.traderCode)}</td><td className="px-2 py-2">{String(row.legalBusinessName)}</td><td className="px-2 py-2">{Array.isArray(row.roles) ? row.roles.join(", ") : ""}</td><td className="px-2 py-2">{Array.isArray(row.mainCommodities) ? row.mainCommodities.join(", ") : ""}</td></tr>)}</tbody></table></div>
        <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => { setImportRows([]); setImportErrors([]); }}>Discard import</button>
      </section>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search code, trader or GSTIN" className="w-full text-sm outline-none" />
          </div>
          <select aria-label="Trading status" className={inputClass + " w-auto min-w-36"} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">All statuses</option><option>Active</option><option>Inactive</option><option>Blocked</option>
          </select>
          <span className="text-sm text-slate-500">{total} traders</span>
        </div>
        {!organizationId ? (
          <div className="p-10 text-center text-sm text-slate-500">{isAdmin ? "Select an organization to view its traders." : "No organization is linked to your account."}</div>
        ) : loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading traders…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No traders found. Add a trader to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>{["Trader", "Role", "Commodity", "Location", "KYC", "Credit / Due", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 font-semibold">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => void openDetail(row.id)} className="text-left font-semibold text-slate-900 hover:text-emerald-700">{row.legalBusinessName}</button>
                      <p className="text-xs text-slate-500">{row.traderCode}{row.tradeName ? ` · ${row.tradeName}` : ""}</p>
                    </td>
                    <td className="px-4 py-3">{row.roles.join(", ")}</td>
                    <td className="px-4 py-3">{row.mainCommodities.slice(0, 2).join(", ") || "—"}</td>
                    <td className="px-4 py-3">{[row.city, row.state].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-4 py-3">{row.kycStatus}</td>
                    <td className="whitespace-nowrap px-4 py-3">{money(row.receivable)} / {money(row.creditLimit)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${row.tradingStatus === "Active" ? "bg-emerald-100 text-emerald-800" : row.tradingStatus === "Blocked" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>{row.tradingStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {organizationId && pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
            <span className="text-slate-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button type="button" className="rounded-lg border px-3 py-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <button type="button" className="rounded-lg border px-3 py-1.5 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8">
          <form onSubmit={saveTrader} className="my-auto w-full max-w-3xl space-y-5 rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between">
              <div><h2 className="text-xl font-semibold">Add trader</h2><p className="mt-1 text-sm text-slate-500">Buyer and seller roles create linked customer/vendor records.</p></div>
              <button type="button" aria-label="Close" onClick={() => setFormOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className={labelClass}>Trader code *</span><input required maxLength={32} className={inputClass} value={form.traderCode} onChange={(e) => setForm({ ...form, traderCode: e.target.value })} /></label>
              <label><span className={labelClass}>Legal business name *</span><input required minLength={2} className={inputClass} value={form.legalBusinessName} onChange={(e) => setForm({ ...form, legalBusinessName: e.target.value })} /></label>
              <label><span className={labelClass}>Trade name</span><input className={inputClass} value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} /></label>
              <label><span className={labelClass}>Business type</span><select className={inputClass} value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })}>{["Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited", "FPO", "Cooperative", "Other"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <fieldset className="sm:col-span-2"><legend className={labelClass}>Trading roles *</legend><div className="flex flex-wrap gap-4">{["Buyer", "Seller", "Broker", "Commission Agent", "Consignment Owner"].map((role) => <label key={role} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.roles.includes(role)} onChange={() => changeRole(role)} />{role}</label>)}</div></fieldset>
              <label><span className={labelClass}>Commodities (comma separated)</span><input className={inputClass} value={form.mainCommodities} onChange={(e) => setForm({ ...form, mainCommodities: e.target.value })} /></label>
              <label><span className={labelClass}>GSTIN</span><input maxLength={15} className={inputClass} value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></label>
              <label><span className={labelClass}>PAN</span><input maxLength={10} className={inputClass} value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} /></label>
              <label><span className={labelClass}>Contact name</span><input className={inputClass} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
              <label><span className={labelClass}>Mobile</span><input className={inputClass} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></label>
              <label><span className={labelClass}>Contact email</span><input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label><span className={labelClass}>City</span><input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
              <label><span className={labelClass}>State</span><input className={inputClass} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
              <label><span className={labelClass}>Credit limit (₹)</span><input type="number" min="0" className={inputClass} value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} /></label>
              <label><span className={labelClass}>Credit period (days)</span><input type="number" min="0" max="3650" className={inputClass} value={form.creditPeriodDays} onChange={(e) => setForm({ ...form, creditPeriodDays: e.target.value })} /></label>
              <label className="sm:col-span-2"><span className={labelClass}>Payment terms</span><input className={inputClass} value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></label>
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setFormOpen(false)}>Cancel</button>
              <button type="submit" className={buttonClass} disabled={saving || form.roles.length === 0}>{saving ? "Saving…" : "Create trader"}</button>
            </div>
          </form>
        </div>
      )}

      {(detailLoading || detail) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8" onClick={() => { setDetail(null); setDetailLoading(false); }}>
          {detailLoading ? <div className="my-24 rounded-xl bg-white p-8">Loading trader…</div> : detail && (
            <section className="my-auto w-full max-w-3xl space-y-5 rounded-2xl bg-white p-5 shadow-2xl sm:p-7" onClick={(event) => event.stopPropagation()}>
              <div className="flex justify-between">
                <div><p className="text-xs uppercase tracking-wide text-slate-500">{detail.traderCode} · {detail.roles?.join(", ")}</p><h2 className="mt-1 text-2xl font-semibold">{detail.legalBusinessName}</h2><p className="text-sm text-slate-500">{detail.tradeName}</p></div>
                <button type="button" aria-label="Close" onClick={() => setDetail(null)}><X className="h-5 w-5" /></button>
              </div>
              <button type="button" className="text-sm font-semibold text-emerald-700 hover:underline" onClick={() => { setProfileForm({ legalBusinessName: detail.legalBusinessName, tradeName: String(detail.tradeName || ""), gstin: String(detail.gstin || ""), pan: String(detail.pan || ""), commodities: detail.mainCommodities?.join(", ") || "", city: detail.billingAddress?.city || "", state: detail.billingAddress?.state || "" }); setProfileEditing((value) => !value); }}> {profileEditing ? "Cancel profile edit" : "Edit trader profile"}</button>
              {profileEditing && <form className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void traderAction("update-profile", { legalBusinessName: profileForm.legalBusinessName, tradeName: profileForm.tradeName, gstin: profileForm.gstin, pan: profileForm.pan, mainCommodities: profileForm.commodities.split(",").map((value) => value.trim()).filter(Boolean), billingAddress: { ...detail.billingAddress, city: profileForm.city, state: profileForm.state } }); setProfileEditing(false); }}>
                {([["legalBusinessName", "Legal business name"], ["tradeName", "Trade name"], ["gstin", "GSTIN"], ["pan", "PAN"], ["commodities", "Commodities (comma separated)"], ["city", "City"], ["state", "State"]] as const).map(([key, label]) => <label key={key}><span className={labelClass}>{label}</span><input required={key === "legalBusinessName"} className={inputClass} value={profileForm[key]} onChange={(event) => setProfileForm({ ...profileForm, [key]: event.target.value })} /></label>)}
                <button type="submit" className={buttonClass}>Save profile</button>
              </form>}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Receivable</p><p className="mt-1 font-semibold">{money(detail.receivable)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Credit limit</p><p className="mt-1 font-semibold">{money(detail.creditLimit)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">KYC / Trading</p><p className="mt-1 font-semibold">{detail.kycStatus} / {detail.tradingStatus}</p></div>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <p><span className="text-slate-500">GSTIN:</span> {String(detail.gstin || "—")}</p><p><span className="text-slate-500">PAN:</span> {String(detail.pan || "—")}</p>
                <p><span className="text-slate-500">Commodities:</span> {detail.mainCommodities?.join(", ") || "—"}</p><p><span className="text-slate-500">Location:</span> {[detail.billingAddress?.city, detail.billingAddress?.state].filter(Boolean).join(", ") || "—"}</p>
                <p><span className="text-slate-500">Contact:</span> {detail.contacts?.[0]?.name || "—"} {detail.contacts?.[0]?.mobile || ""}</p><p><span className="text-slate-500">Credit approval:</span> {String(detail.creditApprovalStatus || "Pending")}</p>
              </div>
              {detail.bankAccounts?.length ? <div className="space-y-2"><h3 className="font-medium">Bank accounts</h3>{detail.bankAccounts.map((account) => <div key={account.id} className="flex items-center justify-between gap-2 text-sm"><span>{account.bankName} · {account.maskedAccountNumber} · {account.verificationStatus}</span><button type="button" className="text-xs text-red-700 hover:underline" onClick={() => { if (window.confirm("Remove this bank account?")) void traderAction("remove-bank-account", { accountId: account.id }); }}>Remove</button></div>)}</div> : null}
              <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Trading status</h3>
                  <div className="flex gap-2"><select id="trader-status" className={inputClass} defaultValue={detail.tradingStatus}>{["Active", "Inactive", "Blocked"].map((value) => <option key={value}>{value}</option>)}</select><button type="button" className={buttonClass} onClick={() => void traderAction("set-status", { status: (document.getElementById("trader-status") as HTMLSelectElement).value })}>Save</button></div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">KYC review</h3>
                  <div className="flex gap-2"><select id="trader-kyc" className={inputClass} defaultValue={String(detail.kycStatus)}>{["Pending", "Approved", "Rejected"].map((value) => <option key={value}>{value}</option>)}</select><button type="button" className={buttonClass} onClick={() => void traderAction("review-kyc", { status: (document.getElementById("trader-kyc") as HTMLSelectElement).value })}>Review</button></div>
                </div>
              </div>
              <form className="grid gap-3 border-t pt-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void traderAction("approve-credit", { status: data.get("creditApproval"), creditLimit: data.get("creditLimit"), reason: data.get("creditReason") }); }}>
                <h3 className="text-sm font-semibold sm:col-span-2">Credit approval</h3>
                <label><span className={labelClass}>Approval status</span><select name="creditApproval" defaultValue={String(detail.creditApprovalStatus || "Approved")} className={inputClass}>{["Approved", "Rejected", "On Hold"].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label><span className={labelClass}>Credit limit (₹)</span><input name="creditLimit" type="number" min="0" required defaultValue={detail.creditLimit} className={inputClass} /></label>
                <label className="sm:col-span-2"><span className={labelClass}>Reason / hold note</span><input name="creditReason" className={inputClass} defaultValue={String(detail.creditHoldReason || "")} /></label>
                <button className={buttonClass} type="submit">Save credit decision</button>
              </form>
              <form className="grid gap-3 border-t pt-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void traderAction("add-bank-account", { accountHolderName: data.get("holder"), bankName: data.get("bank"), accountNumber: data.get("account"), ifscCode: data.get("ifsc") }); event.currentTarget.reset(); }}>
                <h3 className="text-sm font-semibold sm:col-span-2">Add bank account <span className="font-normal text-slate-500">(encrypted before storage)</span></h3>
                <label><span className={labelClass}>Account holder</span><input required name="holder" className={inputClass} /></label>
                <label><span className={labelClass}>Bank</span><input required name="bank" className={inputClass} /></label>
                <label><span className={labelClass}>Account number</span><input required name="account" autoComplete="off" className={inputClass} /></label>
                <label><span className={labelClass}>IFSC</span><input name="ifsc" className={inputClass} /></label>
                <button type="submit" className={buttonClass}>Add bank details</button>
              </form>
              <div className="flex justify-end border-t pt-3"><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setDetail(null)}>Close</button></div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
