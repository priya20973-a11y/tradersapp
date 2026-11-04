"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { generatePaymentsCsv } from "@/lib/ledger-utils";

interface PaymentItem {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  referenceNumber: string;
  notes: string;
  status: string;
}

interface UnpaidInvoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
}

interface RelatedSalesOrder {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  orderDate?: string;
}

type PaymentMode = "Bank Transfer" | "UPI" | "Cash" | "Cheque" | "Credit Card";
type PaymentDatePreset = "all" | "month" | "custom";

function isPaymentMode(value: string): value is PaymentMode {
  return value === "Bank Transfer" || value === "UPI" || value === "Cash" ||
    value === "Cheque" || value === "Credit Card";
}

export function CustomerPaymentsDirectory() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [salesOrders, setSalesOrders] = useState<RelatedSalesOrder[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [metrics, setMetrics] = useState({
    totalReceived: 0,
    receivedThisMonth: 0,
    transactionCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [datePreset, setDatePreset] = useState<PaymentDatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals
  const [showRecordModal, setShowRecordModal] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("action") === "new" || Boolean(params.get("customerId"));
    }
    return false;
  });
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);

  // Form State
  const [formCustomerId, setFormCustomerId] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("customerId") || "";
    }
    return "";
  });
  const [formOrderId, setFormOrderId] = useState("");
  const [formInvoiceId, setFormInvoiceId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formMode, setFormMode] = useState<PaymentMode>("Bank Transfer");
  const [formReference, setFormReference] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCustomerSelect = async (newCustomerId: string) => {
    setFormCustomerId(newCustomerId);
    setFormOrderId("");
    setFormInvoiceId("");
    if (!newCustomerId) return;

    setLoadingOrders(true);
    try {
      const res = await fetch(`/api/sales/payments?customerId=${encodeURIComponent(newCustomerId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.salesOrders)) {
          setSalesOrders((prev) => {
            const existingMap = new Map(prev.map((o) => [o.id, o]));
            for (const o of data.salesOrders) {
              existingMap.set(o.id, o);
            }
            return Array.from(existingMap.values());
          });
        }
        if (Array.isArray(data.unpaidInvoices)) {
          setUnpaidInvoices((prev) => {
            const existingMap = new Map(prev.map((i) => [i.id, i]));
            for (const i of data.unpaidInvoices) {
              existingMap.set(i.id, i);
            }
            return Array.from(existingMap.values());
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch customer sales orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const cid = params.get("customerId");
      if (cid) {
        void (async () => {
          try {
            const res = await fetch(`/api/sales/payments?customerId=${encodeURIComponent(cid)}`);
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.salesOrders)) {
                setSalesOrders((prev) => {
                  const existingMap = new Map(prev.map((o) => [o.id, o]));
                  for (const o of data.salesOrders) {
                    existingMap.set(o.id, o);
                  }
                  return Array.from(existingMap.values());
                });
              }
              if (Array.isArray(data.unpaidInvoices)) {
                setUnpaidInvoices((prev) => {
                  const existingMap = new Map(prev.map((i) => [i.id, i]));
                  for (const i of data.unpaidInvoices) {
                    existingMap.set(i.id, i);
                  }
                  return Array.from(existingMap.values());
                });
              }
            }
          } catch (err) {
            console.error("Failed to fetch customer sales orders:", err);
          }
        })();
      }
    }
  }, []);

  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;
    const loadPayments = async () => {
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

        const [payRes, salesRes] = await Promise.allSettled([
          fetch(`/api/sales/payments?${queryParams.toString()}`),
          fetch("/api/sales"),
        ]);

        if (!active) return;

        let payData: {
          payments?: PaymentItem[];
          customers?: { id?: string; _id?: string; name?: string; companyName?: string }[];
          unpaidInvoices?: UnpaidInvoice[];
          salesOrders?: RelatedSalesOrder[];
          metrics?: typeof metrics;
        } | null = null;

        if (payRes.status === "fulfilled" && payRes.value.ok) {
          payData = await payRes.value.json();
          if (!active) return;
          setPayments(payData?.payments || []);
          setUnpaidInvoices(payData?.unpaidInvoices || []);
          setSalesOrders(payData?.salesOrders || []);
          if (payData?.metrics) setMetrics(payData.metrics);
        } else if (payRes.status === "fulfilled" && !payRes.value.ok) {
          throw new Error("Failed to load customer payments.");
        }

        const nameToId = new Map<string, string>();
        const idToName = new Map<string, string>();

        const addCustomer = (id: string, name: string) => {
          const cleanId = String(id || "").trim();
          const cleanName = String(name || "").trim();
          if (!cleanId || !cleanName) return;

          const normName = cleanName.toLowerCase();
          const existingId = nameToId.get(normName);

          if (existingId) {
            if (existingId.startsWith("demo-") && !cleanId.startsWith("demo-")) {
              idToName.delete(existingId);
              nameToId.set(normName, cleanId);
              idToName.set(cleanId, cleanName);
            }
            return;
          }

          nameToId.set(normName, cleanId);
          idToName.set(cleanId, cleanName);
        };

        // 1. From Customer Module (/api/sales)
        if (salesRes.status === "fulfilled" && salesRes.value.ok) {
          const sData = await salesRes.value.json().catch(() => null);
          if (Array.isArray(sData?.customers)) {
            for (const c of sData.customers) {
              const cId = String(c.id || c._id || "").trim();
              const cName = String(c.name || c.companyName || "").trim();
              if (cId && cName) {
                addCustomer(cId, cName);
              }
            }
          }
        }

        // 2. From Payments route (/api/sales/payments)
        if (payData && Array.isArray(payData.customers)) {
          for (const c of payData.customers) {
            const cId = String(c.id || c._id || "").trim();
            const cName = String(c.name || c.companyName || "").trim();
            if (cId && cName) {
              addCustomer(cId, cName);
            }
          }
        }

        // 3. From sales orders & unpaid invoices
        if (payData && Array.isArray(payData.salesOrders)) {
          for (const so of payData.salesOrders) {
            const cId = String(so.customerId || "").trim();
            const cName = String(so.customerName || "").trim();
            if (cId && cName) {
              addCustomer(cId, cName);
            }
          }
        }
        if (payData && Array.isArray(payData.unpaidInvoices)) {
          for (const inv of payData.unpaidInvoices) {
            const cId = String(inv.customerId || "").trim();
            const cName = String(inv.customerName || "").trim();
            if (cId && cName) {
              addCustomer(cId, cName);
            }
          }
        }

        let combinedCustomers = Array.from(idToName.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));

        const hasRealCustomers = combinedCustomers.some((c) => !c.id.startsWith("demo-"));
        if (hasRealCustomers) {
          combinedCustomers = combinedCustomers.filter((c) => !c.id.startsWith("demo-"));
        }

        if (!active) return;
        setCustomers(combinedCustomers);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load payments.");
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void loadPayments();
    return () => {
      active = false;
    };
  }, [searchTerm, modeFilter, datePreset, startDate, endDate, refreshIndex]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshIndex((prev) => prev + 1);
  }, []);

  // When customer changes in form, reset or auto-fill orders / invoices
  const customerOrders = useMemo(() => {
    if (!formCustomerId) return [];
    const selectedCustomer = customers.find((c) => c.id === formCustomerId);
    return salesOrders.filter((so) => {
      if (so.customerId === formCustomerId) return true;
      if (
        selectedCustomer &&
        so.customerName &&
        selectedCustomer.name &&
        so.customerName.trim().toLowerCase() === selectedCustomer.name.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });
  }, [salesOrders, formCustomerId, customers]);

  const customerInvoices = useMemo(() => {
    if (!formCustomerId) return [];
    const selectedCustomer = customers.find((c) => c.id === formCustomerId);
    return unpaidInvoices.filter((inv) => {
      if (inv.customerId === formCustomerId) return true;
      if (
        selectedCustomer &&
        inv.customerName &&
        selectedCustomer.name &&
        inv.customerName.trim().toLowerCase() === selectedCustomer.name.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });
  }, [unpaidInvoices, formCustomerId, customers]);

  const handleOrderChange = (orderId: string) => {
    setFormOrderId(orderId);
    setFormInvoiceId("");
    if (orderId) {
      const order = customerOrders.find((o) => o.id === orderId);
      if (order) {
        setFormAmount(String(order.balanceDue));
      }
    }
  };

  const handleInvoiceChange = (invId: string) => {
    setFormInvoiceId(invId);
    setFormOrderId("");
    if (invId) {
      const inv = customerInvoices.find((i) => i.id === invId);
      if (inv) {
        setFormAmount(String(inv.balanceDue));
      }
    }
  };

  const handleRecordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amountNum = Number(formAmount);
    if (!formCustomerId) {
      setFormError("Please select a customer.");
      return;
    }
    if (!amountNum || amountNum <= 0) {
      setFormError("Please enter a valid payment amount greater than zero.");
      return;
    }

    if (formOrderId) {
      const order = customerOrders.find((o) => o.id === formOrderId);
      if (order && amountNum > order.balanceDue + 0.05) {
        setFormError(`Payment cannot exceed sales order outstanding balance of ₹${order.balanceDue}.`);
        return;
      }
    } else if (formInvoiceId) {
      const inv = customerInvoices.find((i) => i.id === formInvoiceId);
      if (inv && amountNum > inv.balanceDue + 0.05) {
        setFormError(`Payment cannot exceed invoice outstanding balance of ₹${inv.balanceDue}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/sales/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formCustomerId,
          salesOrderId: formOrderId || undefined,
          invoiceId: formInvoiceId || undefined,
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

      setNotice(`Payment ${data.payment.number} of ₹${amountNum.toLocaleString("en-IN")} recorded successfully.`);
      setShowRecordModal(false);
      // Reset form
      setFormAmount("");
      setFormOrderId("");
      setFormInvoiceId("");
      setFormReference("");
      setFormNotes("");
      handleRefresh();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to submit payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    const csvData = generatePaymentsCsv(
      "Customer Payments",
      payments.map((p) => ({
        date: p.paymentDate,
        number: p.number,
        partyName: p.customerName,
        linkedDoc: p.invoiceNumber,
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
    link.setAttribute("download", `customer-payments-${new Date().toISOString().split("T")[0]}.csv`);
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
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Sales</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Payments Received</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">Customer Payments</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record customer collections, bank receipts, UPI/cheque settlements, and invoice reconciliations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
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
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Collections</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{formatINR(metrics.totalReceived)}</p>
          <p className="text-xs text-slate-400 mt-1">Cumulative payments received</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Received This Month</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{formatINR(metrics.receivedThisMonth)}</p>
          <p className="text-xs text-emerald-600/70 mt-1">Cleared in current month</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Receipts Count</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{metrics.transactionCount} Receipts</p>
          <p className="text-xs text-slate-400 mt-1">All processed transactions</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search receipt#, customer, UTR, invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
            {(["all", "Bank Transfer", "UPI", "Cheque", "Cash"] as const).map((m) => (
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
            onChange={(e) => {
              const value = e.target.value;
              if (value === "all" || value === "month" || value === "custom") {
                setDatePreset(value);
              }
            }}
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
            <p className="text-sm font-medium">Loading customer payments…</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">{error}</div>
        ) : payments.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-base font-semibold text-slate-700">No customer payments recorded</p>
            <p className="text-xs text-slate-400 mt-1">Click &ldquo;Record Payment&rdquo; to record a receipt from a customer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Receipt#</th>
                  <th className="px-4 py-3.5">Customer Name</th>
                  <th className="px-4 py-3.5">Invoice Ref</th>
                  <th className="px-4 py-3.5">Payment Mode</th>
                  <th className="px-4 py-3.5">Ref / UTR#</th>
                  <th className="px-4 py-3.5 text-right">Amount Received</th>
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
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{p.customerName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {p.invoiceNumber || "On Account"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-slate-700">{p.paymentMode}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {p.referenceNumber || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold text-emerald-700 whitespace-nowrap">
                      {formatINR(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
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

      {/* Record Payment Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Sales Collections</span>
                <h3 className="text-lg font-bold text-slate-900">Record Customer Payment</h3>
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

              {/* Customer Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Customer <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formCustomerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {customers.length === 0 && !loading && !refreshing && (
                  <p className="text-xs text-amber-600 mt-1">
                    No customers found. Please add a customer in Customer module first.
                  </p>
                )}
              </div>

              {/* Linked Sales Order / Invoice Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Settle Against Sales Order / Invoice (Optional)
                </label>
                <select
                  value={formOrderId ? `order:${formOrderId}` : formInvoiceId ? `inv:${formInvoiceId}` : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith("order:")) {
                      handleOrderChange(val.replace("order:", ""));
                    } else if (val.startsWith("inv:")) {
                      handleInvoiceChange(val.replace("inv:", ""));
                    } else {
                      setFormOrderId("");
                      setFormInvoiceId("");
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                >
                  <option value="">On Account / Unallocated Payment</option>
                  {customerOrders.length > 0 && (
                    <optgroup label="Sales Orders">
                      {customerOrders.map((so) => (
                        <option key={so.id} value={`order:${so.id}`}>
                          {so.number} • Balance Due: ₹{so.balanceDue.toLocaleString("en-IN")} (Total: ₹
                          {so.total.toLocaleString("en-IN")})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {customerInvoices.length > 0 && (
                    <optgroup label="Invoices">
                      {customerInvoices.map((inv) => (
                        <option key={inv.id} value={`inv:${inv.id}`}>
                          {inv.number} • Balance Due: ₹{inv.balanceDue.toLocaleString("en-IN")} (Total: ₹
                          {inv.total.toLocaleString("en-IN")})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {loadingOrders && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching related sales orders...
                  </p>
                )}
                {!loadingOrders && customerOrders.length === 0 && customerInvoices.length === 0 && formCustomerId && (
                  <p className="text-xs text-slate-400 mt-1">
                    No sales orders or invoices found for this customer. Payment will be credited on account.
                  </p>
                )}
              </div>

              {/* Amount & Date - 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Amount (INR) <span className="text-rose-500">*</span>
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
                    onChange={(e) => {
                      if (isPaymentMode(e.target.value)) setFormMode(e.target.value);
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                  >
                    <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit / Debit Card</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Reference / UTR / Cheque #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFCN2628109 or CHQ-00124"
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
                  placeholder="Additional remarks or payment details..."
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
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Payment Receipt</span>
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
                <span className="text-slate-500">Customer</span>
                <span className="font-semibold text-slate-800">{selectedPayment.customerName}</span>
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
                <span className="text-slate-500">Linked Invoice</span>
                <span className="font-mono font-medium text-slate-800">{selectedPayment.invoiceNumber}</span>
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

              <div className="flex justify-between py-2 bg-emerald-50 rounded-lg px-3 mt-2">
                <span className="font-semibold text-emerald-800">Amount Received</span>
                <span className="font-mono font-bold text-base text-emerald-800">{formatINR(selectedPayment.amount)}</span>
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
