"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeft,
  BarChart3,
  Building2,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { getFinancialYear } from "@/lib/financial-year";


const navigation = [
  { href: "/banking", label: "Banking", icon: WalletCards },
  { href: "/accountant", label: "Accountant", icon: Calculator },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/organizations", label: "Admin Organizations", icon: Building2 },
  { href: "/admin/buying-requests", label: "Admin: Buying Requests", icon: ClipboardList },
];

const marketplaceNavigation = [
  { href: "/marketplace/traders", label: "Trader" },
  { href: "/marketplace/find-buyers", label: "Find Buyers" },
  { href: "/marketplace/buying-requests", label: "Buying Request" },
];

const purchasesNavigation = [
  { href: "/purchases/vendors", label: "Vendors" },
  { href: "/purchases/vendor-ledger", label: "Vendor Ledger" },
  { href: "/purchases/payments", label: "Payment" },
  { href: "/purchases/expenses", label: "Expenses" },
  { href: "/purchases/recurring-expenses", label: "Recurring Expenses" },
  { href: "/purchases/purchase-orders", label: "Purchase Orders" },
  { href: "/purchases/bills", label: "Bills" },
  { href: "/purchases/recurring-bills", label: "Recurring Bills" },
  { href: "/purchases/vendor-credits", label: "Vendor Credits" },
];

const salesNavigation = [
  { href: "/sales/customers", label: "Customers" },
  { href: "/sales/customer-ledger", label: "Customer Accounts" },
  { href: "/sales/payments", label: "Payment" },
  { href: "/sales/quotes", label: "Quotes" },
  { href: "/sales/orders", label: "Sales Orders" },
  { href: "/sales/invoices", label: "Invoices" },
  { href: "/sales/recurring-invoices", label: "Recurring Invoices" },
  { href: "/sales/delivery-challans", label: "Delivery Challans" },
  { href: "/sales/credit-notes", label: "Credit Notes" },
  { href: "/sales/warehouses", label: "Warehouses" },
  { href: "/sales/stock", label: "Stock Lots" },
];

