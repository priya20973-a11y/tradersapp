"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Edit2,
  ExternalLink,
  FileCheck,
  FileText,
  History,
  Mail,
  MapPin,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Plus,
  Printer,
  Receipt,
  Search,
  Send,
  TrendingUp,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calculateCustomerReceivable,
  currency,
  getAvatarColor,
  getInitials,
  type Customer,
  type SalesDocument,
} from "./customer-types";
import { CustomerEditModal } from "./customer-edit-modal";

type DetailTab = "Overview" | "Comments" | "Transactions" | "Mails" | "Statement";
type IncomePeriod = "this_fiscal_year" | "prev_fiscal_year" | "last_6_months" | "this_month";
type CustomerListFilter = "All" | "Active" | "Inactive" | "Receivables";
type CustomerComment = { text: string; author?: string; createdAt?: string };

const subscribeToMount = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

function isCustomerListFilter(value: string): value is CustomerListFilter {
  return value === "All" || value === "Active" || value === "Inactive" || value === "Receivables";
}

type CustomerDetailViewProps = {
  customers: Customer[];
  selectedCustomer: Customer;
  documents: SalesDocument[];
  organizationId?: string;
  onSelectCustomer: (customer: Customer) => void;
  onClose: () => void;
  onCustomerUpdated: (updated: Customer) => void;
  onNewCustomer: () => void;
};

