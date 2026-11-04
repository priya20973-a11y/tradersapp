"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Edit,
  Mail,
  Printer,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  formatCurrency,
  generateUpiQrString,
  numberToIndianWords,
} from "@/lib/invoice-utils";
import {
  type InvoiceRecord,
  type InvoiceSettingsData,
  type PaymentRecordData,
} from "./invoice-types";
import { generateInvoicePdf } from "./invoice-pdf-generator";
import { RecordPaymentModal } from "./record-payment-modal";
import { PaymentReceiptModal } from "./payment-receipt-modal";
import { SendEmailModal } from "./send-email-modal";
import { ApplyCreditNotesModal } from "./apply-credit-notes-modal";

interface InvoicePreviewProps {
  invoice: InvoiceRecord;
  settings?: InvoiceSettingsData | null;
  onRefresh?: () => void;
}

export function InvoicePreview({
  invoice: initialInvoice,
  settings,
  onRefresh,
}: InvoicePreviewProps) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceRecord>(initialInvoice);
  const [activeTab, setActiveTab] = useState<
    "document" | "payments" | "credits" | "emails"
  >("document");

  // Modals state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [availableCustomerCredits, setAvailableCustomerCredits] = useState<Record<string, unknown>[]>([]);
  const [totalCustomerCredit, setTotalCustomerCredit] = useState<number>(0);
  const [creditRefreshIndex, setCreditRefreshIndex] = useState(0);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecordData | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const company = settings?.companyDetails || {
    legalName: "Bharat Traders & Commodities Ltd.",
    tradeName: "LedgerFlow",
    gstin: "27ABCDE1234F1Z5",
    email: "billing@ledgerflow.io",
    phone: "+91 98765 43210",
    address: "Plot 42, APMC Market Yard, Navi Mumbai - 400705",
    city: "Navi Mumbai",
    state: "Maharashtra",
    postalCode: "400705",
  };

  const bank = invoice.bankDetailsSnapshot || settings?.bankDetails || {
    bankName: "HDFC Bank Ltd.",
    accountHolder: "Bharat Traders",
    accountNumber: "50200012345678",
    ifsc: "HDFC0001234",
    branch: "Vashi Sector 19",
    upiId: "bharattraders@hdfcbank",
  };

  const upiQrString = bank.upiId
    ? generateUpiQrString({
        upiId: bank.upiId,
        payeeName: bank.accountHolder || company.legalName,
        amount: invoice.balanceDue > 0 ? invoice.balanceDue : invoice.total,
        transactionRef: invoice.number,
      })
    : "";

  const [profileLogo, setProfileLogo] = useState<string>("");

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile?.logo) {
          setProfileLogo(data.profile.logo);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const invoiceId = invoice.id;
    if (!invoiceId) return;

    async function fetchCredits() {
      try {
        const res = await fetch(`/api/sales/invoices/${invoiceId}/credit-notes`);
        if (res.ok) {
          const data = await res.json();
          if (!active) return;
          setAvailableCustomerCredits(data.availableCredits || []);
          setTotalCustomerCredit(Number(data.totalAvailableCredit || 0));
        }
      } catch (err) {
        console.error("Failed to load customer credits for invoice:", err);
      }
    }

    void fetchCredits();

    return () => {
      active = false;
    };
  }, [invoice.id, invoice.balanceDue, creditRefreshIndex]);

  const companyLogoUrl = profileLogo || settings?.companyDetails?.logoUrl || "";
  const showCompanyLogo =
    settings?.pdfTemplate?.showCompanyLogo !== undefined
      ? Boolean(settings.pdfTemplate.showCompanyLogo)
      : settings?.showCompanyLogo !== undefined
      ? Boolean(settings.showCompanyLogo)
      : true;

  const handleDownloadPdf = async () => {
    const doc = await generateInvoicePdf(
      invoice,
      settings,
      showCompanyLogo ? companyLogoUrl : null,
    );
    doc.save(`${invoice.number}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStatusChange = async (status: string) => {
    try {
      const res = await fetch(`/api/sales/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setInvoice((prev) => ({ ...prev, status: status as InvoiceRecord["status"] }));
        setNotice(`Status updated to ${status}`);
        onRefresh?.();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete invoice ${invoice.number}?`)) return;
    try {
      const res = await fetch(`/api/sales/invoices/${invoice.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/sales/invoices");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePaymentSuccess = (payment: PaymentRecordData, updatedInvoice: InvoiceRecord) => {
    setInvoice((prev) => ({
      ...prev,
      amountPaid: updatedInvoice.amountPaid,
      balanceDue: updatedInvoice.balanceDue,
      status: updatedInvoice.status,
      payments: [payment, ...(prev.payments || [])],
    }));
    setSelectedReceipt(payment);
    setShowReceiptModal(true);
    setNotice(`Payment of ${formatCurrency(payment.amount, invoice.currency)} recorded.`);
    onRefresh?.();
  };

  const handleEmailSuccess = (emailLog: Record<string, unknown>) => {
    setInvoice((prev) => ({
      ...prev,
      status: prev.status === "Draft" ? "Sent" : prev.status,
      emailsSent: [emailLog, ...(prev.emailsSent || [])] as unknown as typeof prev.emailsSent,
    }));
    setNotice(`Invoice sent to ${String(emailLog.to || "")}`);
    onRefresh?.();
  };

  // Status badge colors
  const statusBadge = () => {
    switch (invoice.status) {
      case "Paid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            PAID
          </span>
        );
      case "Overdue":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 border border-rose-200">
            <Clock className="h-3.5 w-3.5" />
            OVERDUE
          </span>
        );
      case "Partly paid":
      case "Partially Paid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
            <CreditCard className="h-3.5 w-3.5" />
            PARTIALLY PAID
          </span>
        );
      case "Sent":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200">
            <Send className="h-3.5 w-3.5" />
            SENT
          </span>
        );
      case "Void":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 border border-slate-200 line-through">
            VOID
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200">
            DRAFT
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* 1. Top Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/sales/invoices"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-xs hover:bg-slate-50 hover:text-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {invoice.number}
              </h1>
              {statusBadge()}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer:{" "}
              <span className="font-semibold text-slate-700">
                {invoice.customerName}
              </span>{" "}
              • Created:{" "}
              {invoice.issueDate
                ? new Date(invoice.issueDate).toLocaleDateString("en-IN")
                : "-"}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {invoice.balanceDue > 0 && invoice.status !== "Void" && (
            <button
              type="button"
              onClick={() => setShowCreditModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 transition cursor-pointer active:scale-98"
            >
              <CreditCard className="h-4 w-4" />
              Apply Credit Note
            </button>
          )}

          {invoice.balanceDue > 0 && invoice.status !== "Void" && (
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer active:scale-98"
            >
              <DollarSign className="h-4 w-4" />
              Record Payment
            </button>
          )}

          {invoice.status !== "Paid" && invoice.status !== "Void" && (
            <Link
              href={`/sales/invoices/${invoice.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
            >
              <Edit className="h-3.5 w-3.5 text-slate-500" />
              Edit
            </Link>
          )}

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            PDF
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            Print
          </button>

          <button
            type="button"
            onClick={() => setShowEmailModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <Mail className="h-3.5 w-3.5 text-blue-600" />
            Send Email
          </button>

          {invoice.status === "Draft" && (
            <button
              type="button"
              onClick={() => handleStatusChange("Sent")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-blue-600 shadow-xs hover:bg-blue-50 transition cursor-pointer"
            >
              Mark Sent
            </button>
          )}

          {invoice.status !== "Void" && invoice.status !== "Paid" && (
            <button
              type="button"
              onClick={() => handleStatusChange("Void")}
              title="Void this invoice"
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}

          {invoice.status === "Draft" && (
            <button
              type="button"
              onClick={handleDelete}
              title="Delete draft invoice"
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Customer Credits Available Banner */}
      {totalCustomerCredit > 0 && invoice.balanceDue > 0 && invoice.status !== "Void" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-purple-200 bg-purple-50/80 p-4 text-xs text-purple-900 shadow-xs print:hidden animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">
                Customer Credits Available: {formatCurrency(totalCustomerCredit, invoice.currency)}
              </p>
              <p className="text-slate-600 text-[11px] mt-0.5">
                This customer has {availableCustomerCredits.length} open credit note(s) with available balance. You can apply them against this invoice.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCreditModal(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 font-semibold text-white hover:bg-purple-700 transition shadow-xs shrink-0 cursor-pointer text-xs"
          >
            Apply Credit Note
          </button>
        </div>
      )}

      {notice && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800 flex items-center justify-between shadow-xs print:hidden">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Sub Navigation Tabs (Document View vs Payment History vs Email Log) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("document")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === "document"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Invoice Document
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === "payments"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>Payment History</span>
          <span className="rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] text-slate-800 font-semibold">
            {invoice.payments?.length || 0}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("credits")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === "credits"
              ? "bg-purple-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>Credits Applied</span>
          <span className="rounded-full bg-purple-100 px-1.5 py-0.2 text-[10px] text-purple-800 font-semibold">
            {invoice.creditsApplied?.length || 0}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("emails")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === "emails"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>Emails Sent</span>
          <span className="rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] text-slate-800 font-semibold">
            {invoice.emailsSent?.length || 0}
          </span>
        </button>
      </div>

      {/* 3. Document View: The A4 Paper Canvas */}
      {activeTab === "document" && (
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200/90 bg-white p-8 sm:p-12 shadow-sm print:border-none print:shadow-none print:p-0">
          {/* Top Banner Stripe */}
          <div className="h-1.5 w-full rounded-full bg-blue-600 mb-8 print:hidden" />

          {/* Company & Invoice Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-start gap-4">
              {showCompanyLogo && companyLogoUrl && (
                <div className="shrink-0">
                  <Image
                    src={companyLogoUrl}
                    alt={company.legalName}
                    width={140}
                    height={64}
                    unoptimized
                    className="h-16 w-auto max-w-[140px] object-contain rounded-lg border border-slate-100 p-1 bg-white print:border-none"
                  />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  {company.legalName}
                </h2>
                {company.tradeName && company.tradeName !== company.legalName && (
                  <p className="text-xs text-slate-500 font-medium">{company.tradeName}</p>
                )}
                <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                  {company.address}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {company.phone && <span>Ph: {company.phone}</span>}
                  {company.email && <span>Email: {company.email}</span>}
                  {company.gstin && (
                    <span className="font-semibold text-slate-700">
                      GSTIN: {company.gstin}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs uppercase tracking-wider rounded-lg mb-2">
                Tax Invoice
              </span>
              <p className="text-xl font-extrabold text-slate-900">
                #{invoice.number}
              </p>
              <div className="mt-2 space-y-1 text-xs text-slate-500">
                <p>
                  Date:{" "}
                  <span className="font-semibold text-slate-800">
                    {invoice.issueDate
                      ? new Date(invoice.issueDate).toLocaleDateString("en-IN")
                      : "-"}
                  </span>
                </p>
                <p>
                  Due Date:{" "}
                  <span className="font-semibold text-slate-800">
                    {invoice.dueDate
                      ? new Date(invoice.dueDate).toLocaleDateString("en-IN")
                      : "-"}
                  </span>
                </p>
                <p>
                  Terms:{" "}
                  <span className="font-semibold text-slate-800">
                    {invoice.paymentTerms}
                  </span>
                </p>
                {invoice.referenceNumber && (
                  <p>
                    Ref / PO #:{" "}
                    <span className="font-mono text-slate-800">
                      {invoice.referenceNumber}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Customer & Place of Supply Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-100 text-xs">
            <div>
              <p className="font-bold uppercase tracking-wider text-blue-600 mb-1.5 text-[11px]">
                Billed To
              </p>
              <p className="text-sm font-bold text-slate-900">
                {invoice.customerSnapshot?.name || invoice.customerName}
              </p>
              {invoice.customerSnapshot?.companyName && (
                <p className="font-medium text-slate-700 mt-0.5">
                  {invoice.customerSnapshot.companyName}
                </p>
              )}
              {invoice.customerSnapshot?.billingAddress?.street && (
                <p className="text-slate-500 mt-1 leading-relaxed">
                  {invoice.customerSnapshot.billingAddress.street}
                  {invoice.customerSnapshot.billingAddress.city &&
                    `, ${invoice.customerSnapshot.billingAddress.city}`}
                  {invoice.customerSnapshot.billingAddress.state &&
                    `, ${invoice.customerSnapshot.billingAddress.state}`}
                  {invoice.customerSnapshot.billingAddress.postalCode &&
                    ` - ${invoice.customerSnapshot.billingAddress.postalCode}`}
                </p>
              )}
              {invoice.customerSnapshot?.gstin && (
                <p className="mt-1 font-semibold text-slate-700">
                  GSTIN: {invoice.customerSnapshot.gstin}
                </p>
              )}
            </div>

            <div className="sm:text-right">
              <p className="font-bold uppercase tracking-wider text-slate-400 mb-1.5 text-[11px]">
                Shipping & Supply
              </p>
              {invoice.placeOfSupply && (
                <p className="text-slate-700">
                  Place of Supply:{" "}
                  <span className="font-semibold text-slate-900">
                    {invoice.placeOfSupply}
                  </span>
                </p>
              )}
              {invoice.salesperson && (
                <p className="text-slate-700 mt-1">
                  Salesperson:{" "}
                  <span className="font-medium text-slate-900">
                    {invoice.salesperson}
                  </span>
                </p>
              )}
              {invoice.subject && (
                <p className="text-slate-700 mt-1">
                  Project / Subject:{" "}
                  <span className="italic text-slate-900">{invoice.subject}</span>
                </p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="py-6 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Item & Description</th>
                  <th className="py-2.5 px-3 text-center">HSN</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                  <th className="py-2.5 px-3 text-right">Discount</th>
                  <th className="py-2.5 px-3 text-right">Tax</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(invoice.items || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{item.name}</p>
                      {item.description && (
                        <p className="text-slate-500 mt-0.5 max-w-sm leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600 font-mono">
                      {item.hsnCode || "-"}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-800">
                      {item.quantity} {item.unit || "pcs"}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-800 font-mono">
                      {formatCurrency(item.rate, invoice.currency)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500 font-mono">
                      {item.discount
                        ? item.discountType === "amount"
                          ? `₹${item.discount}`
                          : `${item.discount}%`
                        : "-"}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 font-mono">
                      {item.taxRate || 0}%
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono">
                      {formatCurrency(item.amount, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculations & Totals Grid */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8 pt-4 border-t border-slate-200">
            {/* Left: Notes & Bank details & QR */}
            <div className="w-full sm:max-w-md space-y-4">
              {/* UPI QR Code & Bank Box */}
              {bank.accountNumber && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                      Bank & Payment Info
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Scan to Pay via UPI
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* UPI QR Code */}
                    {upiQrString && (
                      <div className="flex flex-col items-center shrink-0">
                        <Image
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&margin=4&data=${encodeURIComponent(
                            upiQrString,
                          )}`}
                          alt="UPI QR Code"
                          width={96}
                          height={96}
                          unoptimized
                          className="h-24 w-24 rounded-xl border border-slate-200 shadow-xs bg-white p-1"
                        />
                        <span className="text-[10px] font-mono font-medium text-slate-500 mt-1">
                          {bank.upiId}
                        </span>
                      </div>
                    )}

                    {/* Bank Account Info */}
                    <div className="space-y-1 text-xs text-slate-600 min-w-0">
                      <p>
                        Bank:{" "}
                        <span className="font-semibold text-slate-900">
                          {bank.bankName}
                        </span>
                      </p>
                      <p>
                        A/C Name:{" "}
                        <span className="font-semibold text-slate-900">
                          {bank.accountHolder}
                        </span>
                      </p>
                      <p>
                        A/C No:{" "}
                        <span className="font-mono font-semibold text-slate-900">
                          {bank.accountNumber}
                        </span>
                      </p>
                      <p>
                        IFSC:{" "}
                        <span className="font-mono font-semibold text-slate-900">
                          {bank.ifsc}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Notes */}
              {invoice.customerNotes && (
                <div className="text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">Customer Notes:</p>
                  <p className="mt-0.5 leading-relaxed">{invoice.customerNotes}</p>
                </div>
              )}

              {/* Terms and Conditions */}
              {invoice.termsAndConditions && (
                <div className="text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">Terms & Conditions:</p>
                  <p className="mt-0.5 whitespace-pre-line leading-relaxed">
                    {invoice.termsAndConditions}
                  </p>
                </div>
              )}
            </div>

            {/* Right: Calculations Breakdown Card */}
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatCurrency(invoice.subTotal, invoice.currency)}
                </span>
              </div>

              {invoice.discount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Discount:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    -{formatCurrency(invoice.discount, invoice.currency)}
                  </span>
                </div>
              )}

              {invoice.cgst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>CGST:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(invoice.cgst, invoice.currency)}
                  </span>
                </div>
              )}

              {invoice.sgst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>SGST:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(invoice.sgst, invoice.currency)}
                  </span>
                </div>
              )}

              {invoice.igst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>IGST:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(invoice.igst, invoice.currency)}
                  </span>
                </div>
              )}

              {invoice.shippingCharges > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Shipping Charges:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(invoice.shippingCharges, invoice.currency)}
                  </span>
                </div>
              )}

              {invoice.adjustment !== 0 && invoice.adjustment !== undefined && (
                <div className="flex justify-between text-slate-600">
                  <span>Adjustment:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {invoice.adjustment > 0 ? "+" : ""}
                    {formatCurrency(invoice.adjustment, invoice.currency)}
                  </span>
                </div>
              )}

              {invoice.roundOff !== 0 && invoice.roundOff !== undefined && (
                <div className="flex justify-between text-slate-600">
                  <span>Round Off:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {invoice.roundOff > 0 ? "+" : ""}
                    {formatCurrency(invoice.roundOff, invoice.currency)}
                  </span>
                </div>
              )}

              <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono">
                  {formatCurrency(invoice.total, invoice.currency)}
                </span>
              </div>

              {invoice.amountPaid > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Amount Paid:</span>
                  <span className="font-mono">
                    -{formatCurrency(invoice.amountPaid, invoice.currency)}
                  </span>
                </div>
              )}

              {(invoice.creditedAmount || 0) > 0 && (
                <div className="flex justify-between text-purple-600 font-medium">
                  <span>Credits Applied:</span>
                  <span className="font-mono">
                    -{formatCurrency(invoice.creditedAmount, invoice.currency)}
                  </span>
                </div>
              )}

              <div className="rounded-xl bg-rose-50 p-3 border border-rose-100 flex justify-between items-center text-sm font-bold text-rose-700">
                <span>Balance Due:</span>
                <span className="font-mono text-base">
                  {formatCurrency(invoice.balanceDue, invoice.currency)}
                </span>
              </div>

              {/* Amount in words */}
              <div className="pt-2 text-[11px] text-slate-500 italic">
                <span className="font-semibold text-slate-700 not-italic">
                  Amount in words:
                </span>{" "}
                {numberToIndianWords(invoice.total)}
              </div>
            </div>
          </div>

          {/* Signatory Footer */}
          <div className="mt-12 flex items-end justify-between border-t border-slate-100 pt-8 text-xs text-slate-400">
            <div>
              <p>Thank you for doing business with us!</p>
              <p className="text-[10px] mt-0.5">Computer generated invoice</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-800">{company.legalName}</p>
              <div className="h-12 w-32 border-b border-slate-300 ml-auto my-2" />
              <p className="text-[11px] font-medium text-slate-600">
                Authorized Signatory
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Payment History Tab */}
      {activeTab === "payments" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Payment History
              </h3>
              <p className="text-xs text-slate-500">
                All payments recorded against invoice {invoice.number}
              </p>
            </div>
            {invoice.balanceDue > 0 && (
              <button
                type="button"
                onClick={() => setShowPaymentModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
              >
                <DollarSign className="h-4 w-4" />
                Record Payment
              </button>
            )}
          </div>

          {(!invoice.payments || invoice.payments.length === 0) ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No payments recorded yet for this invoice.
            </div>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                    <th className="py-2.5 px-3">Receipt #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Reference / UTR</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {p.receiptNumber || p.number}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {p.paymentDate
                          ? new Date(p.paymentDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-slate-700 font-medium text-[11px]">
                          {p.method}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {p.referenceNumber || "-"}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600 font-mono">
                        {formatCurrency(p.amount, invoice.currency)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReceipt(p);
                            setShowReceiptModal(true);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Credits Applied Tab */}
      {activeTab === "credits" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Credits Applied History
              </h3>
              <p className="text-xs text-slate-500">
                Credit notes applied toward settlement of {invoice.number}
              </p>
            </div>
            {invoice.balanceDue > 0 && invoice.status !== "Void" && (
              <button
                type="button"
                onClick={() => setShowCreditModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 transition cursor-pointer"
              >
                <CreditCard className="h-4 w-4" />
                Apply Credit Note
              </button>
            )}
          </div>

          {(!invoice.creditsApplied || invoice.creditsApplied.length === 0) ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No credit notes have been applied to this invoice yet.
            </div>
          ) : (
            <div className="overflow-x-auto mt-4 rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Credit Note#</th>
                    <th className="py-2.5 px-3">Applied Date</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3 text-right">Amount Applied</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.creditsApplied.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 font-mono font-bold text-blue-600">
                        <Link href={`/sales/credit-notes/${c.creditNoteId}`} className="hover:underline">
                          {c.creditNoteNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {c.appliedDate
                          ? new Date(c.appliedDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {c.notes || "—"}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-purple-700 font-mono">
                        {formatCurrency(c.amount, invoice.currency)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Link
                          href={`/sales/credit-notes/${c.creditNoteId}`}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          View Note
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Emails Sent Tab */}
      {activeTab === "emails" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Email Dispatch History
              </h3>
              <p className="text-xs text-slate-500">
                Chronological log of emails sent for {invoice.number}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowEmailModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
            >
              <Mail className="h-4 w-4" />
              Compose New Email
            </button>
          </div>

          {(!invoice.emailsSent || invoice.emailsSent.length === 0) ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No emails dispatched yet for this invoice.
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {invoice.emailsSent.map((email, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      To: {email.to}
                    </span>
                    <span className="text-slate-400">
                      {email.sentAt
                        ? new Date(email.sentAt).toLocaleString("en-IN")
                        : ""}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-700">
                    Subject: {email.subject}
                  </p>
                  {email.message && (
                    <p className="text-slate-600 whitespace-pre-line bg-white p-3 rounded-lg border border-slate-200/80">
                      {email.message}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-600 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Dispatched successfully with attached {invoice.number}.pdf</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Integrated Modals */}
      {showPaymentModal && (
        <RecordPaymentModal
          isOpen={showPaymentModal}
          invoice={invoice}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {showEmailModal && (
        <SendEmailModal
          isOpen={showEmailModal}
          invoice={invoice}
          companyName={company.legalName}
          onClose={() => setShowEmailModal(false)}
          onSuccess={handleEmailSuccess}
        />
      )}

      {showReceiptModal && selectedReceipt && (
        <PaymentReceiptModal
          isOpen={showReceiptModal}
          payment={selectedReceipt}
          invoice={invoice}
          companyName={company.legalName}
          onClose={() => setShowReceiptModal(false)}
        />
      )}

      {showCreditModal && (
        <ApplyCreditNotesModal
          isOpen={showCreditModal}
          onClose={() => setShowCreditModal(false)}
          invoiceId={invoice.id}
          invoiceNumber={invoice.number}
          customerName={invoice.customerName}
          balanceDue={invoice.balanceDue}
          onSuccess={() => {
            setShowCreditModal(false);
            setNotice("Credit note applied successfully to invoice.");
            fetch(`/api/sales/invoices/${invoice.id}`)
              .then((r) => r.json())
              .then((d) => {
                if (d.invoice) {
                  setInvoice((prev) => ({
                    ...prev,
                    creditedAmount: d.invoice.creditedAmount,
                    balanceDue: d.invoice.balanceDue,
                    status: d.invoice.status,
                    creditsApplied: d.invoice.creditsApplied,
                  }));
                }
              })
              .catch(() => {});
            setCreditRefreshIndex((idx) => idx + 1);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}
