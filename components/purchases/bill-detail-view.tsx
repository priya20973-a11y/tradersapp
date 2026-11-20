"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Download,
  FileCheck,
  FileText,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
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
  unit?: string;
  rate: number;
  taxRate?: number;
  taxAmount?: number;
  customerId?: string;
  customerName?: string;
  amount: number;
}

export interface BillAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  uploadedAt?: string;
}

export interface PaymentRecord {
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

interface LeftPaneBillSummary {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  orderNumber?: string;
  billDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
}

function formatINR(val: number): string {
  return `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateStr);
  }
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getBillStatusInfo(bill: { dueDate?: string | Date; balanceDue?: number; status?: string }) {
  const status = bill.status || "Draft";
  const balanceDue = Number(bill.balanceDue || 0);

  if (status === "Paid" || balanceDue <= 0) {
    return {
      label: "PAID",
      colorClass: "text-[#16a34a]",
    };
  }

  if (status === "Draft") {
    return {
      label: "DRAFT",
      colorClass: "text-slate-400",
    };
  }

  if (status === "Void") {
    return {
      label: "VOID",
      colorClass: "text-slate-400",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (bill.dueDate) {
    const due = new Date(bill.dueDate);
    due.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - due.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return {
        label: `OVERDUE BY ${diffDays} DAY${diffDays > 1 ? "S" : ""}`,
        colorClass: "text-[#ea580c]",
      };
    }
  }

  if (status === "Partially Paid") {
    return {
      label: "PARTIALLY PAID",
      colorClass: "text-amber-600",
    };
  }

  return {
    label: "OPEN",
    colorClass: "text-slate-600",
  };
}

export function BillDetailView({
  id,
  onClose,
}: {
  id: string;
  onClose?: () => void;
}) {
  const router = useRouter();

  const [activeBillId, setActiveBillId] = useState<string>(id);
  const [bill, setBill] = useState<BillDetail | null>(null);
  const [billsList, setBillsList] = useState<LeftPaneBillSummary[]>([]);
  const [loadingBill, setLoadingBill] = useState(true);
  const [profileLogo, setProfileLogo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Status Filter in left pane ("ALL", "Draft", "Pending", "Partially Paid", "Paid", "Overdue")
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showStatusFilterMenu, setShowStatusFilterMenu] = useState(false);

  // Dropdown states for right pane action bar
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [showMoreActionsMenu, setShowMoreActionsMenu] = useState(false);
  const [showNewBillMenu, setShowNewBillMenu] = useState(false);

  // Modals / Drawers
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("Bank Transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paidThrough, setPaidThrough] = useState("HDFC Operational Bank");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Apply vendor credit modal
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [availableCredits, setAvailableCredits] = useState<AvailableVendorCredit[]>([]);
  const [selectedCreditId, setSelectedCreditId] = useState("");
  const [creditAmountToApply, setCreditAmountToApply] = useState("");
  const [applyingCredit, setApplyingCredit] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Drawers
  const [showAttachmentsDrawer, setShowAttachmentsDrawer] = useState(false);
  const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);

  // Dropdown click outside listeners
  const pdfMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const newBillMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(e.target as Node)) {
        setShowPdfMenu(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreActionsMenu(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setShowStatusFilterMenu(false);
      }
      if (newBillMenuRef.current && !newBillMenuRef.current.contains(e.target as Node)) {
        setShowNewBillMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [previousId, setPreviousId] = useState(id);
  if (id !== previousId) {
    setPreviousId(id);
    setActiveBillId(id);
  }

  // Load organization profile logo
  useEffect(() => {
    fetch("/api/admin/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.organization?.logo) {
          setProfileLogo(data.organization.logo);
        }
      })
      .catch(() => {});
  }, []);

  // Load list of all bills for left pane
  const loadBillsList = useCallback(async () => {
    try {
      const res = await fetch("/api/purchases/bills");
      const data = await res.json();
      if (res.ok && data.bills) {
        setBillsList(data.bills);
      }
    } catch (err) {
      console.error("Error loading bills list:", err);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadBillsList());
  }, [loadBillsList]);

  // Load single bill detail
  const loadBill = useCallback(async (billId: string) => {
    setLoadingBill(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchases/bills/${billId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load bill.");
      }
      setBill(data.bill);

      // Fetch vendor credits for this vendor
      if (data.bill?.vendorId) {
        fetch(`/api/purchases/vendor-credits?vendorId=${data.bill.vendorId}&status=Open`)
          .then((r) => (r.ok ? r.json() : null))
          .then((cData) => {
            if (cData?.vendorCredits) {
              setAvailableCredits(cData.vendorCredits);
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching bill.");
    } finally {
      setLoadingBill(false);
    }
  }, []);

  useEffect(() => {
    if (activeBillId) {
      void Promise.resolve().then(() => loadBill(activeBillId));
    }
  }, [activeBillId, loadBill]);

  // Switch to another bill from left pane
  const handleSelectBill = (newId: string) => {
    if (newId === activeBillId) return;
    setActiveBillId(newId);
    window.history.replaceState(null, "", `/purchases/bills/${newId}`);
  };

  // Close split screen view
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.push("/purchases/bills");
    }
  };

  // Open Record Payment modal
  const handleOpenPayment = () => {
    if (!bill) return;
    setPaymentAmount(bill.balanceDue > 0 ? String(bill.balanceDue) : "");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMode("Bank Transfer");
    setPaymentReference("");
    setPaymentNotes(`Payment for Bill #${bill.billNumber}`);
    setShowPaymentModal(true);
  };

