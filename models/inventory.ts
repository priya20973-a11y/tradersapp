import mongoose, { Schema, Types, type Model } from "mongoose";

export interface StockLotRecord {
  organizationId: Types.ObjectId;
  lotId: string;
  externalLotNumber?: string;
  commodityItemId: Types.ObjectId;
  variety?: string;
  grade?: string;
  cropYear?: string;
  ownershipType: "Trader-owned" | "Customer-owned" | "Consignment" | "Warehouse-owned";
  ownerTraderId?: Types.ObjectId;
  supplierTraderId?: Types.ObjectId;
  tradeDealId?: Types.ObjectId;
  warehouseId: Types.ObjectId;
  locationCode?: string;
  numberOfBags: number;
  bagWeight?: number;
  grossWeight: number;
  tareWeight: number;
  unit: string;
  physicalQuantity: number;
  reservedQuantity: number;
  dispatchedQuantity: number;
  damagedQuantity: number;
  purchaseCost: number;
  allocatedLandedCost: number;
  status: string;
  purchaseDate?: Date;
  inwardDate: Date;
  moisturePercent?: number;
  defectPercent?: number;
  notes?: string;
}

export interface StockMovementRecord {
  organizationId: Types.ObjectId;
  movementId: string;
  lotId: Types.ObjectId;
  movementType: string;
  sourceWarehouseId?: Types.ObjectId;
  destinationWarehouseId?: Types.ObjectId;
  quantity: number;
  unit: string;
  referenceDocument?: string;
  reservationId?: string;
  occurredAt: Date;
  userId?: Types.ObjectId;
  actorId: string;
  remarks?: string;
  idempotencyKey: string;
  reversedMovementId?: Types.ObjectId;
}

const StockLotSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    lotId: { type: String, required: true, trim: true, uppercase: true },
    externalLotNumber: String,
    commodityItemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    variety: String,
    grade: String,
    cropYear: String,
    ownershipType: {
      type: String,
      enum: ["Trader-owned", "Customer-owned", "Consignment", "Warehouse-owned"],
      required: true,
    },
    ownerTraderId: { type: Schema.Types.ObjectId, ref: "TraderProfile" },
    supplierTraderId: { type: Schema.Types.ObjectId, ref: "TraderProfile" },
    tradeDealId: { type: Schema.Types.ObjectId, ref: "TradeDeal" },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    locationCode: String,
    numberOfBags: { type: Number, min: 0, default: 0 },
    bagWeight: { type: Number, min: 0.000001 },
    grossWeight: { type: Number, min: 0, default: 0 },
    tareWeight: { type: Number, min: 0, default: 0 },
    unit: { type: String, required: true },
    physicalQuantity: { type: Number, min: 0, default: 0 },
    reservedQuantity: { type: Number, min: 0, default: 0 },
    dispatchedQuantity: { type: Number, min: 0, default: 0 },
    damagedQuantity: { type: Number, min: 0, default: 0 },
    purchaseCost: { type: Number, min: 0, default: 0 },
    allocatedLandedCost: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: [
        "Expected",
        "Inward Pending",
        "In Stock",
        "Partially Reserved",
        "Reserved",
        "Partially Sold",
        "Dispatched",
        "Exhausted",
        "Damaged",
        "On Hold",
      ],
      default: "Expected",
    },
    purchaseDate: Date,
    inwardDate: { type: Date, default: Date.now },
    moisturePercent: { type: Number, min: 0, max: 100 },
    defectPercent: { type: Number, min: 0, max: 100 },
    notes: String,
  },
  { timestamps: true },
);
StockLotSchema.index({ organizationId: 1, lotId: 1 }, { unique: true });
StockLotSchema.index({ organizationId: 1, commodityItemId: 1, warehouseId: 1, status: 1 });
StockLotSchema.index({ organizationId: 1, ownerTraderId: 1 });

const StockMovementSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    movementId: { type: String, required: true, trim: true, uppercase: true },
    lotId: { type: Schema.Types.ObjectId, ref: "StockLot", required: true },
    movementType: {
      type: String,
      enum: [
        "Opening Stock",
        "Inward",
        "Outward",
        "Transfer",
        "Reservation",
        "Reservation Release",
        "Sales Dispatch",
        "Purchase Return",
        "Sales Return",
        "Damage",
        "Adjustment",
        "Reversal",
      ],
      required: true,
    },
    sourceWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse" },
    destinationWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse" },
    quantity: { type: Number, required: true, min: 0.000001 },
    unit: { type: String, required: true },
    referenceDocument: String,
    reservationId: String,
    occurredAt: { type: Date, default: Date.now },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    actorId: { type: String, required: true },
    remarks: String,
    idempotencyKey: { type: String, required: true },
    reversedMovementId: { type: Schema.Types.ObjectId, ref: "StockMovement" },
  },
  { timestamps: true },
);
StockMovementSchema.index({ organizationId: 1, movementId: 1 }, { unique: true });
StockMovementSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true });
StockMovementSchema.index({ organizationId: 1, lotId: 1, occurredAt: -1 });

export const StockLot =
  (mongoose.models.StockLot as Model<StockLotRecord>) ||
  mongoose.model<StockLotRecord>("StockLot", StockLotSchema);

export const StockMovement =
  (mongoose.models.StockMovement as Model<StockMovementRecord>) ||
  mongoose.model<StockMovementRecord>("StockMovement", StockMovementSchema);
