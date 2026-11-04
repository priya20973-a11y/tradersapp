"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Search,
  Filter,
  Bookmark,
  BookmarkCheck,
  Phone,
  Mail,
  MapPin,
  Building2,
  ShieldCheck,
  Star,
  MessageSquare,
  Plus,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
} from "lucide-react";

export interface BuyerItem {
  id: string;
  buyerCode: string;
  companyName: string;
  contactPerson: string;
  designation: string;
  email: string;
  phone: string;
  whatsapp: string;
  city: string;
  state: string;
  businessType: string;
  commodities: string[];
  annualVolume: string;
  minQuantity: number;
  maxQuantity: number;
  unit: string;
  paymentTerms: string;
  gstin: string;
  verified: boolean;
  rating: number;
  status?: "Active" | "Inactive" | string;
  description: string;
  yearEstablished: number | null;
  isSaved: boolean;
  createdAt?: string;
}

export function BuyerDirectory() {
  const [buyers, setBuyers] = useState<BuyerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filter state
  const [search, setSearch] = useState("");
  const [selectedCommodity, setSelectedCommodity] = useState("all");
  const [selectedState, setSelectedState] = useState("all");
  const [selectedBusinessType, setSelectedBusinessType] = useState("all");
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);

  // Available filter options from backend
  const [availableCommodities, setAvailableCommodities] = useState<string[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableBusinessTypes, setAvailableBusinessTypes] = useState<string[]>([]);

  // Modals state
  const [profileModalBuyer, setProfileModalBuyer] = useState<BuyerItem | null>(null);
  const [contactModalBuyer, setContactModalBuyer] = useState<BuyerItem | null>(null);
  const [newBuyerModalOpen, setNewBuyerModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canAddBuyer, setCanAddBuyer] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    subject: "",
    message: "",
    offeredCommodity: "",
    proposedQuantity: "",
    proposedPrice: "",
    senderPhone: "",
    senderEmail: "",
  });
  const [contactSubmitting, setContactSubmitting] = useState(false);

  // New buyer form state
  const [newBuyerForm, setNewBuyerForm] = useState({
    companyName: "",
    contactPerson: "",
    designation: "Procurement Manager",
    email: "",
    phone: "",
    city: "",
    state: "",
    businessType: "Wholesaler",
    commodities: "",
    annualVolume: "1,000 MT",
    minQuantity: "10",
    maxQuantity: "100",
    unit: "MT",
    paymentTerms: "Immediate RTGS upon delivery",
    gstin: "",
    description: "",
  });
  const [newBuyerSubmitting, setNewBuyerSubmitting] = useState(false);

  // Edit buyer form state (Admin only)
  const [editModalBuyer, setEditModalBuyer] = useState<BuyerItem | null>(null);
  const [editForm, setEditForm] = useState({
    companyName: "",
    contactPerson: "",
    designation: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    businessType: "Wholesaler",
    commodities: "",
    annualVolume: "",
    minQuantity: "0",
    maxQuantity: "0",
    unit: "MT",
    paymentTerms: "",
    gstin: "",
    status: "Active" as "Active" | "Inactive",
    description: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchBuyers = async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: "12",
      });
      if (search.trim()) params.set("search", search.trim());
      if (selectedCommodity !== "all") params.set("commodity", selectedCommodity);
      if (selectedState !== "all") params.set("state", selectedState);
      if (selectedBusinessType !== "all") params.set("businessType", selectedBusinessType);
      if (minQty) params.set("minQuantity", minQty);
      if (maxQty) params.set("maxQuantity", maxQty);
      if (savedOnly) params.set("savedOnly", "true");

      const res = await fetch(`/api/buyers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load buyers");
      const data = await res.json();
      setBuyers(data.buyers || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPage(data.page || 1);
      if (data.availableCommodities) setAvailableCommodities(data.availableCommodities);
      if (data.availableStates) setAvailableStates(data.availableStates);
      if (data.availableBusinessTypes) setAvailableBusinessTypes(data.availableBusinessTypes);
      // Create buyer functionality in marketplace is only for admin (Admin login).
      // Regular user login accounts can only view buyers and buyer details.
      const isSystemAdmin = Boolean(
        data.currentUser?.id === "admin" ||
        data.currentUser?.role === "Super Admin" ||
        data.currentUser?.isSystemAdmin ||
        data.currentUser?.isPlatformAdmin
      );
      setIsAdmin(isSystemAdmin);
      setCanAddBuyer(isSystemAdmin);
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to load buyers directory. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBuyers(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedCommodity, selectedState, selectedBusinessType, minQty, maxQty, savedOnly]);

  const toggleSaveBuyer = async (buyer: BuyerItem) => {
    setSavingId(buyer.id);
    try {
      const res = await fetch(`/api/buyers/${buyer.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to save buyer");
      const data = await res.json();
      setBuyers((prev) =>
        prev.map((b) => (b.id === buyer.id ? { ...b, isSaved: data.isSaved } : b)),
      );
      setFeedback({
        type: "success",
        message: data.isSaved
          ? `Added ${buyer.companyName} to saved buyers`
          : `Removed ${buyer.companyName} from saved buyers`,
      });
    } catch {
      setFeedback({ type: "error", message: "Failed to update saved status" });
    } finally {
      setSavingId(null);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactModalBuyer) return;
    setContactSubmitting(true);
    try {
      const res = await fetch(`/api/buyers/${contactModalBuyer.id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contactForm,
          proposedQuantity: contactForm.proposedQuantity ? Number(contactForm.proposedQuantity) : undefined,
          proposedPrice: contactForm.proposedPrice ? Number(contactForm.proposedPrice) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");
      setFeedback({ type: "success", message: data.message });
      setContactModalBuyer(null);
      setContactForm({
        subject: "",
        message: "",
        offeredCommodity: "",
        proposedQuantity: "",
        proposedPrice: "",
        senderPhone: "",
        senderEmail: "",
      });
    } catch (err: unknown) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to contact buyer" });
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleNewBuyerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddBuyer) {
      setFeedback({ type: "error", message: "Forbidden: Only administrators can add new buyers." });
      setNewBuyerModalOpen(false);
      return;
    }
    setNewBuyerSubmitting(true);
    try {
      const commodityList = newBuyerForm.commodities
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await fetch("/api/buyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newBuyerForm,
          commodities: commodityList.length > 0 ? commodityList : ["General Produce"],
          minQuantity: Number(newBuyerForm.minQuantity) || 0,
          maxQuantity: Number(newBuyerForm.maxQuantity) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create buyer profile");
      setFeedback({ type: "success", message: "New buyer profile added successfully!" });
      setNewBuyerModalOpen(false);
      setNewBuyerForm({
        companyName: "",
        contactPerson: "",
        designation: "Procurement Manager",
        email: "",
        phone: "",
        city: "",
        state: "",
        businessType: "Wholesaler",
        commodities: "",
        annualVolume: "1,000 MT",
        minQuantity: "10",
        maxQuantity: "100",
        unit: "MT",
        paymentTerms: "Immediate RTGS upon delivery",
        gstin: "",
        description: "",
      });
      fetchBuyers(1);
    } catch (err: unknown) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to create buyer" });
    } finally {
      setNewBuyerSubmitting(false);
    }
  };

  const openEditModal = (buyer: BuyerItem) => {
    if (!isAdmin) return;
    setEditModalBuyer(buyer);
    setEditForm({
      companyName: buyer.companyName,
      contactPerson: buyer.contactPerson,
      designation: buyer.designation || "",
      email: buyer.email || "",
      phone: buyer.phone || "",
      city: buyer.city,
      state: buyer.state,
      businessType: buyer.businessType || "Wholesaler",
      commodities: (buyer.commodities || []).join(", "),
      annualVolume: buyer.annualVolume || "",
      minQuantity: String(buyer.minQuantity ?? 0),
      maxQuantity: String(buyer.maxQuantity ?? 0),
      unit: buyer.unit || "MT",
      paymentTerms: buyer.paymentTerms || "",
      gstin: buyer.gstin || "",
      status: (buyer.status as "Active" | "Inactive") || "Active",
      description: buyer.description || "",
    });
  };

  const handleEditBuyerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editModalBuyer) {
      setFeedback({ type: "error", message: "Forbidden: Only administrators can edit buyers." });
      setEditModalBuyer(null);
      return;
    }
    setEditSubmitting(true);
    try {
      const commodityList = editForm.commodities
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await fetch(`/api/buyers/${editModalBuyer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          commodities: commodityList.length > 0 ? commodityList : ["General Produce"],
          minQuantity: Number(editForm.minQuantity) || 0,
          maxQuantity: Number(editForm.maxQuantity) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update buyer");
      setFeedback({ type: "success", message: "Buyer profile updated successfully!" });
      setEditModalBuyer(null);
      if (profileModalBuyer?.id === editModalBuyer.id && data.buyer) {
        setProfileModalBuyer({ ...profileModalBuyer, ...data.buyer });
      }
      fetchBuyers(page);
    } catch (err: unknown) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to update buyer" });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteBuyer = async (buyerId: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Are you sure you want to remove this buyer profile? This action cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/buyers/${buyerId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete buyer");
      setFeedback({ type: "success", message: "Buyer profile deleted successfully" });
      setEditModalBuyer(null);
      setProfileModalBuyer(null);
      fetchBuyers(page);
    } catch (err: unknown) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to delete buyer" });
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedCommodity("all");
    setSelectedState("all");
    setSelectedBusinessType("all");
    setMinQty("");
    setMaxQty("");
    setSavedOnly(false);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    selectedCommodity !== "all" ||
    selectedState !== "all" ||
    selectedBusinessType !== "all" ||
    minQty !== "" ||
    maxQty !== "" ||
    savedOnly;

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Find Buyers</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Verified Directory
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Discover verified commodity buyers, food processors, and grain millers across India.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSavedOnly(!savedOnly)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition shadow-sm ${
              savedOnly
                ? "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {savedOnly ? <BookmarkCheck className="h-4 w-4 text-amber-600" /> : <Bookmark className="h-4 w-4 text-slate-500" />}
            <span>{savedOnly ? "Showing Saved" : "Saved Buyers"}</span>
          </button>
          {canAddBuyer && (
            <button
              type="button"
              id="add-buyer-button"
              onClick={() => setNewBuyerModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              Add Buyer Profile
            </button>
          )}
        </div>
      </div>

      {/* Notification Toast */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 text-sm shadow-sm transition ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="rounded p-1 hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Buyers</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{total}</p>
          <p className="mt-1 text-xs text-slate-500">Active purchasing profiles</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Commodities</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{availableCommodities.length || 8}</p>
          <p className="mt-1 text-xs text-slate-500">Across major grain & spice categories</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">States Covered</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">{availableStates.length || 6}</p>
          <p className="mt-1 text-xs text-slate-500">Pan-India distribution</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Verified Rate</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">100%</p>
          <p className="mt-1 text-xs text-slate-500">KYC & GST verified traders</p>
        </div>
      </div>

      {/* Filter and Search Box */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Main search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company name, contact person, commodity, city, or code..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchBuyers(page)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-100 transition"
              >
                <X className="h-4 w-4" />
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Detailed Filters row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 pt-2 border-t border-slate-100">
          {/* Commodity Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Commodity</label>
            <select
              value={selectedCommodity}
              onChange={(e) => setSelectedCommodity(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value="all">All Commodities</option>
              {availableCommodities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Location / State Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">State / Region</label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value="all">All States</option>
              {availableStates.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Business Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Business Type</label>
            <select
              value={selectedBusinessType}
              onChange={(e) => setSelectedBusinessType(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value="all">All Business Types</option>
              {availableBusinessTypes.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Min Quantity */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Min Qty (MT)</label>
            <input
              type="number"
              placeholder="e.g. 25"
              value={minQty}
              onChange={(e) => setMinQty(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-emerald-500"
            />
          </div>

          {/* Max Quantity */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Max Qty (MT)</label>
            <input
              type="number"
              placeholder="e.g. 500"
              value={maxQty}
              onChange={(e) => setMaxQty(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="h-4 w-12 rounded bg-slate-200" />
              </div>
              <div className="h-6 w-3/4 rounded bg-slate-200" />
              <div className="h-4 w-1/2 rounded bg-slate-200" />
              <div className="flex gap-2 pt-2">
                <div className="h-5 w-16 rounded-full bg-slate-200" />
                <div className="h-5 w-16 rounded-full bg-slate-200" />
              </div>
              <div className="h-10 w-full rounded-xl bg-slate-200" />
            </div>
          ))}
        </div>
      ) : buyers.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Search className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">No buyers found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? "No buyers match your selected filter criteria. Try clearing some filters or searching with a different term."
              : "No buyer profiles exist yet in this directory."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear All Filters
              </button>
            )}
            {canAddBuyer && (
              <button
                type="button"
                id="add-first-buyer-button"
                onClick={() => setNewBuyerModalOpen(true)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Add First Buyer
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Buyer Cards Grid */
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {buyers.map((buyer) => (
            <div
              key={buyer.id}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200"
            >
              <div>
                {/* Header row: Code, Business Type & Save Bookmark */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      {buyer.buyerCode}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {buyer.businessType}
                    </span>
                    {buyer.verified && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        Verified
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSaveBuyer(buyer)}
                    disabled={savingId === buyer.id}
                    title={buyer.isSaved ? "Saved to your list (click to remove)" : "Save buyer profile"}
                    className={`rounded-xl p-2 transition ${
                      buyer.isSaved
                        ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    }`}
                  >
                    {buyer.isSaved ? (
                      <BookmarkCheck className="h-4 w-4 fill-amber-500 text-amber-600" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Company Name & Location */}
                <div className="mt-3">
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition">
                    {buyer.companyName}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>
                      {buyer.city}, {buyer.state}
                    </span>
                  </div>
                </div>

                {/* Contact Person */}
                <div className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{buyer.contactPerson}</span>
                    {buyer.designation && <span className="text-slate-400">{buyer.designation}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {buyer.phone}
                    </span>
                    {buyer.email && (
                      <span className="inline-flex items-center gap-1 truncate max-w-[150px]">
                        <Mail className="h-3 w-3" />
                        {buyer.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Commodities of Interest */}
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Commodities of Interest
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {buyer.commodities.map((item) => (
                      <span
                        key={item}
                        className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-100"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Quantity Capacity / Requirement */}
                {(buyer.minQuantity > 0 || buyer.maxQuantity > 0) && (
                  <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-100 pt-2.5">
                    <span className="text-slate-500">Procurement Range:</span>
                    <span className="font-semibold text-slate-800">
                      {buyer.minQuantity} - {buyer.maxQuantity} {buyer.unit}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className={`mt-5 grid ${isAdmin ? "grid-cols-3" : "grid-cols-2"} gap-2 pt-3 border-t border-slate-100`}>
                <button
                  type="button"
                  onClick={() => setProfileModalBuyer(buyer)}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                  <span className="truncate">View</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    id={`edit-buyer-${buyer.id}`}
                    onClick={() => openEditModal(buyer)}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition shadow-sm"
                  >
                    <Pencil className="h-3.5 w-3.5 text-amber-600" />
                    <span className="truncate">Edit</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setContactModalBuyer(buyer);
                    setContactForm((f) => ({
                      ...f,
                      subject: `Commodity Supply Offer for ${buyer.companyName}`,
                      offeredCommodity: buyer.commodities[0] || "",
                    }));
                  }}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-2 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition shadow-sm"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="truncate">Contact</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 rounded-2xl shadow-sm sm:px-6">
          <div className="text-xs text-slate-600">
            Showing Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{pages}</span> (Total {total} buyers)
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => fetchBuyers(page - 1)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => fetchBuyers(page + 1)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* VIEW PROFILE MODAL */}
      {profileModalBuyer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {profileModalBuyer.buyerCode}
                  </span>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {profileModalBuyer.businessType}
                  </span>
                  {profileModalBuyer.verified && (
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      Verified Buyer
                    </span>
                  )}
                </div>
                <h2 className="mt-1.5 text-xl font-bold text-slate-900">
                  {profileModalBuyer.companyName}
                </h2>
                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {profileModalBuyer.city}, {profileModalBuyer.state}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalBuyer(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="space-y-4 text-sm">
              {profileModalBuyer.description && (
                <div className="rounded-2xl bg-slate-50 p-4 text-slate-700 text-xs leading-relaxed">
                  <p className="font-semibold text-slate-900 mb-1">Company Overview</p>
                  {profileModalBuyer.description}
                </div>
              )}

              {/* Commodities */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Commodities of Interest
                </h4>
                <div className="flex flex-wrap gap-2">
                  {profileModalBuyer.commodities.map((c) => (
                    <span
                      key={c}
                      className="rounded-xl bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Specifications grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 rounded-2xl border border-slate-200 p-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Typical Order Size</span>
                  <span className="font-semibold text-slate-900">
                    {profileModalBuyer.minQuantity} - {profileModalBuyer.maxQuantity} {profileModalBuyer.unit}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Annual Volume</span>
                  <span className="font-semibold text-slate-900">
                    {profileModalBuyer.annualVolume || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Payment Terms</span>
                  <span className="font-semibold text-slate-900">
                    {profileModalBuyer.paymentTerms || "Standard Net"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">GSTIN</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {profileModalBuyer.gstin || "Available on verification"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Year Established</span>
                  <span className="font-semibold text-slate-900">
                    {profileModalBuyer.yearEstablished || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Buyer Rating</span>
                  <span className="font-semibold text-amber-600 flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    {profileModalBuyer.rating} / 5.0
                  </span>
                </div>
              </div>

              {/* Contact Information */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Direct Contact Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Contact Person</span>
                    <span className="font-semibold text-slate-900">
                      {profileModalBuyer.contactPerson} ({profileModalBuyer.designation || "Executive"})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Phone / Mobile</span>
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      {profileModalBuyer.phone}
                    </span>
                  </div>
                  {profileModalBuyer.email && (
                    <div>
                      <span className="text-slate-400 block">Email Address</span>
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-blue-600" />
                        {profileModalBuyer.email}
                      </span>
                    </div>
                  )}
                  {profileModalBuyer.whatsapp && (
                    <div>
                      <span className="text-slate-400 block">WhatsApp</span>
                      <span className="font-semibold text-slate-900">
                        {profileModalBuyer.whatsapp}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => toggleSaveBuyer(profileModalBuyer)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                  profileModalBuyer.isSaved
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {profileModalBuyer.isSaved ? (
                  <BookmarkCheck className="h-4 w-4 fill-amber-500 text-amber-600" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
                {profileModalBuyer.isSaved ? "Saved" : "Save Profile"}
              </button>
              <div className="flex gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const b = profileModalBuyer;
                      setProfileModalBuyer(null);
                      openEditModal(b);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
                  >
                    <Pencil className="h-3.5 w-3.5 text-amber-600" />
                    Edit Profile
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setProfileModalBuyer(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const buyer = profileModalBuyer;
                    setProfileModalBuyer(null);
                    setContactModalBuyer(buyer);
                    setContactForm((f) => ({
                      ...f,
                      subject: `Supply Offer for ${buyer.companyName}`,
                      offeredCommodity: buyer.commodities[0] || "",
                    }));
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Contact Buyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTACT BUYER MODAL */}
      {contactModalBuyer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Contact {contactModalBuyer.companyName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Attn: {contactModalBuyer.contactPerson} ({contactModalBuyer.city}, {contactModalBuyer.state})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContactModalBuyer(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  placeholder="e.g. Ready stock of 100 MT Sharbati Wheat"
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Offered Commodity</label>
                  <input
                    type="text"
                    value={contactForm.offeredCommodity}
                    onChange={(e) => setContactForm({ ...contactForm, offeredCommodity: e.target.value })}
                    placeholder="e.g. Basmati Rice"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Available Qty (MT)</label>
                  <input
                    type="number"
                    value={contactForm.proposedQuantity}
                    onChange={(e) => setContactForm({ ...contactForm, proposedQuantity: e.target.value })}
                    placeholder="e.g. 50"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Indicative Price (₹/MT)</label>
                  <input
                    type="number"
                    value={contactForm.proposedPrice}
                    onChange={(e) => setContactForm({ ...contactForm, proposedPrice: e.target.value })}
                    placeholder="e.g. 2800"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Your Mobile Number</label>
                  <input
                    type="tel"
                    value={contactForm.senderPhone}
                    onChange={(e) => setContactForm({ ...contactForm, senderPhone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Your Message / Trade Terms *</label>
                <textarea
                  rows={4}
                  required
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="Detail your supply capabilities, quality specifications, current stock location, and delivery schedule..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setContactModalBuyer(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contactSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {contactSubmitting ? "Sending..." : "Send Inquiry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD BUYER PROFILE MODAL */}
      {newBuyerModalOpen && canAddBuyer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add New Buyer Profile</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Publish a verified buyer profile to the directory
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewBuyerModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleNewBuyerSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Trade Name *</label>
                  <input
                    type="text"
                    required
                    value={newBuyerForm.companyName}
                    onChange={(e) => setNewBuyerForm({ ...newBuyerForm, companyName: e.target.value })}
                    placeholder="e.g. Navrang Flour Mills"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Business Type *</label>
                  <select
                    value={newBuyerForm.businessType}
                    onChange={(e) => setNewBuyerForm({ ...newBuyerForm, businessType: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500 bg-white"
                  >
                    <option value="Processor / Miller">Processor / Miller</option>
                    <option value="Wholesaler">Wholesaler</option>
                    <option value="Exporter">Exporter</option>
                    <option value="Cooperative">Cooperative</option>
                    <option value="Retailer">Retailer</option>
                    <option value="Private Limited">Private Limited</option>
                    <option value="LLP">LLP</option>
                    <option value="Proprietorship">Proprietorship</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    value={newBuyerForm.contactPerson}
                    onChange={(e) => setNewBuyerForm({ ...newBuyerForm, contactPerson: e.target.value })}
                    placeholder="e.g. Anand Shah"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={newBuyerForm.designation}
                    onChange={(e) => setNewBuyerForm({ ...newBuyerForm, designation: e.target.value })}
                    placeholder="e.g. Purchase Manager"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={newBuyerForm.phone}
                    onChange={(e) => setNewBuyerForm({ ...newBuyerForm, phone: e.target.value })}
                    placeholder="+91 98250 12345"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newBuyerForm.email}
                    onChange={(e) => setNewBuyerForm({ ...newBuyerForm, email: e.target.value })}
                    placeholder="purchase@navrang.com"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={newBuyerForm.city}
                    onChange={(e) => setNewBuyerForm({ ...newBuyerForm, city: e.target.value })}
                    placeholder="e.g. Ahmedabad"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={newBuyerForm.state}
                    onChange={(e) => setNewBuyerForm({ ...newBuyerForm, state: e.target.value })}
                    placeholder="e.g. Gujarat"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Commodities of Interest (comma separated) *
                </label>
                <input
                  type="text"
                  required
                  value={newBuyerForm.commodities}
                  onChange={(e) => setNewBuyerForm({ ...newBuyerForm, commodities: e.target.value })}
                  placeholder="e.g. Wheat, Basmati Rice, Cumin Seeds"
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min Qty (MT)</label>
                  <input
                    type="number"
                    value={newBuyerForm.minQuantity}
                    onChange={(e) => setNewBuyerForm({ ...newBuyerForm, minQuantity: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Qty (MT)</label>
                  <input
                    type="number"
                    value={newBuyerForm.maxQuantity}
                    onChange={(e) => setNewBuyerForm({ ...newBuyerForm, maxQuantity: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={newBuyerForm.gstin}
                    onChange={(e) => setNewBuyerForm({ ...newBuyerForm, gstin: e.target.value.toUpperCase() })}
                    placeholder="24AAACK1234A1Z5"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={newBuyerForm.description}
                  onChange={(e) => setNewBuyerForm({ ...newBuyerForm, description: e.target.value })}
                  placeholder="Additional information about purchasing criteria and facility location..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewBuyerModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newBuyerSubmitting}
                  className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {newBuyerSubmitting ? "Saving..." : "Create Buyer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* EDIT BUYER PROFILE MODAL (Admin Only) */}
      {editModalBuyer && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">Edit Buyer Profile</h3>
                  <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {editModalBuyer.buyerCode}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update company information and procurement criteria
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalBuyer(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditBuyerSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Trade Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.companyName}
                    onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Business Type *</label>
                  <select
                    value={editForm.businessType}
                    onChange={(e) => setEditForm({ ...editForm, businessType: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500 bg-white"
                  >
                    <option value="Processor / Miller">Processor / Miller</option>
                    <option value="Wholesaler">Wholesaler</option>
                    <option value="Exporter">Exporter</option>
                    <option value="Cooperative">Cooperative</option>
                    <option value="Retailer">Retailer</option>
                    <option value="Private Limited">Private Limited</option>
                    <option value="LLP">LLP</option>
                    <option value="Proprietorship">Proprietorship</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    value={editForm.contactPerson}
                    onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={editForm.designation}
                    onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={editForm.state}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as "Active" | "Inactive" })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Commodities of Interest (comma separated) *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.commodities}
                  onChange={(e) => setEditForm({ ...editForm, commodities: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min Qty (MT)</label>
                  <input
                    type="number"
                    value={editForm.minQuantity}
                    onChange={(e) => setEditForm({ ...editForm, minQuantity: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Qty (MT)</label>
                  <input
                    type="number"
                    value={editForm.maxQuantity}
                    onChange={(e) => setEditForm({ ...editForm, maxQuantity: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={editForm.gstin}
                    onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => handleDeleteBuyer(editModalBuyer.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  {deleting ? "Deleting..." : "Delete Profile"}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditModalBuyer(null)}
                    className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {editSubmitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
