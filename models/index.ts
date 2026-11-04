import mongoose, { Schema, type Model } from "mongoose";

// Re-export trading models and types
export * from "./trading";

// Re-export sales models and types
export * from "./sales";

// Re-export accounting models and types
export * from "./accounting";

// Re-export buying models and types
export * from "./buying";

// Re-export expense models and types
export * from "./expense";

// Re-export purchase order models and types
export * from "./purchase-order";

// Re-export purchase bill and vendor payment models and types
export * from "./purchase-bill";

// Re-export recurring bill models and types
export * from "./recurring-bill";

// Re-export vendor credit models and types
export * from "./vendor-credit";

// Re-export custom report models and types
export * from "./custom-report";

// Re-export unit models and types
export * from "./unit";

// Re-export item preference models and types
export * from "./item-preference";

// Re-export payment term models and types
export * from "./payment-term";

const BankDetailsSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifsc: { type: String, trim: true, uppercase: true },
    bankName: { type: String, trim: true },
    branch: { type: String, trim: true },
  },
  { _id: false },
);

const OrganizationSchema = new Schema(
  {
    name: { type: String, required: true },
    tradeName: String,
    gstin: String,
    pan: String,
    aadhaar: String,
    logo: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: "India" },
    bankDetails: BankDetailsSchema,
    currency: { type: String, default: "INR" },
    financialYear: String,
    status: { type: String, enum: ["pending", "active", "inactive"], default: "pending" },
    orgId: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    passwordHash: { type: String, required: true },
    tradeName: String,
    pan: String,
    aadhaar: String,
    gstin: String,
    logo: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: "India" },
    bankDetails: BankDetailsSchema,
    role: {
      type: String,
      enum: [
        "Super Admin",
        "Organization Owner",
        "Administrator",
        "Accountant",
        "Sales Manager",
        "Sales Executive",
        "Purchase Manager",
        "Inventory Manager",
        "Read-Only Auditor",
        "Buyer",
        "Seller",
        "User",
      ],
      default: "Administrator",
    },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    permissions: [{ type: String }],
    authzVersion: { type: Number, default: 0 },
    authVersion: { type: Number, default: 0 },
    mustChangePassword: { type: Boolean, default: false },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLogin: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
UserSchema.index({ organizationId: 1, role: 1 });
UserSchema.index({ email: 1, isDeleted: 1 });

const AuditEventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    changes: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
AuditEventSchema.index({ organizationId: 1, entityType: 1, entityId: 1, occurredAt: -1 });

const RateLimitSchema = new Schema(
  {
    key: { type: String, required: true, index: true },
    count: { type: Number, required: true, default: 1 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "rate_limits" },
);
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Organization =
  (mongoose.models.Organization as Model<Record<string, unknown>>) ||
  mongoose.model("Organization", OrganizationSchema);

export const User =
  (mongoose.models.User as Model<Record<string, unknown>>) ||
  mongoose.model("User", UserSchema);

export const AuditEvent =
  (mongoose.models.AuditEvent as Model<Record<string, unknown>>) ||
  mongoose.model("AuditEvent", AuditEventSchema);

export const RateLimit =
  (mongoose.models.RateLimit as Model<Record<string, unknown>>) ||
  mongoose.model("RateLimit", RateLimitSchema, "rate_limits");