  // Submit Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bill) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setError("Please enter a valid positive payment amount.");
      return;
    }

    if (amt > bill.balanceDue) {
      setError(`Payment cannot exceed the balance due of ${formatINR(bill.balanceDue)}.`);
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
      void loadBill(activeBillId);
      void loadBillsList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error processing payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Open Apply Vendor Credit modal
  const handleOpenApplyCredit = () => {
    if (availableCredits.length > 0) {
      setSelectedCreditId(availableCredits[0].id);
      setCreditAmountToApply(
        String(Math.min(bill?.balanceDue || 0, availableCredits[0].balanceRemaining || 0))
      );
    }
    setShowCreditModal(true);
  };

  // Submit Apply Vendor Credit
  const handleApplyCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bill || !selectedCreditId) return;

    const amt = parseFloat(creditAmountToApply);
    if (isNaN(amt) || amt <= 0) {
      setError("Please enter a valid credit amount to apply.");
      return;
    }

    setApplyingCredit(true);
    setError(null);

    try {
      const res = await fetch("/api/purchases/vendor-credits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditId: selectedCreditId,
          billId: bill.id,
          amountToApply: amt,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to apply vendor credit.");
      }

      setNotice(`Applied ${formatINR(amt)} credit to Bill #${bill.billNumber}.`);
      setShowCreditModal(false);
      void loadBill(activeBillId);
      void loadBillsList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error applying credit.");
    } finally {
      setApplyingCredit(false);
    }
  };

  // Delete Bill
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

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting bill.");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // PDF Download
  const handleDownloadPdf = () => {
    if (!bill) return;
    try {
      generateBillPdf(bill, profileLogo);
    } catch (err) {
      console.error("PDF generation error:", err);
      setError("Failed to generate PDF document.");
    }
  };

  // Filtered bills for left pane
  const filteredLeftBills = useMemo(() => {
    return billsList.filter((b) => {
      if (statusFilter === "ALL") return true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue =
        b.dueDate && new Date(b.dueDate) < today && b.balanceDue > 0 && b.status !== "Draft";

      if (statusFilter === "Overdue") return isOverdue;
      if (statusFilter === "Paid") return b.status === "Paid" || b.balanceDue <= 0;
      if (statusFilter === "Pending") return b.status === "Pending" && !isOverdue;
      return b.status.toLowerCase() === statusFilter.toLowerCase();
    });
  }, [billsList, statusFilter]);

  return (
    <div className="flex h-[calc(100vh-80px)] w-full overflow-hidden bg-white text-slate-800">
      {/* ========================================================= */}
      {/* LEFT PANE: Master Bills List */}
      {/* ========================================================= */}
      <aside className="w-80 lg:w-[350px] shrink-0 border-r border-slate-200 bg-white flex flex-col h-full">
        {/* Left Pane Header Bar */}
        <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          {/* "All Bills ▾" dropdown */}
          <div className="relative" ref={filterMenuRef}>
            <button
              type="button"
              onClick={() => setShowStatusFilterMenu((prev) => !prev)}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-blue-600 transition cursor-pointer"
            >
              <span>{statusFilter === "ALL" ? "All Bills" : `${statusFilter} Bills`}</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </button>

            {showStatusFilterMenu && (
              <div className="absolute left-0 top-full mt-1.5 w-48 rounded-lg bg-white border border-slate-200 shadow-lg py-1.5 z-30 text-xs font-medium text-slate-700">
                {[
                  { id: "ALL", label: "All Bills" },
                  { id: "Draft", label: "Draft Bills" },
                  { id: "Pending", label: "Pending Bills" },
                  { id: "Partially Paid", label: "Partially Paid" },
                  { id: "Paid", label: "Paid Bills" },
                  { id: "Overdue", label: "Overdue Bills" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(item.id);
                      setShowStatusFilterMenu(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-slate-50 transition cursor-pointer flex items-center justify-between ${
                      statusFilter === item.id ? "text-blue-600 font-semibold bg-blue-50/50" : ""
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons on top right of list */}
          <div className="flex items-center gap-1.5">
            {/* Split Blue Button [+ | ▾] */}
            <div className="relative flex items-center shadow-2xs rounded-md overflow-hidden" ref={newBillMenuRef}>
              <Link
                href="/purchases/bills/new"
                className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 flex items-center justify-center transition"
                title="New Bill"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </Link>
              <button
                type="button"
                onClick={() => setShowNewBillMenu((prev) => !prev)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-1.5 py-1.5 border-l border-blue-500 flex items-center justify-center transition cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showNewBillMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-36 rounded-lg bg-white border border-slate-200 shadow-lg py-1 z-30 text-xs font-medium text-slate-700">
                  <Link
                    href="/purchases/bills/new"
                    onClick={() => setShowNewBillMenu(false)}
                    className="block px-3 py-1.5 hover:bg-slate-50 transition"
                  >
                    New Bill
                  </Link>
                </div>
              )}
            </div>

            {/* More Options Button [...] */}
            <button
              type="button"
              onClick={() => void loadBillsList()}
              className="p-1.5 border border-slate-200 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer"
              title="Refresh bills list"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Bills List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredLeftBills.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No bills found for this filter.
            </div>
          ) : (
            filteredLeftBills.map((b) => {
              const isSelected = b.id === activeBillId;
              const statusInfo = getBillStatusInfo(b);

              return (
                <div
                  key={b.id}
                  onClick={() => handleSelectBill(b.id)}
                  className={`px-4 py-3 cursor-pointer transition flex items-start gap-3 select-none ${
                    isSelected
                      ? "bg-white border-l-4 border-l-blue-600 shadow-2xs"
                      : "bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent"
                  }`}
                >
                  {/* Checkbox */}
                  <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                    />
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    {/* Line 1: Vendor Name & Amount */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {b.vendorName || "Unknown Vendor"}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                        {formatINR(b.total)}
                      </span>
                    </div>

                    {/* Line 2: Bill # • Date */}
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <span className="font-medium text-slate-600">{b.billNumber}</span>
                      <span>•</span>
                      <span>{formatDate(b.billDate)}</span>
                    </div>

                    {/* Line 3: Status Badge */}
                    <div className="mt-1">
                      <span className={`text-[11px] font-bold tracking-wide uppercase ${statusInfo.colorClass}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* RIGHT PANE: Selected Bill Document-Style Preview */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100/70">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 shrink-0 px-8 py-3.5 z-10 shadow-2xs">
          {/* Row 1: Bill Number on left, Icons on right */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {bill?.billNumber || "—"}
            </h1>

            <div className="flex items-center gap-2">
              {/* Attachment Icon */}
              <button
                type="button"
                onClick={() => setShowAttachmentsDrawer(true)}
                className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-md text-slate-500 hover:text-slate-700 transition cursor-pointer relative"
                title="Attachments"
              >
                <Paperclip className="w-4 h-4" />
                {Boolean(bill?.attachments?.length) && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                    {bill?.attachments?.length}
                  </span>
                )}
              </button>

              {/* Comments Icon */}
              <button
                type="button"
                onClick={() => setShowCommentsDrawer(true)}
                className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-md text-slate-500 hover:text-slate-700 transition cursor-pointer relative"
                title="Comments & Notes"
              >
                <MessageSquare className="w-4 h-4" />
                {Boolean(bill?.notes) && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-blue-600" />
                )}
              </button>

              {/* Red Close Icon */}
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer"
                title="Close bill preview"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Row 2: Action Toolbar (Edit, PDF/Print ▾, Record Payment ▾, ...) */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
            {/* Edit Button */}
            {bill && (
              <Link
                href={`/purchases/bills/${bill.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md shadow-2xs transition"
              >
                <Pencil className="w-3.5 h-3.5 text-slate-600" />
                <span>Edit</span>
              </Link>
            )}

            {/* PDF/Print ▾ Dropdown */}
            <div className="relative" ref={pdfMenuRef}>
              <button
                type="button"
                onClick={() => setShowPdfMenu((prev) => !prev)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md shadow-2xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>PDF/Print</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showPdfMenu && (
                <div className="absolute left-0 top-full mt-1 w-36 rounded-lg bg-white border border-slate-200 shadow-lg py-1 z-30 text-xs font-medium text-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPdfMenu(false);
                      handleDownloadPdf();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-slate-500" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPdfMenu(false);
                      window.print();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-3 h-3 text-slate-500" />
                    <span>Print</span>
                  </button>
                </div>
              )}
            </div>

            {/* Record Payment ▾ Button */}
            {bill && bill.balanceDue > 0 && bill.status !== "Draft" && bill.status !== "Void" && (
              <button
                type="button"
                onClick={handleOpenPayment}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md shadow-2xs transition cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                <span>Record Payment</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}

            {/* ... More Button */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setShowMoreActionsMenu((prev) => !prev)}
                className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-md shadow-2xs transition cursor-pointer"
                title="More actions"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showMoreActionsMenu && (
                <div className="absolute left-0 top-full mt-1 w-44 rounded-lg bg-white border border-slate-200 shadow-lg py-1 z-30 text-xs font-medium text-slate-700">
                  {bill && availableCredits.length > 0 && bill.balanceDue > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreActionsMenu(false);
                        handleOpenApplyCredit();
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition flex items-center gap-2 text-purple-700 cursor-pointer"
                    >
                      <CreditCard className="w-3 h-3 text-purple-600" />
                      <span>Apply Vendor Credit</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreActionsMenu(false);
                      setShowDeleteModal(true);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-50 transition flex items-center gap-2 text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" />
                    <span>Delete Bill</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Feedback Notices */}
        {notice && (
          <div className="mx-8 mt-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {error && (
          <div className="mx-8 mt-4 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Document Canvas Container */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {loadingBill ? (
            <div className="flex h-96 flex-col items-center justify-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
              <p className="text-xs text-slate-500">Loading bill preview…</p>
            </div>
          ) : !bill ? (
            <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">Bill Not Found</h3>
              <p className="text-xs text-slate-500">The selected bill could not be retrieved from the database.</p>
            </div>
          ) : (
            /* ========================================================= */
            /* DOCUMENT PREVIEW SHEET (ZOHO BOOKS STYLE) */
            /* ========================================================= */
            <div className="max-w-[850px] mx-auto bg-white border border-slate-200/90 shadow-xs p-10 sm:p-14 text-slate-800 text-xs min-h-[780px] flex flex-col justify-between">
              <div>
                {/* Document Top: Bill From on Left, Metadata on Right */}
                <div className="flex flex-wrap items-start justify-between gap-6">
                  {/* Left: Bill From */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-600">Bill From</p>
                    <Link
                      href={`/purchases/vendors/${bill.vendorId}`}
                      className="text-sm font-semibold text-blue-600 hover:underline block"
                    >
                      {bill.vendorName}
                    </Link>
                  </div>

                  {/* Right: Key-Value Metadata aligned */}
                  <div className="space-y-1.5 text-xs text-slate-700 font-sans">
                    <div className="flex items-center justify-end gap-4">
                      <span className="text-slate-600 font-medium w-28 text-right">Order Number :</span>
                      <span className="text-slate-900 font-medium w-28 text-right font-mono">
                        {bill.orderNumber || "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-4">
                      <span className="text-slate-600 font-medium w-28 text-right">Bill Date :</span>
                      <span className="text-slate-900 font-medium w-28 text-right font-mono">
                        {formatDate(bill.billDate)}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-4">
                      <span className="text-slate-600 font-medium w-28 text-right">Due Date :</span>
                      <span className="text-slate-900 font-medium w-28 text-right font-mono">
                        {formatDate(bill.dueDate)}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-4">
                      <span className="text-slate-600 font-medium w-28 text-right">Terms :</span>
                      <span className="text-slate-900 font-medium w-28 text-right">
                        {bill.paymentTerms || "Custom"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="mt-10 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#333333] text-white text-[11px] font-semibold">
                        <th className="py-2.5 px-3 w-8 text-center">#</th>
                        <th className="py-2.5 px-3 font-semibold">Item & Description</th>
                        <th className="py-2.5 px-3 font-semibold">Customer Details</th>
                        <th className="py-2.5 px-3 text-right font-semibold">Qty</th>
                        <th className="hidden">Unit</th>
                        <th className="py-2.5 px-3 text-right font-semibold">Rate</th>
                        <th className="py-2.5 px-3 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {bill.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/40">
                          {/* Row Index */}
                          <td className="py-3 px-3 text-center text-slate-500 font-mono">
                            {idx + 1}
                          </td>

                          {/* Item & Description */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 text-xs">
                              {item.name}
                            </div>
                            {item.description && (
                              <div className="text-[11px] text-slate-500 mt-0.5 whitespace-pre-line">
                                {item.description}
                              </div>
                            )}
                          </td>

                          {/* Customer Details */}
                          <td className="py-3 px-3 text-slate-700">
                            {item.customerName ? (
                              <div>
                                <div className="flex items-center gap-1 font-medium text-slate-800">
                                  <User className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{item.customerName}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Non-Billable
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Qty & Unit */}
                          <td className="py-3 px-3 text-right tabular-nums">
                            <span className="hidden">{item.quantity}</span>
                            <div className="font-semibold text-slate-900">
                              {Number(item.quantity || 0).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {item.unit || "—"}
                            </div>
                          </td>
                          <td className="hidden">{item.unit || "—"}</td>

                          {/* Rate */}
                          <td className="py-3 px-3 text-right tabular-nums text-slate-800">
                            {formatINR(item.rate)}
                          </td>

                          {/* Amount */}
                          <td className="py-3 px-3 text-right tabular-nums font-semibold text-slate-900">
                            {Number(item.amount || 0).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Sub Total, Total & Balance Due Block */}
                <div className="mt-8 flex justify-end">
                  <div className="w-72 space-y-2 text-xs">
                    {/* Sub Total */}
                    <div className="flex justify-between items-center py-1 text-slate-700">
                      <span>Sub Total</span>
                      <span className="font-semibold tabular-nums">
                        {Number(bill.subTotal || 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    {/* Discount */}
                    {bill.discountAmount > 0 && (
                      <div className="flex justify-between items-center py-1 text-slate-700">
                        <span>Discount {bill.discountType === "percent" ? `(${bill.discount}%)` : ""}</span>
                        <span className="font-semibold text-rose-600 tabular-nums">
                          -{formatINR(bill.discountAmount)}
                        </span>
                      </div>
                    )}

                    {/* Tax */}
                    {bill.taxAmount > 0 && (
                      <div className="flex justify-between items-center py-1 text-slate-700">
                        <span>Tax ({bill.taxRate}%)</span>
                        <span className="font-semibold tabular-nums">{formatINR(bill.taxAmount)}</span>
                      </div>
                    )}

                    {/* Adjustment */}
                    {bill.adjustment !== 0 && (
                      <div className="flex justify-between items-center py-1 text-slate-700">
                        <span>Adjustment</span>
                        <span className="font-semibold tabular-nums">{formatINR(bill.adjustment)}</span>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex justify-between items-center py-1.5 text-sm font-bold text-slate-900 border-t border-slate-200">
                      <span>Total</span>
                      <span className="tabular-nums">{formatINR(bill.total)}</span>
                    </div>

                    {/* Shaded Balance Due Row (Zoho Books Style) */}
                    <div className="bg-slate-100 p-2.5 rounded-xs flex justify-between items-center text-sm font-bold text-slate-900 mt-2">
                      <span>Balance Due</span>
                      <span className="tabular-nums">{formatINR(bill.balanceDue)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: Authorized Signature */}
              <div className="mt-24 pt-6 text-xs text-slate-500 font-medium">
                Authorized Signature _____________________
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ========================================================= */}
      {/* MODAL: Record Payment */}
      {/* ========================================================= */}
      {showPaymentModal && bill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Payment</h3>
                <p className="text-xs text-slate-500">Bill #{bill.billNumber} • {bill.vendorName}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 flex justify-between text-xs font-semibold">
                <span className="text-slate-500">Current Balance Due:</span>
                <span className="text-slate-900">{formatINR(bill.balanceDue)}</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  max={bill.balanceDue}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Paid Through Account</label>
                  <input
                    type="text"
                    value={paidThrough}
                    onChange={(e) => setPaidThrough(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reference / UTR #</label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="UTR-992837..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  {submittingPayment && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Apply Vendor Credit */}
      {/* ========================================================= */}
      {showCreditModal && bill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Apply Vendor Credit</h3>
                <p className="text-xs text-slate-500">Bill #{bill.billNumber} • {bill.vendorName}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreditModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleApplyCredit} className="space-y-4 text-xs">
              <div className="rounded-xl bg-purple-50 p-3 flex justify-between text-xs font-semibold text-purple-900">
                <span>Bill Balance Due:</span>
                <span>{formatINR(bill.balanceDue)}</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Credit Note</label>
                <select
                  value={selectedCreditId}
                  onChange={(e) => {
                    setSelectedCreditId(e.target.value);
                    const found = availableCredits.find((c) => c.id === e.target.value);
                    if (found) {
                      setCreditAmountToApply(String(Math.min(bill.balanceDue, found.balanceRemaining)));
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 font-medium"
                >
                  {availableCredits.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.creditNoteNumber} — Available: {formatINR(c.balanceRemaining)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount to Apply (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={creditAmountToApply}
                  onChange={(e) => setCreditAmountToApply(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applyingCredit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 font-semibold text-white hover:bg-purple-700 disabled:opacity-60 cursor-pointer"
                >
                  {applyingCredit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Apply Credit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Delete Confirmation */}
      {/* ========================================================= */}
      {showDeleteModal && bill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Bill?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-800">Bill #{bill.billNumber}</span>?
              This will remove this record and reverse any recorded purchase inventory movements.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DRAWER / MODAL: Attachments */}
      {/* ========================================================= */}
      {showAttachmentsDrawer && bill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Attachments ({bill.attachments?.length || 0})</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAttachmentsDrawer(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {!bill.attachments || bill.attachments.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No files attached to this bill.</p>
              ) : (
                bill.attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    {file.dataUrl && (
                      <a
                        href={file.dataUrl}
                        download={file.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 shrink-0"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAttachmentsDrawer(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DRAWER / MODAL: Comments / Notes */}
      {/* ========================================================= */}
      {showCommentsDrawer && bill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Notes & Comments</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCommentsDrawer(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Customer Notes / Memo</p>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 whitespace-pre-wrap min-h-16">
                  {bill.notes || "No notes recorded for this bill."}
                </div>
              </div>

              {bill.termsAndConditions && (
                <div>
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Terms & Conditions</p>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 whitespace-pre-wrap">
                    {bill.termsAndConditions}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCommentsDrawer(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
