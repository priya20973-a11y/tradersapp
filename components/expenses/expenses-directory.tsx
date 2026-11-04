"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Edit2,
  Eye,
  Gauge,
  ListPlus,
  Paperclip,
  Plus,
  Receipt,
  Search,
  Trash2,
} from "lucide-react";

export interface ExpenseRecord {
  id: string;
  _id?: string;
  referenceNumber: string;
  expenseType: "standard" | "mileage" | "bulk";
  date: string;
  paidThrough: string;
  currency: string;
  vendor: string;
  invoiceNumber: string;
  customerName: string;
  notes: string;
  amount: number;
  status: "Paid" | "Unbilled" | "Reimbursable" | "Draft";
  billable: boolean;
  project?: string;
  reportingTags?: string[];
  items?: Array<{ expenseAccount: string; notes?: string; amount: number }>;
  mileageDetails?: {
    employee: string;
    distance: number;
    unit: string;
    rate: number;
  };
  receipts?: Array<{ id: string; name: string }>;
}

export function ExpensesDirectory() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "standard" | "mileage">("all");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchExpenses = () => {
    fetch("/api/expenses")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.expenses) {
          setExpenses(data.expenses);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense record?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        setExpenses((prev) => prev.filter((e) => e.id !== id && e._id !== id));
      }
    } catch {
      alert("Failed to delete expense");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchesType = typeFilter === "all" || e.expenseType === typeFilter;
      const matchesStatus =
        statusFilter === "ALL" || e.status.toLowerCase() === statusFilter.toLowerCase();
      const searchStr = search.toLowerCase();
      const accountName = e.items?.[0]?.expenseAccount || "";
      const employeeName = e.mileageDetails?.employee || "";
      const matchesSearch =
        !searchStr ||
        [e.vendor, e.customerName, e.notes, e.referenceNumber, accountName, employeeName]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(searchStr));

      return matchesType && matchesStatus && matchesSearch;
    });
  }, [expenses, typeFilter, statusFilter, search]);

  // KPI Metrics
  const totalAmount = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const mileageTotal = useMemo(() => {
    return expenses
      .filter((e) => e.expenseType === "mileage")
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const reimbursableTotal = useMemo(() => {
    return expenses
      .filter((e) => e.status === "Reimbursable")
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const billableCount = useMemo(() => {
    return expenses.filter((e) => e.billable).length;
  }, [expenses]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Purchases</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Expenses</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track business expenditures, vehicle mileage reimbursements, and client billable costs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/purchases/expenses/new?tab=bulk"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <ListPlus className="h-3.5 w-3.5 text-slate-500" />
            <span>Bulk Add</span>
          </Link>

          <Link
            href="/purchases/expenses/new?tab=mileage"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <Gauge className="h-3.5 w-3.5 text-emerald-600" />
            <span>Record Mileage</span>
          </Link>

          <Link
            href="/purchases/expenses/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Record Expense</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Expenses</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              ₹{totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {expenses.length} records
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mileage Travelled</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              ₹{mileageTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Reimbursed
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reimbursable Claims</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              ₹{reimbursableTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              Pending payout
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Billable To Client</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{billableCount}</span>
            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              Customer link
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                typeFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("standard")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                typeFilter === "standard" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("mileage")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                typeFilter === "mileage" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Mileage
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {/* Status Filter */}
          {["ALL", "Paid", "Reimbursable", "Unbilled"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === st
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {st === "ALL" ? "All Status" : st}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by vendor, account, customer..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-1.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Main Expenses Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-6 py-3.5">Date & Ref#</th>
              <th className="px-6 py-3.5">Expense Details</th>
              <th className="px-6 py-3.5">Party / Submitter</th>
              <th className="px-6 py-3.5">Paid Through</th>
              <th className="px-6 py-3.5">Amount</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Receipt className="h-8 w-8 text-slate-300" />
                    <span>No expenses found matching the filter criteria.</span>
                    <Link
                      href="/purchases/expenses/new"
                      className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Record a new expense
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              filteredExpenses.map((expense) => {
                const accountName = expense.items?.[0]?.expenseAccount || "General Operating Expense";
                const isMileage = expense.expenseType === "mileage";

                return (
                  <tr key={expense.id} className="hover:bg-slate-50/80 transition group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 font-mono text-xs">
                        {expense.referenceNumber || expense.id}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{expense.date}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-xs">{accountName}</span>
                        {isMileage && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.2 text-[10px] font-bold text-emerald-700">
                            <Gauge className="h-3 w-3" />
                            {expense.mileageDetails?.distance} {expense.mileageDetails?.unit || "KM"}
                          </span>
                        )}
                        {expense.receipts && expense.receipts.length > 0 && (
                          <span
                            className="inline-flex items-center text-slate-400"
                            title={`${expense.receipts.length} receipt(s) attached`}
                          >
                            <Paperclip className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      {expense.notes && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{expense.notes}</p>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-xs font-medium text-slate-800">
                        {isMileage
                          ? expense.mileageDetails?.employee || expense.vendor || "Employee"
                          : expense.vendor || "Direct Expense"}
                      </div>
                      {expense.customerName && (
                        <div className="text-[11px] text-blue-600 mt-0.5">
                          Customer: {expense.customerName}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-600">
                      {expense.paidThrough}
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900 text-sm">
                        ₹{Number(expense.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                      {expense.billable && (
                        <span className="block text-[10px] font-semibold text-blue-600 uppercase tracking-wide">
                          Billable
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          expense.status === "Paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : expense.status === "Reimbursable"
                            ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                            : "bg-amber-50 text-amber-700 border border-amber-200/60"
                        }`}
                      >
                        {expense.status === "Paid" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {expense.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/purchases/expenses/${expense.id}?mode=view`}
                          title="View details"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/purchases/expenses/${expense.id}?mode=edit`}
                          title="Edit expense"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(expense.id)}
                          disabled={deletingId === expense.id}
                          title="Delete expense"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
