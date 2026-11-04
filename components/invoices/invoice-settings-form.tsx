"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  Palette,
  Save,
} from "lucide-react";
import {
  INDIAN_STATES,
  PAYMENT_TERMS_OPTIONS,
  type InvoiceSettingsData,
} from "./invoice-types";

export function InvoiceSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Settings State
  const [invoicePrefix, setInvoicePrefix] = useState("INV-");
  const [nextNumber, setNextNumber] = useState(1);
  const [autoGenerateNumbering, setAutoGenerateNumbering] = useState(true);
  const [numberZeroPadding, setNumberZeroPadding] = useState(6);
  const [restartNumberingEachFiscalYear, setRestartNumberingEachFiscalYear] = useState(false);
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState("Due on Receipt");
  const [defaultNotes, setDefaultNotes] = useState(
    "Thank you for your business. Please reach out with any questions.",
  );
  const [defaultTerms, setDefaultTerms] = useState(
    "1. Payment is due as per terms specified above.\n2. Please quote invoice number in all payment remittances.\n3. Goods once sold will not be returned without prior authorization.",
  );
  const [currency, setCurrency] = useState("INR");
  const [defaultTaxRate, setDefaultTaxRate] = useState(18);

  // Company Details
  const [legalName, setLegalName] = useState("Bharat Traders & Commodities Ltd.");
  const [tradeName, setTradeName] = useState("LedgerFlow");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [email, setEmail] = useState("billing@ledgerflow.io");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [website, setWebsite] = useState("https://ledgerflow.io");
  const [address, setAddress] = useState("Plot 42, APMC Market Yard");
  const [city, setCity] = useState("Navi Mumbai");
  const [state, setState] = useState("Maharashtra");
  const [postalCode, setPostalCode] = useState("400705");

  // Bank & UPI
  const [bankName, setBankName] = useState("HDFC Bank Ltd.");
  const [accountHolder, setAccountHolder] = useState("Bharat Traders");
  const [accountNumber, setAccountNumber] = useState("50200012345678");
  const [ifsc, setIfsc] = useState("HDFC0001234");
  const [branch, setBranch] = useState("Vashi Sector 19");
  const [upiId, setUpiId] = useState("bharattraders@hdfcbank");

  // PDF Template
  const [layout, setLayout] = useState<"modern" | "classic" | "minimal">("modern");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [showCompanyLogo, setShowCompanyLogo] = useState(true);
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [showQrCode, setShowQrCode] = useState(true);
  const [showSignature, setShowSignature] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/sales/invoices/settings")
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      fetch("/api/profile")
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([data, profileData]: [{ settings?: InvoiceSettingsData } | null, { profile?: { logo?: string } } | null]) => {
        const profileLogo = profileData?.profile?.logo || "";
        if (profileLogo) {
          setCompanyLogoUrl(profileLogo);
        }

        if (data?.settings) {
          const s: InvoiceSettingsData = data.settings;
          setInvoicePrefix(s.invoicePrefix || "INV-");
          setNextNumber(s.nextNumber || 1);
          setAutoGenerateNumbering(s.autoGenerateNumbering !== false);
          setNumberZeroPadding(s.numberZeroPadding || 6);
          setRestartNumberingEachFiscalYear(Boolean(s.restartNumberingEachFiscalYear));
          setDefaultPaymentTerms(s.defaultPaymentTerms || "Due on Receipt");
          setDefaultNotes(s.defaultNotes || "");
          setDefaultTerms(s.defaultTerms || "");
          setCurrency(s.currency || "INR");
          setDefaultTaxRate(s.defaultTaxRate || 18);

          if (s.companyDetails) {
            setLegalName(s.companyDetails.legalName || "");
            setTradeName(s.companyDetails.tradeName || "");
            setGstin(s.companyDetails.gstin || "");
            setPan(s.companyDetails.pan || "");
            setEmail(s.companyDetails.email || "");
            setPhone(s.companyDetails.phone || "");
            setWebsite(s.companyDetails.website || "");
            setAddress(s.companyDetails.address || "");
            setCity(s.companyDetails.city || "");
            setState(s.companyDetails.state || "Maharashtra");
            setPostalCode(s.companyDetails.postalCode || "");
            const logo = profileLogo || s.companyDetails.logoUrl;
            if (logo) setCompanyLogoUrl(logo);
          }

          if (s.bankDetails) {
            setBankName(s.bankDetails.bankName || "");
            setAccountHolder(s.bankDetails.accountHolder || "");
            setAccountNumber(s.bankDetails.accountNumber || "");
            setIfsc(s.bankDetails.ifsc || "");
            setBranch(s.bankDetails.branch || "");
            setUpiId(s.bankDetails.upiId || "");
          }

          const logoEnabled =
            s.pdfTemplate?.showCompanyLogo !== undefined
              ? s.pdfTemplate.showCompanyLogo
              : s.showCompanyLogo !== undefined
              ? s.showCompanyLogo
              : true;
          setShowCompanyLogo(Boolean(logoEnabled));

          if (s.pdfTemplate) {
            setLayout(s.pdfTemplate.layout || "modern");
            setAccentColor(s.pdfTemplate.accentColor || "#2563eb");
            setShowQrCode(s.pdfTemplate.showQrCode ?? true);
            setShowSignature(s.pdfTemplate.showSignature ?? true);
          }
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);

    try {
      const payload = {
        invoicePrefix: invoicePrefix.trim() || "INV-",
        nextNumber: Number(nextNumber) || 1,
        autoGenerateNumbering,
        numberZeroPadding: Number(numberZeroPadding) || 6,
        restartNumberingEachFiscalYear,
        defaultPaymentTerms,
        defaultNotes,
        defaultTerms,
        currency,
        defaultTaxRate: Number(defaultTaxRate) || 0,
        showCompanyLogo,
        companyDetails: {
          legalName: legalName.trim(),
          tradeName: tradeName.trim(),
          gstin: gstin.trim().toUpperCase(),
          pan: pan.trim().toUpperCase(),
          email: email.trim(),
          phone: phone.trim(),
          website: website.trim(),
          address: address.trim(),
          city: city.trim(),
          state,
          postalCode: postalCode.trim(),
          country: "India",
          logoUrl: companyLogoUrl,
        },
        bankDetails: {
          bankName: bankName.trim(),
          accountHolder: accountHolder.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          branch: branch.trim(),
          upiId: upiId.trim(),
        },
        pdfTemplate: {
          layout,
          accentColor,
          showCompanyLogo,
          showQrCode,
          showSignature,
        },
      };

      const res = await fetch("/api/sales/invoices/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings.");
      }

      setNotice("Invoice configuration saved successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
        Loading invoice settings...
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="mx-auto max-w-4xl space-y-6 pb-12 text-slate-800">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/sales/invoices"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-xs hover:bg-slate-50 hover:text-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Invoice Settings
            </h1>
            <p className="text-xs text-slate-500">
              Configure numbering sequences, company branding, bank details, and PDF layout
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Configuration
            </>
          )}
        </button>
      </div>

      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center justify-between shadow-xs">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-700 hover:text-rose-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Invoice Numbering & Sequence */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <FileText className="h-4 w-4 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">
            Invoice Numbering & Sequence
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Invoice Prefix
            </label>
            <input
              type="text"
              required
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Next Sequence Number
            </label>
            <input
              type="number"
              min="1"
              required
              value={nextNumber}
              onChange={(e) => setNextNumber(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Zero Padding (Digits)
            </label>
            <input
              type="number"
              min="1"
              max="12"
              required
              value={numberZeroPadding}
              onChange={(e) => setNumberZeroPadding(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Next Invoice Preview
            </label>
            <div className="flex h-[38px] items-center rounded-xl bg-slate-50 border border-slate-200 px-3 font-mono font-bold text-sm text-blue-600">
              {invoicePrefix}
              {String(nextNumber).padStart(numberZeroPadding, "0")}
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-6 border-t border-slate-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoGenerateNumbering}
              onChange={(e) => setAutoGenerateNumbering(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-700">
              Auto-generate sequential invoice numbers for each new invoice
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={restartNumberingEachFiscalYear}
              onChange={(e) => setRestartNumberingEachFiscalYear(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-700">
              Restart numbering for invoices at the start of each fiscal year (Apr 1)
            </span>
          </label>
        </div>
      </div>

      {/* 2. Company Profile Details (Snapshot on Invoices) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building2 className="h-4 w-4 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">
            Company Profile & Tax Details
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Legal Business Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Trade / Brand Name
            </label>
            <input
              type="text"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Company GSTIN
            </label>
            <input
              type="text"
              placeholder="27ABCDE1234F1Z5"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Company PAN
            </label>
            <input
              type="text"
              placeholder="ABCDE1234F"
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Billing Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Contact Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Registered Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                State
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pincode
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bank Account & UPI ID for QR Code */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <CreditCard className="h-4 w-4 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">
            Bank Account & UPI Payment Remittance
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Bank Name
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Account Holder Name
            </label>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Account Number
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              IFSC Code
            </label>
            <input
              type="text"
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm uppercase text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Branch Name
            </label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              UPI VPA (for QR Code generation)
            </label>
            <input
              type="text"
              placeholder="merchant@bank"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
        </div>
      </div>

      {/* 4. Defaults & Terms */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          Default Notes & Commercial Terms
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Default Payment Terms
            </label>
            <select
              value={defaultPaymentTerms}
              onChange={(e) => setDefaultPaymentTerms(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            >
              {PAYMENT_TERMS_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Currency
            </label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Default Customer Notes
            </label>
            <textarea
              rows={2}
              value={defaultNotes}
              onChange={(e) => setDefaultNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Default Terms and Conditions
            </label>
            <textarea
              rows={3}
              value={defaultTerms}
              onChange={(e) => setDefaultTerms(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* 5. PDF Template Styling */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Palette className="h-4 w-4 text-purple-600" />
          <h2 className="text-base font-bold text-slate-900">
            PDF Template Customization
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Accent Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 p-0.5"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-32 rounded-xl border border-slate-200 px-3 py-1.5 font-mono text-xs uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Template Layout Style
            </label>
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as "modern" | "classic" | "minimal")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="modern">Modern Clean (Recommended)</option>
              <option value="classic">Classic Corporate</option>
              <option value="minimal">Minimal Compact</option>
            </select>
          </div>

          {/* Show Company Logo Checkbox */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 sm:col-span-2">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="showCompanyLogoToggle"
                checked={showCompanyLogo}
                onChange={(e) => setShowCompanyLogo(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex-1">
                <label
                  htmlFor="showCompanyLogoToggle"
                  className="text-xs font-semibold text-slate-800 cursor-pointer select-none"
                >
                  Show Company Logo
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Display the company logo uploaded in your Profile on the invoice PDF and print layout.
                </p>

                {companyLogoUrl ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="text-[11px] text-slate-500 font-medium">Saved Profile Logo:</span>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xs">
                      <Image
                        src={companyLogoUrl}
                        alt="Company Logo Preview"
                        width={120}
                        height={32}
                        unoptimized
                        className="h-8 max-w-[120px] object-contain"
                      />
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Connected
                      </span>
                    </div>
                    <Link
                      href="/profile"
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Update logo in Profile Settings →
                    </Link>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200/70">
                    <span>No logo uploaded in your Profile yet.</span>
                    <Link
                      href="/profile"
                      className="font-semibold underline hover:text-amber-900"
                    >
                      Upload logo in Profile
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="qrToggle"
              checked={showQrCode}
              onChange={(e) => setShowQrCode(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="qrToggle" className="text-xs font-medium text-slate-700 cursor-pointer">
              Print UPI QR Code for instant mobile scanning
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="sigToggle"
              checked={showSignature}
              onChange={(e) => setShowSignature(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="sigToggle" className="text-xs font-medium text-slate-700 cursor-pointer">
              Include Authorized Signatory box on invoice
            </label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer active:scale-98"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving Settings...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save All Settings
            </>
          )}
        </button>
      </div>
    </form>
  );
}
