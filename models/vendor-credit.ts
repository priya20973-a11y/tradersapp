import mongoose, { Schema, Types, type Model } from "mongoose";

export interface VendorCreditItem {
  itemId?: Types.ObjectId | string;
  name: string;
  description?: string;
  account?: string;
  quantity: number;
  rate: number;
  taxRate?: number;
  taxAmount?: number;
  amount: number;
}

export interface VendorCreditAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  uploadedAt?: Date;
}

export interface VendorCreditBillApplication {
  billId: Types.ObjectId | string;
  billNumber: string;
  amountApplied: number;
  appliedDate: Date;
  notes?: string;
}

export interface VendorCreditRecord {
  _id?: Types.ObjectId | string;
  id?: string;
  organizationId: Types.ObjectId;
  creditNoteNumber: string;
  vendorId: Types.ObjectId;
  vendorName: string;
  orderNumber?: string;
  vendorCreditDate: Date;
  subject?: string;
  accountsPayable: string;
  items: VendorCreditItem[];
  subTotal: number;
  discount: number;
  discountType: "percent" | "amount";
  discountAmount: number;
  taxType: "GST" | "TDS" | "TCS" | "None";
  taxRate: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  adjustment: number;
  total: number;
  balanceRemaining: number;
  appliedAmount: number;
  currency: string;
  notes?: string;
  status: "Draft" | "Open" | "Partially Applied" | "Closed" | "Void";
  attachments?: VendorCreditAttachment[];
  billsApplied?: VendorCreditBillApplication[];
  createdAt?: Date;
  updatedAt?: Date;
}

const VendorCreditSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    creditNoteNumber: { type: String, required: true, trim: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    vendorName: { type: String, required: true, trim: true },
    orderNumber: { type: String, default: "" },
    vendorCreditDate: { type: Date, default: Date.now, index: true },
    subject: { type: String, default: "", maxLength: 250 },
    accountsPayable: { type: String, default: "Accounts Payable" },
    items: [
      {
        itemId: { type: Schema.Types.Mixed },
        name: { type: String, required: true },
        description: { type: String, default: "" },
        account: { type: String, default: "Cost of Goods Sold" },
        quantity: { type: Number, default: 1, min: 0.001 },
        rate: { type: Number, default: 0, min: 0 },
        taxRate: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
      },
    ],
    subTotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0 },
    discountType: { type: String, enum: ["percent", "amount"], default: "percent" },
    discountAmount: { type: Number, default: 0 },
    taxType: { type: String, enum: ["GST", "TDS", "TCS", "None"], default: "GST" },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    adjustment: { type: Number, default: 0 },
    total: { type: Number, required: true, min: 0 },
    balanceRemaining: { type: Number, required: true, min: 0 },
    appliedAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "INR" },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Draft", "Open", "Partially Applied", "Closed", "Void"],
      default: "Open",
      index: true,
    },
    attachments: [
      {
        name: { type: String, required: true },
        size: { type: Number, required: true },
        type: { type: String, default: "" },
        dataUrl: { type: String, default: "" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    billsApplied: [
      {
        billId: { type: Schema.Types.ObjectId, ref: "PurchaseBill", required: true },
        billNumber: { type: String, required: true },
        amountApplied: { type: Number, required: true, min: 0.01 },
        appliedDate: { type: Date, default: Date.now },
        notes: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true },
);

VendorCreditSchema.index({ organizationId: 1, creditNoteNumber: 1 }, { unique: true });
VendorCreditSchema.index({ organizationId: 1, vendorId: 1, vendorCreditDate: -1 });

export const VendorCredit =
  (mongoose.models.VendorCredit as Model<VendorCreditRecord>) ||
  mongoose.model<VendorCreditRecord>("VendorCredit", VendorCreditSchema);
