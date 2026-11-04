"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { generatePaymentsCsv } from "@/lib/ledger-utils";

interface VendorPaymentItem {
  id: string;
  number: string;
  vendorId: string;
  vendorName: string;
  billId?: string;
  billNumber?: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  referenceNumber: string;
  notes: string;
  status: string;
}

interface PendingBill {
  id: string;
  number: string;
  orderNumber?: string;
  vendorId: string;
  vendorName: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
}

export function VendorPaymentsDirectory() {
  const [payments, setPayments] = useState<VendorPaymentItem[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [pendingBills, setPendingBills] = useState<PendingBill[]>([]);
  const [metrics, setMetrics] = useState({
    totalDisbursed: 0,
    disbursedThisMonth: 0,
    pendingClearing: 0,
    transactionCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [datePreset, setDatePreset] = useState<"all" | "month" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const searchParams = useSearchParams();

  // Modals
  const [showRecordModal, setShowRecordModal] = useState(
    () => searchParams?.get("action") === "record" || Boolean(searchParams?.get("vendorId")),
  );
  const [selectedPayment, setSelectedPayment] = useState<VendorPaymentItem | null>(null);

  // Form State
  const [formVendorId, setFormVendorId] = useState(() => searchParams?.get("vendorId") || "");
  const [formBillId, setFormBillId] = useState(() => searchParams?.get("billId") || "");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formMode, setFormMode] = useState<"Bank Transfer" | "UPI" | "Cash" | "Cheque" | "NEFT / RTGS">("Bank Transfer");
  const [formReference, setFormReference] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchPayments = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        if (searchTerm) queryParams.set("search", searchTerm);
        if (modeFilter !== "all") queryParams.set("mode", modeFilter);

        const now = new Date();
        if (datePreset === "month") {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          queryParams.set("startDate", firstDay.toISOString().split("T")[0]);
        } else if (datePreset === "custom") {
          if (startDate) queryParams.set("startDate", startDate);
          if (endDate) queryParams.set("endDate", endDate);
        }

        const [payRes, vendRes] = await Promise.allSettled([
          fetch(`/api/purchases/payments?${queryParams.toString()}`),
          fetch("/api/vendors"),
        ]);

        let payData: {
          payments?: VendorPaymentItem[];
          pendingBills?: PendingBill[];
          metrics?: typeof metrics;
          vendors?: { id?: string; _id?: string; name?: string; displayName?: string }[];
        } | null = null;

        if (payRes.status === "fulfilled" && payRes.value.ok) {
          payData = await payRes.value.json();
          setPayments(payData?.payments || []);
          setPendingBills(payData?.pendingBills || []);
          if (payData?.metrics) setMetrics(payData.metrics);
        } else if (payRes.status === "fulfilled" && !payRes.value.ok) {
          throw new Error("Failed to load vendor payments.");
        }

        const nameToId = new Map<string, string>();
        const idToName = new Map<string, string>();

        const addVendor = (id: string, name: string) => {
          const cleanId = String(id || "").trim();
          const cleanName = String(name || "").trim();
          if (!cleanId || !cleanName) return;

          const normName = cleanName.toLowerCase();
          const existingId = nameToId.get(normName);

          if (existingId) {
            // If existing is synthetic (starts with po-vend-) and new is a real ID, upgrade to real ID
            if (existingId.startsWith("po-vend-") && !cleanId.startsWith("po-vend-")) {
              idToName.delete(existingId);
              nameToId.set(normName, cleanId);
              idToName.set(cleanId, cleanName);
            }
            return;
          }

          nameToId.set(normName, cleanId);
          idToName.set(cleanId, cleanName);
        };

        // 1. From Vendor Master (/api/vendors)
        if (vendRes.status === "fulfilled" && vendRes.value.ok) {
          const vData = await vendRes.value.json().catch(() => null);
          if (Array.isArray(vData?.vendors)) {
            for (const v of vData.vendors) {
              const vId = String(v.id || v._id || "").trim();
              const vName = String(v.displayName || v.name || v.companyName || "").trim();
              if (vId && vName) {
                addVendor(vId, vName);
              }
            }
          }
        }

        // 2. From Payments route (/api/purchases/payments)
        if (payData && Array.isArray(payData.vendors)) {
          for (const v of payData.vendors) {
            const vId = String(v.id || v._id || "").trim();
            const vName = String(v.name || v.displayName || "").trim();
            if (vId && vName) {
              addVendor(vId, vName);
            }
          }
        }

        // 3. From pending bills
        if (payData && Array.isArray(payData.pendingBills)) {
          for (const b of payData.pendingBills) {
            const bVendorId = String(b.vendorId || "").trim();
            const bVendorName = String(b.vendorName || "").trim();
            if (bVendorId && bVendorName) {
              addVendor(bVendorId, bVendorName);
            }
          }
        }

        const combinedVendors = Array.from(idToName.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setVendors(combinedVendors);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load vendor payments.";
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchTerm, modeFilter, datePreset, startDate, endDate],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPayments();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPayments]);

  useEffect(() => {
    const qVendorId = searchParams?.get("vendorId");
    const qBillId = searchParams?.get("billId");
    const qAction = searchParams?.get("action");
    if (!qVendorId && qAction !== "record") return;

    const timer = setTimeout(() => {
      if (qVendorId) {
        setFormVendorId(qVendorId);
        setShowRecordModal(true);
        void fetchPayments(true);
        if (qBillId) {
          setFormBillId(qBillId);
          const matched = pendingBills.find((b) => b.id === qBillId);
          if (matched) {
            setFormAmount(String(matched.balanceDue));
          }
        }
      } else if (qAction === "record") {
        setShowRecordModal(true);
        void fetchPayments(true);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [searchParams, pendingBills, fetchPayments]);

  const vendorBills = useMemo(() => {
    if (!formVendorId) return [];
    const selectedVendor = vendors.find((v) => v.id === formVendorId);
    return pendingBills.filter((b) => {
      if (b.vendorId === formVendorId) return true;
      if (
        selectedVendor &&
        b.vendorName &&
        selectedVendor.name &&
        b.vendorName.trim().toLowerCase() === selectedVendor.name.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });
  }, [pendingBills, formVendorId, vendors]);

  const handleBillChange = (billId: string) => {
    setFormBillId(billId);
    if (billId) {
      const bill = pendingBills.find((b) => b.id === billId);
      if (bill) {
        setFormAmount(String(bill.balanceDue));
      }
    }
  };

  const handleRecordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amountNum = Number(formAmount);
    if (!formVendorId) {
      setFormError("Please select a vendor.");
      return;
    }
    if (!amountNum || amountNum <= 0) {
      setFormError("Please enter a valid disbursement amount greater than zero.");
      return;
    }

    if (formBillId) {
      const bill = pendingBills.find((b) => b.id === formBillId);
      if (bill && amountNum > bill.balanceDue + 0.05) {
        setFormError(`Payment cannot exceed bill balance of ₹${bill.balanceDue}.`);
        return;
      }
    }

    const selectedVendor = vendors.find((v) => v.id === formVendorId);
    setSubmitting(true);
    try {
      const res = await fetch("/api/purchases/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: formVendorId,
          vendorName: selectedVendor?.name || undefined,
          billId: formBillId || undefined,
          amount: amountNum,
          paymentDate: formDate,
          paymentMode: formMode,
          referenceNumber: formReference.trim(),
          notes: formNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record payment.");
      }

      setNotice(`Vendor payment ${data.payment.paymentNumber} of ₹${amountNum.toLocaleString("en-IN")} recorded.`);
      setShowRecordModal(false);
      setFormAmount("");
      setFormBillId("");
      setFormReference("");
      setFormNotes("");
      fetchPayments(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit vendor payment.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    const csvData = generatePaymentsCsv(
      "Vendor Payments",
      payments.map((p) => ({
        date: p.paymentDate,
        number: p.number,
        partyName: p.vendorName,
        linkedDoc: p.billNumber,
        mode: p.paymentMode,
        referenceNumber: p.referenceNumber,
        amount: p.amount,
        status: p.status,
      })),
    );
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `vendor-payments-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatINR = (val: number) => {
    return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Purchases</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Disbursements & Settlements</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">Vendor Payments</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record supplier remittances, bank transfers, purchase bill settlements, and outgoing payment audit
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchPayments(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || payments.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setShowRecordModal(true);
              void fetchPayments(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 3 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Disbursed</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{formatINR(metrics.totalDisbursed)}</p>
          <p className="text-xs text-slate-400 mt-1">Cumulative payments to vendors</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Disbursed This Month</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{formatINR(metrics.disbursedThisMonth)}</p>
          <p className="text-xs text-emerald-600/70 mt-1">Remittances in current month</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Clearing</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{formatINR(metrics.pendingClearing)}</p>
          <p className="text-xs text-amber-600/70 mt-1">Cheques in transit</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search payment#, vendor, UTR, bill..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
            {(["all", "Bank Transfer", "NEFT / RTGS", "UPI", "Cheque", "Cash"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeFilter(m)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  modeFilter === m ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {m === "all" ? "All Modes" : m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as "all" | "month" | "custom")}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Dates</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Date</option>
          </select>
          {datePreset === "custom" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Payments Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-medium">Loading vendor payments…</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">{error}</div>
        ) : payments.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-base font-semibold text-slate-700">No vendor payments recorded</p>
            <p className="text-xs text-slate-400 mt-1">Click &quot;Record Payment&quot; to record a disbursement to a supplier.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Payment#</th>
                  <th className="px-4 py-3.5">Vendor Name</th>
                  <th className="px-4 py-3.5">Bill Ref</th>
                  <th className="px-4 py-3.5">Payment Mode</th>
                  <th className="px-4 py-3.5">Ref / UTR#</th>
                  <th className="px-4 py-3.5 text-right">Amount Paid</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {new Date(p.paymentDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {p.number}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{p.vendorName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {p.billNumber || "On Account"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-slate-700">{p.paymentMode}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {p.referenceNumber || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                      {formatINR(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                          p.status === "Cleared"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : p.status === "In Clearing"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedPayment(p)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Vendor Payment Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Disbursements</span>
                <h3 className="text-lg font-bold text-slate-900">Record Vendor Payment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordSubmit} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {formError}
                </div>
              )}

              {/* Vendor Selector */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Vendor / Supplier <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fetchPayments(true)}
                      disabled={refreshing}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition cursor-pointer disabled:opacity-50"
                      title="Reload vendor list from database"
                    >
                      <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                      <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
                    </button>
                    <span className="text-slate-300">•</span>
                    <Link
                      href="/purchases/vendors/new"
                      target="_blank"
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-800 underline decoration-slate-300 transition"
                    >
                      + Add New Vendor
                    </Link>
                  </div>
                </div>
                <select
                  required
                  value={formVendorId}
                  onChange={(e) => {
                    setFormVendorId(e.target.value);
                    setFormBillId("");
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                >
                  <option value="">-- Select Vendor --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                {vendors.length === 0 && !loading && !refreshing && (
                  <p className="text-xs text-amber-600 mt-1">
                    No vendors found. Please add a vendor in Vendor Master first.
                  </p>
                )}
              </div>

              {/* Linked Purchase Bill */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Settle Against Purchase Bill (Optional)
                </label>
                <select
                  value={formBillId}
                  onChange={(e) => handleBillChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                >
                  <option value="">On Account / Advance Payment</option>
                  {vendorBills.map((bill) => (
                    <option key={bill.id} value={bill.id}>
                      {bill.number} {bill.orderNumber ? `(PO: ${bill.orderNumber})` : ""} • Balance Due: ₹{bill.balanceDue.toLocaleString("en-IN")} (Total: ₹
                      {bill.total.toLocaleString("en-IN")})
                    </option>
                  ))}
                </select>
                {vendorBills.length === 0 && formVendorId && (
                  <p className="text-xs text-slate-400 mt-1">No pending bills found for this vendor. Payment will be credited on account.</p>
                )}
              </div>

              {/* Amount & Date - 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Amount Paid (INR) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-2 text-sm text-slate-400">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Payment Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Mode & Reference - 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Payment Mode <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formMode}
                    onChange={(e) => setFormMode(e.target.value as "Bank Transfer" | "UPI" | "Cash" | "Cheque" | "NEFT / RTGS")}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI Corporate</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Reference / UTR / Cheque #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFCN2629381920 or CHQ-004412"
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Notes (Internal Memo)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  placeholder="Additional remarks or disbursement notes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Vendor Voucher</span>
                <h3 className="text-lg font-bold text-slate-900">{selectedPayment.number}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Vendor</span>
                <span className="font-semibold text-slate-800">{selectedPayment.vendorName}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Date</span>
                <span className="font-semibold text-slate-800">
                  {new Date(selectedPayment.paymentDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Linked Purchase Bill</span>
                <span className="font-mono font-medium text-slate-800">{selectedPayment.billNumber}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Payment Mode</span>
                <span className="font-medium text-slate-800">{selectedPayment.paymentMode}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Reference / UTR#</span>
                <span className="font-mono text-slate-800">{selectedPayment.referenceNumber || "—"}</span>
              </div>

              {selectedPayment.notes && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Notes</span>
                  <span className="text-slate-700 max-w-[200px] text-right">{selectedPayment.notes}</span>
                </div>
              )}

              <div className="flex justify-between py-2 bg-blue-50 rounded-lg px-3 mt-2">
                <span className="font-semibold text-blue-900">Amount Disbursed</span>
                <span className="font-mono font-bold text-base text-blue-900">{formatINR(selectedPayment.amount)}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer"
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
