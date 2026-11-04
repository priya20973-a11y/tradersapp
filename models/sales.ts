import mongoose, { Schema, Types, type Model } from "mongoose";

export type SalesDocumentType =
  | "Quote"
  | "Sales Order"
  | "Invoice"
  | "Recurring Invoice"
  | "Delivery Challan"
  | "Payment Received"
  | "Credit Note";

export interface CustomerSnapshot {
  name: string;
  companyName?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  mobile?: string;
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
}

export interface CustomerRecord {
  _id?: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  gstin?: string;
  pan?: string;
  state?: string;
  currency?: string;
  paymentTerms?: string;
  openingBalance?: number;
  creditLimit?: number;
  unusedCredits?: number;
  status?: "Active" | "Inactive" | "Review";
  customerType?: "Business" | "Individual";
  customerLanguage?: string;
  contactPersons?: Array<{
    name?: string;
    email?: string;
    phone?: string;
    mobile?: string;
  }>;
  customFields?: Array<{ label?: string; value?: string }>;
  reportingTags?: string[];
  remarks?: string;
  comments?: unknown[];
  createdAt?: Date;
  updatedAt?: Date;
  billingAddress?: CustomerSnapshot["billingAddress"];
  shippingAddress?: CustomerSnapshot["shippingAddress"];
  [key: string]: unknown;
}

export interface VendorRecord {
  _id?: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  displayName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  state?: string;
  openingBalance?: number;
  status?: "Active" | "Inactive" | "Pending";
  [key: string]: unknown;
}

