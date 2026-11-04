import mongoose, { Schema, type Model } from "mongoose";

const ExpenseItemRowSchema = new Schema(
  {
    expenseAccount: { type: String, required: true },
    notes: { type: String, default: "" },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const MileageDetailsSchema = new Schema(
  {
    employee: { type: String, default: "" },
    calculationMethod: { type: String, enum: ["distance", "odometer"], default: "distance" },
    distance: { type: Number, default: 0 },
    unit: { type: String, enum: ["KM", "Mile"], default: "KM" },
    rate: { type: Number, default: 12 },
    startOdometer: { type: Number, default: 0 },
    endOdometer: { type: Number, default: 0 },
  },
  { _id: false },
);

const ReceiptSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
    type: { type: String, default: "" },
    url: { type: String, default: "" },
    uploadedAt: { type: String, default: "" },
  },
  { _id: false },
);

const ExpenseSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    referenceNumber: { type: String, required: true },
    expenseType: { type: String, enum: ["standard", "mileage", "bulk"], default: "standard" },
    date: { type: String, required: true },
    paidThrough: { type: String, required: true },
    currency: { type: String, default: "INR" },
    vendor: { type: String, default: "" },
    invoiceNumber: { type: String, default: "" },
    customerName: { type: String, default: "" },
    notes: { type: String, default: "" },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["Paid", "Unbilled", "Reimbursable", "Draft"], default: "Paid" },
    billable: { type: Boolean, default: false },
    project: { type: String, default: "" },
    reportingTags: [{ type: String, trim: true }],
    items: [ExpenseItemRowSchema],
    mileageDetails: { type: MileageDetailsSchema, default: null },
    receipts: [ReceiptSchema],
  },
  { timestamps: true, strict: false },
);

const MileagePreferenceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    category: { type: String, default: "Standard Business Travel" },
    unit: { type: String, enum: ["KM", "Mile"], default: "KM" },
    startDate: { type: String, default: "2026-04-01" },
    rate: { type: Number, default: 12.0 },
  },
  { timestamps: true },
);

export const Expense =
  (mongoose.models.Expense as Model<Record<string, unknown>>) ||
  mongoose.model("Expense", ExpenseSchema);

export const MileagePreference =
  (mongoose.models.MileagePreference as Model<Record<string, unknown>>) ||
  mongoose.model("MileagePreference", MileagePreferenceSchema);

const RecurringExpenseSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    profileName: { type: String, required: true, trim: true },
    repeatEvery: {
      type: String,
      enum: ["Week", "2 Weeks", "Month", "2 Months", "3 Months", "6 Months", "Year"],
      default: "Month",
    },
    startDate: { type: String, required: true },
    endsOn: { type: String, default: "" },
    neverExpires: { type: Boolean, default: true },
    nextDate: { type: String, required: true },
    expenseAccount: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    paidThrough: { type: String, required: true, trim: true },
    vendor: { type: String, default: "", trim: true },
    notes: { type: String, default: "", maxlength: 500 },
    customerName: { type: String, default: "", trim: true },
    reportingTags: [{ type: String, trim: true }],
    status: { type: String, enum: ["Active", "Paused", "Expired"], default: "Active" },
    lastGeneratedDate: { type: String, default: "" },
  },
  { timestamps: true, strict: false },
);

export const RecurringExpense =
  (mongoose.models.RecurringExpense as Model<Record<string, unknown>>) ||
  mongoose.model("RecurringExpense", RecurringExpenseSchema);
