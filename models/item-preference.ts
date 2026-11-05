import mongoose, { Schema, type Model } from "mongoose";

export interface ItemPreferenceRecord {
  _id?: string;
  organizationId?: mongoose.Types.ObjectId | string;
  inventoryEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const ItemPreferenceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    inventoryEnabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const ItemPreference =
  (mongoose.models.ItemPreference as Model<ItemPreferenceRecord>) ||
  mongoose.model<ItemPreferenceRecord>("ItemPreference", ItemPreferenceSchema);