export interface InvoiceItemRecord {
  _id?: Types.ObjectId;
  itemId?: Types.ObjectId;
  name: string;
  description?: string;
  account?: string;
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

export interface BankDetailsSnapshot {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  upiId?: string;
}

export interface EmailLogRecord {
  sentAt: Date;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  message?: string;
  status: string;
}

export interface SalesDocumentRecord {
  _id?: Types.ObjectId;
  organizationId: Types.ObjectId;
  type: SalesDocumentType;
  number: string;
  customerId: Types.ObjectId;
  relatedDocumentId?: Types.ObjectId;
  status: string;
  issueDate: Date;
  dueDate?: Date;
  nextRunDate?: Date;
  frequency?: "Weekly" | "Monthly" | "Quarterly" | "Yearly";
  total: number;
  amountPaid: number;
  creditedAmount: number;
  method?: "Cash" | "Bank" | "UPI" | "Cheque";
  referenceNumber?: string;
  notes?: string;
  expiryDate?: Date;
  expectedShipmentDate?: Date;
  paymentTerms?: string;
  deliveryMethod?: string;
  salesperson?: string;
  projectName?: string;
  subject?: string;
  challanType?: string;
  attachments?: {
    name: string;
    size?: number;
    type?: string;
    data?: string;
    url?: string;
  }[];
  termsAndConditions?: string;
  customerNotes?: string;
  subTotal?: number;
  discount?: number;
  discountType?: "percent" | "amount";
  taxType?: "TDS" | "TCS" | "GST";
  taxName?: string;
  taxRate?: number;
  taxAmount?: number;
  tdsTcsType?: "TDS" | "TCS" | "None";
  tdsTcsName?: string;
  tdsTcsRate?: number;
  tdsTcsAmount?: number;
  adjustment?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  shippingCharges?: number;
  roundOff?: number;
  currency?: string;
  placeOfSupply?: string;
  customerSnapshot?: CustomerSnapshot;
  bankDetailsSnapshot?: BankDetailsSnapshot;
  emailsSent?: EmailLogRecord[];
  paymentDate?: Date;
  bankAccountId?: Types.ObjectId;
  receiptNumber?: string;
  items?: InvoiceItemRecord[];
  balanceRemaining?: number;
  accountsReceivable?: string;
  invoicesApplied?: {
    invoiceId: Types.ObjectId | string;
    invoiceNumber: string;
    amountApplied: number;
    appliedDate: Date;
    notes?: string;
  }[];
  creditsApplied?: {
    creditNoteId: Types.ObjectId | string;
    creditNoteNumber: string;
    amount: number;
    appliedDate: Date;
    notes?: string;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreditNoteSettingsRecord {
  organizationId: Types.ObjectId;
  creditNotePrefix: string;
  nextNumber: number;
  autoGenerateNumbering?: boolean;
  numberZeroPadding?: number;
  restartNumberingEachFiscalYear?: boolean;
  lastFiscalYear?: string;
  defaultNotes?: string;
  defaultTerms?: string;
}

export interface DeliveryChallanSettingsRecord {
  organizationId: Types.ObjectId;
  prefix: string;
  nextNumber: number;
  autoGenerateNumbering?: boolean;
  numberZeroPadding?: number;
  restartNumberingEachFiscalYear?: boolean;
  lastFiscalYear?: string;
  defaultNotes?: string;
  defaultTerms?: string;
}

export interface InvoiceSettingsRecord {
  organizationId: Types.ObjectId;
  invoicePrefix: string;
  nextNumber: number;
  autoGenerateNumbering?: boolean;
  numberZeroPadding?: number;
  restartNumberingEachFiscalYear?: boolean;
  lastFiscalYear?: string;
  defaultPaymentTerms: string;
  defaultNotes: string;
  defaultTerms: string;
  currency: string;
  defaultTaxRate: number;
  createdAt?: Date;
  updatedAt?: Date;
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
  bankDetails: {
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
    ifsc?: string;
    branch?: string;
    upiId?: string;
  };
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

const CustomerSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    customerType: { type: String, enum: ["Business", "Individual"], default: "Business" },
    salutation: String,
    firstName: String,
    lastName: String,
    companyName: String,
    contactPerson: String,
    email: String,
    phone: String,
    mobile: String,
    gstin: String,
    pan: String,
    state: String,
    customerLanguage: { type: String, default: "English" },
    currency: { type: String, default: "INR" },
    paymentTerms: { type: String, default: "Due on Receipt" },
    openingBalance: { type: Number, default: 0 },
    creditLimit: { type: Number, default: 0 },
    unusedCredits: { type: Number, default: 0 },
    allowPortal: { type: Boolean, default: false },
    billingAddress: {
      attention: String,
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    shippingAddress: {
      attention: String,
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    contactPersons: [{
      name: String,
      email: String,
      phone: String,
      mobile: String,
    }],
    customFields: [{ label: String, value: String }],
    reportingTags: [String],
    remarks: String,
    status: { type: String, enum: ["Active", "Inactive", "Review"], default: "Active" },
  },
  { timestamps: true },
);
CustomerSchema.index({ organizationId: 1, name: 1 }, { unique: false });

const VendorSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    email: String,
    phone: String,
    gstin: String,
    state: String,
    openingBalance: { type: Number, default: 0 },
    status: { type: String, enum: ["Active", "Inactive", "Pending"], default: "Active" },
  },
  { timestamps: true, strict: false },
);

const ItemSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    hsnCode: String,
    type: { type: String, enum: ["goods", "service"], default: "goods" },
    unit: String,
    salesPrice: Number,
    purchasePrice: Number,
    gstRate: Number,
    openingStock: { type: Number, default: 0 },
    reorderLevel: Number,
    inventoryTracking: { type: Boolean, default: true },
    commodityCategory: String,
    varieties: [{ type: String, trim: true }],
    grades: [{ type: String, trim: true }],
    sizeCalibres: [{ type: String, trim: true }],
    alternateUnits: [
      {
        unit: { type: String, required: true },
        kilogramsPerUnit: { type: Number, required: true, min: 0.000001 },
      },
    ],
    standardBagWeightKg: { type: Number, min: 0.000001 },
    packagingTypes: [{ type: String, trim: true }],
    qualityParameters: [{ name: { type: String, required: true }, unit: String, required: Boolean }],
    shelfLifeDays: { type: Number, min: 1 },
    salesAccount: { type: String, default: "Sales" },
    salesDescription: { type: String, default: "" },
    purchaseAccount: { type: String, default: "Cost of Goods Sold" },
    purchaseDescription: { type: String, default: "" },
    preferredVendor: { type: String, default: "" },
    trackSales: { type: Boolean, default: true },
    trackPurchase: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
ItemSchema.index({ organizationId: 1, sku: 1 }, { unique: true });

const InvoiceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    invoiceNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    status: { type: String, enum: ["Draft", "Sent", "Paid", "Partly paid", "Overdue"], default: "Draft" },
    subtotal: Number,
    discount: Number,
    taxRate: Number,
    total: Number,
    amountPaid: Number,
    dueDate: Date,
  },
  { timestamps: true },
);
InvoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });

const SalesDocumentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    type: {
      type: String,
      enum: [
        "Quote",
        "Sales Order",
        "Invoice",
        "Recurring Invoice",
        "Delivery Challan",
        "Payment Received",
        "Credit Note",
      ],
      required: true,
    },
    number: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    relatedDocumentId: { type: Schema.Types.ObjectId, ref: "SalesDocument" },
    status: { type: String, required: true, default: "Draft" },
    issueDate: { type: Date, default: Date.now },
    dueDate: Date,
    nextRunDate: Date,
    frequency: { type: String, enum: ["Weekly", "Monthly", "Quarterly", "Yearly"] },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    creditedAmount: { type: Number, default: 0, min: 0 },
    method: { type: String, enum: ["Cash", "Bank", "UPI", "Cheque"] },
    referenceNumber: String,
    notes: String,
    expiryDate: Date,
    expectedShipmentDate: Date,
    paymentTerms: String,
    deliveryMethod: String,
    salesperson: String,
    projectName: String,
    subject: String,
    challanType: { type: String, default: "Supply on Approval" },
    attachments: [
      {
        name: { type: String, required: true },
        size: Number,
        type: { type: String },
        data: String,
        url: String,
      },
    ],
    termsAndConditions: String,
    customerNotes: String,
    subTotal: Number,
    discount: Number,
    discountType: { type: String, enum: ["percent", "amount"], default: "percent" },
    taxType: { type: String, enum: ["TDS", "TCS", "GST"], default: "GST" },
    taxName: String,
    taxRate: Number,
    taxAmount: Number,
    tdsTcsType: { type: String, enum: ["TDS", "TCS", "None"], default: "None" },
    tdsTcsName: String,
    tdsTcsRate: { type: Number, default: 0 },
    tdsTcsAmount: { type: Number, default: 0 },
    adjustment: Number,
    cgst: Number,
    sgst: Number,
    igst: Number,
    shippingCharges: Number,
    roundOff: Number,
    currency: { type: String, default: "INR" },
    placeOfSupply: String,
    paymentDate: Date,
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount" },
    receiptNumber: String,
    customerSnapshot: {
      name: String,
      companyName: String,
      gstin: String,
      pan: String,
      email: String,
      phone: String,
      mobile: String,
      billingAddress: {
        attention: String,
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
      },
      shippingAddress: {
        attention: String,
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
      },
    },
    bankDetailsSnapshot: {
      bankName: String,
      accountHolder: String,
      accountNumber: String,
      ifsc: String,
      branch: String,
      upiId: String,
    },
    emailsSent: [
      {
        sentAt: { type: Date, default: Date.now },
        to: { type: String, required: true },
        cc: String,
        bcc: String,
        subject: { type: String, required: true },
        message: String,
        status: { type: String, default: "Sent" },
      },
    ],
    items: [
      {
        itemId: { type: Schema.Types.ObjectId, ref: "Item" },
        name: { type: String, required: true },
        description: String,
        account: { type: String, default: "Sales" },
        hsnCode: String,
        unit: String,
        quantity: { type: Number, default: 1 },
        rate: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        discountType: { type: String, enum: ["percent", "amount"], default: "percent" },
        taxRate: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
      },
    ],
    balanceRemaining: { type: Number, default: 0 },
    accountsReceivable: { type: String, default: "Accounts Receivable" },
    invoicesApplied: [
      {
        invoiceId: { type: Schema.Types.ObjectId, ref: "SalesDocument" },
        invoiceNumber: String,
        amountApplied: Number,
        appliedDate: { type: Date, default: Date.now },
        notes: String,
      },
    ],
    creditsApplied: [
      {
        creditNoteId: { type: Schema.Types.ObjectId, ref: "SalesDocument" },
        creditNoteNumber: String,
        amount: Number,
        appliedDate: { type: Date, default: Date.now },
        notes: String,
      },
    ],
  },
  { timestamps: true },
);
SalesDocumentSchema.index({ organizationId: 1, type: 1, number: 1 }, { unique: true });
SalesDocumentSchema.index({ organizationId: 1, type: 1, status: 1 });
SalesDocumentSchema.index({ organizationId: 1, type: 1, dueDate: 1 });
SalesDocumentSchema.index({ organizationId: 1, type: 1, customerId: 1 });

const PaymentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ["Cash", "Bank", "UPI", "Cheque"], default: "Bank" },
    referenceNumber: String,
    status: { type: String, enum: ["Posted", "Reversed"], default: "Posted" },
  },
  { timestamps: true },
);

const InvoiceSettingsSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true, index: true },
    invoicePrefix: { type: String, default: "INV-" },
    nextNumber: { type: Number, default: 1 },
    autoGenerateNumbering: { type: Boolean, default: true },
    numberZeroPadding: { type: Number, default: 6 },
    restartNumberingEachFiscalYear: { type: Boolean, default: false },
    lastFiscalYear: { type: String, default: "" },
    defaultPaymentTerms: { type: String, default: "Due on Receipt" },
    defaultNotes: { type: String, default: "Thank you for your business. Please reach out with any questions." },
    defaultTerms: {
      type: String,
      default: "1. Payment is due as per the terms specified above.\n2. Please quote invoice number in all payment remittances.\n3. Goods once sold will not be returned without prior authorization.",
    },
    currency: { type: String, default: "INR" },
    defaultTaxRate: { type: Number, default: 18 },
    companyDetails: {
      legalName: { type: String, default: "Bharat Traders & Commodities Ltd." },
      tradeName: { type: String, default: "LedgerFlow" },
      gstin: { type: String, default: "" },
      pan: { type: String, default: "" },
      email: { type: String, default: "billing@ledgerflow.io" },
      phone: { type: String, default: "+91 98765 43210" },
      website: { type: String, default: "https://ledgerflow.io" },
      address: { type: String, default: "Plot 42, APMC Market Yard" },
      city: { type: String, default: "Navi Mumbai" },
      state: { type: String, default: "Maharashtra" },
      postalCode: { type: String, default: "400705" },
      country: { type: String, default: "India" },
      logoUrl: { type: String, default: "" },
    },
    bankDetails: {
      bankName: { type: String, default: "HDFC Bank Ltd." },
      accountHolder: { type: String, default: "Bharat Traders" },
      accountNumber: { type: String, default: "50200012345678" },
      ifsc: { type: String, default: "HDFC0001234" },
      branch: { type: String, default: "Vashi Sector 19" },
      upiId: { type: String, default: "bharattraders@hdfcbank" },
    },
    showCompanyLogo: { type: Boolean, default: true },
    pdfTemplate: {
      layout: { type: String, enum: ["modern", "classic", "minimal"], default: "modern" },
      accentColor: { type: String, default: "#2563eb" },
      showCompanyLogo: { type: Boolean, default: true },
      showQrCode: { type: Boolean, default: true },
      showSignature: { type: Boolean, default: true },
      signatureLabel: { type: String, default: "Authorized Signatory" },
    },
  },
  { timestamps: true },
);

export const Customer =
  (mongoose.models.Customer as Model<CustomerRecord>) ||
  mongoose.model<CustomerRecord>("Customer", CustomerSchema);

export const Vendor =
  (mongoose.models.Vendor as Model<VendorRecord>) ||
  mongoose.model<VendorRecord>("Vendor", VendorSchema);

export const Item =
  (mongoose.models.Item as Model<Record<string, unknown>>) ||
  mongoose.model("Item", ItemSchema);

export const Invoice =
  (mongoose.models.Invoice as Model<Record<string, unknown>>) ||
  mongoose.model("Invoice", InvoiceSchema);

export const SalesDocument =
  (mongoose.models.SalesDocument as Model<SalesDocumentRecord>) ||
  mongoose.model<SalesDocumentRecord>("SalesDocument", SalesDocumentSchema);

export const Payment =
  (mongoose.models.Payment as Model<Record<string, unknown>>) ||
  mongoose.model("Payment", PaymentSchema);

export const InvoiceSettings =
  (mongoose.models.InvoiceSettings as Model<InvoiceSettingsRecord>) ||
  mongoose.model<InvoiceSettingsRecord>("InvoiceSettings", InvoiceSettingsSchema);

const CreditNoteSettingsSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true, index: true },
    creditNotePrefix: { type: String, default: "CN-" },
    nextNumber: { type: Number, default: 2 },
    autoGenerateNumbering: { type: Boolean, default: true },
    numberZeroPadding: { type: Number, default: 5 },
    restartNumberingEachFiscalYear: { type: Boolean, default: false },
    lastFiscalYear: { type: String, default: "" },
    defaultNotes: { type: String, default: "Will be displayed on the credit note" },
    defaultTerms: {
      type: String,
      default: "Enter the terms and conditions of your business to be displayed in your transaction",
    },
  },
  { timestamps: true }
);

export const CreditNoteSettings =
  (mongoose.models.CreditNoteSettings as Model<CreditNoteSettingsRecord>) ||
  mongoose.model<CreditNoteSettingsRecord>("CreditNoteSettings", CreditNoteSettingsSchema);

const DeliveryChallanSettingsSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true, index: true },
    prefix: { type: String, default: "DC-" },
    nextNumber: { type: Number, default: 2 },
    autoGenerateNumbering: { type: Boolean, default: true },
    numberZeroPadding: { type: Number, default: 5 },
    restartNumberingEachFiscalYear: { type: Boolean, default: false },
    lastFiscalYear: { type: String, default: "" },
    defaultNotes: { type: String, default: "" },
    defaultTerms: { type: String, default: "" },
  },
  { timestamps: true }
);

export const DeliveryChallanSettings =
  (mongoose.models.DeliveryChallanSettings as Model<DeliveryChallanSettingsRecord>) ||
  mongoose.model<DeliveryChallanSettingsRecord>("DeliveryChallanSettings", DeliveryChallanSettingsSchema);
