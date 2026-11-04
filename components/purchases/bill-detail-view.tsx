"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Download,
  Edit,
  Eye,
  FileCheck,
  Loader2,
  Paperclip,
  Printer,
  Trash2,
  User,
  X,
} from "lucide-react";
import { generateBillPdf } from "./bill-pdf-generator";

export interface BillItem {
  itemId?: string;
  name: string;
  description?: string;
  account: string;
  quantity: number;
  rate: number;
  taxRate?: number;
  taxAmount?: number;
  customerId?: string;
  customerName?: string;
  amount: number;
}

interface BillAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  uploadedAt?: string;
}

interface PaymentRecord {
  id: string;
  paymentNumber: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  referenceNumber?: string;
  status: string;
}

export interface AppliedCreditRecord {
  creditId: string;
  creditNoteNumber: string;
  amount: number;
  appliedDate: string;
  notes?: string;
}

export interface AvailableVendorCredit {
  id: string;
  creditNoteNumber: string;
  vendorId: string;
  vendorName: string;
  vendorCreditDate: string;
  subject?: string;
  total: number;
  balanceRemaining: number;
  appliedAmount: number;
  status: string;
}

export interface BillDetail {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  orderNumber?: string;
  billDate: string;
  dueDate: string;
  paymentTerms: string;
  accountsPayable: string;
  subject?: string;
  subTotal: number;
  discount: number;
  discountType: string;
  discountAmount: number;
  taxType: string;
  taxRate: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  adjustment: number;
  total: number;
  amountPaid: number;
  vendorCreditApplied?: number;
  balanceDue: number;
  status: string;
  items: BillItem[];
  notes?: string;
  termsAndConditions?: string;
  attachments?: BillAttachment[];
  payments?: PaymentRecord[];
  creditsApplied?: AppliedCreditRecord[];
  createdAt?: string;
  updatedAt?: string;
}

