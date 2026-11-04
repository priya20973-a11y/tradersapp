export interface ItemOption {
  id: string;
  name: string;
  sku?: string;
  salesPrice: number;
  salesDescription?: string;
  unit?: string;
}

export interface CustomerOption {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
}

export interface OrderItemRow {
  id: string;
  itemId?: string;
  name: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface AttachedFile {
  name: string;
  size: number;
}

export interface NewSalesOrderFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialQuoteId?: string;
}

export interface SalesOrderDocument {
  id: string;
  type: string;
  number: string;
  customerId: string;
  relatedDocumentId?: string;
  status: string;
  total: number;
  issueDate: string;
  dueDate?: string;
  expectedShipmentDate?: string;
  referenceNumber?: string;
  paymentTerms?: string;
  deliveryMethod?: string;
  salesperson?: string;
  customerNotes?: string;
  termsAndConditions?: string;
  subTotal?: number;
  discount?: number;
  discountType?: string;
  taxType?: string;
  taxName?: string;
  taxRate?: number;
  taxAmount?: number;
  adjustment?: number;
  items?: {
    itemId?: string;
    name: string;
    description?: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  notes?: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface SalesApiResponse {
  organizations: { id: string; name: string }[];
  customers: CustomerRecord[];
  documents: SalesOrderDocument[];
  isAdmin: boolean;
  error?: string;
}

export const salespersons = [
  "Alice Trader",
  "John Doe",
  "Sales Manager",
  "Executive Staff",
];

export const paymentTermsOptions = [
  "Due on Receipt",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
  "Due end of the month",
  "Due end of next month",
  "Custom",
];

export const deliveryMethods = [
  "Courier",
  "In-Person Delivery",
  "Transport Freight",
  "Direct Truckload",
  "Air Cargo",
  "Rail Freight",
  "Customer Pickup",
];

export const taxOptions = [
  { label: "TDS 1% - Section 194C", rate: 0.01, type: "TDS" },
  { label: "TDS 2% - Section 194J", rate: 0.02, type: "TDS" },
  { label: "TDS 5% - Section 194H", rate: 0.05, type: "TDS" },
  { label: "TCS 0.1% - Section 206C", rate: 0.001, type: "TCS" },
  { label: "TCS 1% - High Value Goods", rate: 0.01, type: "TCS" },
  { label: "GST 5% (CGST+SGST)", rate: 0.05, type: "TCS" },
  { label: "GST 12% (CGST+SGST)", rate: 0.12, type: "TCS" },
  { label: "GST 18% (Standard GST)", rate: 0.18, type: "TCS" },
];

export const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function getSalesOrderStatusStyle(status: string) {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "confirmed":
      return {
        badge: "bg-blue-50 text-blue-700 border-blue-200",
        dot: "bg-blue-500",
      };
    case "fulfilled":
      return {
        badge: "bg-purple-50 text-purple-700 border-purple-200",
        dot: "bg-purple-500",
      };
    case "invoiced":
      return {
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
      };
    case "cancelled":
      return {
        badge: "bg-red-50 text-red-700 border-red-200",
        dot: "bg-red-500",
      };
    case "draft":
    default:
      return {
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
      };
  }
}

export function getAvatarColor(name: string) {
  const colors = [
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-indigo-50 text-indigo-700 border-indigo-200",
    "bg-violet-50 text-violet-700 border-violet-200",
    "bg-purple-50 text-purple-700 border-purple-200",
    "bg-pink-50 text-pink-700 border-pink-200",
    "bg-emerald-50 text-emerald-700 border-emerald-200",
    "bg-teal-50 text-teal-700 border-teal-200",
    "bg-amber-50 text-amber-700 border-amber-200",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getInitials(name: string) {
  if (!name) return "SO";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
