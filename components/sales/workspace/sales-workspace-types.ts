export type SalesSection =
  | "customers"
  | "quotes"
  | "orders"
  | "invoices"
  | "recurring-invoices"
  | "delivery-challans"
  | "payments-received"
  | "credit-notes";

export type CustomerRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  openingBalance: number;
  creditLimit: number;
  status: string;
};

export type SalesDocument = {
  id: string;
  type: string;
  number: string;
  customerId: string;
  relatedDocumentId: string;
  status: string;
  total: number;
  amountPaid: number;
  creditedAmount: number;
  issueDate: string;
  dueDate: string;
  nextRunDate: string;
  frequency: string;
  method: string;
  referenceNumber: string;
  notes: string;
};

export type Organization = { id: string; name: string };

export type SalesData = {
  organizations: Organization[];
  customers: CustomerRecord[];
  documents: SalesDocument[];
  isAdmin: boolean;
};

export const tabs: { section: SalesSection; label: string; type: string }[] = [
  { section: "customers", label: "Customers", type: "Customer" },
  { section: "quotes", label: "Quotes", type: "Quote" },
  { section: "orders", label: "Sales Orders", type: "Sales Order" },
  { section: "invoices", label: "Invoices", type: "Invoice" },
  { section: "recurring-invoices", label: "Recurring Invoices", type: "Recurring Invoice" },
  { section: "delivery-challans", label: "Delivery Challans", type: "Delivery Challan" },
  { section: "payments-received", label: "Payments Received", type: "Payment Received" },
  { section: "credit-notes", label: "Credit Notes", type: "Credit Note" },
];

export const inputClassName =
  "mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10";

export const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function dateLabel(date: string) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
