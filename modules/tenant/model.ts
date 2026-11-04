/**
 * modules/tenant/model.ts — Tenant (Organization) Data Model
 *
 * Defines the core tenant entity for multi-tenant isolation, billing plans,
 * settings, and atomic number sequences for documents.
 */

import mongoose, { Schema, type Document, type Model } from "mongoose";

export type TenantStatus = "pending" | "active" | "inactive" | "suspended";
export type TenantPlan = "standard" | "professional" | "enterprise";

export interface INumberSequence {
  prefix: string;
  nextNumber: number;
}

export interface ITenantSettings {
  timezone: string;
  taxRateDefault: number;
  enforceStrictKyc: boolean;
  requireDealApprovalAbovePaise: number;
}

export interface ITenant extends Document {
  name: string;
  orgId: string; // URL-safe slug or code e.g. "acme-traders"
  legalName?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  aadhaar?: string;
  logo?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  bankDetails?: {
    accountHolderName?: string;
    accountNumber?: string;
    ifsc?: string;
    bankName?: string;
    branch?: string;
  };
  country: string;
  currency: string;
  fiscalYearStart: string; // e.g. "04-01"
  status: TenantStatus;
  plan: TenantPlan;
  numberSeries: {
    deal: INumberSequence;
    contract: INumberSequence;
    invoice: INumberSequence;
    payment: INumberSequence;
    stockLot: INumberSequence;
    goodsReceipt: INumberSequence;
    [key: string]: INumberSequence;
  };
  settings: ITenantSettings;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NumberSequenceSchema = new Schema<INumberSequence>(
  {
    prefix: { type: String, required: true },
    nextNumber: { type: Number, required: true, default: 1001 },
  },
  { _id: false },
);

const TenantSettingsSchema = new Schema<ITenantSettings>(
  {
    timezone: { type: String, default: "Asia/Kolkata" },
    taxRateDefault: { type: Number, default: 0 },
    enforceStrictKyc: { type: Boolean, default: true },
    requireDealApprovalAbovePaise: { type: Number, default: 50_000_000 }, // 5 Lakhs in paise
  },
  { _id: false },
);

export const TenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    orgId: { type: String, required: true, unique: true, trim: true, lowercase: true },
    legalName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    pan: { type: String, trim: true, uppercase: true },
    aadhaar: { type: String, trim: true },
    logo: { type: String },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    bankDetails: {
      accountHolderName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifsc: { type: String, trim: true, uppercase: true },
      bankName: { type: String, trim: true },
      branch: { type: String, trim: true },
    },
    country: { type: String, default: "India" },
    currency: { type: String, default: "INR" },
    fiscalYearStart: { type: String, default: "04-01" },
    status: {
      type: String,
      enum: ["pending", "active", "inactive", "suspended"],
      default: "active",
      index: true,
    },
    plan: {
      type: String,
      enum: ["standard", "professional", "enterprise"],
      default: "standard",
    },
    numberSeries: {
      deal: { type: NumberSequenceSchema, default: () => ({ prefix: "DL", nextNumber: 1001 }) },
      contract: { type: NumberSequenceSchema, default: () => ({ prefix: "CTR", nextNumber: 1001 }) },
      invoice: { type: NumberSequenceSchema, default: () => ({ prefix: "INV", nextNumber: 1001 }) },
      payment: { type: NumberSequenceSchema, default: () => ({ prefix: "PAY", nextNumber: 1001 }) },
      stockLot: { type: NumberSequenceSchema, default: () => ({ prefix: "LOT", nextNumber: 1001 }) },
      goodsReceipt: { type: NumberSequenceSchema, default: () => ({ prefix: "GRN", nextNumber: 1001 }) },
    },
    settings: {
      type: TenantSettingsSchema,
      default: () => ({}),
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "organizations",
  },
);

TenantSchema.index({ status: 1, isDeleted: 1 });
TenantSchema.index({ gstin: 1 });

export const Tenant: Model<ITenant> =
  (mongoose.models.Organization as Model<ITenant>) ||
  mongoose.model<ITenant>("Organization", TenantSchema, "organizations");