function formatINR(val: number): string {
  return `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BillDetailView({ id }: { id: string }) {
  const router = useRouter();

  const [bill, setBill] = useState<BillDetail | null>(null);
  const [profileLogo, setProfileLogo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Quick Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("Bank Transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paidThrough, setPaidThrough] = useState("HDFC Operational Bank");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Apply Vendor Credit Modal
  const [availableCredits, setAvailableCredits] = useState<AvailableVendorCredit[]>([]);
  const [showApplyCreditModal, setShowApplyCreditModal] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("action") === "apply-credit";
    }
    return false;
  });
  const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({});
  const [applyingCredits, setApplyingCredits] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadAvailableCredits = useCallback(async (billId: string) => {
    try {
      const res = await fetch(`/api/purchases/bills/${billId}/vendor-credits`);
      if (res.ok) {
        const data = await res.json();
        setAvailableCredits(data.availableCredits || []);
      }
    } catch (err) {
      console.error("Failed to load vendor credits for bill:", err);
    }
  }, []);

  const loadBill = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchases/bills/${id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load bill details.");
      }
      setBill(data.bill);
      void loadAvailableCredits(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading bill.");
    } finally {
      setLoading(false);
    }
  }, [id, loadAvailableCredits]);

  useEffect(() => {
    if (!id) return;
    let ignore = false;
    const fetchInitialBill = async () => {
      try {
        const res = await fetch(`/api/purchases/bills/${id}`);
        const data = await res.json();
        if (ignore) return;
        if (!res.ok) {
          throw new Error(data.error || "Failed to load bill details.");
        }
        setBill(data.bill);
        void loadAvailableCredits(id);
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Error loading bill.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void fetchInitialBill();
    return () => {
      ignore = true;
    };
  }, [id, loadAvailableCredits]);

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

  const handleDownloadPdf = async () => {
    if (!bill) return;
    const doc = await generateBillPdf(bill, profileLogo);
    doc.save(`${bill.billNumber}.pdf`);
  };

  const handleOpenPayment = () => {
    if (!bill) return;
    setPaymentAmount(bill.balanceDue > 0 ? String(bill.balanceDue) : "");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMode("Bank Transfer");
    setPaymentReference("");
    setPaymentNotes(`Payment for Bill #${bill.billNumber}`);
    setShowPaymentModal(true);
  };

  const handleOpenApplyCredit = () => {
    if (!bill) return;
    setCreditError(null);
    setCreditAmounts({});
    if (availableCredits.length === 1) {
      const singleCredit = availableCredits[0];
      const maxApplicable = Math.min(singleCredit.balanceRemaining, bill.balanceDue);
      setCreditAmounts({ [singleCredit.id]: String(Math.round(maxApplicable * 100) / 100) });
    }
    setShowApplyCreditModal(true);
  };

  const handleSetMaxCredit = (creditId: string) => {
    if (!bill) return;
    const targetCredit = availableCredits.find((c) => c.id === creditId);
    if (!targetCredit) return;
    const otherAllocations = Object.entries(creditAmounts)
      .filter(([id]) => id !== creditId)
      .reduce((sum, [, amt]) => sum + (parseFloat(amt) || 0), 0);
    const remainingDue = Math.max(0, bill.balanceDue - otherAllocations);
    const maxCanApply = Math.min(targetCredit.balanceRemaining, remainingDue);
    const rounded = Math.round(maxCanApply * 100) / 100;
    setCreditAmounts((prev) => ({
      ...prev,
      [creditId]: rounded > 0 ? String(rounded) : "",
    }));
  };

  const handleApplyAllCredits = () => {
    if (!bill) return;
    let remainingDue = bill.balanceDue;
    const newAmounts: Record<string, string> = {};
    for (const cred of availableCredits) {
      if (remainingDue <= 0) {
        newAmounts[cred.id] = "";
        continue;
      }
      const canApply = Math.min(cred.balanceRemaining, remainingDue);
      const rounded = Math.round(canApply * 100) / 100;
      newAmounts[cred.id] = rounded > 0 ? String(rounded) : "";
      remainingDue = Math.max(0, remainingDue - rounded);
    }
    setCreditAmounts(newAmounts);
  };

  const totalCreditApplying = Object.values(creditAmounts).reduce(
    (sum, val) => sum + (parseFloat(val) || 0),
    0
  );
  const remainingDueAfterCredit = Math.max(
    0,
    Math.round(((bill?.balanceDue || 0) - totalCreditApplying) * 100) / 100
  );

  const handleApplyCreditsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bill) return;

    const apps = Object.entries(creditAmounts)
      .map(([creditId, amtStr]) => ({ creditId, amount: parseFloat(amtStr) || 0 }))
      .filter((a) => a.amount > 0);

    if (apps.length === 0) {
      setCreditError("Please specify at least one vendor credit amount to apply.");
      return;
    }

    const totalApplying = apps.reduce((sum, a) => sum + a.amount, 0);
    const roundedTotal = Math.round(totalApplying * 100) / 100;

    if (roundedTotal > bill.balanceDue + 0.01) {
      setCreditError(
        `Total credit applied (${formatINR(roundedTotal)}) cannot exceed payment due (${formatINR(bill.balanceDue)}).`,
      );
      return;
    }

    for (const app of apps) {
      const cred = availableCredits.find((c) => c.id === app.creditId);
      if (cred && app.amount > cred.balanceRemaining + 0.01) {
        setCreditError(
          `Amount for credit note ${cred.creditNoteNumber} exceeds available balance (${formatINR(cred.balanceRemaining)}).`,
        );
        return;
      }
    }

    setApplyingCredits(true);
    setCreditError(null);

    try {
      const res = await fetch(`/api/purchases/bills/${bill.id}/apply-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: apps }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to apply vendor credits.");
      }

      setNotice(`Vendor credit of ${formatINR(roundedTotal)} applied to Bill #${bill.billNumber} successfully.`);
      setShowApplyCreditModal(false);
      void loadBill();
    } catch (err) {
      setCreditError(err instanceof Error ? err.message : "Error applying credit.");
    } finally {
      setApplyingCredits(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bill) return;

    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setError("Please enter a valid payment amount greater than zero.");
      return;
    }

    if (amt > bill.balanceDue) {
      setError(`Payment amount cannot exceed the balance due of ${formatINR(bill.balanceDue)}.`);
      return;
    }

    setSubmittingPayment(true);
    setError(null);

    try {
      const res = await fetch("/api/purchases/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: bill.vendorId,
          billId: bill.id,
          amount: amt,
          paymentDate,
          paymentMode,
          referenceNumber: paymentReference.trim(),
          paidThrough,
          notes: paymentNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record payment.");
      }

      setNotice(`Payment of ${formatINR(amt)} recorded against Bill #${bill.billNumber}.`);
      setShowPaymentModal(false);
      void loadBill();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error processing payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDelete = async () => {
    if (!bill) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/purchases/bills/${bill.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete bill.");
      }

      router.push("/purchases/bills");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting bill.");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500">Loading purchase bill details…</p>
      </div>
    );
  }

  if (error && !bill) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Failed to Load Bill</h2>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
        </div>
        <Link
          href="/purchases/bills"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Bills
        </Link>
      </div>
    );
  }

  if (!bill) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue =
    bill.dueDate &&
    new Date(bill.dueDate) < today &&
    bill.balanceDue > 0 &&
    bill.status !== "Draft";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/purchases/bills"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            title="Back to Bills"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Bill #{bill.billNumber}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  bill.status === "Paid"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : bill.status === "Partially Paid"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : bill.status === "Draft"
                    ? "bg-slate-100 text-slate-700 border border-slate-200"
                    : isOverdue
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                {bill.status === "Paid" && <CheckCircle2 className="h-3 w-3" />}
                {bill.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Vendor: <span className="font-semibold text-slate-700">{bill.vendorName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Apply Vendor Credit */}
          {bill.balanceDue > 0 && bill.status !== "Draft" && bill.status !== "Void" && (
            <button
              type="button"
              onClick={handleOpenApplyCredit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 transition cursor-pointer"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Apply Vendor Credit
            </button>
          )}

          {/* Record Payment */}
          {bill.balanceDue > 0 && bill.status !== "Draft" && (
            <button
              type="button"
              onClick={handleOpenPayment}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Record Payment
            </button>
          )}

          {/* Edit */}
          <Link
            href={`/purchases/bills/${bill.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Edit className="h-3.5 w-3.5" />
            Edit
          </Link>

          {/* Download PDF */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </button>

          {/* Print */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* Available Vendor Credits Notification Banner */}
      {availableCredits.length > 0 && bill.balanceDue > 0 && bill.status !== "Draft" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-900 shadow-xs print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-purple-950">
                Available Vendor Credit: {formatINR(availableCredits.reduce((sum, c) => sum + c.balanceRemaining, 0))}
              </p>
              <p className="text-purple-800/80 mt-0.5">
                Vendor <span className="font-semibold">{bill.vendorName}</span> has {availableCredits.length} open credit note{availableCredits.length > 1 ? "s" : ""} available to settle this bill.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenApplyCredit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 transition cursor-pointer"
          >
            Apply Credit
          </button>
        </div>
      )}

      {/* Notice feedback */}
      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded p-1 hover:bg-emerald-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Document Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-8 print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-100 pb-6">
          <div className="flex items-start gap-4">
            {profileLogo && (
              <div className="shrink-0">
                <Image
                  src={profileLogo}
                  alt="Company Logo"
                  width={140}
                  height={64}
                  unoptimized
                  className="h-16 w-auto max-w-[140px] object-contain rounded-lg border border-slate-100 p-1 bg-white print:border-none"
                />
              </div>
            )}
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] text-blue-600 uppercase">
                Purchase Bill
              </span>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 mt-0.5">
                #{bill.billNumber}
              </h2>
              {bill.subject && (
                <p className="text-sm font-medium text-slate-600 mt-1 max-w-md">{bill.subject}</p>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Payment Due
            </span>
            <div className="text-3xl font-black text-slate-900 mt-0.5">
              {formatINR(bill.balanceDue)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Bill Total: <span className="font-semibold text-slate-800">{formatINR(bill.total)}</span>
              {(bill.vendorCreditApplied || 0) > 0 && (
                <span className="ml-2 text-purple-600">
                  (Credit: {formatINR(bill.vendorCreditApplied || 0)})
                </span>
              )}
              {bill.amountPaid > 0 && (
                <span className="ml-2 text-emerald-600">
                  (Paid: {formatINR(bill.amountPaid)})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Vendor & Bill Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Vendor Details */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <User className="h-3.5 w-3.5" />
              Vendor Information
            </div>
            <h3 className="text-base font-bold text-slate-900">{bill.vendorName}</h3>
            <p className="text-xs text-slate-600">
              <span className="text-slate-400">Accounts Payable:</span> {bill.accountsPayable}
            </p>
          </div>

          {/* Dates & Terms Details */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-5 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                Bill Date
              </span>
              <p className="font-semibold text-slate-900 mt-0.5 font-mono">
                {formatDate(bill.billDate)}
              </p>
            </div>

            <div>
              <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                Due Date
              </span>
              <p
                className={`font-semibold mt-0.5 font-mono ${
                  isOverdue ? "text-rose-600" : "text-slate-900"
                }`}
              >
                {formatDate(bill.dueDate)}
                {isOverdue && <span className="ml-1 text-[10px] font-bold">(Overdue)</span>}
              </p>
            </div>

            <div>
              <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                Payment Terms
              </span>
              <p className="font-semibold text-slate-900 mt-0.5">{bill.paymentTerms}</p>
            </div>

            <div>
              <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                Order / PO Number
              </span>
              <p className="font-semibold text-slate-900 mt-0.5 font-mono">
                {bill.orderNumber || "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-5 py-3 w-12 text-center">#</th>
                <th className="px-5 py-3">Item Details</th>
                <th className="px-5 py-3">Account</th>
                <th className="px-5 py-3 text-right">Qty</th>
                <th className="px-5 py-3 text-right">Rate</th>
                <th className="px-5 py-3">Customer Allocation</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {bill.items.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-center text-slate-400 font-mono">{index + 1}</td>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    {item.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{item.account}</td>
                  <td className="px-5 py-3 text-right font-mono font-medium text-slate-800">
                    {item.quantity}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-medium text-slate-800">
                    {formatINR(item.rate)}
                  </td>
                  <td className="px-5 py-3 text-slate-600 font-medium">
                    {item.customerName ? (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                        {item.customerName}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                    {formatINR(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculation & Notes Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
          {/* Notes and Terms & Attachments */}
          <div className="space-y-6 text-xs">
            {bill.notes && (
              <div>
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Customer Notes / Memo
                </h4>
                <p className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-slate-600 whitespace-pre-wrap">
                  {bill.notes}
                </p>
              </div>
            )}

            {bill.termsAndConditions && (
              <div>
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Terms & Conditions
                </h4>
                <p className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-slate-600 whitespace-pre-wrap">
                  {bill.termsAndConditions}
                </p>
              </div>
            )}

            {/* Attachments Section */}
            {bill.attachments && bill.attachments.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                  Attachments ({bill.attachments.length} files)
                </h4>
                <div className="space-y-2">
                  {bill.attachments.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileCheck className="h-4 w-4 shrink-0 text-blue-600" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate text-xs">{file.name}</p>
                          <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>

                      {file.dataUrl && (
                        <a
                          href={file.dataUrl}
                          download={file.name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition shrink-0"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Calculations Table */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-3 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Sub Total</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatINR(bill.subTotal)}
              </span>
            </div>

            {bill.discountAmount > 0 && (
              <div className="flex justify-between items-center text-slate-600">
                <span>
                  Discount {bill.discountType === "percent" ? `(${bill.discount}%)` : ""}
                </span>
                <span className="font-mono font-semibold text-rose-600">
                  -{formatINR(bill.discountAmount)}
                </span>
              </div>
            )}

            {/* GST breakdown */}
            {bill.taxAmount > 0 && (
              <>
                {bill.cgst > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>CGST ({bill.taxRate / 2}%)</span>
                    <span className="font-mono font-semibold text-slate-900">
                      +{formatINR(bill.cgst)}
                    </span>
                  </div>
                )}
                {bill.sgst > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>SGST ({bill.taxRate / 2}%)</span>
                    <span className="font-mono font-semibold text-slate-900">
                      +{formatINR(bill.sgst)}
                    </span>
                  </div>
                )}
                {bill.igst > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>IGST ({bill.taxRate}%)</span>
                    <span className="font-mono font-semibold text-slate-900">
                      +{formatINR(bill.igst)}
                    </span>
                  </div>
                )}
              </>
            )}

            {bill.adjustment !== 0 && (
              <div className="flex justify-between items-center text-slate-600">
                <span>Adjustment</span>
                <span className="font-mono font-semibold text-slate-900">
                  {bill.adjustment > 0 ? `+${formatINR(bill.adjustment)}` : formatINR(bill.adjustment)}
                </span>
              </div>
            )}

            <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-900">Bill Total</span>
              <span className="text-lg font-black text-slate-900 font-mono">
                {formatINR(bill.total)}
              </span>
            </div>

            <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-purple-700">
              <span className="font-medium">Vendor Credit Applied</span>
              <span className="font-mono font-bold">
                {bill.vendorCreditApplied && bill.vendorCreditApplied > 0
                  ? `(-) ${formatINR(bill.vendorCreditApplied)}`
                  : formatINR(0)}
              </span>
            </div>

            <div className="flex justify-between items-center text-emerald-700">
              <span className="font-medium">Payment Made</span>
              <span className="font-mono font-bold">
                {bill.amountPaid > 0 ? `(-) ${formatINR(bill.amountPaid)}` : formatINR(0)}
              </span>
            </div>

            <div
              className={`rounded-lg border p-3 flex justify-between items-center ${
                bill.balanceDue === 0
                  ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                  : "bg-white border-slate-200"
              }`}
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Payment Due
                </span>
                <span className="text-[10px] text-slate-400">
                  Bill Total − Credit Applied − Payment Made
                </span>
              </div>
              <span
                className={`text-base font-black font-mono ${
                  bill.balanceDue === 0 ? "text-emerald-700" : "text-amber-600"
                }`}
              >
                {formatINR(bill.balanceDue)}
              </span>
            </div>
          </div>
        </div>

        {/* Vendor Credits Applied Section */}
        {bill.creditsApplied && bill.creditsApplied.length > 0 && (
          <div className="border-t border-slate-100 pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-purple-600" />
                Vendor Credits Applied
              </h4>
              <span className="text-xs font-semibold text-purple-700 font-mono">
                Total Credit Applied: {formatINR(bill.vendorCreditApplied || 0)}
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-5 py-2.5">Credit Note #</th>
                    <th className="px-5 py-2.5">Notes</th>
                    <th className="px-5 py-2.5 text-right">Amount Applied</th>
                    <th className="px-5 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {bill.creditsApplied.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-mono text-slate-500 whitespace-nowrap">
                        {formatDate(c.appliedDate)}
                      </td>
                      <td className="px-5 py-3 font-semibold font-mono text-purple-700">
                        {c.creditNoteNumber}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {c.notes || `Applied to Bill #${bill.billNumber}`}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-purple-700">
                        {formatINR(c.amount)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Link
                          href={`/purchases/vendor-credits/${c.creditId}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payments History Section */}
        {bill.payments && bill.payments.length > 0 && (
          <div className="border-t border-slate-100 pt-6 space-y-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              Payment History
            </h4>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-5 py-2.5">Payment #</th>
                    <th className="px-5 py-2.5">Mode</th>
                    <th className="px-5 py-2.5">Reference #</th>
                    <th className="px-5 py-2.5 text-right">Amount Paid</th>
                    <th className="px-5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {bill.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-mono text-slate-500 whitespace-nowrap">
                        {formatDate(p.paymentDate)}
                      </td>
                      <td className="px-5 py-3 font-semibold font-mono text-slate-900">
                        {p.paymentNumber}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{p.paymentMode}</td>
                      <td className="px-5 py-3 font-mono text-slate-500">
                        {p.referenceNumber || "—"}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-emerald-600">
                        {formatINR(p.amount)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Apply Vendor Credit Modal */}
      {showApplyCreditModal && bill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Apply Vendor Credit</h3>
                <p className="text-xs text-slate-500">
                  Bill #{bill.billNumber} • Vendor: <span className="font-semibold text-slate-700">{bill.vendorName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyCreditModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Financial Overview Card */}
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-xs">
              <div>
                <span className="text-slate-500">Bill Total</span>
                <p className="text-sm font-bold text-slate-900 font-mono mt-0.5">{formatINR(bill.total)}</p>
              </div>
              <div>
                <span className="text-slate-500">Current Payment Due</span>
                <p className="text-sm font-bold text-amber-600 font-mono mt-0.5">{formatINR(bill.balanceDue)}</p>
              </div>
              <div>
                <span className="text-slate-500">Available Credit Balance</span>
                <p className="text-sm font-bold text-purple-700 font-mono mt-0.5">
                  {formatINR(availableCredits.reduce((s, c) => s + c.balanceRemaining, 0))}
                </p>
              </div>
            </div>

            {creditError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{creditError}</span>
              </div>
            )}

            {availableCredits.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">No Open Vendor Credits Available</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    There are no open or partially applied vendor credits for <span className="font-semibold">{bill.vendorName}</span>. Credits must belong to this vendor and have an available remaining balance.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowApplyCreditModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleApplyCreditsSubmit} className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    Available Credits for {bill.vendorName} ({availableCredits.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyAllCredits}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-700 underline cursor-pointer"
                  >
                    Auto-Fill Max Applicable
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="px-4 py-2.5">Credit Note #</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5 text-right">Total Credit</th>
                        <th className="px-4 py-2.5 text-right">Available Balance</th>
                        <th className="px-4 py-2.5 text-right w-48">Amount to Apply (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {availableCredits.map((cred) => (
                        <tr key={cred.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono font-semibold text-purple-700">
                            {cred.creditNoteNumber}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                            {formatDate(cred.vendorCreditDate)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">
                            {formatINR(cred.total)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                            {formatINR(cred.balanceRemaining)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={Math.min(cred.balanceRemaining, bill.balanceDue)}
                                placeholder="0.00"
                                value={creditAmounts[cred.id] ?? ""}
                                onChange={(e) =>
                                  setCreditAmounts((prev) => ({
                                    ...prev,
                                    [cred.id]: e.target.value,
                                  }))
                                }
                                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right font-mono text-xs font-semibold outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleSetMaxCredit(cred.id)}
                                className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-700 hover:bg-purple-100 transition cursor-pointer"
                                title="Apply maximum allowable from this credit note"
                              >
                                Max
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary calculation */}
                <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Total Credit to Apply:</span>
                    <span className="font-mono font-bold text-purple-700">
                      {formatINR(totalCreditApplying)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Remaining Payment Due After Application:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatINR(remainingDueAfterCredit)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowApplyCreditModal(false)}
                    disabled={applyingCredits}
                    className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={applyingCredits || totalCreditApplying <= 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition text-xs cursor-pointer"
                  >
                    {applyingCredits && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Apply Credit ({formatINR(totalCreditApplying)})
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Record Vendor Payment</h3>
                <p className="text-xs text-slate-500">
                  Bill #{bill.billNumber} • {bill.vendorName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 flex justify-between items-center">
                <div>
                  <span className="text-slate-500">Total Bill Amount:</span>
                  <p className="text-sm font-bold text-slate-900">{formatINR(bill.total)}</p>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Current Balance Due:</span>
                  <p className="text-sm font-bold text-amber-600">{formatINR(bill.balanceDue)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Amount Paid (₹) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={bill.balanceDue}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Reference / UTR #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-98214"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Paid Through Account
                </label>
                <select
                  value={paidThrough}
                  onChange={(e) => setPaidThrough(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="HDFC Operational Bank">HDFC Operational Bank</option>
                  <option value="ICICI Current Account">ICICI Current Account</option>
                  <option value="SBI Corporate Account">SBI Corporate Account</option>
                  <option value="Petty Cash">Petty Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={submittingPayment}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {submittingPayment && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Purchase Bill</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to delete Bill #{bill.billNumber}?
                </p>
              </div>
            </div>

            {bill.amountPaid > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-semibold">Warning: Payment Recorded</p>
                <p className="mt-0.5">
                  This bill already has payments of {formatINR(bill.amountPaid)} recorded against
                  it. You must delete the recorded payments first before deleting this bill.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || bill.amountPaid > 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
