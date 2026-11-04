import mongoose, { Schema, type Model } from "mongoose";

export interface UnitRecord {
  _id?: string;
  organizationId?: mongoose.Types.ObjectId | string;
  name: string;
  value: string;
  label: string;
  isCustom?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const UnitSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    name: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    isCustom: { type: Boolean, default: true },
  },
  { timestamps: true },
);

UnitSchema.index({ organizationId: 1, value: 1 });

export const Unit =
  (mongoose.models.Unit as Model<UnitRecord>) ||
  mongoose.model<UnitRecord>("Unit", UnitSchema);
