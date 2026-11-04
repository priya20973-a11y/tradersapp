import mongoose, { Schema, type Model } from "mongoose";

export interface PaymentTermRecord {
  _id?: string;
  organizationId?: mongoose.Types.ObjectId | string;
  name: string;
  days: number;
  isCustom?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const PaymentTermSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    name: { type: String, required: true, trim: true },
    days: { type: Number, required: true, min: 0, max: 365 },
    isCustom: { type: Boolean, default: true },
  },
  { timestamps: true },
);

PaymentTermSchema.index({ organizationId: 1, name: 1 });

export const PaymentTerm =
  (mongoose.models.PaymentTerm as Model<PaymentTermRecord>) ||
  mongoose.model<PaymentTermRecord>("PaymentTerm", PaymentTermSchema);
