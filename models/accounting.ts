import mongoose, { Schema, type Model } from "mongoose";

const BankAccountSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    accountType: { type: String, enum: ["Bank", "Cash"], default: "Bank" },
    accountNumber: String,
    currentBalance: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const ChartOfAccountSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    accountType: { type: String, enum: ["Asset", "Liability", "Equity", "Revenue", "Expense"], required: true },
    normalBalance: { type: String, enum: ["debit", "credit"], required: true },
    code: String,
  },
  { timestamps: true },
);

const JournalEntrySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    description: { type: String, required: true },
    postedAt: { type: Date, default: Date.now },
    isBalanced: { type: Boolean, default: false },
    totalDebits: Number,
    totalCredits: Number,
  },
  { timestamps: true },
);

const TaxRateSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    rate: { type: Number, required: true },
    type: { type: String, enum: ["CGST", "SGST", "IGST", "Custom"], default: "Custom" },
  },
  { timestamps: true },
);

const DocumentSequenceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    prefix: { type: String, required: true },
    nextNumber: { type: Number, default: 1 },
    modelName: { type: String, required: true },
  },
  { timestamps: true },
);
DocumentSequenceSchema.index({ organizationId: 1, modelName: 1 }, { unique: true });

export const BankAccount =
  (mongoose.models.BankAccount as Model<Record<string, unknown>>) ||
  mongoose.model("BankAccount", BankAccountSchema);

export const ChartOfAccount =
  (mongoose.models.ChartOfAccount as Model<Record<string, unknown>>) ||
  mongoose.model("ChartOfAccount", ChartOfAccountSchema);

export const JournalEntry =
  (mongoose.models.JournalEntry as Model<Record<string, unknown>>) ||
  mongoose.model("JournalEntry", JournalEntrySchema);

export const TaxRate =
  (mongoose.models.TaxRate as Model<Record<string, unknown>>) ||
  mongoose.model("TaxRate", TaxRateSchema);

export const DocumentSequence =
  (mongoose.models.DocumentSequence as Model<Record<string, unknown>>) ||
  mongoose.model("DocumentSequence", DocumentSequenceSchema);