export function AppShell({
  children,
  initialCollapsed = false,
}: {
  children: ReactNode;
  initialCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const financialYear = getFinancialYear();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialCollapsed);
  const [salesExpanded, setSalesExpanded] = useState(true);
  const [purchasesExpanded, setPurchasesExpanded] = useState(true);
  const [marketplaceExpanded, setMarketplaceExpanded] = useState(true);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [orgInitial, setOrgInitial] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        const orgName = data?.profile?.organizationName;
        if (orgName && typeof orgName === "string" && orgName.trim().length > 0) {
          setOrgInitial(orgName.trim().charAt(0).toUpperCase());
        }
        if (
          data?.isAdmin === true ||
          data?.profile?.isAdmin === true ||
          data?.profile?.role === "Super Admin" ||
          data?.profile?.id === "admin"
        ) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      })
      .catch(() => {});

    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((sessionData) => {
        if (!isMounted) return;
        if (sessionData?.user?.id === "admin" || sessionData?.user?.role === "Super Admin") {
          setIsAdmin(true);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const isNavigating = navigatingTo !== null && navigatingTo !== pathname;

  const handleNav = (targetHref: string) => {
    if (targetHref !== pathname) {
      setNavigatingTo(targetHref);
    }
  };

  const visibleNavigation = navigation.filter((item) => {
    if (item.href === "/admin/organizations" && !isAdmin) {
      return false;
    }
    if (item.href === "/admin/buying-requests" && !isAdmin) {
      return false;
    }
    return true;
  });

  if (pathname === "/signin" || pathname === "/signup" || pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen bg-slate-100 text-slate-900">
      {/* Top Route Progress Bar for Instant Visual Feedback */}
      {isNavigating && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden bg-slate-900/10">
          <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 animate-loading-bar" />
        </div>
      )}
      <div className="flex min-h-screen">
        <aside
          className={`hidden shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-950 text-slate-100 lg:flex lg:flex-col transition-all duration-300 ${
            sidebarCollapsed ? "w-20 p-2.5" : "w-72 p-4"
          }`}
          aria-label="Sidebar Navigation"
          data-collapsed={sidebarCollapsed ? "true" : "false"}
        >
          {/* BharatGodam Top Logo Header */}
          <div className="mb-4">
            {!sidebarCollapsed ? (
              <div className="flex items-center justify-between gap-2.5">
                <Link
                  href="/"
                  prefetch={true}
                  onClick={() => handleNav("/")}
                  className="group flex flex-1 items-center justify-center rounded-2xl bg-white px-2 py-2.5 shadow-sm transition hover:ring-2 hover:ring-emerald-500/50"
                  title="BharatGodam"
                  aria-label="BharatGodam Home"
                >
                  <Image
                    src="/bharatgodam-logo.jpg"
                    alt="BharatGodam Logo"
                    width={200}
                    height={90}
                    className="w-full h-auto max-w-full object-contain transition-transform group-hover:scale-[1.02]"
                    style={{ objectFit: "contain", aspectRatio: "1024 / 458" }}
                    priority
                  />
                </Link>
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Link
                  href="/"
                  prefetch={true}
                  onClick={() => handleNav("/")}
                  className="group flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1 shadow-sm transition hover:ring-2 hover:ring-emerald-500/50"
                  title="BharatGodam"
                  aria-label="BharatGodam Home"
                >
                  <Image
                    src="/bharatgodam-logo.jpg"
                    alt="BharatGodam Logo"
                    width={48}
                    height={48}
                    className="h-full w-full object-contain transition-transform group-hover:scale-105"
                    style={{ objectFit: "contain", aspectRatio: "1024 / 458" }}
                  />
                </Link>
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {/* Dashboard */}
            <Link
              href="/"
              prefetch={true}
              onClick={() => handleNav("/")}
              title={sidebarCollapsed ? "Dashboard" : undefined}
              className={`flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition ${
                sidebarCollapsed ? "justify-center px-2" : "px-3"
              } ${
                pathname === "/"
                  ? "bg-[#FF8C00] text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>Dashboard</span>}
            </Link>

            {/* Marketplace Module */}
            <div>
              <button
                type="button"
                onClick={() => setMarketplaceExpanded((expanded) => !expanded)}
                title={sidebarCollapsed ? "Marketplace" : undefined}
                aria-label={marketplaceExpanded ? "Collapse Marketplace menu" : "Expand Marketplace menu"}
                aria-expanded={marketplaceExpanded}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition cursor-pointer ${
                  pathname.startsWith("/marketplace") ||
                  pathname.startsWith("/find-buyers") ||
                  pathname.startsWith("/buying-requests") ||
                  pathname.startsWith("/sales/traders")
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Store className="h-4 w-4" />
                  {!sidebarCollapsed && <span>Marketplace</span>}
                </div>
                {!sidebarCollapsed && (
                  <ChevronDown className={`h-4 w-4 transition-transform ${marketplaceExpanded ? "rotate-180" : ""}`} />
                )}
              </button>
              {marketplaceExpanded && !sidebarCollapsed && (
                <div className="mt-1 space-y-1 pl-7">
                  {marketplaceNavigation.map(({ href, label }) => {
                    const isActive =
                      pathname === href ||
                      (href === "/marketplace/traders" &&
                        (pathname === "/sales/traders" ||
                          pathname.startsWith("/sales/traders/") ||
                          pathname.startsWith("/marketplace/traders/"))) ||
                      (href === "/marketplace/find-buyers" &&
                        (pathname === "/find-buyers" ||
                          pathname.startsWith("/find-buyers/") ||
                          pathname.startsWith("/marketplace/find-buyers/"))) ||
                      (href === "/marketplace/buying-requests" &&
                        (pathname === "/buying-requests" ||
                          pathname.startsWith("/buying-requests/") ||
                          pathname.startsWith("/marketplace/buying-requests/")));

                    const hasPlus =
                      href === "/marketplace/traders"
                        ? "/marketplace/traders?new=true"
                        : href === "/marketplace/buying-requests"
                        ? "/marketplace/buying-requests?new=true"
                        : null;

                    return (
                      <div
                        key={href}
                        className={`flex items-center rounded-lg transition ${
                          isActive
                            ? "bg-[#FF8C00] font-medium text-white shadow-sm"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <Link
                          href={href}
                          prefetch={true}
                          onClick={() => handleNav(href)}
                          className="flex-1 px-3 py-2 text-sm"
                        >
                          {label}
                        </Link>
                        {hasPlus && (
                          <Link
                            href={hasPlus}
                            prefetch={true}
                            onClick={() => handleNav(hasPlus)}
                            title={`New ${label}`}
                            aria-label={`New ${label}`}
                            className={`p-1.5 mr-1.5 rounded transition ${
                              isActive
                                ? "text-white/80 hover:text-white hover:bg-black/20"
                                : "text-slate-400 hover:text-white hover:bg-slate-700"
                            }`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Items */}
            <Link
              href="/items"
              prefetch={true}
              onClick={() => handleNav("/items")}
              title={sidebarCollapsed ? "Commodity" : undefined}
              className={`flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition ${
                sidebarCollapsed ? "justify-center px-2" : "px-3"
              } ${
                pathname === "/items" || pathname.startsWith("/items")
                  ? "bg-[#FF8C00] text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Package className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>Commodity</span>}
            </Link>

            {/* Sales Module */}
            <div>
              <button
                type="button"
                onClick={() => setSalesExpanded((expanded) => !expanded)}
                title={sidebarCollapsed ? "Sales" : undefined}
                aria-label={salesExpanded ? "Collapse Sales menu" : "Expand Sales menu"}
                aria-expanded={salesExpanded}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition cursor-pointer ${
                  pathname.startsWith("/sales")
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-4 w-4" />
                  {!sidebarCollapsed && <span>Sales</span>}
                </div>
                {!sidebarCollapsed && (
                  <ChevronDown className={`h-4 w-4 transition-transform ${salesExpanded ? "rotate-180" : ""}`} />
                )}
              </button>
              {salesExpanded && !sidebarCollapsed && (
                <div className="mt-1 space-y-1 pl-7">
                  {salesNavigation.map(({ href, label }) => {
                    const isActive =
                      pathname === href ||
                      (href === "/sales/customers" && pathname.startsWith("/sales/customers/")) ||
                      (href === "/sales/quotes" && pathname.startsWith("/sales/quotes/")) ||
                      (href === "/sales/orders" && pathname.startsWith("/sales/orders")) ||
                      (href === "/sales/delivery-challans" && pathname.startsWith("/sales/delivery-challans")) ||
                      (href === "/sales/warehouses" && pathname.startsWith("/sales/warehouses")) ||
                      (href === "/sales/payments" && (pathname.startsWith("/sales/payments") || pathname.startsWith("/sales/payments-received"))) ||
                      (href === "/sales/invoices" && (pathname.startsWith("/sales/invoices") || pathname.startsWith("/invoices")));

                    const hasPlus =
                      href === "/sales/orders"
                        ? "/sales/orders/new"
                        : href === "/sales/quotes"
                        ? "/sales/quotes/new"
                        : href === "/sales/delivery-challans"
                        ? "/sales/delivery-challans/new"
                        : href === "/sales/customers"
                        ? "/sales/customers/new"
                        : href === "/sales/invoices"
                        ? "/sales/invoices/new"
                        : href === "/sales/payments"
                        ? "/sales/payments?new=true"
                        : null;

                    return (
                      <div
                        key={href}
                        className={`flex items-center rounded-lg transition ${
                          isActive
                            ? "bg-[#FF8C00] font-medium text-white shadow-sm"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <Link
                          href={href}
                          prefetch={true}
                          onClick={() => handleNav(href)}
                          className="flex-1 px-3 py-2 text-sm"
                        >
                          {label}
                        </Link>
                        {hasPlus && (
                          <Link
                            href={hasPlus}
                            prefetch={true}
                            onClick={() => handleNav(hasPlus)}
                            title={`New ${label.replace(/s$/, "")}`}
                            className={`p-1.5 mr-1.5 rounded transition ${
                              isActive
                                ? "text-white/80 hover:text-white hover:bg-black/20"
                                : "text-slate-400 hover:text-white hover:bg-slate-700"
                            }`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Purchases Module */}
            <div>
              <button
                type="button"
                onClick={() => setPurchasesExpanded((expanded) => !expanded)}
                title={sidebarCollapsed ? "Purchases" : undefined}
                aria-label={purchasesExpanded ? "Collapse Purchases menu" : "Expand Purchases menu"}
                aria-expanded={purchasesExpanded}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition cursor-pointer ${
                  pathname.startsWith("/purchases") || pathname.startsWith("/vendors")
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag className="h-4 w-4" />
                  {!sidebarCollapsed && <span>Purchases</span>}
                </div>
                {!sidebarCollapsed && (
                  <ChevronDown className={`h-4 w-4 transition-transform ${purchasesExpanded ? "rotate-180" : ""}`} />
                )}
              </button>
              {purchasesExpanded && !sidebarCollapsed && (
                <div className="mt-1 space-y-1 pl-7">
                  {/* Previous active style: bg-blue-600 font-medium text-white shadow-sm hover:bg-blue-500 */}
                  {purchasesNavigation.map(({ href, label }) => {
                    const isActive =
                      pathname === href ||
                      (href === "/purchases/vendors" &&
                        (pathname === "/vendors" ||
                          pathname.startsWith("/vendors/") ||
                          pathname.startsWith("/purchases/vendors/"))) ||
                      (href === "/purchases/expenses" &&
                        (pathname === "/expenses" ||
                          pathname.startsWith("/expenses/") ||
                          pathname.startsWith("/purchases/expenses/"))) ||
                      (href === "/purchases/purchase-orders" &&
                        pathname.startsWith("/purchases/purchase-orders")) ||
                      (href === "/purchases/bills" &&
                        pathname.startsWith("/purchases/bills")) ||
                      (href === "/purchases/payments" &&
                        (pathname.startsWith("/purchases/payments") || pathname.startsWith("/purchases/payments-made"))) ||
                      (href !== "/purchases/vendors" &&
                        href !== "/purchases/expenses" &&
                        href !== "/purchases/purchase-orders" &&
                        href !== "/purchases/bills" &&
                        href !== "/purchases/payments" &&
                        pathname.startsWith(href));

                    const plusHref =
                      href === "/purchases/vendors"
                        ? "/purchases/vendors/new"
                        : href === "/purchases/expenses"
                        ? "/purchases/expenses/new"
                        : href === "/purchases/purchase-orders"
                        ? "/purchases/purchase-orders/new"
                        : href === "/purchases/recurring-expenses"
                        ? "/purchases/recurring-expenses/new"
                        : href === "/purchases/bills"
                        ? "/purchases/bills/new"
                        : href === "/purchases/recurring-bills"
                        ? "/purchases/recurring-bills/new"
                        : href === "/purchases/vendor-credits"
                        ? "/purchases/vendor-credits/new"
                        : href === "/purchases/payments"
                        ? "/purchases/payments?new=true"
                        : `${href}?new=true`;

                    return (
                      <div
                        key={href}
                        className={`flex items-center rounded-lg transition ${
                          isActive
                            ? "bg-[#FF8C00] font-medium text-white shadow-sm"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <Link
                          href={href}
                          prefetch={true}
                          onClick={() => handleNav(href)}
                          className="flex-1 px-3 py-2 text-sm"
                        >
                          {label}
                        </Link>
                        {isActive && (
                          <Link
                            href={plusHref}
                            prefetch={true}
                            onClick={() => handleNav(plusHref)}
                            title={`New ${label.replace(/s$/, "")}`}
                            aria-label={`New ${label.replace(/s$/, "")}`}
                            className="p-1.5 mr-1.5 rounded transition text-white/80 hover:text-white hover:bg-black/20"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Other Navigation */}
            {visibleNavigation.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch={true}
                  onClick={() => handleNav(href)}
                  title={sidebarCollapsed ? label : undefined}
                  className={`flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition ${
                    sidebarCollapsed ? "justify-center px-2" : "px-3"
                  } ${
                    isActive
                      ? "bg-[#FF8C00] text-white shadow-sm"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span>{label}</span>}
                </Link>
              );
            })}
          </div>

          <div
            className={`mt-auto rounded-2xl border border-slate-800 bg-slate-900 transition-all ${
              sidebarCollapsed ? "p-2.5 flex justify-center" : "p-4"
            }`}
            title={`Finance year ${financialYear}`}
          >
            {!sidebarCollapsed ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Finance year</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-semibold">{financialYear}</span>
                  <Building2 className="h-4 w-4 text-emerald-300" />
                </div>
              </>
            ) : (
              <Building2 className="h-5 w-5 text-emerald-300" />
            )}
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
                    BharatGodam 
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
                  {/* Financial year indicator (previously hardcoded FY 2026-27, now dynamically calculated) */}
                  <span className="hidden text-sm font-medium text-slate-700 sm:inline">FY {financialYear}</span>
                </div>
                <Link
                  href="/profile"
                  prefetch={true}
                  onClick={() => handleNav("/profile")}
                  title="Profile"
                  aria-label="Profile"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white transition hover:ring-2 hover:ring-emerald-500 hover:ring-offset-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  {orgInitial || "SA"}
                </Link>
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
