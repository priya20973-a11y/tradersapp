import mongoose, { Schema, Types, type Model } from "mongoose";

export interface RecurringBillItem {
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

export interface GeneratedBillLog {
  billId: Types.ObjectId | string;
  billNumber: string;
  generatedAt: Date;
  total: number;
  status?: string;
}

export interface RecurringBillRecord {
  _id?: Types.ObjectId | string;
  id?: string;
  organizationId: Types.ObjectId;
  profileName: string;
  vendorId: Types.ObjectId;
  vendorName: string;
  repeatEvery: "Week" | "2 Weeks" | "Month" | "2 Months" | "3 Months" | "6 Months" | "Year";
  startDate: Date;
  endsOn?: Date | null;
  neverExpires: boolean;
  nextBillDate: Date;
  lastGeneratedDate?: Date | null;
  billsGeneratedCount: number;
  paymentTerms: string;
  accountsPayable: string;
  items: RecurringBillItem[];
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
  currency: string;
  notes?: string;
  termsAndConditions?: string;
  status: "Active" | "Paused" | "Expired";
  generatedBills?: GeneratedBillLog[];
  createdAt?: Date;
  updatedAt?: Date;
}

const RecurringBillSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    profileName: { type: String, required: true, trim: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    vendorName: { type: String, required: true, trim: true },
    repeatEvery: {
      type: String,
      enum: ["Week", "2 Weeks", "Month", "2 Months", "3 Months", "6 Months", "Year"],
      default: "Month",
      required: true,
    },
    startDate: { type: Date, required: true, default: Date.now },
    endsOn: { type: Date, default: null },
    neverExpires: { type: Boolean, default: true },
    nextBillDate: { type: Date, required: true, index: true },
    lastGeneratedDate: { type: Date, default: null },
    billsGeneratedCount: { type: Number, default: 0, min: 0 },
    paymentTerms: { type: String, default: "Due on Receipt" },
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
        customerId: { type: Schema.Types.Mixed },
        customerName: { type: String, default: "" },
        amount: { type: Number, default: 0 },
      },
    ],
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
    currency: { type: String, default: "INR" },
    notes: { type: String, default: "" },
    termsAndConditions: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Active", "Paused", "Expired"],
      default: "Active",
      index: true,
    },
    generatedBills: [
      {
        billId: { type: Schema.Types.ObjectId, ref: "PurchaseBill" },
        billNumber: { type: String, required: true },
        generatedAt: { type: Date, default: Date.now },
        total: { type: Number, required: true },
        status: { type: String, default: "Pending" },
      },
    ],
  },
  { timestamps: true },
);

RecurringBillSchema.index({ organizationId: 1, profileName: 1 });
RecurringBillSchema.index({ organizationId: 1, status: 1, nextBillDate: 1 });

export const RecurringBill =
  (mongoose.models.RecurringBill as Model<RecurringBillRecord>) ||
  mongoose.model<RecurringBillRecord>("RecurringBill", RecurringBillSchema);
