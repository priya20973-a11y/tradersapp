import mongoose, { Schema, Types, type Model } from "mongoose";

export interface CustomReportColumn {
  key: string;
  label: string;
  visible?: boolean;
  format?: "text" | "currency" | "date" | "number" | "badge";
}

export interface CustomReportFilters {
  dateField?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  paymentStatus?: string;
  partyId?: string;
  itemSearch?: string;
  minAmount?: number;
  maxAmount?: number;
  searchTerm?: string;
}

export interface CustomReportSort {
  field: string;
  direction: "asc" | "desc";
}

export interface CustomReportRecord {
  _id?: Types.ObjectId;
  id?: string;
  organizationId: Types.ObjectId;
  userId?: Types.ObjectId;
  name: string;
  description?: string;
  module:
    | "Sales"
    | "Purchase"
    | "Quotes"
    | "Bills"
    | "Expenses"
    | "Payments"
    | "Customers"
    | "Vendors"
    | "Items"
    | "Inventory";
  columns: CustomReportColumn[];
  filters?: CustomReportFilters;
  sort?: CustomReportSort;
  groupBy?: string;
  lastRunAt?: Date;
  runCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const CustomReportColumnSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    visible: { type: Boolean, default: true },
    format: {
      type: String,
      enum: ["text", "currency", "date", "number", "badge"],
      default: "text",
    },
  },
  { _id: false },
);

const CustomReportFiltersSchema = new Schema(
  {
    dateField: { type: String },
    startDate: { type: String },
    endDate: { type: String },
    status: { type: String },
    paymentStatus: { type: String },
    partyId: { type: String },
    itemSearch: { type: String },
    minAmount: { type: Number },
    maxAmount: { type: Number },
    searchTerm: { type: String },
  },
  { _id: false },
);

const CustomReportSortSchema = new Schema(
  {
    field: { type: String, default: "createdAt" },
    direction: { type: String, enum: ["asc", "desc"], default: "desc" },
  },
  { _id: false },
);

const CustomReportSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    module: {
      type: String,
      enum: [
        "Sales",
        "Purchase",
        "Quotes",
        "Bills",
        "Expenses",
        "Payments",
        "Customers",
        "Vendors",
        "Items",
        "Inventory",
      ],
      required: true,
      index: true,
    },
    columns: {
      type: [CustomReportColumnSchema],
      default: [],
    },
    filters: {
      type: CustomReportFiltersSchema,
      default: () => ({}),
    },
    sort: {
      type: CustomReportSortSchema,
      default: () => ({ field: "createdAt", direction: "desc" }),
    },
    groupBy: {
      type: String,
      default: "",
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
    runCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

CustomReportSchema.index({ organizationId: 1, name: 1 });

export const CustomReport =
  (mongoose.models.CustomReport as Model<CustomReportRecord>) ||
  mongoose.model<CustomReportRecord>("CustomReport", CustomReportSchema);
