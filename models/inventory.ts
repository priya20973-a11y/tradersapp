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
  traderId?: Types.ObjectId;
  movementId: string;
  lotId?: Types.ObjectId;
  movementType: string;
  locationType?: "Warehouse" | "Shop";
  locationId?: Types.ObjectId;
  commodityId?: Types.ObjectId;
  sourceWarehouseId?: Types.ObjectId;
  destinationWarehouseId?: Types.ObjectId;
  sourceLocationType?: "Warehouse" | "Shop";
  sourceLocationId?: Types.ObjectId;
  destinationLocationType?: "Warehouse" | "Shop";
  destinationLocationId?: Types.ObjectId;
  quantity: number;
  unit: string;
  onHandDelta?: number;
  reservedDelta?: number;
  damagedDelta?: number;
  resultingOnHand?: number;
  resultingReserved?: number;
  resultingAvailable?: number;
  resultingDamaged?: number;
  referenceDocument?: string;
  referenceDocumentType?: string;
  referenceDocumentId?: Types.ObjectId | string;
  referenceDocumentNumber?: string;
  reservationId?: string;
  occurredAt: Date;
  userId?: Types.ObjectId;
  actorId: string;
  remarks?: string;
  idempotencyKey: string;
  reversedMovementId?: Types.ObjectId;
}

export interface StockLocationRecord {
  _id?: Types.ObjectId;
  organizationId: Types.ObjectId;
  traderId?: Types.ObjectId;
  locationType: "Warehouse" | "Shop";
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  status: "Active" | "Inactive";
  isDefault?: boolean;
  referenceWarehouseId?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StockLevelRecord {
  _id?: Types.ObjectId;
  organizationId: Types.ObjectId;
  traderId?: Types.ObjectId;
  locationType: "Warehouse" | "Shop";
  locationId: Types.ObjectId;
  commodityId: Types.ObjectId;
  unit: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  damagedQuantity: number;
  stockValue: number;
  averageCost: number;
  lastUpdated: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StockReservationRecord {
  _id?: Types.ObjectId;
  organizationId: Types.ObjectId;
  traderId?: Types.ObjectId;
  salesOrderId: Types.ObjectId;
  salesOrderNumber: string;
  locationType: "Warehouse" | "Shop";
  locationId: Types.ObjectId;
  commodityId: Types.ObjectId;
  reservedQuantity: number;
  invoicedQuantity: number;
  releasedQuantity: number;
  unit: string;
  status: "Active" | "Partially Invoiced" | "Fully Invoiced" | "Cancelled";
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StockTransferRecord {
  _id?: Types.ObjectId;
  organizationId: Types.ObjectId;
  traderId?: Types.ObjectId;
  transferNumber: string;
  transferDate: Date;
  fromLocationType: "Warehouse" | "Shop";
  fromLocationId: Types.ObjectId;
  toLocationType: "Warehouse" | "Shop";
  toLocationId: Types.ObjectId;
  commodityId: Types.ObjectId;
  unit: string;
  availableQuantityAtTransfer?: number;
  transferQuantity: number;
  remarks?: string;
  status: "Completed" | "Draft" | "Cancelled";
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StockAdjustmentRecord {
  _id?: Types.ObjectId;
  organizationId: Types.ObjectId;
  traderId?: Types.ObjectId;
  adjustmentNumber: string;
  adjustmentDate: Date;
  locationType: "Warehouse" | "Shop";
  locationId: Types.ObjectId;
  commodityId: Types.ObjectId;
  adjustmentType: "Damaged Write-off" | "Quantity Correction" | "Physical Count Reconcile";
  quantity: number;
  unit: string;
  reason: string;
  status: "Completed";
  createdAt?: Date;
  updatedAt?: Date;
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
    traderId: { type: Schema.Types.ObjectId, index: true },
    movementId: { type: String, required: true, trim: true, uppercase: true },
    lotId: { type: Schema.Types.ObjectId, ref: "StockLot", required: false },
    movementType: {
      type: String,
      required: true,
    },
    locationType: { type: String, enum: ["Warehouse", "Shop"] },
    locationId: { type: Schema.Types.ObjectId },
    commodityId: { type: Schema.Types.ObjectId, ref: "Item" },
    sourceWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse" },
    destinationWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse" },
    sourceLocationType: { type: String, enum: ["Warehouse", "Shop"] },
    sourceLocationId: { type: Schema.Types.ObjectId },
    destinationLocationType: { type: String, enum: ["Warehouse", "Shop"] },
    destinationLocationId: { type: Schema.Types.ObjectId },
    quantity: { type: Number, required: true, min: 0.000001 },
    unit: { type: String, required: true },
    onHandDelta: { type: Number, default: 0 },
    reservedDelta: { type: Number, default: 0 },
    damagedDelta: { type: Number, default: 0 },
    resultingOnHand: { type: Number },
    resultingReserved: { type: Number },
    resultingAvailable: { type: Number },
    resultingDamaged: { type: Number },
    referenceDocument: String,
    referenceDocumentType: String,
    referenceDocumentId: { type: Schema.Types.Mixed },
    referenceDocumentNumber: String,
    reservationId: String,
    occurredAt: { type: Date, default: Date.now },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    actorId: { type: String, required: true },
    remarks: String,
    idempotencyKey: { type: String, required: true },
    reversedMovementId: { type: Schema.Types.ObjectId, ref: "StockMovement" },
  },
  { timestamps: true, collection: "stock_movements" },
);
StockMovementSchema.index({ organizationId: 1, movementId: 1 }, { unique: true });
StockMovementSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true });
StockMovementSchema.index({ organizationId: 1, lotId: 1, occurredAt: -1 });
StockMovementSchema.index({ organizationId: 1, locationType: 1, locationId: 1, commodityId: 1, occurredAt: -1 });
StockMovementSchema.index({ organizationId: 1, referenceDocumentId: 1 });

const StockLocationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    traderId: { type: Schema.Types.ObjectId, index: true },
    locationType: { type: String, enum: ["Warehouse", "Shop"], required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    isDefault: { type: Boolean, default: false },
    referenceWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse" },
  },
  { timestamps: true, collection: "stock_locations" },
);
StockLocationSchema.index({ organizationId: 1, locationType: 1, code: 1 }, { unique: true });
StockLocationSchema.index({ organizationId: 1, locationType: 1, name: 1 });

const StockLevelSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    traderId: { type: Schema.Types.ObjectId, index: true },
    locationType: { type: String, enum: ["Warehouse", "Shop"], required: true },
    locationId: { type: Schema.Types.ObjectId, required: true },
    commodityId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    unit: { type: String, required: true },
    onHandQuantity: { type: Number, required: true, min: 0, default: 0 },
    reservedQuantity: { type: Number, required: true, min: 0, default: 0 },
    availableQuantity: { type: Number, required: true, min: 0, default: 0 },
    damagedQuantity: { type: Number, required: true, min: 0, default: 0 },
    stockValue: { type: Number, default: 0 },
    averageCost: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "stock_levels" },
);
StockLevelSchema.index(
  { organizationId: 1, locationType: 1, locationId: 1, commodityId: 1 },
  { unique: true },
);
StockLevelSchema.index({ organizationId: 1, locationId: 1 });
StockLevelSchema.index({ organizationId: 1, commodityId: 1 });

const StockReservationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    traderId: { type: Schema.Types.ObjectId, index: true },
    salesOrderId: { type: Schema.Types.ObjectId, ref: "SalesDocument", required: true },
    salesOrderNumber: { type: String, required: true },
    locationType: { type: String, enum: ["Warehouse", "Shop"], required: true },
    locationId: { type: Schema.Types.ObjectId, required: true },
    commodityId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    reservedQuantity: { type: Number, required: true, min: 0 },
    invoicedQuantity: { type: Number, default: 0, min: 0 },
    releasedQuantity: { type: Number, default: 0, min: 0 },
    unit: { type: String, required: true },
    status: {
      type: String,
      enum: ["Active", "Partially Invoiced", "Fully Invoiced", "Cancelled"],
      default: "Active",
    },
  },
  { timestamps: true, collection: "stock_reservations" },
);
StockReservationSchema.index({ organizationId: 1, salesOrderId: 1, commodityId: 1 });
StockReservationSchema.index({ organizationId: 1, locationType: 1, locationId: 1 });

const StockTransferSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    traderId: { type: Schema.Types.ObjectId, index: true },
    transferNumber: { type: String, required: true, trim: true, uppercase: true },
    transferDate: { type: Date, default: Date.now },
    fromLocationType: { type: String, enum: ["Warehouse", "Shop"], required: true },
    fromLocationId: { type: Schema.Types.ObjectId, required: true },
    toLocationType: { type: String, enum: ["Warehouse", "Shop"], required: true },
    toLocationId: { type: Schema.Types.ObjectId, required: true },
    commodityId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    unit: { type: String, required: true },
    availableQuantityAtTransfer: { type: Number, default: 0 },
    transferQuantity: { type: Number, required: true, min: 0.000001 },
    remarks: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Completed", "Draft", "Cancelled"],
      default: "Completed",
    },
  },
  { timestamps: true, collection: "stock_transfers" },
);
StockTransferSchema.index({ organizationId: 1, transferNumber: 1 }, { unique: true });
StockTransferSchema.index({ organizationId: 1, transferDate: -1 });

const StockAdjustmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    traderId: { type: Schema.Types.ObjectId, index: true },
    adjustmentNumber: { type: String, required: true, trim: true, uppercase: true },
    adjustmentDate: { type: Date, default: Date.now },
    locationType: { type: String, enum: ["Warehouse", "Shop"], required: true },
    locationId: { type: Schema.Types.ObjectId, required: true },
    commodityId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    adjustmentType: {
      type: String,
      enum: ["Damaged Write-off", "Quantity Correction", "Physical Count Reconcile"],
      required: true,
    },
    quantity: { type: Number, required: true, min: 0.000001 },
    unit: { type: String, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ["Completed"], default: "Completed" },
  },
  { timestamps: true, collection: "stock_adjustments" },
);
StockAdjustmentSchema.index({ organizationId: 1, adjustmentNumber: 1 }, { unique: true });

export const StockLot =
  (mongoose.models.StockLot as Model<StockLotRecord>) ||
  mongoose.model<StockLotRecord>("StockLot", StockLotSchema);

export const StockMovement =
  (mongoose.models.StockMovement as Model<StockMovementRecord>) ||
  mongoose.model<StockMovementRecord>("StockMovement", StockMovementSchema, "stock_movements");

export const StockLocation =
  (mongoose.models.StockLocation as Model<StockLocationRecord>) ||
  mongoose.model<StockLocationRecord>("StockLocation", StockLocationSchema, "stock_locations");

export const StockLevel =
  (mongoose.models.StockLevel as Model<StockLevelRecord>) ||
  mongoose.model<StockLevelRecord>("StockLevel", StockLevelSchema, "stock_levels");

export const StockReservation =
  (mongoose.models.StockReservation as Model<StockReservationRecord>) ||
  mongoose.model<StockReservationRecord>("StockReservation", StockReservationSchema, "stock_reservations");

export const StockTransfer =
  (mongoose.models.StockTransfer as Model<StockTransferRecord>) ||
  mongoose.model<StockTransferRecord>("StockTransfer", StockTransferSchema, "stock_transfers");

export const StockAdjustment =
  (mongoose.models.StockAdjustment as Model<StockAdjustmentRecord>) ||
  mongoose.model<StockAdjustmentRecord>("StockAdjustment", StockAdjustmentSchema, "stock_adjustments");