export function CustomerDetailView({
  customers,
  selectedCustomer,
  documents,
  organizationId,
  onSelectCustomer,
  onClose,
  onCustomerUpdated,
  onNewCustomer,
}: CustomerDetailViewProps) {
  const router = useRouter();
  const mounted = useSyncExternalStore(
    subscribeToMount,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );
  const [activeTab, setActiveTab] = useState<DetailTab>("Overview");
  const [listSearch, setListSearch] = useState("");
  const [listFilter, setListFilter] = useState<CustomerListFilter>("All");
  const [incomePeriod, setIncomePeriod] = useState<IncomePeriod>("this_fiscal_year");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isNewTxnOpen, setIsNewTxnOpen] = useState(false);
  const newTxnRef = useRef<HTMLDivElement>(null);
  const [hoveredTxnIndex, setHoveredTxnIndex] = useState<number | null>(null);
  const [txnAlign, setTxnAlign] = useState<"left" | "right">("left");
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);
  const [isSendEmailOpen, setIsSendEmailOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Comments state
  const [commentState, setCommentState] = useState<{
    customerId: string;
    comments: CustomerComment[];
  }>({ customerId: selectedCustomer.id, comments: selectedCustomer.comments || [] });
  const comments = commentState.customerId === selectedCustomer.id
    ? commentState.comments
    : selectedCustomer.comments || [];
  const setComments = (nextComments: CustomerComment[]) => {
    setCommentState({ customerId: selectedCustomer.id, comments: nextComments });
  };
  const [newCommentText, setNewCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Attachments local state
  const [attachments, setAttachments] = useState<Array<{ name: string; size: string; date: string }>>([
    { name: "GST_Certificate.pdf", size: "245 KB", date: "15 Oct 2026" },
  ]);

  // Email draft state
  const [emailDraft, setEmailDraft] = useState({
    subject: `Statement of Account - ${selectedCustomer.name}`,
    body: `Dear ${selectedCustomer.name},\n\nPlease find attached your updated statement of account.\n\nThank you for your business.`,
  });
  const [emailSentNotice, setEmailSentNotice] = useState<string | null>(null);

  // Transactions filter
  const [txTypeFilter, setTxTypeFilter] = useState<string>("All");
  const [txSearch, setTxSearch] = useState("");

  // Click outside and escape handler for New Transaction dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (newTxnRef.current && !newTxnRef.current.contains(event.target as Node)) {
        setIsNewTxnOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsNewTxnOpen(false);
      }
    }
    if (isNewTxnOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isNewTxnOpen]);

  // Transaction options grouped for New Transaction dropdown
  const transactionItems = useMemo(() => {
    const orgQuery = organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : "";
    const cid = encodeURIComponent(selectedCustomer.id);
    const cName = encodeURIComponent(selectedCustomer.name);

    return [
      {
        section: "SALES",
        label: "Invoice",
        href: `/sales/invoices/new?customerId=${cid}${orgQuery}`,
      },
      {
        section: "SALES",
        label: "Customer Payment",
        href: `/sales/payments?action=new&customerId=${cid}${orgQuery}`,
      },
      {
        section: "SALES",
        label: "Quote",
        href: `/sales/quotes/new?customerId=${cid}${orgQuery}`,
      },
      {
        section: "SALES",
        label: "Sales Order",
        href: `/sales/orders/new?customerId=${cid}${orgQuery}`,
      },
      {
        section: "SALES",
        label: "Delivery Challan",
        href: `/sales/delivery-challans?action=new&customerId=${cid}${orgQuery}`,
      },
      {
        section: "SALES",
        label: "Recurring Invoice",
        href: `/sales/recurring-invoices?action=new&customerId=${cid}${orgQuery}`,
      },
      {
        section: "OTHER TRANSACTIONS",
        label: "Expense",
        href: `/expenses/new?customerId=${cid}&customerName=${cName}${orgQuery}`,
      },
      {
        section: "OTHER TRANSACTIONS",
        label: "Recurring Expense",
        href: `/purchases/recurring-expenses/new?customerId=${cid}&customerName=${cName}${orgQuery}`,
      },
      {
        section: "OTHER TRANSACTIONS",
        label: "Journal",
        href: `/accountant?action=new-journal&customerId=${cid}${orgQuery}`,
      },
      {
        section: "OTHER TRANSACTIONS",
        label: "Credit Note",
        href: `/sales/credit-notes?action=new&customerId=${cid}${orgQuery}`,
      },
      {
        section: "OTHER TRANSACTIONS",
        label: "Project",
        href: `/sales?section=projects&customerId=${cid}${orgQuery}`,
      },
    ];
  }, [selectedCustomer.id, selectedCustomer.name, organizationId]);

  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoveredTxnIndex((prev) => (prev === null || prev >= transactionItems.length - 1 ? 0 : prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoveredTxnIndex((prev) => (prev === null || prev <= 0 ? transactionItems.length - 1 : prev - 1));
    } else if (e.key === "Enter" && hoveredTxnIndex !== null) {
      e.preventDefault();
      const target = transactionItems[hoveredTxnIndex];
      if (target) {
        setIsNewTxnOpen(false);
        router.push(target.href);
      }
    }
  };

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Filtered sidebar customer list
  const filteredSidebarCustomers = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (listFilter === "Active") return c.status === "Active";
      if (listFilter === "Inactive") return c.status === "Inactive";
      if (listFilter === "Receivables") {
        return calculateCustomerReceivable(c, documents) > 0;
      }
      return true;
    });
  }, [customers, listSearch, listFilter, documents]);

  // Actual documents associated with this customer
  const customerDocs = useMemo(() => {
    return documents.filter((d) => d.customerId === selectedCustomer.id);
  }, [documents, selectedCustomer.id]);

  const receivable = useMemo(() => {
    return calculateCustomerReceivable(selectedCustomer, documents);
  }, [selectedCustomer, documents]);

  // Income chart & calculation derived from customer's actual sales documents
  const incomeStats = useMemo(() => {
    const invoices = customerDocs.filter((d) => d.type === "Invoice");

    // Standard fiscal year months (Apr -> Mar)
    const monthNames = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    const monthMap: Record<string, number> = {};
    monthNames.forEach((m) => {
      monthMap[m] = 0;
    });

    let total = 0;
    invoices.forEach((inv) => {
      const d = inv.issueDate || inv.createdAt;
      if (!d) return;
      const date = new Date(d);
      if (isNaN(date.getTime())) return;
      const monthIdx = date.getMonth(); // 0 = Jan, 3 = Apr
      const fiscalMonth = (monthIdx + 9) % 12; // Apr = 0, Mar = 11
      const mName = monthNames[fiscalMonth];
      const amount = Number(inv.total) || 0;
      monthMap[mName] = (monthMap[mName] || 0) + amount;
      total += amount;
    });

    const chartData = monthNames.map((month) => ({
      name: month,
      income: monthMap[month] || 0,
    }));

    return { total, chartData };
  }, [customerDocs]);

  // Activity timeline dynamically constructed from customer record & documents
  const activityTimeline = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      desc: string;
      date: Date;
      iconType: "invoice" | "payment" | "quote" | "order" | "user" | "credit";
      badge?: string;
      badgeColor?: string;
    }> = [];

    // Profile Created
    if (selectedCustomer.createdAt) {
      const d = new Date(selectedCustomer.createdAt);
      if (!isNaN(d.getTime())) {
        list.push({
          id: "created",
          title: "Customer Profile Created",
          desc: `Created by ${selectedCustomer.companyName ? `for ${selectedCustomer.companyName}` : "Admin"}`,
          date: d,
          iconType: "user",
          badge: "System",
          badgeColor: "bg-slate-100 text-slate-700",
        });
      }
    }

    // Contact Persons
    selectedCustomer.contactPersons?.forEach((cp, idx) => {
      if (cp.name) {
        list.push({
          id: `cp-${idx}`,
          title: "Contact Person Added",
          desc: `${cp.name} ${cp.email ? `(${cp.email})` : ""} added to profile`,
          date: new Date(selectedCustomer.createdAt || 0),
          iconType: "user",
          badge: "Contact",
          badgeColor: "bg-purple-50 text-purple-700",
        });
      }
    });

    // Invoices
    customerDocs
      .filter((d) => d.type === "Invoice")
      .forEach((inv) => {
        const d = new Date(inv.issueDate || inv.createdAt || 0);
        list.push({
          id: `inv-${inv.id || inv.number}`,
          title: `Invoice ${inv.number || "INV"} Generated`,
          desc: `Invoice for ${currency.format(inv.total || 0)} created (Due: ${
            inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "On Receipt"
          })`,
          date: d,
          iconType: "invoice",
          badge: inv.status || "Draft",
          badgeColor:
            inv.status === "Paid"
              ? "bg-emerald-50 text-emerald-700"
              : inv.status === "Partly Paid"
              ? "bg-amber-50 text-amber-700"
              : "bg-blue-50 text-blue-700",
        });

        if (inv.amountPaid > 0) {
          list.push({
            id: `inv-paid-${inv.id || inv.number}`,
            title: `Payment Received on ${inv.number || "Invoice"}`,
            desc: `Payment of ${currency.format(inv.amountPaid)} credited toward invoice`,
            date: new Date(inv.updatedAt || inv.issueDate || 0),
            iconType: "payment",
            badge: "Paid",
            badgeColor: "bg-emerald-50 text-emerald-700",
          });
        }
      });

    // Payments Received
    customerDocs
      .filter((d) => d.type === "Payment Received")
      .forEach((pmt) => {
        const d = new Date(pmt.paymentDate || pmt.issueDate || pmt.createdAt || 0);
        list.push({
          id: `pmt-${pmt.id || pmt.number}`,
          title: `Payment Received (${pmt.number || "REC"})`,
          desc: `Received ${currency.format(pmt.total || 0)} via ${pmt.method || "Bank"}${
            pmt.referenceNumber ? ` · Ref: ${pmt.referenceNumber}` : ""
          }`,
          date: d,
          iconType: "payment",
          badge: "Credited",
          badgeColor: "bg-emerald-50 text-emerald-700",
        });
      });

    // Quotes
    customerDocs
      .filter((d) => d.type === "Quote")
      .forEach((q) => {
        const d = new Date(q.issueDate || q.createdAt || 0);
        list.push({
          id: `q-${q.id || q.number}`,
          title: `Estimate / Quote ${q.number || "QT"} Created`,
          desc: `Quote amount: ${currency.format(q.total || 0)}`,
          date: d,
          iconType: "quote",
          badge: q.status || "Sent",
          badgeColor: "bg-indigo-50 text-indigo-700",
        });
      });

    // Sales Orders
    customerDocs
      .filter((d) => d.type === "Sales Order")
      .forEach((so) => {
        const d = new Date(so.issueDate || so.createdAt || 0);
        list.push({
          id: `so-${so.id || so.number}`,
          title: `Sales Order ${so.number || "SO"} Confirmed`,
          desc: `Order total: ${currency.format(so.total || 0)}`,
          date: d,
          iconType: "order",
          badge: so.status || "Confirmed",
          badgeColor: "bg-teal-50 text-teal-700",
        });
      });

    // Credit Notes
    customerDocs
      .filter((d) => d.type === "Credit Note")
      .forEach((cn) => {
        const d = new Date(cn.issueDate || cn.createdAt || 0);
        list.push({
          id: `cn-${cn.id || cn.number}`,
          title: `Credit Note ${cn.number || "CN"} Issued`,
          desc: `Credit amount: ${currency.format(cn.total || 0)}`,
          date: d,
          iconType: "credit",
          badge: "Credit Note",
          badgeColor: "bg-rose-50 text-rose-700",
        });
      });

    // Sort newest first
    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [selectedCustomer, customerDocs]);

  // Filtered transactions for Transactions Tab
  const filteredTransactions = useMemo(() => {
    return customerDocs.filter((doc) => {
      if (txTypeFilter !== "All" && doc.type !== txTypeFilter) return false;
      if (txSearch) {
        const q = txSearch.toLowerCase();
        return (
          doc.number?.toLowerCase().includes(q) ||
          doc.type.toLowerCase().includes(q) ||
          doc.status?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [customerDocs, txTypeFilter, txSearch]);

  // Comment submission
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/sales/customers/${selectedCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-comment",
          commentText: newCommentText.trim(),
          organizationId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const added = data.comment || {
          text: newCommentText.trim(),
          author: "Current User",
          createdAt: new Date().toISOString(),
        };
        const updatedComments = [added, ...comments];
        setComments(updatedComments);
        onCustomerUpdated({
          ...selectedCustomer,
          comments: updatedComments,
        });
        setNewCommentText("");
      }
    } catch {
      // fallback local update
      const fallback = {
        text: newCommentText.trim(),
        author: "Current User",
        createdAt: new Date().toISOString(),
      };
      setComments([fallback, ...comments]);
      setNewCommentText("");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Status toggle
  const handleToggleStatus = async () => {
    const nextStatus = selectedCustomer.status === "Active" ? "Inactive" : "Active";
    try {
      await fetch(`/api/sales/customers/${selectedCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          organizationId,
        }),
      });
      onCustomerUpdated({ ...selectedCustomer, status: nextStatus });
    } catch {
      onCustomerUpdated({ ...selectedCustomer, status: nextStatus });
    }
    setIsMoreOpen(false);
  };

  // Email send simulation
  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendEmailOpen(false);
    setEmailSentNotice(`Email statement sent successfully to ${selectedCustomer.email}`);
    setTimeout(() => setEmailSentNotice(null), 4000);
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] w-full overflow-hidden bg-white">
      {/* ─── LEFT PANEL: Customers Master List ─────────────────────────────────── */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50/70 sm:w-88 lg:w-96">
        {/* Left Panel Top Header */}
        <div className="border-b border-slate-200 bg-white px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="relative">
              <select
                aria-label="Filter customer list"
                value={listFilter}
                onChange={(e) => {
                  if (isCustomerListFilter(e.target.value)) setListFilter(e.target.value);
                }}
                className="appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-bold text-slate-800 shadow-2xs outline-none hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="All">All Customers ({customers.length})</option>
                <option value="Active">
                  Active Customers ({customers.filter((c) => c.status === "Active").length})
                </option>
                <option value="Inactive">
                  Inactive ({customers.filter((c) => c.status === "Inactive").length})
                </option>
                <option value="Receivables">With Outstanding</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>

            <button
              type="button"
              onClick={onNewCustomer}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative mt-2.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search customers..."
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-8 pr-7 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            {listSearch && (
              <button
                type="button"
                onClick={() => setListSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Customer Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredSidebarCustomers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No customers found</div>
          ) : (
            filteredSidebarCustomers.map((c) => {
              const isSelected = c.id === selectedCustomer.id;
              const cReceivable = calculateCustomerReceivable(c, documents);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCustomer(c)}
                  className={`w-full text-left transition-all p-3.5 flex items-start justify-between gap-3 ${
                    isSelected
                      ? "border-l-4 border-l-blue-600 bg-blue-50/80 shadow-2xs"
                      : "border-l-4 border-l-transparent hover:bg-slate-100/60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-slate-900">{c.name}</span>
                      {c.status === "Inactive" && (
                        <span className="shrink-0 rounded px-1 text-[9px] font-semibold bg-slate-200 text-slate-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    {c.companyName && (
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{c.companyName}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-slate-800">
                      {currency.format(cReceivable)}
                    </span>
                    <span className="block text-[10px] text-slate-400">Receivable</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ─── RIGHT PANEL: Customer Details Workspace ───────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden bg-slate-50/40">
        {/* Notification Banner */}
        {emailSentNotice && (
          <div className="flex items-center justify-between bg-emerald-50 px-6 py-2.5 text-xs font-medium text-emerald-800 border-b border-emerald-200">
            <span>{emailSentNotice}</span>
            <button onClick={() => setEmailSentNotice(null)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Header ── */}
        <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-2xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Customer Title & Tags */}
            <div className="flex items-center gap-3.5">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold shadow-2xs ${getAvatarColor(
                  selectedCustomer.name
                )}`}
              >
                {getInitials(selectedCustomer.name)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
                    {selectedCustomer.name}
                  </h1>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                      selectedCustomer.customerType === "Business"
                        ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20"
                        : "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20"
                    }`}
                  >
                    {selectedCustomer.customerType || "Business"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      selectedCustomer.status === "Active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        selectedCustomer.status === "Active" ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    {selectedCustomer.status || "Active"}
                  </span>
                </div>
                {selectedCustomer.companyName && (
                  <p className="mt-0.5 text-xs text-slate-500">{selectedCustomer.companyName}</p>
                )}
              </div>
            </div>

            {/* Action Buttons: Edit, Attachments, New Transaction, More, Close */}
            <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 shrink-0"
              >
                <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                <span>Edit</span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAttachmentsOpen(!isAttachmentsOpen)}
                  className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 shrink-0"
                >
                  <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                  <span>Attachments ({attachments.length})</span>
                </button>

                {isAttachmentsOpen && (
                  <div className="absolute right-0 top-full z-30 mt-1.5 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-800">Files & Attachments</span>
                      <button
                        type="button"
                        onClick={() => setIsAttachmentsOpen(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 divide-y divide-slate-100 text-xs">
                      {attachments.map((att, i) => (
                        <div key={i} className="py-2 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-800 truncate max-w-[170px]">{att.name}</p>
                            <span className="text-[10px] text-slate-400">{att.size} · {att.date}</span>
                          </div>
                          <span className="text-blue-600 cursor-pointer hover:underline text-[11px]">View</span>
                        </div>
                      ))}
                    </div>
                    <label className="mt-2.5 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-2 text-xs font-medium text-blue-600 hover:bg-blue-50/50">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload New File</span>
                      <input
                        type="file"
                        className="sr-only"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            const file = e.target.files[0];
                            setAttachments([
                              ...attachments,
                              {
                                name: file.name,
                                size: `${Math.round(file.size / 1024)} KB`,
                                date: "Just now",
                              },
                            ]);
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* New Transaction Dropdown */}
              <div className="relative" ref={newTxnRef}>
                <button
                  id="new-transaction-btn"
                  type="button"
                  onClick={() => {
                    setHoveredTxnIndex(0);
                    if (newTxnRef.current) {
                      const rect = newTxnRef.current.getBoundingClientRect();
                      setTxnAlign(window.innerWidth - rect.left < 240 ? "right" : "left");
                    }
                    setIsNewTxnOpen((prev) => !prev);
                  }}
                  className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white shadow-2xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shrink-0"
                  aria-expanded={isNewTxnOpen}
                  aria-haspopup="true"
                >
                  <span>New Transaction</span>
                  <ChevronDown
                    className={`h-3 w-3 fill-current transition-transform duration-150 ${
                      isNewTxnOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isNewTxnOpen && (
                  <div
                    id="new-transaction-menu"
                    role="menu"
                    aria-orientation="vertical"
                    tabIndex={0}
                    onKeyDown={handleDropdownKeyDown}
                    onMouseLeave={() => setHoveredTxnIndex(null)}
                    className={`absolute ${
                      txnAlign === "left" ? "left-0" : "right-0"
                    } top-full z-50 mt-1 max-h-[350px] w-56 overflow-y-auto rounded-lg border border-slate-200/90 bg-white py-1.5 shadow-xl outline-none animate-in fade-in zoom-in-95 scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400`}
                  >
                    {transactionItems.map((item, idx) => {
                      const showHeader =
                        idx === 0 || transactionItems[idx - 1].section !== item.section;
                      const isHighlighted = hoveredTxnIndex === idx;

                      return (
                        <div key={item.label}>
                          {showHeader && (
                            <div
                              className={`px-3.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 select-none ${
                                idx === 0 ? "pt-1.5" : "pt-2.5 border-t border-slate-100 mt-1"
                              }`}
                            >
                              {item.section}
                            </div>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            onMouseEnter={() => setHoveredTxnIndex(idx)}
                            onClick={() => {
                              setIsNewTxnOpen(false);
                              router.push(item.href);
                            }}
                            className={`mx-1.5 flex w-[calc(100%-0.75rem)] items-center px-3 py-1.5 text-xs text-left cursor-pointer rounded-md transition-colors select-none ${
                              isHighlighted
                                ? "bg-blue-600 text-white font-medium shadow-2xs"
                                : "text-slate-700 hover:bg-blue-600 hover:text-white"
                            }`}
                          >
                            <span>{item.label}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* More Actions Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
                  title="More actions"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>

                {isMoreOpen && (
                  <div className="absolute right-0 top-full z-30 mt-1.5 w-52 rounded-2xl border border-slate-200 bg-white py-1.5 shadow-xl animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={handleToggleStatus}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span>Mark as {selectedCustomer.status === "Active" ? "Inactive" : "Active"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        router.push(`/sales/customer-ledger?customerId=${selectedCustomer.id}`);
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <TrendingUp className="h-4 w-4 text-slate-400" />
                      <span>View Customer Ledger</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        window.print();
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Printer className="h-4 w-4 text-slate-400" />
                      <span>Print Profile</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close customer detail view"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 shadow-2xs hover:bg-slate-100 hover:text-slate-800 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ── Navigation Tabs: Overview, Comments, Transactions, Mails, Statement ── */}
          <nav className="mt-4 flex items-center gap-6 border-t border-slate-100 pt-3" role="tablist">
            {(["Overview", "Comments", "Transactions", "Mails", "Statement"] as DetailTab[]).map(
              (tab) => {
                const isSelected = activeTab === tab;
                const count =
                  tab === "Comments"
                    ? comments.length
                    : tab === "Transactions"
                    ? customerDocs.length
                    : undefined;

                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-2.5 text-xs font-bold transition flex items-center gap-1.5 ${
                      isSelected
                        ? "text-blue-600 border-b-2 border-b-blue-600"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <span>{tab}</span>
                    {count !== undefined && count > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          isSelected ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </nav>
        </header>

        {/* ── Main Tab Content Scrollable Area ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ══════════ TAB 1: OVERVIEW ══════════ */}
          {activeTab === "Overview" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              {/* ── Left-side Panel: Contact Info & Addresses ── */}
              <div className="space-y-6 xl:col-span-5">
                {/* Contact Information Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Contact Details
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditOpen(true)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Primary Contact</span>
                      <span className="font-semibold text-slate-800">
                        {selectedCustomer.name}
                      </span>
                    </div>

                    {selectedCustomer.email && (
                      <div>
                        <span className="text-slate-400 block text-[11px]">Email Address</span>
                        <div className="flex items-center gap-2">
                          <a
                            href={`mailto:${selectedCustomer.email}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {selectedCustomer.email}
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopy(selectedCustomer.email, "email")}
                            className="text-slate-400 hover:text-slate-600"
                            title="Copy email"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          {copiedField === "email" && (
                            <span className="text-[10px] text-emerald-600">Copied</span>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedCustomer.phone && (
                      <div>
                        <span className="text-slate-400 block text-[11px]">Work Phone</span>
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${selectedCustomer.phone}`}
                            className="font-medium text-slate-800 hover:text-blue-600"
                          >
                            {selectedCustomer.phone}
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopy(selectedCustomer.phone, "phone")}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedCustomer.mobile && (
                      <div>
                        <span className="text-slate-400 block text-[11px]">Mobile Phone</span>
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${selectedCustomer.mobile}`}
                            className="font-medium text-slate-800 hover:text-blue-600"
                          >
                            {selectedCustomer.mobile}
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopy(selectedCustomer.mobile, "mobile")}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Currency</span>
                        <span className="font-semibold text-slate-800">
                          {selectedCustomer.currency || "INR (₹)"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Language</span>
                        <span className="font-semibold text-slate-800">
                          {selectedCustomer.customerLanguage || "English"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Billing & Shipping Addresses Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Address Information
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditOpen(true)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Update
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {/* Billing */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                        <MapPin className="h-3.5 w-3.5 text-blue-600" />
                        <span>Billing Address</span>
                      </div>
                      {selectedCustomer.billingAddress?.attention && (
                        <p className="font-medium text-slate-800">{selectedCustomer.billingAddress.attention}</p>
                      )}
                      <p className="text-slate-600">
                        {selectedCustomer.billingAddress?.street || "No street address"}
                      </p>
                      <p className="text-slate-600">
                        {[
                          selectedCustomer.billingAddress?.city,
                          selectedCustomer.billingAddress?.state,
                          selectedCustomer.billingAddress?.postalCode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <p className="text-slate-500 font-medium">
                        {selectedCustomer.billingAddress?.country || "India"}
                      </p>
                    </div>

                    {/* Shipping */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Shipping Address</span>
                      </div>
                      {selectedCustomer.shippingAddress?.attention && (
                        <p className="font-medium text-slate-800">{selectedCustomer.shippingAddress.attention}</p>
                      )}
                      <p className="text-slate-600">
                        {selectedCustomer.shippingAddress?.street || "Same as billing address"}
                      </p>
                      <p className="text-slate-600">
                        {[
                          selectedCustomer.shippingAddress?.city,
                          selectedCustomer.shippingAddress?.state,
                          selectedCustomer.shippingAddress?.postalCode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <p className="text-slate-500 font-medium">
                        {selectedCustomer.shippingAddress?.country || "India"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tax & Compliance Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block border-b border-slate-100 pb-3">
                    Tax & Compliance Details
                  </span>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">GSTIN</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {selectedCustomer.gstin || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">PAN</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {selectedCustomer.pan || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Place of Supply</span>
                      <span className="font-medium text-slate-800">
                        {selectedCustomer.state || "Not specified"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Payment Terms</span>
                      <span className="font-semibold text-blue-600">
                        {selectedCustomer.paymentTerms || "Due on Receipt"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Remarks & Notes */}
                {selectedCustomer.remarks && (
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs text-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Internal Remarks
                    </span>
                    <p className="text-slate-700 whitespace-pre-wrap">{selectedCustomer.remarks}</p>
                  </div>
                )}
              </div>

              {/* ── Right-side Content: Financial Cards, Income Chart, Activity Timeline ── */}
              <div className="space-y-6 xl:col-span-7">
                {/* Payment Due Period & Receivables Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Financial Status
                      </span>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">Payment Due Period:</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                          <Clock className="h-3.5 w-3.5" />
                          {selectedCustomer.paymentTerms || "Due on Receipt"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/sales/customer-ledger?customerId=${selectedCustomer.id}`)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      <span>Ledger Statement</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Receivables */}
                    <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
                      <span className="text-[11px] font-semibold text-slate-500">Outstanding Receivables</span>
                      <div className="mt-1 text-xl font-bold text-rose-700">
                        {currency.format(receivable)}
                      </div>
                      <span className="mt-1 block text-[10px] text-slate-400">Total balance due</span>
                    </div>

                    {/* Unused Credits */}
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                      <span className="text-[11px] font-semibold text-slate-500">Unused Credits</span>
                      <div className="mt-1 text-xl font-bold text-emerald-700">
                        {currency.format(selectedCustomer.unusedCredits || 0)}
                      </div>
                      <span className="mt-1 block text-[10px] text-slate-400">Available credit notes</span>
                    </div>

                    {/* Credit Limit */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                      <span className="text-[11px] font-semibold text-slate-500">Credit Limit</span>
                      <div className="mt-1 text-xl font-bold text-slate-800">
                        {selectedCustomer.creditLimit > 0
                          ? currency.format(selectedCustomer.creditLimit)
                          : "No Limit"}
                      </div>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {selectedCustomer.creditLimit > 0
                          ? `${Math.min(
                              100,
                              Math.round((receivable / selectedCustomer.creditLimit) * 100)
                            )}% utilized`
                          : "Unlimited credit approved"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Income Chart & Total Income */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Income Analysis
                      </span>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900">
                          {currency.format(incomeStats.total)}
                        </span>
                        <span className="text-xs text-slate-500">Total Income</span>
                      </div>
                    </div>

                    <div className="relative">
                      <select
                        aria-label="Select income period"
                        value={incomePeriod}
                        onChange={(e) => setIncomePeriod(e.target.value as IncomePeriod)}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs outline-none hover:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="this_fiscal_year">This Fiscal Year (2026-27)</option>
                        <option value="prev_fiscal_year">Previous Fiscal Year</option>
                        <option value="last_6_months">Last 6 Months</option>
                        <option value="this_month">This Month</option>
                      </select>
                    </div>
                  </div>

                  {/* Recharts Bar Chart */}
                  <div className="mt-4 h-56 w-full">
                    {mounted ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={incomeStats.chartData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "#64748b" }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: "#94a3b8" }}
                            tickFormatter={(v) => `₹${v >= 1000 ? `${v / 1000}k` : v}`}
                          />
                          <Tooltip
                            formatter={(value) => [
                              currency.format(Number(value) || 0),
                              "Income",
                            ]}
                            contentStyle={{
                              borderRadius: "12px",
                              border: "1px solid #e2e8f0",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                              fontSize: "12px",
                            }}
                          />
                          <Bar
                            dataKey="income"
                            fill="#3b82f6"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={36}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full bg-slate-50 animate-pulse rounded-xl" />
                    )}
                  </div>
                </div>

                {/* Activity Timeline Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-blue-600" />
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Activity Timeline
                      </h3>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      {activityTimeline.length} events recorded
                    </span>
                  </div>

                  <div className="mt-4 space-y-4">
                    {activityTimeline.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No customer activities logged yet
                      </div>
                    ) : (
                      <div className="relative pl-6 space-y-6 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-slate-200">
                        {activityTimeline.slice(0, 8).map((event) => (
                          <div key={event.id} className="relative flex items-start gap-3">
                            <span
                              className={`absolute -left-6 top-1 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${
                                event.iconType === "invoice"
                                  ? "bg-blue-600 text-white"
                                  : event.iconType === "payment"
                                  ? "bg-emerald-600 text-white"
                                  : event.iconType === "quote"
                                  ? "bg-indigo-600 text-white"
                                  : event.iconType === "order"
                                  ? "bg-teal-600 text-white"
                                  : "bg-slate-600 text-white"
                              }`}
                            >
                              {event.iconType === "invoice" ? (
                                <Receipt className="h-3 w-3" />
                              ) : event.iconType === "payment" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : event.iconType === "quote" ? (
                                <FileText className="h-3 w-3" />
                              ) : event.iconType === "order" ? (
                                <FileCheck className="h-3 w-3" />
                              ) : (
                                <User className="h-3 w-3" />
                              )}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <span className="text-xs font-bold text-slate-900">
                                  {event.title}
                                </span>
                                {event.badge && (
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      event.badgeColor || "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {event.badge}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-slate-600">{event.desc}</p>
                              <span className="mt-1 block text-[10px] text-slate-400">
                                {event.date.toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                                {" at "}
                                {event.date.toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ TAB 2: COMMENTS ══════════ */}
          {activeTab === "Comments" && (
            <div className="mx-auto max-w-4xl space-y-6">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Add Internal Note / Comment
                </h3>
                <form onSubmit={handleAddComment} className="space-y-3">
                  <textarea
                    rows={3}
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Type an internal note regarding this client account..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingComment || !newCommentText.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{isSubmittingComment ? "Posting..." : "Post Comment"}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Comments Feed */}
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
                    <MessageSquare className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    No internal notes posted for this customer yet.
                  </div>
                ) : (
                  comments.map((comm, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-bold text-slate-700">{comm.author || "User"}</span>
                        <span>
                          {comm.createdAt
                            ? new Date(comm.createdAt).toLocaleString("en-IN", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "Recently"}
                        </span>
                      </div>
                      <p className="text-slate-800 whitespace-pre-wrap">{comm.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ══════════ TAB 3: TRANSACTIONS ══════════ */}
          {activeTab === "Transactions" && (
            <div className="space-y-4">
              {/* Transactions Toolbar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                {/* Type Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {["All", "Invoice", "Payment Received", "Quote", "Sales Order", "Credit Note"].map(
                    (t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTxTypeFilter(t)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          txTypeFilter === t
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {t === "Invoice" ? "Invoices" : t === "Payment Received" ? "Payments" : t}
                      </button>
                    )
                  )}
                </div>

                {/* Search */}
                <div className="relative sm:w-60">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Search transaction #..."
                    className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Number</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Balance Due</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-400">
                          No transactions found matching this criteria
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((doc) => {
                        const balanceDue =
                          doc.type === "Invoice"
                            ? doc.total - doc.amountPaid - doc.creditedAmount
                            : 0;
                        return (
                          <tr key={doc.id || doc.number} className="hover:bg-slate-50/60">
                            <td className="px-4 py-3 text-slate-600">
                              {doc.issueDate
                                ? new Date(doc.issueDate).toLocaleDateString("en-IN")
                                : "—"}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {doc.type}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-blue-600">
                              {doc.number || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  doc.status === "Paid"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : doc.status === "Confirmed"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {doc.status || "Draft"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">
                              {currency.format(doc.total || 0)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-rose-700">
                              {doc.type === "Invoice" ? currency.format(balanceDue) : "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {doc.type === "Invoice" && doc.id && (
                                <button
                                  type="button"
                                  onClick={() => router.push(`/sales/invoices/${doc.id}`)}
                                  className="text-xs font-semibold text-blue-600 hover:underline"
                                >
                                  View
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════ TAB 4: MAILS ══════════ */}
          {activeTab === "Mails" && (
            <div className="mx-auto max-w-4xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Customer Mail History</h3>
                  <p className="text-xs text-slate-500">Track invoices, receipts, and account statements emailed to client</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSendEmailOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Send Email</span>
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Recipient</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">20 Oct 2026, 03:30 PM</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{selectedCustomer.email || "client@company.com"}</td>
                      <td className="px-4 py-3 text-slate-700">Invoice Statement - Month Ending Oct 2026</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Delivered
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════ TAB 5: STATEMENT ══════════ */}
          {activeTab === "Statement" && (
            <div className="mx-auto max-w-4xl space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Statement of Accounts</h3>
                  <p className="text-xs text-slate-500">
                    Statement period: 01 Oct 2026 to 31 Oct 2026
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-500" />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Generate simple CSV download
                      const rows = [
                        ["Date", "Transaction", "Details", "Amount", "Payments", "Balance"],
                        ["2026-10-01", "Opening Balance", "Opening Ledger", selectedCustomer.openingBalance, 0, selectedCustomer.openingBalance],
                        ...customerDocs.map((d) => [
                          d.issueDate || "",
                          d.type,
                          d.number || "",
                          d.total,
                          d.amountPaid,
                          d.total - d.amountPaid,
                        ]),
                      ];
                      const csvContent =
                        "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `Statement_${selectedCustomer.name}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Statement Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <span className="text-[11px] text-slate-400">Opening Balance</span>
                  <div className="mt-1 font-bold text-slate-800">
                    {currency.format(selectedCustomer.openingBalance || 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <span className="text-[11px] text-slate-400">Invoiced Amount</span>
                  <div className="mt-1 font-bold text-slate-800">
                    {currency.format(
                      customerDocs
                        .filter((d) => d.type === "Invoice")
                        .reduce((sum, i) => sum + i.total, 0)
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <span className="text-[11px] text-slate-400">Amount Received</span>
                  <div className="mt-1 font-bold text-emerald-700">
                    {currency.format(
                      customerDocs
                        .filter((d) => d.type === "Payment Received")
                        .reduce((sum, p) => sum + p.total, 0)
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3.5">
                  <span className="text-[11px] font-semibold text-rose-700">Balance Due</span>
                  <div className="mt-1 font-bold text-rose-800">
                    {currency.format(receivable)}
                  </div>
                </div>
              </div>

              {/* Statement Entries Table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Transaction</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Payments</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50/40 font-semibold text-slate-700">
                      <td className="px-4 py-3">01 Oct 2026</td>
                      <td className="px-4 py-3">Opening Balance</td>
                      <td className="px-4 py-3 font-mono">—</td>
                      <td className="px-4 py-3 text-right">—</td>
                      <td className="px-4 py-3 text-right">—</td>
                      <td className="px-4 py-3 text-right">
                        {currency.format(selectedCustomer.openingBalance || 0)}
                      </td>
                    </tr>
                    {customerDocs.map((doc) => (
                      <tr key={doc.id || doc.number} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">
                          {doc.issueDate ? new Date(doc.issueDate).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{doc.type}</td>
                        <td className="px-4 py-3 font-mono text-blue-600 font-bold">{doc.number || "—"}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {doc.type === "Invoice" ? currency.format(doc.total) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-700">
                          {doc.type === "Payment Received" ? currency.format(doc.total) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {currency.format(receivable)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ─── MODALS ───────────────────────────────────────────────────────────── */}
      {/* Edit Customer Modal */}
      {isEditOpen && (
        <CustomerEditModal
          customer={selectedCustomer}
          organizationId={organizationId}
          onClose={() => setIsEditOpen(false)}
          onSaved={(updated) => {
            onCustomerUpdated(updated);
            setIsEditOpen(false);
          }}
        />
      )}

      {/* Send Email Modal */}
      {isSendEmailOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Send Email to Customer</h3>
              <button onClick={() => setIsSendEmailOpen(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">To</label>
                <input
                  type="email"
                  required
                  value={selectedCustomer.email || "billing@customer.com"}
                  className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={emailDraft.subject}
                  onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                  className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Body</label>
                <textarea
                  rows={4}
                  value={emailDraft.body}
                  onChange={(e) => setEmailDraft({ ...emailDraft, body: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSendEmailOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Send Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
