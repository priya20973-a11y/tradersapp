import mongoose, { Schema, type Model } from "mongoose";

export interface SalespersonRecord {
  _id?: string;
  organizationId?: mongoose.Types.ObjectId | string;
  name: string;
  email?: string;
  phone?: string;
  active?: boolean;
  isCustom?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const SalespersonSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true },
    isCustom: { type: Boolean, default: true },
  },
  { timestamps: true },
);

SalespersonSchema.index({ organizationId: 1, name: 1 });

export const Salesperson =
  (mongoose.models.Salesperson as Model<SalespersonRecord>) ||
  mongoose.model<SalespersonRecord>("Salesperson", SalespersonSchema);
