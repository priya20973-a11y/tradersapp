"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  ExternalLink,
  Edit2,
  Eye,
} from "lucide-react";
import { vendors as defaultVendors } from "@/lib/demo-data";

type Vendor = {
  id: string;
  _id?: string;
  name: string;
  displayName?: string;
  email: string;
  balance: number;
  status: string;
  phone?: string;
  category?: string;
};

const initialVendors: Vendor[] = [
  ...defaultVendors.map((v) => ({
    ...v,
    phone: "+91 98201 44521",
    category: "Packaging & Goods",
  })),
  {
    id: "V-404",
    name: "Kaveri Agro Industries",
    email: "sales@kaveriagro.com",
    balance: 34500,
    status: "Active",
    phone: "+91 98450 11234",
    category: "Raw Commodities",
  },
  {
    id: "V-405",
    name: "Apex Freight Solutions",
    email: "billing@apexfreight.in",
    balance: 0,
    status: "Active",
    phone: "+91 97110 99882",
    category: "Logistics",
  },
];

export function VendorsDirectory() {
  const [vendorsList, setVendorsList] = useState<Vendor[]>(initialVendors);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    let mounted = true;
    fetch("/api/vendors")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.vendors?.length) return;
        setVendorsList(
          data.vendors.map((v: Record<string, unknown>) => ({
            id: String(v.id || v._id),
            _id: String(v._id || v.id),
            name: String(v.displayName || v.name),
            email: String(v.email || ""),
            balance: Number(v.openingBalance || v.balance || 0),
            status: String(v.status || "Active"),
            phone: String(v.workPhone || v.phone || v.mobile || ""),
            category: String(v.category || "General Purchases"),
          })),
        );
      })
      .catch(() => {
        // Fallback to initialVendors on network error
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredVendors = useMemo(() => {
    return vendorsList.filter((v) => {
      const matchesSearch =
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.email.toLowerCase().includes(search.toLowerCase()) ||
        v.id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || v.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [vendorsList, search, statusFilter]);

  const totalOutstanding = useMemo(() => {
    return vendorsList.reduce((sum, v) => sum + v.balance, 0);
  }, [vendorsList]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Purchases</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Vendors</h2>
        </div>
        <Link
          href="/purchases/vendors/new"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition"
        >
          <Plus className="h-4 w-4" />
          Add vendor
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Vendors</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{vendorsList.length}</span>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {vendorsList.filter((v) => v.status === "Active").length} Active
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Outstanding</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              ₹{totalOutstanding.toLocaleString("en-IN")}
            </span>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Payable</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Approvals</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              {vendorsList.filter((v) => v.status === "Pending").length}
            </span>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">KYC review</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "Active", "Pending"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === status
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {status === "ALL" ? "All Vendors" : status}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors by name, ID or email..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-1.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Vendors Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-6 py-3.5">Vendor</th>
              <th className="px-6 py-3.5">Contact Details</th>
              <th className="px-6 py-3.5">Category</th>
              <th className="px-6 py-3.5">Outstanding Balance</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
            {filteredVendors.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No vendors found matching your filter criteria.
                </td>
              </tr>
            ) : (
              filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-slate-50/80 transition group">
                  <td className="px-6 py-4">
                    <Link
                      href={`/purchases/vendors/${vendor.id}`}
                      className="font-semibold text-slate-900 hover:text-blue-600 transition flex items-center gap-1.5"
                    >
                      <span>{vendor.name}</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-blue-500 transition" />
                    </Link>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{vendor.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      {vendor.email || "—"}
                    </div>
                    {vendor.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {vendor.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-600">
                    {vendor.category || "General"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-900">
                      ₹{vendor.balance.toLocaleString("en-IN")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                        vendor.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                          : "bg-amber-50 text-amber-700 border border-amber-200/50"
                      }`}
                    >
                      {vendor.status === "Active" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {vendor.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/purchases/vendors/${vendor.id}?mode=view`}
                        title="View details"
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/purchases/vendors/${vendor.id}?mode=edit`}
                        title="Edit vendor"
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
