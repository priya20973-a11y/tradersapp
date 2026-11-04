import mongoose, { Schema, Types, type Model } from "mongoose";

export interface BuyerProfileRecord {
  organizationId: Types.ObjectId;
  buyerCode: string;
  companyName: string;
  contactPerson: string;
  designation?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  city: string;
  state: string;
  businessType: string;
  commodities: string[];
  annualVolume?: string;
  minQuantity?: number;
  maxQuantity?: number;
  unit: string;
  paymentTerms?: string;
  gstin?: string;
  verified: boolean;
  rating: number;
  status: "Active" | "Inactive";
  description?: string;
  yearEstablished?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SavedBuyerRecord {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  buyerId: Types.ObjectId;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type BuyingRequestStatus =
  | "Pending"
  | "Approved"
  | "Open"
  | "In Progress"
  | "Offers Received"
  | "Accepted"
  | "Rejected"
  | "Fulfilled"
  | "Closed"
  | "Cancelled";

export interface BuyingRequestRecord {
  requestId: string;
  organizationId: Types.ObjectId;
  buyerId: Types.ObjectId;
  buyerName: string;
  buyerCompany: string;
  buyerEmail?: string;
  buyerPhone?: string;
  commodity: string;
  requiredQuantity: number;
  unit: string;
  targetPrice?: number | null;
  qualitySpecs?: string;
  deliveryLocation: string;
  requiredDeliveryDate: Date;
  description?: string;
  status: BuyingRequestStatus;
  acceptedOfferId?: Types.ObjectId | null;
  offersCount: number;
  adminStatus?: "Pending" | "Approved";
  createdAt?: Date;
  updatedAt?: Date;
}

export type RequestOfferStatus = "Pending" | "Accepted" | "Rejected" | "Withdrawn";

export interface RequestOfferRecord {
  offerId: string;
  requestId: Types.ObjectId;
  organizationId: Types.ObjectId;
  sellerId: Types.ObjectId;
  sellerName: string;
  sellerCompany: string;
  sellerEmail?: string;
  sellerPhone?: string;
  offeredPrice: number;
  availableQuantity: number;
  unit: string;
  deliveryTerms: string;
  validTill?: Date | null;
  remarks?: string;
  status: RequestOfferStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

const BuyerProfileSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    buyerCode: { type: String, required: true, trim: true, uppercase: true },
    companyName: { type: String, required: true, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    businessType: {
      type: String,
      enum: [
        "Proprietorship",
        "Partnership",
        "LLP",
        "Private Limited",
        "Public Limited",
        "FPO",
        "Cooperative",
        "Processor / Miller",
        "Exporter",
        "Wholesaler",
        "Retailer",
        "Other",
      ],
      required: true,
    },
    commodities: [{ type: String, trim: true, required: true }],
    annualVolume: { type: String, trim: true },
    minQuantity: { type: Number, min: 0, default: 0 },
    maxQuantity: { type: Number, min: 0, default: 0 },
    unit: { type: String, default: "MT" },
    paymentTerms: { type: String, trim: true },
    gstin: { type: String, uppercase: true, trim: true },
    verified: { type: Boolean, default: true },
    rating: { type: Number, min: 1, max: 5, default: 4.5 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    description: { type: String, trim: true },
    yearEstablished: { type: Number },
  },
  { timestamps: true },
);

BuyerProfileSchema.index({ organizationId: 1, buyerCode: 1 }, { unique: true });
BuyerProfileSchema.index({ organizationId: 1, companyName: 1 });
BuyerProfileSchema.index({ organizationId: 1, commodities: 1 });
BuyerProfileSchema.index({ organizationId: 1, state: 1, city: 1 });
BuyerProfileSchema.index({ organizationId: 1, businessType: 1 });

const SavedBuyerSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "BuyerProfile", required: true, index: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

SavedBuyerSchema.index({ userId: 1, buyerId: 1 }, { unique: true });

const BuyingRequestSchema = new Schema(
  {
    requestId: { type: String, required: true, trim: true, uppercase: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    buyerName: { type: String, required: true, trim: true },
    buyerCompany: { type: String, required: true, trim: true },
    buyerEmail: { type: String, trim: true },
    buyerPhone: { type: String, trim: true },
    commodity: { type: String, required: true, trim: true, index: true },
    requiredQuantity: { type: Number, required: true, min: 0.01 },
    unit: { type: String, required: true, default: "MT" },
    targetPrice: { type: Number, min: 0, default: null },
    qualitySpecs: { type: String, trim: true },
    deliveryLocation: { type: String, required: true, trim: true },
    requiredDeliveryDate: { type: Date, required: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: [
        "Pending",
        "Approved",
        "Open",
        "In Progress",
        "Offers Received",
        "Accepted",
        "Rejected",
        "Fulfilled",
        "Closed",
        "Cancelled",
      ],
      default: "Pending",
      index: true,
    },
    acceptedOfferId: { type: Schema.Types.ObjectId, ref: "RequestOffer", default: null },
    offersCount: { type: Number, default: 0, min: 0 },
    adminStatus: { type: String, enum: ["Pending", "Approved"], default: "Pending", index: true },
  },
  { timestamps: true },
);

BuyingRequestSchema.index({ organizationId: 1, requestId: 1 }, { unique: true });
BuyingRequestSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
BuyingRequestSchema.index({ organizationId: 1, buyerId: 1, status: 1 });
BuyingRequestSchema.index({ organizationId: 1, commodity: 1, status: 1 });

const RequestOfferSchema = new Schema(
  {
    offerId: { type: String, required: true, trim: true, uppercase: true },
    requestId: { type: Schema.Types.ObjectId, ref: "BuyingRequest", required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerName: { type: String, required: true, trim: true },
    sellerCompany: { type: String, required: true, trim: true },
    sellerEmail: { type: String, trim: true },
    sellerPhone: { type: String, trim: true },
    offeredPrice: { type: Number, required: true, min: 0.01 },
    availableQuantity: { type: Number, required: true, min: 0.01 },
    unit: { type: String, required: true, default: "MT" },
    deliveryTerms: { type: String, required: true, trim: true },
    validTill: { type: Date, default: null },
    remarks: { type: String, trim: true },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Withdrawn"],
      default: "Pending",
      index: true,
    },
  },
  { timestamps: true },
);

RequestOfferSchema.index({ organizationId: 1, offerId: 1 }, { unique: true });
RequestOfferSchema.index({ requestId: 1, status: 1, createdAt: -1 });
RequestOfferSchema.index({ organizationId: 1, sellerId: 1, createdAt: -1 });

export const BuyerProfile =
  (mongoose.models.BuyerProfile as Model<BuyerProfileRecord>) ||
  mongoose.model<BuyerProfileRecord>("BuyerProfile", BuyerProfileSchema);

export const SavedBuyer =
  (mongoose.models.SavedBuyer as Model<SavedBuyerRecord>) ||
  mongoose.model<SavedBuyerRecord>("SavedBuyer", SavedBuyerSchema);

// In development, delete the cached model so schema changes (e.g. new fields) are picked up
// after hot-module replacement without needing a full server restart.
if (process.env.NODE_ENV !== "production" && mongoose.models.BuyingRequest) {
  delete mongoose.models.BuyingRequest;
}

export const BuyingRequest =
  (mongoose.models.BuyingRequest as Model<BuyingRequestRecord>) ||
  mongoose.model<BuyingRequestRecord>("BuyingRequest", BuyingRequestSchema);

export const RequestOffer =
  (mongoose.models.RequestOffer as Model<RequestOfferRecord>) ||
  mongoose.model<RequestOfferRecord>("RequestOffer", RequestOfferSchema);
