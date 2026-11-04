import mongoose, { Schema, Types, type Model } from "mongoose";

export interface PurchaseBillItemRecord {
  itemId?: Types.ObjectId | string;
  name: string;
  description?: string;
  account?: string;
  quantity: number;
  rate: number;
  taxRate?: number;
  taxAmount?: number;
  customerId?: Types.ObjectId | string;
  customerName?: string;
  amount: number;
}

export interface PurchaseBillAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  uploadedAt?: Date;
}

export interface BillCreditAppliedRecord {
  creditId: Types.ObjectId | string;
  creditNoteNumber: string;
  amount: number;
  appliedDate: Date;
  notes?: string;
}

export interface PurchaseBillRecord {
  _id?: Types.ObjectId | string;
  id?: string;
  organizationId: Types.ObjectId;
  billNumber: string;
  vendorId: Types.ObjectId;
  vendorName: string;
  orderNumber?: string;
  billDate: Date;
  dueDate?: Date;
  paymentTerms?: string;
  accountsPayable?: string;
  subject?: string;
  subTotal: number;
  discount: number;
  discountType: "percent" | "amount";
  discountAmount: number;
  taxType: "GST" | "TDS" | "None";
  taxRate: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  adjustment: number;
  total: number;
  amountPaid: number;
  vendorCreditApplied?: number;
  creditsApplied?: BillCreditAppliedRecord[];
  balanceDue: number;
  status: "Draft" | "Pending" | "Partially Paid" | "Paid" | "Void";
  category?: string;
  items?: PurchaseBillItemRecord[];
  notes?: string;
  termsAndConditions?: string;
  attachments?: PurchaseBillAttachment[];
  currency?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const PurchaseBillSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    billNumber: { type: String, required: true, trim: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    vendorName: { type: String, required: true, trim: true },
    orderNumber: { type: String, default: "" },
    billDate: { type: Date, default: Date.now, index: true },
    dueDate: { type: Date },
    paymentTerms: { type: String, default: "Due on Receipt" },
    accountsPayable: { type: String, default: "Accounts Payable" },
    subject: { type: String, default: "" },
    subTotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0 },
    discountType: { type: String, enum: ["percent", "amount"], default: "percent" },
    discountAmount: { type: Number, default: 0 },
    taxType: { type: String, enum: ["GST", "TDS", "None"], default: "GST" },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    adjustment: { type: Number, default: 0 },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    vendorCreditApplied: { type: Number, default: 0, min: 0 },
    creditsApplied: [
      {
        creditId: { type: Schema.Types.ObjectId, ref: "VendorCredit", required: true },
        creditNoteNumber: { type: String, required: true },
        amount: { type: Number, required: true, min: 0.01 },
        appliedDate: { type: Date, default: Date.now },
        notes: { type: String, default: "" },
      },
    ],
    status: {
      type: String,
      enum: ["Draft", "Pending", "Partially Paid", "Paid", "Void"],
      default: "Pending",
      index: true,
    },
    category: { type: String, default: "Cost of Goods Sold" },
    items: [
      {
        itemId: { type: Schema.Types.Mixed },
        name: { type: String, required: true },
        description: { type: String, default: "" },
        account: { type: String, default: "Cost of Goods Sold" },
        quantity: { type: Number, default: 1 },
        rate: { type: Number, default: 0 },
        taxRate: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        customerId: { type: Schema.Types.Mixed },
        customerName: { type: String, default: "" },
        amount: { type: Number, default: 0 },
      },
    ],
    notes: { type: String, default: "" },
    termsAndConditions: { type: String, default: "" },
    attachments: [
      {
        name: { type: String, required: true },
        size: { type: Number, required: true },
        type: { type: String, default: "" },
        dataUrl: { type: String, default: "" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    currency: { type: String, default: "INR" },
  },
  { timestamps: true },
);

PurchaseBillSchema.index({ organizationId: 1, billNumber: 1 }, { unique: true });
PurchaseBillSchema.index({ organizationId: 1, vendorId: 1, billDate: -1 });

export interface VendorPaymentRecord {
  _id?: Types.ObjectId | string;
  id?: string;
  organizationId: Types.ObjectId;
  paymentNumber: string;
  vendorId: Types.ObjectId;
  vendorName: string;
  billId?: Types.ObjectId;
  billNumber?: string;
  paymentDate: Date;
  amount: number;
  paymentMode: "Bank Transfer" | "UPI" | "Cash" | "Cheque" | "NEFT / RTGS" | "Credit Card";
  referenceNumber?: string;
  notes?: string;
  status: "Cleared" | "Disbursed" | "In Clearing";
  currency?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const VendorPaymentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    paymentNumber: { type: String, required: true, trim: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    vendorName: { type: String, required: true, trim: true },
    billId: { type: Schema.Types.ObjectId, ref: "PurchaseBill", index: true },
    billNumber: { type: String, default: "" },
    paymentDate: { type: Date, default: Date.now, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMode: {
      type: String,
      enum: ["Bank Transfer", "UPI", "Cash", "Cheque", "NEFT / RTGS", "Credit Card"],
      default: "Bank Transfer",
    },
    referenceNumber: { type: String, default: "", trim: true },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Cleared", "Disbursed", "In Clearing"],
      default: "Cleared",
      index: true,
    },
    currency: { type: String, default: "INR" },
  },
  { timestamps: true },
);

VendorPaymentSchema.index({ organizationId: 1, paymentNumber: 1 }, { unique: true });
VendorPaymentSchema.index({ organizationId: 1, vendorId: 1, paymentDate: -1 });

export const PurchaseBill =
  (mongoose.models.PurchaseBill as Model<PurchaseBillRecord>) ||
  mongoose.model<PurchaseBillRecord>("PurchaseBill", PurchaseBillSchema);

export const VendorPayment =
  (mongoose.models.VendorPayment as Model<VendorPaymentRecord>) ||
  mongoose.model<VendorPaymentRecord>("VendorPayment", VendorPaymentSchema);
