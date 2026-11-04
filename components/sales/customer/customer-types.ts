export type Customer = {
  id: string;
  name: string;
  customerType: string;
  companyName: string;
  email: string;
  phone: string;
  mobile: string;
  openingBalance: number;
  creditLimit: number;
  unusedCredits: number;
  status: string;
  gstin?: string;
  pan?: string;
  state?: string;
  customerLanguage?: string;
  paymentTerms?: string;
  currency?: string;
  billingAddress?: {
    attention?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  shippingAddress?: {
    attention?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  contactPersons?: Array<{ name?: string; email?: string; phone?: string; mobile?: string }>;
  customFields?: Array<{ label?: string; value?: string }>;
  reportingTags?: string[];
  remarks?: string;
  comments?: Array<{ text: string; author?: string; createdAt?: string }>;
  createdAt?: string;
  updatedAt?: string;
};

export type SalesDocument = {
  id?: string;
  type: string;
  number?: string;
  customerId: string;
  relatedDocumentId?: string;
  total: number;
  amountPaid: number;
  creditedAmount: number;
  status?: string;
  issueDate?: string;
  dueDate?: string;
  paymentDate?: string;
  method?: string;
  referenceNumber?: string;
  notes?: string;
  items?: Array<{ name?: string; quantity?: number; rate?: number; amount?: number }>;
  createdAt?: string;
  updatedAt?: string;
};

export type Organization = { id: string; name: string };

export type SalesResponse = {
  organizations: Organization[];
  customers: Customer[];
  documents: SalesDocument[];
  isAdmin: boolean;
  error?: string;
};

export type ViewMode = "table" | "grid";
export type SortOption = "name-asc" | "name-desc" | "receivable-desc" | "credit-desc" | "company-asc";

export const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

export const avatarColors = [
  "bg-blue-600 text-white",
  "bg-indigo-600 text-white",
  "bg-violet-600 text-white",
  "bg-emerald-600 text-white",
  "bg-teal-600 text-white",
  "bg-sky-600 text-white",
  "bg-rose-600 text-white",
  "bg-amber-600 text-white",
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function getInitials(name: string): string {
  if (!name) return "CU";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function calculateCustomerReceivable(customer: Customer, documents: SalesDocument[]): number {
  return (
    customer.openingBalance +
    documents
      .filter((document) => document.type === "Invoice" && document.customerId === customer.id)
      .reduce((balance, invoice) => balance + invoice.total - invoice.amountPaid - invoice.creditedAmount, 0)
  );
}
