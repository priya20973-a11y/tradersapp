import mongoose, { Schema, Types, type Model } from "mongoose";

export type TraderRole = "Buyer" | "Seller" | "Broker" | "Commission Agent" | "Consignment Owner";

export interface TraderProfileRecord {
  organizationId: Types.ObjectId;
  traderCode: string;
  legalBusinessName: string;
  tradeName?: string;
  businessType: string;
  tradingStatus: "Active" | "Inactive" | "Blocked";
  roles: TraderRole[];
  customerId?: Types.ObjectId;
  vendorId?: Types.ObjectId;
  mainCommodities: string[];
  primaryMarket?: string;
  operatingMarkets: string[];
  preferredWarehouseIds: Types.ObjectId[];
  accountManagerId?: Types.ObjectId;
  preferredLanguage?: string;
  notes?: string;
  tags: string[];
  gstRegistrationType?: string;
  gstin?: string;
  pan?: string;
  gstinVerificationStatus: string;
  licenses: { type: string; number: string; expiresAt?: Date }[];
  kycStatus: string;
  kycReviewDate?: Date;
  kycReviewedBy?: Types.ObjectId;
  contacts: { name: string; designation?: string; mobile?: string; whatsapp?: string; email?: string }[];
  billingAddress?: { line1?: string; city?: string; district?: string; state?: string; stateCode?: string; country?: string; postalCode?: string };
  shippingAddress?: { line1?: string; city?: string; district?: string; state?: string; stateCode?: string; country?: string; postalCode?: string };
  branches: { name: string; address?: string; city?: string; state?: string; postalCode?: string }[];
  creditLimit: number;
  creditPeriodDays: number;
  paymentTerms?: string;
  openingReceivable: number;
  openingPayable: number;
  securityDeposit: number;
  preferredPaymentMethods: string[];
  riskCategory: string;
  creditApprovalStatus: string;
  approvedBy?: Types.ObjectId;
  creditHoldReason?: string;
  bankAccounts: {
    _id: Types.ObjectId;
    accountHolderName: string;
    bankName: string;
    encryptedAccountNumber: string;
    accountNumberLast4: string;
    ifscCode?: string;
    branch?: string;
    verificationStatus: string;
    upiId?: string;
  }[];
}

export interface WarehouseRecord {
  organizationId: Types.ObjectId;
  code: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  status: "Active" | "Inactive";
  locations: { code: string; name: string; type: string; capacity?: number; unit?: string }[];
}

export interface TradeDealRecord {
  organizationId: Types.ObjectId;
  dealReference: string;
  dealType: string;
  status: string;
  tradeDate: Date;
  buyerTraderId?: Types.ObjectId;
  sellerTraderId?: Types.ObjectId;
  brokerTraderId?: Types.ObjectId;
  commodityItemId: Types.ObjectId;
  variety?: string;
  grade?: string;
  cropYear?: string;
  originMarket?: string;
  contractedQuantity: number;
  unit: string;
  actualBagWeight?: number;
  agreedRate: number;
  rateBasis: string;
  commissionRate: number;
  commissionAmount: number;
  otherCharges: number;
  expectedDeliveryDate?: Date;
  deliveryLocation?: string;
  warehouseId?: Types.ObjectId;
  linkedSalesOrderId?: Types.ObjectId;
  linkedPurchaseOrderReference?: string;
  linkedInvoiceIds: Types.ObjectId[];
  advanceAmount: number;
  settlementTerms?: string;
  internalRemarks?: string;
  estimatedCosts: { category: string; amount: number }[];
  realizedCosts: { category: string; amount: number }[];
  deliveredQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  settledAmount: number;
}
export * from "./inventory";


export interface TraderPaymentRecord {
  organizationId: Types.ObjectId;
  traderId: Types.ObjectId;
  direction: "Receipt" | "Payment";
  paymentDate: Date;
  method: string;
  amount: number;
  unallocatedAmount: number;
  allocations: { targetType: "Invoice" | "Deal"; targetId: Types.ObjectId; amount: number }[];
  referenceNumber?: string;
  notes?: string;
  status: "Posted" | "Reversed";
  idempotencyKey: string;
  actorId: string;
}

const TraderProfileSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    traderCode: { type: String, required: true, trim: true, uppercase: true },
    legalBusinessName: { type: String, required: true, trim: true },
    tradeName: { type: String, trim: true },
    businessType: {
      type: String,
      enum: ["Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited", "FPO", "Cooperative", "Other"],
      required: true,
    },
    tradingStatus: { type: String, enum: ["Active", "Inactive", "Blocked"], default: "Active" },
    roles: {
      type: [String],
      enum: ["Buyer", "Seller", "Broker", "Commission Agent", "Consignment Owner"],
      required: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    mainCommodities: [{ type: String, trim: true }],
    primaryMarket: String,
    operatingMarkets: [{ type: String, trim: true }],
    preferredWarehouseIds: [{ type: Schema.Types.ObjectId, ref: "Warehouse" }],
    accountManagerId: { type: Schema.Types.ObjectId, ref: "User" },
    preferredLanguage: String,
    notes: String,
    tags: [{ type: String, trim: true }],
    gstRegistrationType: String,
    gstin: { type: String, uppercase: true, trim: true },
    pan: { type: String, uppercase: true, trim: true },
    gstinVerificationStatus: { type: String, enum: ["Unverified", "Pending", "Verified", "Failed"], default: "Unverified" },
    licenses: [{ type: String, number: String, expiresAt: Date }],
    kycStatus: { type: String, enum: ["Not Started", "Pending", "Approved", "Rejected", "Expired"], default: "Not Started" },
    kycReviewDate: Date,
    kycReviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    contacts: [
      {
        name: { type: String, required: true, trim: true },
        designation: String,
        mobile: String,
        whatsapp: String,
        email: String,
      },
    ],
    billingAddress: {
      line1: String,
      city: String,
      district: String,
      state: String,
      stateCode: String,
      country: String,
      postalCode: String,
    },
    shippingAddress: {
      line1: String,
      city: String,
      district: String,
      state: String,
      stateCode: String,
      country: String,
      postalCode: String,
    },
    branches: [{ name: { type: String, required: true }, address: String, city: String, state: String, postalCode: String }],
    creditLimit: { type: Number, min: 0, default: 0 },
    creditPeriodDays: { type: Number, min: 0, default: 0 },
    paymentTerms: String,
    openingReceivable: { type: Number, min: 0, default: 0 },
    openingPayable: { type: Number, min: 0, default: 0 },
    securityDeposit: { type: Number, min: 0, default: 0 },
    preferredPaymentMethods: [{ type: String, enum: ["Cash", "Bank", "UPI", "Cheque", "RTGS", "NEFT"] }],
    riskCategory: { type: String, enum: ["Low", "Medium", "High"], default: "Low" },
    creditApprovalStatus: { type: String, enum: ["Pending", "Approved", "Rejected", "On Hold"], default: "Pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    creditHoldReason: String,
    bankAccounts: [
      {
        accountHolderName: { type: String, required: true },
        bankName: { type: String, required: true },
        encryptedAccountNumber: { type: String, required: true, select: false },
        accountNumberLast4: { type: String, required: true, select: true },
        ifscCode: String,
        branch: String,
        verificationStatus: { type: String, enum: ["Unverified", "Pending", "Verified", "Failed"], default: "Unverified" },
        upiId: String,
      },
    ],
  },
  { timestamps: true, optimisticConcurrency: true },
);

TraderProfileSchema.index({ organizationId: 1, traderCode: 1 }, { unique: true });
TraderProfileSchema.index({ organizationId: 1, legalBusinessName: 1 });
TraderProfileSchema.index({ organizationId: 1, tradingStatus: 1 });

const WarehouseSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    address: String,
    city: String,
    state: String,
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    locations: [
      {
        code: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ["Chamber", "Floor", "Stack", "Rack", "Other"], default: "Other" },
        capacity: { type: Number, min: 0 },
        unit: String,
      },
    ],
  },
  { timestamps: true },
);
WarehouseSchema.index({ organizationId: 1, code: 1 }, { unique: true });

const TradeDealSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    dealReference: { type: String, required: true, trim: true, uppercase: true },
    dealType: { type: String, enum: ["Purchase", "Sale", "Buy-Sell", "Brokered Deal", "Consignment"], required: true },
    status: {
      type: String,
      enum: [
        "Draft",
        "Negotiation",
        "Confirmed",
        "Partially Delivered",
        "Delivered",
        "Partially Invoiced",
        "Invoiced",
        "Partially Settled",
        "Settled",
        "Cancelled",
        "Disputed",
      ],
      default: "Draft",
    },
    tradeDate: { type: Date, default: Date.now },
    buyerTraderId: { type: Schema.Types.ObjectId, ref: "TraderProfile" },
    sellerTraderId: { type: Schema.Types.ObjectId, ref: "TraderProfile" },
    brokerTraderId: { type: Schema.Types.ObjectId, ref: "TraderProfile" },
    commodityItemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    variety: String,
    grade: String,
    cropYear: String,
    originMarket: String,
    contractedQuantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    actualBagWeight: { type: Number, min: 0.000001 },
    agreedRate: { type: Number, required: true, min: 0 },
    rateBasis: { type: String, required: true },
    commissionRate: { type: Number, min: 0, default: 0 },
    commissionAmount: { type: Number, min: 0, default: 0 },
    otherCharges: { type: Number, min: 0, default: 0 },
    expectedDeliveryDate: Date,
    deliveryLocation: String,
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse" },
    linkedSalesOrderId: { type: Schema.Types.ObjectId, ref: "SalesDocument" },
    linkedPurchaseOrderReference: String,
    linkedInvoiceIds: [{ type: Schema.Types.ObjectId, ref: "SalesDocument" }],
    advanceAmount: { type: Number, min: 0, default: 0 },
    settlementTerms: String,
    internalRemarks: String,
    estimatedCosts: [{ category: { type: String, required: true }, amount: { type: Number, min: 0, required: true } }],
    realizedCosts: [{ category: { type: String, required: true }, amount: { type: Number, min: 0, required: true } }],
    deliveredQuantity: { type: Number, min: 0, default: 0 },
    acceptedQuantity: { type: Number, min: 0, default: 0 },
    rejectedQuantity: { type: Number, min: 0, default: 0 },
    settledAmount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true, optimisticConcurrency: true },
);
TradeDealSchema.index({ organizationId: 1, dealReference: 1 }, { unique: true });
TradeDealSchema.index({ organizationId: 1, status: 1, tradeDate: -1 });


const TraderPaymentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    traderId: { type: Schema.Types.ObjectId, ref: "TraderProfile", required: true, index: true },
    direction: { type: String, enum: ["Receipt", "Payment"], required: true },
    paymentDate: { type: Date, default: Date.now },
    method: { type: String, enum: ["Cash", "Bank", "UPI", "Cheque", "RTGS", "NEFT"], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    unallocatedAmount: { type: Number, required: true, min: 0 },
    allocations: [{
      targetType: { type: String, enum: ["Invoice", "Deal"], required: true },
      targetId: { type: Schema.Types.ObjectId, required: true },
      amount: { type: Number, required: true, min: 0.01 },
    }],
    referenceNumber: String,
    notes: String,
    status: { type: String, enum: ["Posted", "Reversed"], default: "Posted" },
    idempotencyKey: { type: String, required: true },
    actorId: { type: String, required: true },
  },
  { timestamps: true },
);
TraderPaymentSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true });
TraderPaymentSchema.index({ organizationId: 1, traderId: 1, paymentDate: -1 });

export const TraderProfile =
  (mongoose.models.TraderProfile as Model<TraderProfileRecord>) ||
  mongoose.model<TraderProfileRecord>("TraderProfile", TraderProfileSchema);

export const Warehouse =
  (mongoose.models.Warehouse as Model<WarehouseRecord>) ||
  mongoose.model<WarehouseRecord>("Warehouse", WarehouseSchema);

export const TradeDeal =
  (mongoose.models.TradeDeal as Model<TradeDealRecord>) ||
  mongoose.model<TradeDealRecord>("TradeDeal", TradeDealSchema);


export const TraderPayment =
  (mongoose.models.TraderPayment as Model<TraderPaymentRecord>) ||
  mongoose.model<TraderPaymentRecord>("TraderPayment", TraderPaymentSchema);
