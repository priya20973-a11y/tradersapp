import mongoose, { Schema, Types, type Model } from "mongoose";

export type PurchaseOrderStatus =
  | "Draft"
  | "Sent"
  | "Partially Received"
  | "Received"
  | "Cancelled";

export interface PurchaseOrderItemRecord {
  itemId?: Types.ObjectId | string;
  name: string;
  description?: string;
  sku?: string;
  account?: string;
  quantity: number;
  receivedQuantity: number;
  unit: string;
  rate: number;
  discount: number;
  discountType: "percent" | "amount";
  taxRate: number;
  taxAmount: number;
  amount: number;
}

export interface PurchaseOrderRecord {
  _id?: Types.ObjectId | string;
  id?: string;
  organizationId: Types.ObjectId;
  purchaseOrderNumber: string;
  referenceNumber?: string;
  vendorId?: Types.ObjectId | string;
  vendorName: string;
  vendorDetails?: {
    companyName?: string;
    email?: string;
    phone?: string;
    gstin?: string;
    pan?: string;
    address?: {
      attention?: string;
      street1?: string;
      street2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
  deliveryAddressType: "organization" | "customer";
  customerId?: Types.ObjectId | string;
  customerName?: string;
  deliveryAddress?: {
    attention?: string;
    name?: string;
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  };
  orderDate: string;
  deliveryDate?: string;
  paymentTerms: string;
  shipmentPreference: string;
  items: PurchaseOrderItemRecord[];
  subtotal: number;
  discount: number;
  discountType: "percent" | "amount";
  discountAmount: number;
  taxType: "None" | "TDS" | "TCS";
  taxName?: string;
  taxRate: number;
  taxDeduction: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
  adjustment: number;
  adjustmentDescription?: string;
  total: number;
  status: PurchaseOrderStatus;
  paymentStatus?: "Unpaid" | "Partially Paid" | "Paid";
  notes?: string;
  termsAndConditions?: string;
  attachments?: {
    id: string;
    name: string;
    size: number;
    type: string;
    url?: string;
    uploadedAt: string;
  }[];
  emailsSent?: {
    sentAt: Date;
    to: string;
    subject: string;
    status: string;
  }[];
  receivingLogs?: {
    receivedAt: Date;
    receivedBy: string;
    notes?: string;
    items: {
      name: string;
      quantityReceived: number;
    }[];
  }[];
  createdAt?: Date;
  updatedAt?: Date;
}

const PurchaseOrderItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.Mixed },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    sku: { type: String, default: "" },
    account: { type: String, default: "Cost of Goods Sold" },
    quantity: { type: Number, required: true, min: 0.001 },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "pcs" },
    rate: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    discountType: { type: String, enum: ["percent", "amount"], default: "percent" },
    taxRate: { type: Number, default: 18, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const PurchaseOrderSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    purchaseOrderNumber: { type: String, required: true, trim: true },
    referenceNumber: { type: String, default: "", trim: true },
    vendorId: { type: Schema.Types.Mixed },
    vendorName: { type: String, required: true, trim: true },
    vendorDetails: {
      companyName: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      gstin: { type: String, default: "" },
      pan: { type: String, default: "" },
      address: {
        attention: { type: String, default: "" },
        street1: { type: String, default: "" },
        street2: { type: String, default: "" },
        city: { type: String, default: "" },
        state: { type: String, default: "" },
        postalCode: { type: String, default: "" },
        country: { type: String, default: "India" },
      },
    },
    deliveryAddressType: { type: String, enum: ["organization", "customer"], default: "organization" },
    customerId: { type: Schema.Types.Mixed },
    customerName: { type: String, default: "" },
    deliveryAddress: {
      attention: { type: String, default: "" },
      name: { type: String, default: "" },
      street1: { type: String, default: "" },
      street2: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      country: { type: String, default: "India" },
      phone: { type: String, default: "" },
    },
    orderDate: { type: String, required: true },
    deliveryDate: { type: String, default: "" },
    paymentTerms: { type: String, default: "Due on Receipt" },
    shipmentPreference: { type: String, default: "Surface Express Freight" },
    items: [PurchaseOrderItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    discountType: { type: String, enum: ["percent", "amount"], default: "percent" },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxType: { type: String, enum: ["None", "TDS", "TCS"], default: "None" },
    taxName: { type: String, default: "" },
    taxRate: { type: Number, default: 0, min: 0 },
    taxDeduction: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    adjustment: { type: Number, default: 0 },
    adjustmentDescription: { type: String, default: "" },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["Draft", "Sent", "Partially Received", "Received", "Cancelled"],
      default: "Draft",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Partially Paid", "Paid"],
      default: "Unpaid",
      index: true,
    },
    notes: { type: String, default: "" },
    termsAndConditions: { type: String, default: "" },
    attachments: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        size: { type: Number, default: 0 },
        type: { type: String, default: "" },
        url: { type: String, default: "" },
        uploadedAt: { type: String, default: "" },
      },
    ],
    emailsSent: [
      {
        sentAt: { type: Date, default: Date.now },
        to: { type: String, required: true },
        subject: { type: String, required: true },
        status: { type: String, default: "Sent" },
      },
    ],
    receivingLogs: [
      {
        receivedAt: { type: Date, default: Date.now },
        receivedBy: { type: String, default: "Store Manager" },
        notes: { type: String, default: "" },
        items: [
          {
            name: { type: String, required: true },
            quantityReceived: { type: Number, required: true },
          },
        ],
      },
    ],
  },
  { timestamps: true, strict: false },
);

PurchaseOrderSchema.index({ organizationId: 1, purchaseOrderNumber: 1 });
PurchaseOrderSchema.index({ organizationId: 1, status: 1 });
PurchaseOrderSchema.index({ organizationId: 1, orderDate: -1 });

export const PurchaseOrder =
  (mongoose.models.PurchaseOrder as Model<PurchaseOrderRecord>) ||
  mongoose.model<PurchaseOrderRecord>("PurchaseOrder", PurchaseOrderSchema);

export interface PurchaseOrderPreferencesRecord {
  _id?: Types.ObjectId | string;
  organizationId: Types.ObjectId;
  autoGenerateNumbering: boolean;
  prefix: string;
  nextNumber: number;
  numberZeroPadding: number;
  restartNumberingEachFiscalYear: boolean;
  lastFiscalYear: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const PurchaseOrderPreferencesSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    autoGenerateNumbering: { type: Boolean, default: true },
    prefix: { type: String, default: "PO-" },
    nextNumber: { type: Number, default: 2 },
    numberZeroPadding: { type: Number, default: 5 },
    restartNumberingEachFiscalYear: { type: Boolean, default: false },
    lastFiscalYear: { type: String, default: "" },
  },
  { timestamps: true }
);

export const PurchaseOrderPreferences =
  (mongoose.models.PurchaseOrderPreferences as Model<PurchaseOrderPreferencesRecord>) ||
  mongoose.model<PurchaseOrderPreferencesRecord>(
    "PurchaseOrderPreferences",
    PurchaseOrderPreferencesSchema
  );

