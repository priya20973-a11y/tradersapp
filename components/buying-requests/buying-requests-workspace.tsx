"use client";

import { useState, useEffect } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Send,
  Edit,
  Ban,
  Tag,
  Calendar,
  MapPin,
  TrendingUp,
  RefreshCw,
  X,
  Check,
  Building,
  User,
  Phone,
  Mail,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  CheckCheck,
} from "lucide-react";

export interface BuyingRequestItem {
  id: string;
  requestId: string;
  commodity: string;
  requiredQuantity: number;
  unit: string;
  targetPrice: number | null;
  qualitySpecs: string;
  deliveryLocation: string;
  requiredDeliveryDate: string;
  description: string;
  status: "Pending" | "Approved" | "Open" | "In Progress" | "Closed" | "Offers Received" | "Accepted" | "Rejected" | "Fulfilled" | "Cancelled";
  offersCount: number;
  acceptedOfferId: string | null;
  buyerId: string;
  buyerName: string;
  buyerCompany: string;
  buyerEmail?: string;
  buyerPhone?: string;
  isMine: boolean;
  adminStatus?: "Pending" | "Approved";
  myOffer?: {
    id: string;
    offerId: string;
    offeredPrice: number;
    availableQuantity: number;
    deliveryTerms: string;
    status: "Pending" | "Accepted" | "Rejected" | "Withdrawn";
    createdAt: string;
  } | null;
  createdAt: string;
}

export interface OfferItem {
  id: string;
  offerId: string;
  sellerId: string;
  sellerName: string;
  sellerCompany: string;
  sellerEmail?: string;
  sellerPhone?: string;
  offeredPrice: number;
  availableQuantity: number;
  unit: string;
  deliveryTerms: string;
  validTill?: string | null;
  remarks?: string;
  status: "Pending" | "Accepted" | "Rejected" | "Withdrawn";
  createdAt: string;
}

