"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeft,
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Calculator,
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  Search,
  Settings,
  ShoppingCart,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { signOut } from "next-auth/react";
import { useState } from "react";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/banking", label: "Banking", icon: WalletCards },
  { href: "/vendors", label: "Vendors", icon: BriefcaseBusiness },
  { href: "/items", label: "Items & Inventory", icon: Package },
  { href: "/accountant", label: "Accountant", icon: Calculator },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin/organizations", label: "Admin Organizations", icon: Building2 },
];

const salesNavigation = [
  { href: "/sales/customers", label: "Customers" },
  { href: "/sales/quotes", label: "Quotes" },
  { href: "/sales/orders", label: "Sales Orders" },
  { href: "/sales/invoices", label: "Invoices" },
  { href: "/sales/recurring-invoices", label: "Recurring Invoices" },
  { href: "/sales/delivery-challans", label: "Delivery Challans" },
  { href: "/sales/payments-received", label: "Payments Received" },
  { href: "/sales/credit-notes", label: "Credit Notes" },
  { href: "/sales/traders", label: "Traders" },
  { href: "/sales/commodities", label: "Commodities" },
  { href: "/sales/deals", label: "Commodity Deals" },
  { href: "/sales/warehouses", label: "Warehouses" },
  { href: "/sales/stock", label: "Stock Lots" },
  { href: "/sales/ledger", label: "Trader Ledger & Payments" },
  { href: "/sales/reports", label: "Trading Reports" },
  { href: "/sales/audit", label: "Trading Audit Log" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [salesExpanded, setSalesExpanded] = useState(true);

  if (pathname === "/signin" || pathname === "/signup" || pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-950 p-4 text-slate-100 lg:flex lg:flex-col">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <BadgeDollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">FinanceOS</p>
              <h1 className="text-lg font-semibold">LedgerFlow</h1>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <div
                className={`flex items-center rounded-xl transition ${
                  pathname.startsWith("/sales")
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Link
                  href="/sales"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Sales
                </Link>
                <button
                  type="button"
                  aria-label={salesExpanded ? "Collapse Sales menu" : "Expand Sales menu"}
                  aria-expanded={salesExpanded}
                  onClick={() => setSalesExpanded((expanded) => !expanded)}
                  className="rounded-r-xl px-3 py-2 hover:bg-slate-700"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${salesExpanded ? "rotate-180" : ""}`} />
                </button>
              </div>
              {salesExpanded && (
                <div className="mt-1 space-y-1 pl-7">
                  {salesNavigation.map(({ href, label }) => {
                    const isActive =
                      pathname === href || (href === "/sales/customers" && pathname.startsWith("/sales/customers/"));
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`block rounded-lg px-3 py-2 text-sm transition ${
                          isActive
                            ? "bg-emerald-500 font-medium text-slate-950"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            {navigation.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Finance year</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-lg font-semibold">2026-27</span>
              <Building2 className="h-4 w-4 text-emerald-300" />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white/85 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg border border-slate-200 p-2 lg:hidden">
                  <FolderKanban className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Organization</p>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    BharatGodam Foods
                    <ArrowRightLeft className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="flex flex-1 items-center justify-end gap-3">
                <div className="hidden min-w-[240px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input
                    aria-label="Search"
                    placeholder="Search transactions, customers..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                  <ReceiptText className="h-4 w-4 text-slate-600" />
                  <span className="hidden text-sm font-medium text-slate-700 sm:inline">FY 2026-27</span>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  SA
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/signin" })}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
