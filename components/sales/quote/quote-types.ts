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
}

export interface QuoteItemRow {
  id: string;
  itemId?: string;
  name: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface NewQuoteFormProps {
  initialData?: QuoteDocument;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export interface CustomerRecord {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
}

export interface QuoteDocument {
  id: string;
  type: string;
  number: string;
  customerId: string;
  relatedDocumentId?: string;
  status: string;
  total: number;
  issueDate: string;
  dueDate?: string;
  expiryDate?: string;
  referenceNumber?: string;
  salesperson?: string;
  projectName?: string;
  subject?: string;
  customerNotes?: string;
  termsAndConditions?: string;
  subTotal?: number;
  discount?: number;
  discountType?: "percent" | "amount";
  taxType?: string;
  taxName?: string;
  taxRate?: number;
  taxAmount?: number;
  tdsTcsType?: "TDS" | "TCS" | "None";
  tdsTcsName?: string;
  tdsTcsRate?: number;
  tdsTcsAmount?: number;
  adjustment?: number;
  items?: {
    name: string;
    description?: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
}

export interface SalesApiResponse {
  organizations: { id: string; name: string }[];
  customers: CustomerRecord[];
  documents: QuoteDocument[];
  isAdmin: boolean;
  error?: string;
}

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

export function getQuoteStatusStyle(status: string) {
  switch (status?.toLowerCase()) {
    case "accepted":
      return {
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200/90 ring-1 ring-emerald-600/10",
        dot: "bg-emerald-500",
      };
    case "sent":
      return {
        badge: "bg-blue-50 text-blue-700 border-blue-200/90 ring-1 ring-blue-600/10",
        dot: "bg-blue-500",
      };
    case "converted":
      return {
        badge: "bg-purple-50 text-purple-700 border-purple-200/90 ring-1 ring-purple-600/10",
        dot: "bg-purple-500",
      };
    case "rejected":
    case "declined":
      return {
        badge: "bg-rose-50 text-rose-700 border-rose-200/90 ring-1 ring-rose-600/10",
        dot: "bg-rose-500",
      };
    case "draft":
    default:
      return {
        badge: "bg-slate-100 text-slate-700 border-slate-200 ring-1 ring-slate-500/10",
        dot: "bg-slate-400",
      };
  }
}

export function getInitials(name: string) {
  if (!name) return "QT";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function getAvatarColor(name: string) {
  const colors = [
    "bg-blue-100 text-blue-700 border-blue-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
    "bg-emerald-100 text-emerald-700 border-emerald-200",
    "bg-purple-100 text-purple-700 border-purple-200",
    "bg-amber-100 text-amber-700 border-amber-200",
    "bg-teal-100 text-teal-700 border-teal-200",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}


export const GST_RATE_PRESETS = [0, 5, 12, 18, 28] as const;

export const gstOptions = [
  { label: "GST 0% - Exempted Goods", rate: 0 },
  { label: "GST 5% - Essential Commodities", rate: 5 },
  { label: "GST 12% - Processed Goods", rate: 12 },
  { label: "GST 18% - Standard Trading & Commercial", rate: 18 },
  { label: "GST 28% - Luxury & High Value", rate: 28 },
];

export interface DirectTaxOption {
  id: string;
  name: string;
  rate: number;
  section?: string;
  isCustom?: boolean;
}

export const DEFAULT_TDS_RATES: DirectTaxOption[] = [
  { id: "tds-comm", name: "Commission or Brokerage", rate: 2, section: "Sec 194H" },
  { id: "tds-div", name: "Dividend", rate: 10, section: "Sec 194" },
  { id: "tds-int-other", name: "Other Interest than securities", rate: 10, section: "Sec 194A" },
  { id: "tds-cont-others", name: "Payment of contractors for Others", rate: 2, section: "Sec 194C" },
  { id: "tds-cont-indiv", name: "Payment of contractors HUF/Indiv", rate: 1, section: "Sec 194C" },
  { id: "tds-rent-prop", name: "Rent on Land or Building or Furniture", rate: 10, section: "Sec 194I" },
  { id: "tds-rent-mach", name: "Rent on Plant & Machinery", rate: 2, section: "Sec 194I" },
  { id: "tds-prof-tech", name: "Fees for Professional or Technical Services", rate: 10, section: "Sec 194J" },
  { id: "tds-sale-goods", name: "Payment on purchase of goods", rate: 0.1, section: "Sec 194Q" },
];

export const DEFAULT_TCS_RATES: DirectTaxOption[] = [
  { id: "tcs-sale-goods", name: "Collection at source on sale of goods", rate: 0.1, section: "Sec 206C(1H)" },
  { id: "tcs-scrap", name: "Scrap", rate: 1, section: "Sec 206C" },
  { id: "tcs-minerals", name: "Minerals like coal, lignite, iron ore", rate: 1, section: "Sec 206C" },
  { id: "tcs-liquor", name: "Alcoholic liquor for human consumption", rate: 1, section: "Sec 206C" },
  { id: "tcs-timber", name: "Timber obtained under forest lease", rate: 2.5, section: "Sec 206C" },
  { id: "tcs-parking", name: "Parking lot, toll plaza, mining and quarrying", rate: 2, section: "Sec 206C" },
  { id: "tcs-lrs", name: "Remittance under LRS", rate: 5, section: "Sec 206C(1G)" },
  { id: "tcs-motor", name: "Sale of motor vehicle above 10 Lakhs", rate: 1, section: "Sec 206C(1F)" },
];