export function BuyingRequestsWorkspace() {
  const [activeTab, setActiveTab] = useState<"all" | "my-requests" | "open-market" | "my-offers">("all");
  const [requests, setRequests] = useState<BuyingRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [commodityFilter, setCommodityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [availableCommodities, setAvailableCommodities] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: string; isAdmin: boolean } | null>(null);

  // Notifications
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editRequest, setEditRequest] = useState<BuyingRequestItem | null>(null);
  const [detailsRequest, setDetailsRequest] = useState<BuyingRequestItem | null>(null);
  const [offerModalRequest, setOfferModalRequest] = useState<BuyingRequestItem | null>(null);
  const [compareOffersRequest, setCompareOffersRequest] = useState<BuyingRequestItem | null>(null);
  const [requestOffers, setRequestOffers] = useState<OfferItem[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [cancelTargetRequest, setCancelTargetRequest] = useState<BuyingRequestItem | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState(() => ({
    commodity: "",
    requiredQuantity: "",
    unit: "MT",
    targetPrice: "",
    qualitySpecs: "",
    deliveryLocation: "",
    requiredDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    description: "",
    buyerCompany: "BharatGodam Foods",
    buyerPhone: "+91 98250 11223",
  }));
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    commodity: "",
    requiredQuantity: "",
    unit: "MT",
    targetPrice: "",
    qualitySpecs: "",
    deliveryLocation: "",
    requiredDeliveryDate: "",
    description: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Submit offer form state
  const [offerForm, setOfferForm] = useState(() => ({
    offeredPrice: "",
    availableQuantity: "",
    unit: "MT",
    deliveryTerms: "Ex-warehouse / Immediate dispatch upon order confirmation",
    validTill: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    remarks: "",
    sellerCompany: "Agro Traders Co.",
    sellerPhone: "+91 98765 43210",
  }));
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [actionProcessingOfferId, setActionProcessingOfferId] = useState<string | null>(null);

  const fetchRequests = async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: "10",
        view: activeTab,
      });
      if (search.trim()) params.set("search", search.trim());
      if (commodityFilter !== "all") params.set("commodity", commodityFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/buying-requests?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error || `Server error (${res.status})`);
      }
      const data = await res.json();
      setRequests(data.requests || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPage(data.page || 1);
      if (data.availableCommodities) setAvailableCommodities(data.availableCommodities);
      if (data.currentUser) setCurrentUser(data.currentUser);
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load requests. Please refresh.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const params = new URLSearchParams({
          page: "1",
          limit: "10",
          view: activeTab,
        });
        if (search.trim()) params.set("search", search.trim());
        if (commodityFilter !== "all") params.set("commodity", commodityFilter);
        if (statusFilter !== "all") params.set("status", statusFilter);

        const res = await fetch(`/api/buying-requests?${params.toString()}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(errData.error || `Server error (${res.status})`);
        }
        const data = await res.json();
        if (!active) return;
        setRequests(data.requests || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
        setPage(data.page || 1);
        if (data.availableCommodities) setAvailableCommodities(data.availableCommodities);
        if (data.currentUser) setCurrentUser(data.currentUser);
      } catch (err) {
        if (active) {
          console.error(err);
          setFeedback({
            type: "error",
            message: err instanceof Error ? err.message : "Failed to load requests. Please refresh.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [activeTab, commodityFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRequests(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Load offers for a request
  const openCompareOffers = async (req: BuyingRequestItem) => {
    setCompareOffersRequest(req);
    setOffersLoading(true);
    try {
      const res = await fetch(`/api/buying-requests/${req.id}`);
      if (!res.ok) throw new Error("Failed to fetch offers");
      const data = await res.json();
      setRequestOffers(data.offers || []);
    } catch {
      setFeedback({ type: "error", message: "Failed to load offers for this request." });
    } finally {
      setOffersLoading(false);
    }
  };

  // Handle Offer Accept / Reject
  const handleOfferDecision = async (offerId: string, action: "accept" | "reject") => {
    if (!compareOffersRequest) return;
    setActionProcessingOfferId(offerId);
    try {
      const res = await fetch(`/api/buying-requests/${compareOffersRequest.id}/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} offer`);
      setFeedback({ type: "success", message: data.message });

      // Refresh offers and request list
      openCompareOffers(compareOffersRequest);
      fetchRequests(page);
    } catch (err: unknown) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : `Failed to ${action} offer` });
    } finally {
      setActionProcessingOfferId(null);
    }
  };

  // Handle Offer Withdraw (Seller action)
  const handleWithdrawOffer = async (req: BuyingRequestItem) => {
    if (!req.myOffer) return;
    try {
      const res = await fetch(`/api/buying-requests/${req.id}/offers/${req.myOffer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to withdraw offer");
      setFeedback({ type: "success", message: data.message });
      fetchRequests(page);
    } catch (err: unknown) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to withdraw offer" });
    }
  };

  // Handle Create Request
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createSubmitting) return;
    setCreateSubmitting(true);
    setCreateModalError(null);
    try {
      const res = await fetch("/api/buying-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          requiredQuantity: Number(createForm.requiredQuantity),
          targetPrice: createForm.targetPrice ? Number(createForm.targetPrice) : null,
        }),
      });
      const data: {
        issues?: Array<{ message?: string }>;
        error?: string;
        requestId?: string;
      } = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg =
          data.issues && Array.isArray(data.issues) && data.issues.length > 0
            ? data.issues.map((issue) => issue.message || "").filter(Boolean).join(", ")
            : data.error || `Failed to create buying request (${res.status})`;
        throw new Error(errorMsg);
      }
      setFeedback({ type: "success", message: `Buying Request ${data.requestId} published successfully!` });
      setCreateModalOpen(false);
      setCreateModalError(null);
      setCreateForm({
        commodity: "",
        requiredQuantity: "",
        unit: "MT",
        targetPrice: "",
        qualitySpecs: "",
        deliveryLocation: "",
        requiredDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        description: "",
        buyerCompany: "BharatGodam Foods",
        buyerPhone: "+91 98250 11223",
      });
      fetchRequests(1);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create request";
      setCreateModalError(errorMsg);
      setFeedback({ type: "error", message: errorMsg });
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Handle Edit Request
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRequest) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/buying-requests/${editRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commodity: editForm.commodity,
          requiredQuantity: Number(editForm.requiredQuantity),
          unit: editForm.unit,
          targetPrice: editForm.targetPrice ? Number(editForm.targetPrice) : null,
          qualitySpecs: editForm.qualitySpecs,
          deliveryLocation: editForm.deliveryLocation,
          requiredDeliveryDate: editForm.requiredDeliveryDate,
          description: editForm.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update request");
      setFeedback({ type: "success", message: data.message });
      setEditRequest(null);
      fetchRequests(page);
    } catch (err: unknown) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to update request" });
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Cancel Request
  const handleCancelRequest = async (req: BuyingRequestItem) => {
    try {
      const res = await fetch(`/api/buying-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Cancelled" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel request");
      setFeedback({ type: "success", message: `Buying Request ${req.requestId} has been cancelled.` });
      setCancelTargetRequest(null);
      fetchRequests(page);
    } catch (err: unknown) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to cancel request" });
    }
  };

  // Handle Submit Offer
  const handleOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerModalRequest) return;
    setOfferSubmitting(true);
    try {
      const res = await fetch(`/api/buying-requests/${offerModalRequest.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeredPrice: Number(offerForm.offeredPrice),
          availableQuantity: Number(offerForm.availableQuantity),
          unit: offerForm.unit,
          deliveryTerms: offerForm.deliveryTerms,
          validTill: offerForm.validTill || undefined,
          remarks: offerForm.remarks,
          sellerCompany: offerForm.sellerCompany,
          sellerPhone: offerForm.sellerPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit offer");
      setFeedback({ type: "success", message: `Offer ${data.offerId} submitted to buyer successfully!` });
      setOfferModalRequest(null);
      setOfferForm({
        offeredPrice: "",
        availableQuantity: "",
        unit: "MT",
        deliveryTerms: "Ex-warehouse / Immediate dispatch upon order confirmation",
        validTill: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        remarks: "",
        sellerCompany: "Agro Traders Co.",
        sellerPhone: "+91 98765 43210",
      });
      fetchRequests(page);
    } catch (err: unknown) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to submit offer" });
    } finally {
      setOfferSubmitting(false);
    }
  };

  const getStatusBadge = (status: BuyingRequestItem["status"]) => {
    switch (status) {
      case "Pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
      case "Approved":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <ShieldCheck className="h-3 w-3" /> Approved
          </span>
        );
      case "Open":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
            <Clock className="h-3 w-3" /> Open
          </span>
        );
      case "In Progress":
      case "Offers Received":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
            <TrendingUp className="h-3 w-3" /> {status === "In Progress" ? "In Progress" : "In Progress (Offers Received)"}
          </span>
        );
      case "Accepted":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Accepted
          </span>
        );
      case "Closed":
      case "Fulfilled":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
            <CheckCheck className="h-3 w-3" /> {status === "Closed" ? "Closed" : "Closed (Fulfilled)"}
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
            <Ban className="h-3 w-3" /> Cancelled
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
            <XCircle className="h-3 w-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Buying Requests</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Procurement & Bidding
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Buyers post commodity procurement requirements. Sellers discover open demands and submit competitive offers.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => {
              setCreateModalError(null);
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            Create Buying Request
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
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
            {feedback.message.includes("sign in") && (
              <a
                href="/signin"
                className="ml-2 font-semibold underline hover:opacity-80"
              >
                Sign in now
              </a>
            )}
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="rounded p-1 hover:bg-black/5">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs Row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setActiveTab("all");
          }}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "all"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          All Requests
        </button>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setActiveTab("my-requests");
          }}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "my-requests"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <span>My Requests (Buyer)</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setActiveTab("open-market");
          }}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "open-market"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <span>Marketplace / Open Requests (Seller)</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setActiveTab("my-offers");
          }}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "my-offers"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <span>My Submitted Offers</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search request ID, commodity, location, buyer..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-2 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Commodity Dropdown */}
          <select
            value={commodityFilter}
            onChange={(e) => {
              setLoading(true);
              setCommodityFilter(e.target.value);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="all">All Commodities</option>
            {availableCommodities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setLoading(true);
              setStatusFilter(e.target.value);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Closed">Closed</option>
            <option value="Offers Received">Offers Received</option>
            <option value="Accepted">Accepted</option>
            <option value="Fulfilled">Fulfilled</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <button
            type="button"
            onClick={() => fetchRequests(page)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="h-5 w-48 rounded bg-slate-200" />
              <div className="h-4 w-72 rounded bg-slate-200" />
              <div className="h-10 w-full rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <ClipboardList className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">No buying requests found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            {activeTab === "my-requests"
              ? "You haven't posted any buying requests yet. Click 'Create Buying Request' to publish one."
              : activeTab === "my-offers"
              ? "You haven't submitted any offers yet. Check the 'Marketplace' tab to find open requests."
              : "No requests match the selected filters."}
          </p>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setCreateModalError(null);
                setCreateModalOpen(true);
              }}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create Buying Request
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                {/* Left Column: ID, Commodity, Quantity, Target Price */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {req.requestId}
                    </span>
                    {getStatusBadge(req.status)}
                    {req.adminStatus === "Approved" && req.status !== "Approved" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="h-3 w-3" /> Admin Approved
                      </span>
                    )}
                    {req.adminStatus === "Pending" && req.status !== "Pending" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                        <Clock className="h-3 w-3" /> Pending Approval
                      </span>
                    )}
                    {req.isMine && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                        My Request
                      </span>
                    )}
                    {req.offersCount > 0 && (
                      <button
                        type="button"
                        onClick={() => openCompareOffers(req)}
                        title="Click to view and compare offers"
                        className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200 hover:bg-amber-100 transition cursor-pointer"
                      >
                        {req.offersCount} {req.offersCount === 1 ? "Offer" : "Offers"} Received
                      </button>
                    )}
                    <span className="text-xs text-slate-400">
                      Posted on {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{req.commodity}</h3>
                    <p className="text-xs text-slate-500">
                      Posted by <span className="font-semibold text-slate-700">{req.buyerCompany}</span> ({req.buyerName})
                    </p>
                  </div>

                  {/* Highlights Bar */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl bg-slate-50 p-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Required Quantity</span>
                      <span className="font-bold text-slate-900">
                        {req.requiredQuantity} {req.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Target Price</span>
                      <span className="font-bold text-slate-900">
                        {req.targetPrice ? `₹${req.targetPrice.toLocaleString("en-IN")}/${req.unit}` : "Open to Bids"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Delivery By</span>
                      <span className="font-semibold text-slate-900 flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {new Date(req.requiredDeliveryDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Destination</span>
                      <span className="font-semibold text-slate-900 truncate block" title={req.deliveryLocation}>
                        {req.deliveryLocation}
                      </span>
                    </div>
                  </div>

                  {/* Quality Specs snippet */}
                  {req.qualitySpecs && (
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Specifications: </span>
                      {req.qualitySpecs}
                    </p>
                  )}

                  {/* If current user already submitted an offer */}
                  {req.myOffer && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-blue-900">Your Submitted Offer ({req.myOffer.offerId}): </span>
                        <span className="text-blue-800">
                          ₹{req.myOffer.offeredPrice.toLocaleString("en-IN")}/{req.unit} for {req.myOffer.availableQuantity} {req.unit}
                        </span>
                        <span className={`ml-2 font-semibold ${
                          req.myOffer.status === "Accepted"
                            ? "text-emerald-700"
                            : req.myOffer.status === "Rejected"
                            ? "text-rose-700"
                            : req.myOffer.status === "Withdrawn"
                            ? "text-slate-500"
                            : "text-amber-700"
                        }`}>
                          [{req.myOffer.status}]
                        </span>
                      </div>
                      {req.myOffer.status === "Pending" && (
                        <button
                          type="button"
                          onClick={() => handleWithdrawOffer(req)}
                          className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 font-semibold text-blue-700 hover:bg-blue-50 transition"
                        >
                          Withdraw Offer
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column: Actions */}
                <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end lg:justify-center">
                  <button
                    type="button"
                    onClick={() => setDetailsRequest(req)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-500" />
                    View Details
                  </button>

                  {/* Buyer & Admin Actions: View Offers, Edit, Cancel */}
                  {(req.isMine || currentUser?.isAdmin) && (
                    <>
                      {req.offersCount > 0 && (
                        <button
                          type="button"
                          onClick={() => openCompareOffers(req)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition shadow-sm"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          View Offers ({req.offersCount})
                        </button>
                      )}

                      {["Open", "Offers Received"].includes(req.status) && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditRequest(req);
                              setEditForm({
                                commodity: req.commodity,
                                requiredQuantity: String(req.requiredQuantity),
                                unit: req.unit,
                                targetPrice: req.targetPrice ? String(req.targetPrice) : "",
                                qualitySpecs: req.qualitySpecs || "",
                                deliveryLocation: req.deliveryLocation,
                                requiredDeliveryDate: new Date(req.requiredDeliveryDate).toISOString().split("T")[0],
                                description: req.description || "",
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            title="Edit Request"
                          >
                            <Edit className="h-3.5 w-3.5 text-slate-500" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancelTargetRequest(req)}
                            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
                            title="Cancel Request"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Seller Action: Submit Offer */}
                  {!req.isMine && ["Open", "Offers Received"].includes(req.status) && !req.myOffer && (
                    <button
                      type="button"
                      onClick={() => {
                        setOfferModalRequest(req);
                        setOfferForm((f) => ({
                          ...f,
                          unit: req.unit,
                          availableQuantity: String(req.requiredQuantity),
                          offeredPrice: req.targetPrice ? String(req.targetPrice) : "",
                        }));
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-sm"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Submit Offer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 rounded-2xl shadow-sm sm:px-6">
          <div className="text-xs text-slate-600">
            Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{pages}</span> (Total {total} requests)
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => fetchRequests(page - 1)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => fetchRequests(page + 1)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* CREATE BUYING REQUEST MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Buying Request</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Publish a procurement demand for suppliers and sellers to bid on
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateModalOpen(false);
                  setCreateModalError(null);
                }}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createModalError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-900 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{createModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Commodity *</label>
                  <input
                    type="text"
                    required
                    value={createForm.commodity}
                    onChange={(e) => setCreateForm({ ...createForm, commodity: e.target.value })}
                    placeholder="e.g. Sharbati Wheat"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={createForm.requiredQuantity}
                      onChange={(e) => setCreateForm({ ...createForm, requiredQuantity: e.target.value })}
                      placeholder="e.g. 100"
                      className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                    <select
                      value={createForm.unit}
                      onChange={(e) => setCreateForm({ ...createForm, unit: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500 bg-white"
                    >
                      <option value="MT">MT</option>
                      <option value="Quintal">Quintal</option>
                      <option value="Bags">Bags</option>
                      <option value="Kg">Kg</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Price (Optional, ₹/unit)</label>
                  <input
                    type="number"
                    value={createForm.targetPrice}
                    onChange={(e) => setCreateForm({ ...createForm, targetPrice: e.target.value })}
                    placeholder="e.g. 2800"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Required Delivery Date *</label>
                  <input
                    type="date"
                    required
                    value={createForm.requiredDeliveryDate}
                    onChange={(e) => setCreateForm({ ...createForm, requiredDeliveryDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery Location / Mandi *</label>
                <input
                  type="text"
                  required
                  value={createForm.deliveryLocation}
                  onChange={(e) => setCreateForm({ ...createForm, deliveryLocation: e.target.value })}
                  placeholder="e.g. Sanand Mandi Warehouse #4, Ahmedabad, Gujarat"
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quality Specifications</label>
                <textarea
                  rows={2}
                  value={createForm.qualitySpecs}
                  onChange={(e) => setCreateForm({ ...createForm, qualitySpecs: e.target.value })}
                  placeholder="Moisture < 12%, Foreign matter < 1%, Grain count, packing type..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Commercial Terms</label>
                <textarea
                  rows={2}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Payment upon weighing & lab report, unloading terms, split supply accepted..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setCreateModalError(null);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  aria-busy={createSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {createSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    "Publish Request"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BUYING REQUEST MODAL */}
      {editRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Buying Request {editRequest.requestId}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Update requirement specifications</p>
              </div>
              <button type="button" onClick={() => setEditRequest(null)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Commodity</label>
                  <input
                    type="text"
                    required
                    value={editForm.commodity}
                    onChange={(e) => setEditForm({ ...editForm, commodity: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={editForm.requiredQuantity}
                      onChange={(e) => setEditForm({ ...editForm, requiredQuantity: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                    <input
                      type="text"
                      value={editForm.unit}
                      onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Price</label>
                  <input
                    type="number"
                    value={editForm.targetPrice}
                    onChange={(e) => setEditForm({ ...editForm, targetPrice: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Required Delivery Date</label>
                  <input
                    type="date"
                    required
                    value={editForm.requiredDeliveryDate}
                    onChange={(e) => setEditForm({ ...editForm, requiredDeliveryDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery Location</label>
                <input
                  type="text"
                  required
                  value={editForm.deliveryLocation}
                  onChange={(e) => setEditForm({ ...editForm, deliveryLocation: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quality Specifications</label>
                <textarea
                  rows={2}
                  value={editForm.qualitySpecs}
                  onChange={(e) => setEditForm({ ...editForm, qualitySpecs: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditRequest(null)}
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
            </form>
          </div>
        </div>
      )}

      {/* SUBMIT OFFER MODAL */}
      {offerModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Submit Offer for {offerModalRequest.commodity}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Request {offerModalRequest.requestId} by {offerModalRequest.buyerCompany}
                </p>
              </div>
              <button type="button" onClick={() => setOfferModalRequest(null)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Request Summary Box */}
            <div className="rounded-2xl bg-slate-50 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Demanded Quantity:</span>
                <span className="font-bold text-slate-800">
                  {offerModalRequest.requiredQuantity} {offerModalRequest.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Buyer Target Price:</span>
                <span className="font-bold text-slate-800">
                  {offerModalRequest.targetPrice ? `₹${offerModalRequest.targetPrice}/${offerModalRequest.unit}` : "Open"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Delivery Location:</span>
                <span className="font-semibold text-slate-800">{offerModalRequest.deliveryLocation}</span>
              </div>
            </div>

            <form onSubmit={handleOfferSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Offered Price (₹/{offerModalRequest.unit}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={offerForm.offeredPrice}
                    onChange={(e) => setOfferForm({ ...offerForm, offeredPrice: e.target.value })}
                    placeholder="e.g. 2820"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Available Quantity ({offerModalRequest.unit}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={offerForm.availableQuantity}
                    onChange={(e) => setOfferForm({ ...offerForm, availableQuantity: e.target.value })}
                    placeholder="e.g. 100"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery Terms & Payment *</label>
                <input
                  type="text"
                  required
                  value={offerForm.deliveryTerms}
                  onChange={(e) => setOfferForm({ ...offerForm, deliveryTerms: e.target.value })}
                  placeholder="e.g. FOR destination / 100% on delivery / Ex-warehouse"
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Offer Valid Until</label>
                  <input
                    type="date"
                    value={offerForm.validTill}
                    onChange={(e) => setOfferForm({ ...offerForm, validTill: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={offerForm.sellerPhone}
                    onChange={(e) => setOfferForm({ ...offerForm, sellerPhone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks & Quality Guarantees</label>
                <textarea
                  rows={3}
                  value={offerForm.remarks}
                  onChange={(e) => setOfferForm({ ...offerForm, remarks: e.target.value })}
                  placeholder="Confirm lot specs, lab certificates available, dispatch ready date..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOfferModalRequest(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={offerSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {offerSubmitting ? "Submitting..." : "Send Offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW & COMPARE OFFERS MODAL (BUYER ACTION) */}
      {compareOffersRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {compareOffersRequest.requestId}
                  </span>
                  {getStatusBadge(compareOffersRequest.status)}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-1">
                  Offers Received for {compareOffersRequest.commodity}
                </h3>
                <p className="text-xs text-slate-500">
                  Target: {compareOffersRequest.requiredQuantity} {compareOffersRequest.unit} | Location: {compareOffersRequest.deliveryLocation}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompareOffersRequest(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {offersLoading ? (
              <div className="py-12 text-center text-sm text-slate-500">Loading offers...</div>
            ) : requestOffers.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No offers have been received for this request yet.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-500">
                  Review competitive bids from sellers. Accepting an offer will confirm the deal and reject all other pending offers.
                </div>

                {requestOffers.map((offer, idx) => {
                  const isAccepted = offer.status === "Accepted";
                  const isRejected = offer.status === "Rejected";
                  const isWithdrawn = offer.status === "Withdrawn";
                  const isPending = offer.status === "Pending";

                  return (
                    <div
                      key={offer.id}
                      className={`rounded-2xl border p-4 transition ${
                        isAccepted
                          ? "border-emerald-300 bg-emerald-50/50 shadow-sm"
                          : isRejected
                          ? "border-slate-200 bg-slate-50 opacity-60"
                          : "border-slate-200 bg-white hover:border-slate-300 shadow-sm"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {offer.offerId}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">{offer.sellerCompany}</span>
                            <span className="text-xs text-slate-500">({offer.sellerName})</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                isAccepted
                                  ? "bg-emerald-100 text-emerald-800"
                                  : isRejected
                                  ? "bg-rose-100 text-rose-800"
                                  : isWithdrawn
                                  ? "bg-slate-200 text-slate-600"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {offer.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-4 text-xs pt-1">
                            <div>
                              <span className="text-slate-400">Offered Price: </span>
                              <span className="font-bold text-emerald-700 text-sm">
                                ₹{offer.offeredPrice.toLocaleString("en-IN")}/{offer.unit}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Quantity: </span>
                              <span className="font-semibold text-slate-800">
                                {offer.availableQuantity} {offer.unit}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Delivery Terms: </span>
                              <span className="font-semibold text-slate-800">{offer.deliveryTerms}</span>
                            </div>
                            {offer.validTill && (
                              <div>
                                <span className="text-slate-400">Valid Till: </span>
                                <span className="text-slate-700">
                                  {new Date(offer.validTill).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>

                          {offer.remarks && (
                            <p className="text-xs text-slate-600 italic bg-white/70 p-2 rounded-lg border border-slate-100">
                              &ldquo;{offer.remarks}&rdquo;
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                            {offer.sellerPhone && <span>Phone: {offer.sellerPhone}</span>}
                            {offer.sellerEmail && <span>Email: {offer.sellerEmail}</span>}
                          </div>
                        </div>

                        {/* Accept / Reject actions */}
                        {isPending && compareOffersRequest.status !== "Accepted" && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={actionProcessingOfferId === offer.id}
                              onClick={() => handleOfferDecision(offer.id, "reject")}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              disabled={actionProcessingOfferId === offer.id}
                              onClick={() => handleOfferDecision(offer.id, "accept")}
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Accept Offer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCompareOffersRequest(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {detailsRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {detailsRequest.requestId}
                  </span>
                  {getStatusBadge(detailsRequest.status)}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{detailsRequest.commodity}</h3>
              </div>
              <button type="button" onClick={() => setDetailsRequest(null)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4">
                <div>
                  <span className="text-slate-400 block">Required Quantity</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {detailsRequest.requiredQuantity} {detailsRequest.unit}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Target Price</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {detailsRequest.targetPrice
                      ? `₹${detailsRequest.targetPrice.toLocaleString("en-IN")}/${detailsRequest.unit}`
                      : "Open to competitive offers"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Delivery Deadline</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(detailsRequest.requiredDeliveryDate).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Offers Received</span>
                  <span className="font-semibold text-slate-800">{detailsRequest.offersCount}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                <span className="text-slate-400 block">Delivery Location</span>
                <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                  {detailsRequest.deliveryLocation}
                </span>
              </div>

              {detailsRequest.qualitySpecs && (
                <div className="rounded-2xl border border-slate-200 p-4 space-y-1">
                  <span className="font-bold text-slate-900 block">Quality & Lab Specifications</span>
                  <p className="text-slate-700 leading-relaxed">{detailsRequest.qualitySpecs}</p>
                </div>
              )}

              {detailsRequest.description && (
                <div className="rounded-2xl border border-slate-200 p-4 space-y-1">
                  <span className="font-bold text-slate-900 block">Commercial Terms & Instructions</span>
                  <p className="text-slate-700 leading-relaxed">{detailsRequest.description}</p>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                <span className="font-bold text-slate-900 block">Buyer Details</span>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 block">Company</span>
                    <span className="font-semibold text-slate-900">{detailsRequest.buyerCompany}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Contact</span>
                    <span className="font-semibold text-slate-900">{detailsRequest.buyerName}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailsRequest(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL CONFIRMATION MODAL */}
      {cancelTargetRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="rounded-2xl bg-rose-100 p-2.5">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Cancel Buying Request?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel request <span className="font-bold">{cancelTargetRequest.requestId}</span> ({cancelTargetRequest.commodity})? All pending offers will be closed and suppliers will no longer be able to submit bids.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelTargetRequest(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep Request
              </button>
              <button
                type="button"
                onClick={() => handleCancelRequest(cancelTargetRequest)}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
