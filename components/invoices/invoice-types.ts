/**
 * components/invoices/invoice-types.ts
 *
 * Comprehensive TypeScript interfaces for Invoice Management Module.
 */

export type InvoiceStatus =
  | "Draft"
  | "Sent"
  | "Partly paid"
  | "Partially Paid"
  | "Paid"
  | "Overdue"
  | "Void";

export interface AddressData {
  attention?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface CustomerSnapshotData {
  name: string;
  companyName?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  billingAddress?: AddressData;
  shippingAddress?: AddressData;
}

export interface InvoiceItemData {
  itemId?: string;
  name: string;
  description?: string;
  hsnCode?: string;
  unit?: string;
  quantity: number;
  rate: number;
  discount?: number;
  discountType?: "percent" | "amount";
  taxRate?: number;
  taxAmount?: number;
  amount: number;
}

export interface BankDetailsData {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  upiId?: string;
}

export interface EmailLogData {
  sentAt: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  message?: string;
  status: string;
}

export interface AppliedCreditNoteData {
  creditNoteId: string;
  creditNoteNumber: string;
  amount: number;
  appliedDate?: string;
  notes?: string;
}

export interface PaymentRecordData {
  id: string;
  number: string;
  receiptNumber: string;
  amount: number;
  paymentDate: string;
  method: "Cash" | "Bank" | "UPI" | "Cheque";
  referenceNumber?: string;
  notes?: string;
  status: string;
  createdAt?: string;
}

export interface InvoiceRecord {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerCompany?: string;
  customerSnapshot?: CustomerSnapshotData;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  salesperson?: string;
  subject?: string;
  referenceNumber?: string;
  customerNotes?: string;
  termsAndConditions?: string;
  placeOfSupply?: string;
  currency: string;
  subTotal: number;
  discount: number;
  discountType: "percent" | "amount";
  taxRate?: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  shippingCharges: number;
  adjustment: number;
  roundOff: number;
  total: number;
  amountPaid: number;
  creditedAmount: number;
  balanceDue: number;
  items?: InvoiceItemData[];
  itemsCount?: number;
  bankDetailsSnapshot?: BankDetailsData;
  emailsSent?: EmailLogData[];
  emailsSentCount?: number;
  payments?: PaymentRecordData[];
  creditsApplied?: AppliedCreditNoteData[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerOption {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  state?: string;
  paymentTerms?: string;
  billingAddress?: AddressData;
  shippingAddress?: AddressData;
}

export interface ItemOption {
  id: string;
  name: string;
  sku: string;
  salesPrice: number;
  salesDescription?: string;
  hsnCode?: string;
  unit?: string;
  gstRate?: number;
}

export interface InvoiceSettingsData {
  invoicePrefix: string;
  nextNumber: number;
  autoGenerateNumbering?: boolean;
  numberZeroPadding?: number;
  restartNumberingEachFiscalYear?: boolean;
  lastFiscalYear?: string;
  formattedNextNumber?: string;
  defaultPaymentTerms: string;
  defaultNotes: string;
  defaultTerms: string;
  currency: string;
  defaultTaxRate: number;
  companyDetails: {
    legalName: string;
    tradeName?: string;
    gstin?: string;
    pan?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    logoUrl?: string;
  };
  bankDetails: BankDetailsData;
  showCompanyLogo?: boolean;
  pdfTemplate: {
    layout: "modern" | "classic" | "minimal";
    accentColor: string;
    showCompanyLogo?: boolean;
    showQrCode: boolean;
    showSignature: boolean;
    signatureLabel: string;
  };
}

export interface InvoiceKpiStats {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
  counts: {
    total: number;
    draft: number;
    sent: number;
    partlyPaid: number;
    paid: number;
    overdue: number;
    void: number;
  };
}

export const PAYMENT_TERMS_OPTIONS = [
  "Due on Receipt",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
  "Due End of the Month",
] as const;

export const GST_RATE_OPTIONS = [
  { label: "GST 0% (Exempt)", rate: 0 },
  { label: "GST 5% (2.5% + 2.5%)", rate: 5 },
  { label: "GST 12% (6% + 6%)", rate: 12 },
  { label: "GST 18% (9% + 9%)", rate: 18 },
  { label: "GST 28% (14% + 14%)", rate: 28 },
] as const;

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
  "Puducherry",
  "Chandigarh",
] as const;
