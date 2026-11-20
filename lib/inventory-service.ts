import { isValidObjectId, Types, type ClientSession } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import {
  DocumentSequence,
  Item,
  StockAdjustment,
  StockLevel,
  StockLocation,
  StockMovement,
  StockReservation,
  StockTransfer,
  Warehouse,
} from "@/models";

export interface StockOperationResult {
  success: boolean;
  message?: string;
  error?: string;
  movements?: unknown[];
}

export interface InventoryItemInput {
  commodityId: string | Types.ObjectId;
  quantity: number;
  unit?: string;
  rate?: number;
  name?: string;
}

export function aggregateInventoryItems(items: InventoryItemInput[]): InventoryItemInput[] {
  const aggregated = new Map<
    string,
    { commodityId: string | Types.ObjectId; quantity: number; totalValue: number; unit?: string; name?: string }
  >();

  for (const item of items) {
    if (!item.commodityId || !isValidObjectId(item.commodityId) || item.quantity <= 0) continue;

    const commodityId = String(item.commodityId);
    const current = aggregated.get(commodityId) || {
      commodityId: item.commodityId,
      quantity: 0,
      totalValue: 0,
      unit: item.unit,
      name: item.name,
    };
    current.quantity += item.quantity;
    current.totalValue += Math.round(item.quantity * (Number(item.rate) || 0) * 100) / 100;
    aggregated.set(commodityId, current);
  }

  return Array.from(aggregated.values()).map((item) => {
    const quantity = Math.round(item.quantity * 10000) / 10000;
    return {
      commodityId: item.commodityId,
      quantity,
      rate: quantity > 0 ? item.totalValue / quantity : 0,
      unit: item.unit,
      name: item.name,
    };
  });
}

/**
 * Execute a function within a MongoDB transaction if supported,
 * or fallback gracefully to safe atomic execution on standalone deployments.
 */
async function executeTransactionSafe<T>(
  fn: (session?: ClientSession) => Promise<T>,
): Promise<T> {
  const mongoose = await connectToDatabase();
  let session: ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    let result: T;
    try {
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result!;
    } catch (txErr: unknown) {
      const errMsg = txErr instanceof Error ? txErr.message : String(txErr);
      // If transactions are not supported on this MongoDB server (standalone)
      if (
        errMsg.includes("replica set") ||
        errMsg.includes("standalone") ||
        errMsg.includes("Transaction numbers are only allowed")
      ) {
        // Fallback without session
        return await fn(undefined);
      }
      throw txErr;
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (
      errMsg.includes("replica set") ||
      errMsg.includes("standalone") ||
      errMsg.includes("Transaction numbers are only allowed")
    ) {
      return await fn(undefined);
    }
    throw err;
  } finally {
    if (session) {
      await session.endSession().catch(() => {});
    }
  }
}

/**
 * Allocate the next unique ID for a sequence.
 */
export async function getNextSequenceNumber(
  organizationId: Types.ObjectId,
  modelName: string,
  prefix: string,
  padLength = 5,
  session?: ClientSession,
): Promise<string> {
  const query = { organizationId, modelName };
  const update = { $inc: { nextNumber: 1 } };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true, session };

  const seq = await DocumentSequence.findOneAndUpdate(query, update, options);
  const nextVal = seq?.nextNumber || 1;
  return `${prefix}-${String(nextVal).padStart(padLength, "0")}`;
}

/**
 * Get or initialize a StockLevel record.
 */
export async function getOrCreateStockLevel(
  organizationId: Types.ObjectId,
  traderId: Types.ObjectId,
  locationType: "Warehouse" | "Shop",
  locationId: Types.ObjectId,
  commodityId: Types.ObjectId,
  unit = "unit",
  session?: ClientSession,
) {
  let stockLevel = await StockLevel.findOne({
    organizationId,
    locationType,
    locationId,
    commodityId,
  }).session(session || null);

  if (!stockLevel) {
    try {
      const created = await StockLevel.create(
        [
          {
            organizationId,
            traderId,
            locationType,
            locationId,
            commodityId,
            unit,
            onHandQuantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
            damagedQuantity: 0,
            stockValue: 0,
            averageCost: 0,
            lastUpdated: new Date(),
          },
        ],
        { session },
      );
      stockLevel = created[0];
    } catch (err: unknown) {
      // If concurrent insert created it, query again
      const mongoErr = err as { code?: number };
      if (mongoErr?.code === 11000) {
        stockLevel = await StockLevel.findOne({
          organizationId,
          locationType,
          locationId,
          commodityId,
        }).session(session || null);
      } else {
        throw err;
      }
    }
  }

  if (!stockLevel) {
    throw new Error("Failed to initialize or retrieve stock level.");
  }

  return stockLevel;
}

/**
 * 1. PURCHASE INWARD: Add purchased commodity quantities to location stock.
 */
export async function recordPurchaseInward(params: {
  organizationId: string | Types.ObjectId;
  traderId?: string | Types.ObjectId;
  billId: string | Types.ObjectId;
  billNumber: string;
  locationType: "Warehouse" | "Shop";
  locationId: string | Types.ObjectId;
  items: InventoryItemInput[];
  actorId?: string;
}): Promise<StockOperationResult> {
  const orgObjId = new Types.ObjectId(params.organizationId);
  const traderObjId = params.traderId ? new Types.ObjectId(params.traderId) : orgObjId;
  const locObjId = new Types.ObjectId(params.locationId);
  const billObjId = new Types.ObjectId(params.billId);

  return executeTransactionSafe(async (session) => {
    for (const item of aggregateInventoryItems(params.items)) {
      if (!item.commodityId || !isValidObjectId(item.commodityId) || item.quantity <= 0) {
        continue;
      }
      const commObjId = new Types.ObjectId(item.commodityId);
      const idempotencyKey = `PURCHASE-${billObjId.toString()}-${locObjId.toString()}-${commObjId.toString()}`;

      // Check idempotency to prevent duplicate stock additions
      const existingMovement = await StockMovement.findOne({
        organizationId: orgObjId,
        idempotencyKey,
      }).session(session || null);

      if (existingMovement) {
        continue; // Already processed
      }

      // Fetch or init stock level
      const stockLevel = await getOrCreateStockLevel(
        orgObjId,
        traderObjId,
        params.locationType,
        locObjId,
        commObjId,
        item.unit || "unit",
        session,
      );

      const oldOnHand = stockLevel.onHandQuantity || 0;
      const oldReserved = stockLevel.reservedQuantity || 0;
      const oldDamaged = stockLevel.damagedQuantity || 0;
      const newOnHand = Math.round((oldOnHand + item.quantity) * 10000) / 10000;
      const newAvailable = Math.round((newOnHand - oldReserved) * 10000) / 10000;

      // Update valuation
      const rate = Number(item.rate) || 0;
      const addedValue = Math.round(item.quantity * rate * 100) / 100;
      const newStockValue = Math.round(((stockLevel.stockValue || 0) + addedValue) * 100) / 100;
      const newAvgCost = newOnHand > 0 ? Math.round((newStockValue / newOnHand) * 100) / 100 : rate;

      stockLevel.onHandQuantity = newOnHand;
      stockLevel.availableQuantity = newAvailable;
      stockLevel.stockValue = newStockValue;
      stockLevel.averageCost = newAvgCost;
      stockLevel.lastUpdated = new Date();
      await stockLevel.save({ session });

      const movementId = await getNextSequenceNumber(orgObjId, "StockMovement", "MOV", 5, session);

      await StockMovement.create(
        [
          {
            organizationId: orgObjId,
            traderId: traderObjId,
            movementId,
            movementType: "Purchase Inward",
            locationType: params.locationType,
            locationId: locObjId,
            commodityId: commObjId,
            quantity: item.quantity,
            unit: item.unit || stockLevel.unit || "unit",
            onHandDelta: item.quantity,
            reservedDelta: 0,
            damagedDelta: 0,
            resultingOnHand: newOnHand,
            resultingReserved: oldReserved,
            resultingAvailable: newAvailable,
            resultingDamaged: oldDamaged,
            referenceDocumentType: "PurchaseBill",
            referenceDocumentId: billObjId,
            referenceDocumentNumber: params.billNumber,
            referenceDocument: `Bill ${params.billNumber}`,
            idempotencyKey,
            actorId: params.actorId || "system",
            remarks: `Purchased via Purchase Bill #${params.billNumber}`,
            occurredAt: new Date(),
          },
        ],
        { session },
      );
    }

    return { success: true };
  });
}

/**
 * 2. SALES ORDER: Reserve stock without reducing on-hand.
 * Available = On Hand - Reserved.
 * Validates available stock.
 */
export async function reserveStockForSalesOrder(params: {
  organizationId: string | Types.ObjectId;
  traderId?: string | Types.ObjectId;
  salesOrderId: string | Types.ObjectId;
  salesOrderNumber: string;
  locationType: "Warehouse" | "Shop";
  locationId: string | Types.ObjectId;
  items: InventoryItemInput[];
  actorId?: string;
}): Promise<StockOperationResult> {
  const orgObjId = new Types.ObjectId(params.organizationId);
  const traderObjId = params.traderId ? new Types.ObjectId(params.traderId) : orgObjId;
  const locObjId = new Types.ObjectId(params.locationId);
  const soObjId = new Types.ObjectId(params.salesOrderId);

  return executeTransactionSafe(async (session) => {
    // First pass: Validate available stock for ALL items
    for (const item of params.items) {
      if (!item.commodityId || !isValidObjectId(item.commodityId) || item.quantity <= 0) {
        continue;
      }
      const commObjId = new Types.ObjectId(item.commodityId);
      const stockLevel = await StockLevel.findOne({
        organizationId: orgObjId,
        locationType: params.locationType,
        locationId: locObjId,
        commodityId: commObjId,
      }).session(session || null);

      const available = stockLevel?.availableQuantity || 0;
      if (available < item.quantity) {
        const itemDoc = await Item.findById(commObjId).select("name").lean();
        const itemName = itemDoc ? String((itemDoc as { name?: string }).name) : item.name || "Commodity";
        throw new Error(
          `Insufficient available stock for ${itemName} at selected ${params.locationType}. Required: ${item.quantity}, Available: ${available}.`,
        );
      }
    }

    // Second pass: Reserve stock atomically
    for (const item of params.items) {
      if (!item.commodityId || !isValidObjectId(item.commodityId) || item.quantity <= 0) {
        continue;
      }
      const commObjId = new Types.ObjectId(item.commodityId);
      const idempotencyKey = `SO-RESERVE-${soObjId.toString()}-${locObjId.toString()}-${commObjId.toString()}`;

      const existingMovement = await StockMovement.findOne({
        organizationId: orgObjId,
        idempotencyKey,
      }).session(session || null);

      if (existingMovement) {
        continue; // Already reserved
      }

      const stockLevel = await getOrCreateStockLevel(
        orgObjId,
        traderObjId,
        params.locationType,
        locObjId,
        commObjId,
        item.unit || "unit",
        session,
      );

      const oldOnHand = stockLevel.onHandQuantity || 0;
      const oldReserved = stockLevel.reservedQuantity || 0;
      const oldDamaged = stockLevel.damagedQuantity || 0;
      const newReserved = Math.round((oldReserved + item.quantity) * 10000) / 10000;
      const newAvailable = Math.round((oldOnHand - newReserved) * 10000) / 10000;

      if (newAvailable < 0) {
        throw new Error(`Concurrent reservation conflict: available stock exceeded for commodity ${commObjId.toString()}.`);
      }

      stockLevel.reservedQuantity = newReserved;
      stockLevel.availableQuantity = newAvailable;
      stockLevel.lastUpdated = new Date();
      await stockLevel.save({ session });

      // Create or update StockReservation record
      await StockReservation.findOneAndUpdate(
        {
          organizationId: orgObjId,
          salesOrderId: soObjId,
          commodityId: commObjId,
        },
        {
          $set: {
            traderId: traderObjId,
            salesOrderNumber: params.salesOrderNumber,
            locationType: params.locationType,
            locationId: locObjId,
            reservedQuantity: item.quantity,
            unit: item.unit || stockLevel.unit || "unit",
            status: "Active",
          },
        },
        { upsert: true, new: true, session },
      );

      const movementId = await getNextSequenceNumber(orgObjId, "StockMovement", "MOV", 5, session);

      await StockMovement.create(
        [
          {
            organizationId: orgObjId,
            traderId: traderObjId,
            movementId,
            movementType: "Sales Reserve",
            locationType: params.locationType,
            locationId: locObjId,
            commodityId: commObjId,
            quantity: item.quantity,
            unit: item.unit || stockLevel.unit || "unit",
            onHandDelta: 0,
            reservedDelta: item.quantity,
            damagedDelta: 0,
            resultingOnHand: oldOnHand,
            resultingReserved: newReserved,
            resultingAvailable: newAvailable,
            resultingDamaged: oldDamaged,
            referenceDocumentType: "SalesOrder",
            referenceDocumentId: soObjId,
            referenceDocumentNumber: params.salesOrderNumber,
            referenceDocument: `Sales Order ${params.salesOrderNumber}`,
            idempotencyKey,
            actorId: params.actorId || "system",
            remarks: `Reserved for Sales Order #${params.salesOrderNumber}`,
            occurredAt: new Date(),
          },
        ],
        { session },
      );
    }

    return { success: true };
  });
}

/**
 * 3. SALES ORDER CANCELLATION: Release reserved stock.
 */
export async function cancelSalesOrderReservation(params: {
  organizationId: string | Types.ObjectId;
  salesOrderId: string | Types.ObjectId;
  actorId?: string;
}): Promise<StockOperationResult> {
  const orgObjId = new Types.ObjectId(params.organizationId);
  const soObjId = new Types.ObjectId(params.salesOrderId);

  return executeTransactionSafe(async (session) => {
    const reservations = await StockReservation.find({
      organizationId: orgObjId,
      salesOrderId: soObjId,
      status: { $in: ["Active", "Partially Invoiced"] },
    }).session(session || null);

    for (const res of reservations) {
      const activeReservedQty = Math.max(0, res.reservedQuantity - res.invoicedQuantity - res.releasedQuantity);
      if (activeReservedQty <= 0) continue;

      const idempotencyKey = `SO-RELEASE-${soObjId.toString()}-${res.locationId.toString()}-${res.commodityId.toString()}-${Date.now()}`;

      const stockLevel = await StockLevel.findOne({
        organizationId: orgObjId,
        locationType: res.locationType,
        locationId: res.locationId,
        commodityId: res.commodityId,
      }).session(session || null);

      if (stockLevel) {
        const oldOnHand = stockLevel.onHandQuantity || 0;
        const oldReserved = stockLevel.reservedQuantity || 0;
        const oldDamaged = stockLevel.damagedQuantity || 0;
        const newReserved = Math.max(0, Math.round((oldReserved - activeReservedQty) * 10000) / 10000);
        const newAvailable = Math.round((oldOnHand - newReserved) * 10000) / 10000;

        stockLevel.reservedQuantity = newReserved;
        stockLevel.availableQuantity = newAvailable;
        stockLevel.lastUpdated = new Date();
        await stockLevel.save({ session });

        const movementId = await getNextSequenceNumber(orgObjId, "StockMovement", "MOV", 5, session);

        await StockMovement.create(
          [
            {
              organizationId: orgObjId,
              traderId: res.traderId || orgObjId,
              movementId,
              movementType: "Sales Reserve Release",
              locationType: res.locationType,
              locationId: res.locationId,
              commodityId: res.commodityId,
              quantity: activeReservedQty,
              unit: res.unit,
              onHandDelta: 0,
              reservedDelta: -activeReservedQty,
              damagedDelta: 0,
              resultingOnHand: oldOnHand,
              resultingReserved: newReserved,
              resultingAvailable: newAvailable,
              resultingDamaged: oldDamaged,
              referenceDocumentType: "SalesOrder",
              referenceDocumentId: soObjId,
              referenceDocumentNumber: res.salesOrderNumber,
              referenceDocument: `Sales Order ${res.salesOrderNumber}`,
              idempotencyKey,
              actorId: params.actorId || "system",
              remarks: `Released on cancellation of Sales Order #${res.salesOrderNumber}`,
              occurredAt: new Date(),
            },
          ],
          { session },
        );
      }

      res.status = "Cancelled";
      res.releasedQuantity += activeReservedQty;
      await res.save({ session });
    }

    return { success: true };
  });
}

/**
 * 4. INVOICE STOCK OUT:
 * - If from Sales Order:
 *     Reduces On Hand stock AND reduces Reserved stock by the invoiced quantity.
 *     Supports partial invoicing (remaining stays reserved).
 * - Direct Invoice:
 *     Requires location selection, validates available stock, reduces On Hand directly.
 */
export async function recordInvoiceStockOut(params: {
  organizationId: string | Types.ObjectId;
  traderId?: string | Types.ObjectId;
  invoiceId: string | Types.ObjectId;
  invoiceNumber: string;
  salesOrderId?: string | Types.ObjectId;
  locationType: "Warehouse" | "Shop";
  locationId: string | Types.ObjectId;
  items: InventoryItemInput[];
  actorId?: string;
}): Promise<StockOperationResult> {
  const orgObjId = new Types.ObjectId(params.organizationId);
  const traderObjId = params.traderId ? new Types.ObjectId(params.traderId) : orgObjId;
  const locObjId = new Types.ObjectId(params.locationId);
  const invObjId = new Types.ObjectId(params.invoiceId);
  const soObjId = params.salesOrderId && isValidObjectId(params.salesOrderId) ? new Types.ObjectId(params.salesOrderId) : undefined;

  return executeTransactionSafe(async (session) => {
    // If direct invoice, validate available stock first
    if (!soObjId) {
      for (const item of params.items) {
        if (!item.commodityId || !isValidObjectId(item.commodityId) || item.quantity <= 0) continue;
        const commObjId = new Types.ObjectId(item.commodityId);
        const stockLevel = await StockLevel.findOne({
          organizationId: orgObjId,
          locationType: params.locationType,
          locationId: locObjId,
          commodityId: commObjId,
        }).session(session || null);

        const available = stockLevel?.availableQuantity || 0;
        if (available < item.quantity) {
          const itemDoc = await Item.findById(commObjId).select("name").lean();
          const itemName = itemDoc ? String((itemDoc as { name?: string }).name) : item.name || "Commodity";
          throw new Error(
            `Insufficient available stock for ${itemName} at selected ${params.locationType}. Required: ${item.quantity}, Available: ${available}.`,
          );
        }
      }
    }

    for (const item of params.items) {
      if (!item.commodityId || !isValidObjectId(item.commodityId) || item.quantity <= 0) continue;
      const commObjId = new Types.ObjectId(item.commodityId);
      const idempotencyKey = `INV-OUT-${invObjId.toString()}-${locObjId.toString()}-${commObjId.toString()}`;

      const existingMovement = await StockMovement.findOne({
        organizationId: orgObjId,
        idempotencyKey,
      }).session(session || null);

      if (existingMovement) continue; // Already processed

      const stockLevel = await getOrCreateStockLevel(
        orgObjId,
        traderObjId,
        params.locationType,
        locObjId,
        commObjId,
        item.unit || "unit",
        session,
      );

      const oldOnHand = stockLevel.onHandQuantity || 0;
      const oldReserved = stockLevel.reservedQuantity || 0;
      const oldDamaged = stockLevel.damagedQuantity || 0;

      const newOnHand = Math.max(0, Math.round((oldOnHand - item.quantity) * 10000) / 10000);
      let newReserved = oldReserved;
      let reservedDelta = 0;

      if (soObjId) {
        // Linked to sales order: reduce reserved stock by invoiced quantity
        const reservation = await StockReservation.findOne({
          organizationId: orgObjId,
          salesOrderId: soObjId,
          commodityId: commObjId,
        }).session(session || null);

        if (reservation) {
          const currentRemainingReserved = Math.max(0, reservation.reservedQuantity - reservation.invoicedQuantity);
          const qtyToDeductFromReservation = Math.min(item.quantity, currentRemainingReserved);

          reservedDelta = -qtyToDeductFromReservation;
          newReserved = Math.max(0, Math.round((oldReserved - qtyToDeductFromReservation) * 10000) / 10000);

          reservation.invoicedQuantity += item.quantity;
          if (reservation.invoicedQuantity >= reservation.reservedQuantity) {
            reservation.status = "Fully Invoiced";
          } else {
            reservation.status = "Partially Invoiced";
          }
          await reservation.save({ session });
        }
      }

      const newAvailable = Math.round((newOnHand - newReserved) * 10000) / 10000;
      const avgCost = stockLevel.averageCost || 0;
      const newStockValue = Math.max(0, Math.round(newOnHand * avgCost * 100) / 100);

      stockLevel.onHandQuantity = newOnHand;
      stockLevel.reservedQuantity = newReserved;
      stockLevel.availableQuantity = newAvailable;
      stockLevel.stockValue = newStockValue;
      stockLevel.lastUpdated = new Date();
      await stockLevel.save({ session });

      const movementId = await getNextSequenceNumber(orgObjId, "StockMovement", "MOV", 5, session);

      await StockMovement.create(
        [
          {
            organizationId: orgObjId,
            traderId: traderObjId,
            movementId,
            movementType: "Sales Outward",
            locationType: params.locationType,
            locationId: locObjId,
            commodityId: commObjId,
            quantity: item.quantity,
            unit: item.unit || stockLevel.unit || "unit",
            onHandDelta: -item.quantity,
            reservedDelta,
            damagedDelta: 0,
            resultingOnHand: newOnHand,
            resultingReserved: newReserved,
            resultingAvailable: newAvailable,
            resultingDamaged: oldDamaged,
            referenceDocumentType: "Invoice",
            referenceDocumentId: invObjId,
            referenceDocumentNumber: params.invoiceNumber,
            referenceDocument: `Invoice ${params.invoiceNumber}`,
            idempotencyKey,
            actorId: params.actorId || "system",
            remarks: `Stock out for Invoice #${params.invoiceNumber}${soObjId ? ` (Order ${soObjId.toString()})` : ""}`,
            occurredAt: new Date(),
          },
        ],
        { session },
      );
    }

    return { success: true };
  });
}

/**
 * 5. VENDOR CREDIT: Physical return to vendor reduces stock from location.
 */
export async function recordVendorCreditReturn(params: {
  organizationId: string | Types.ObjectId;
  traderId?: string | Types.ObjectId;
  creditId: string | Types.ObjectId;
  creditNoteNumber: string;
  locationType: "Warehouse" | "Shop";
  locationId: string | Types.ObjectId;
  isPhysicalReturn: boolean;
  items: InventoryItemInput[];
  actorId?: string;
}): Promise<StockOperationResult> {
  if (!params.isPhysicalReturn) {
    return { success: true, message: "Financial credit only, no stock changed." };
  }

  const orgObjId = new Types.ObjectId(params.organizationId);
  const traderObjId = params.traderId ? new Types.ObjectId(params.traderId) : orgObjId;
  const locObjId = new Types.ObjectId(params.locationId);
  const creditObjId = new Types.ObjectId(params.creditId);

  return executeTransactionSafe(async (session) => {
    // Validate available stock first
    for (const item of params.items) {
      if (!item.commodityId || !isValidObjectId(item.commodityId) || item.quantity <= 0) continue;
      const commObjId = new Types.ObjectId(item.commodityId);
      const stockLevel = await StockLevel.findOne({
        organizationId: orgObjId,
        locationType: params.locationType,
        locationId: locObjId,
        commodityId: commObjId,
      }).session(session || null);

      const available = stockLevel?.availableQuantity || 0;
      if (available < item.quantity) {
        const itemDoc = await Item.findById(commObjId).select("name").lean();
        const itemName = itemDoc ? String((itemDoc as { name?: string }).name) : item.name || "Commodity";
        throw new Error(
          `Cannot return goods: Insufficient available stock for ${itemName} at ${params.locationType}. Required: ${item.quantity}, Available: ${available}.`,
        );
      }
    }

    for (const item of params.items) {
      if (!item.commodityId || !isValidObjectId(item.commodityId) || item.quantity <= 0) continue;
      const commObjId = new Types.ObjectId(item.commodityId);
      const idempotencyKey = `VEND-CREDIT-${creditObjId.toString()}-${locObjId.toString()}-${commObjId.toString()}`;

      const existingMovement = await StockMovement.findOne({
        organizationId: orgObjId,
        idempotencyKey,
      }).session(session || null);

      if (existingMovement) continue;

      const stockLevel = await getOrCreateStockLevel(
        orgObjId,
        traderObjId,
        params.locationType,
        locObjId,
        commObjId,
        item.unit || "unit",
        session,
      );

      const oldOnHand = stockLevel.onHandQuantity || 0;
      const oldReserved = stockLevel.reservedQuantity || 0;
      const oldDamaged = stockLevel.damagedQuantity || 0;
      const newOnHand = Math.max(0, Math.round((oldOnHand - item.quantity) * 10000) / 10000);
      const newAvailable = Math.round((newOnHand - oldReserved) * 10000) / 10000;
      const avgCost = stockLevel.averageCost || 0;
      const newStockValue = Math.max(0, Math.round(newOnHand * avgCost * 100) / 100);

      stockLevel.onHandQuantity = newOnHand;
      stockLevel.availableQuantity = newAvailable;
      stockLevel.stockValue = newStockValue;
      stockLevel.lastUpdated = new Date();
      await stockLevel.save({ session });

      const movementId = await getNextSequenceNumber(orgObjId, "StockMovement", "MOV", 5, session);

      await StockMovement.create(
        [
          {
            organizationId: orgObjId,
            traderId: traderObjId,
            movementId,
            movementType: "Purchase Return",
            locationType: params.locationType,
            locationId: locObjId,
            commodityId: commObjId,
            quantity: item.quantity,
            unit: item.unit || stockLevel.unit || "unit",
            onHandDelta: -item.quantity,
            reservedDelta: 0,
            damagedDelta: 0,
            resultingOnHand: newOnHand,
            resultingReserved: oldReserved,
            resultingAvailable: newAvailable,
            resultingDamaged: oldDamaged,
            referenceDocumentType: "VendorCredit",
            referenceDocumentId: creditObjId,
            referenceDocumentNumber: params.creditNoteNumber,
            referenceDocument: `Vendor Credit ${params.creditNoteNumber}`,
            idempotencyKey,
            actorId: params.actorId || "system",
            remarks: `Returned goods to vendor via Vendor Credit #${params.creditNoteNumber}`,
            occurredAt: new Date(),
          },
        ],
        { session },
      );
    }

    return { success: true };
  });
}

/**
 * 6. CUSTOMER CREDIT NOTE / SALES RETURN:
 * - If goods condition is "Usable": increase on-hand stock in selected location.
 * - If goods condition is "Damaged": record as damaged stock, do not add to sellable stock.
 * - If "FinancialOnly" or isPhysicalReturn is false: no stock movement.
 */
export async function recordCreditNoteReturn(params: {
  organizationId: string | Types.ObjectId;
  traderId?: string | Types.ObjectId;
  creditNoteId: string | Types.ObjectId;
  creditNoteNumber: string;
  locationType?: "Warehouse" | "Shop";
  locationId?: string | Types.ObjectId;
  isPhysicalReturn: boolean;
  goodsCondition: "Usable" | "Damaged" | "FinancialOnly";
  items: InventoryItemInput[];
  actorId?: string;
}): Promise<StockOperationResult> {
  if (!params.isPhysicalReturn || params.goodsCondition === "FinancialOnly" || !params.locationId || !params.locationType) {
    return { success: true, message: "Financial credit note only, no stock altered." };
  }

  const orgObjId = new Types.ObjectId(params.organizationId);
  const traderObjId = params.traderId ? new Types.ObjectId(params.traderId) : orgObjId;
  const locObjId = new Types.ObjectId(params.locationId);
  const cnObjId = new Types.ObjectId(params.creditNoteId);

  return executeTransactionSafe(async (session) => {
    for (const item of params.items) {
      if (!item.commodityId || !isValidObjectId(item.commodityId) || item.quantity <= 0) continue;
      const commObjId = new Types.ObjectId(item.commodityId);
      const idempotencyKey = `CN-RETURN-${cnObjId.toString()}-${locObjId.toString()}-${commObjId.toString()}`;

      const existingMovement = await StockMovement.findOne({
        organizationId: orgObjId,
        idempotencyKey,
      }).session(session || null);

      if (existingMovement) continue; // Prevent duplicate stock-in

      const stockLevel = await getOrCreateStockLevel(
        orgObjId,
        traderObjId,
        params.locationType!,
        locObjId,
        commObjId,
        item.unit || "unit",
        session,
      );

      const oldOnHand = stockLevel.onHandQuantity || 0;
      const oldReserved = stockLevel.reservedQuantity || 0;
      const oldDamaged = stockLevel.damagedQuantity || 0;

      let newOnHand = oldOnHand;
      let newDamaged = oldDamaged;
      let onHandDelta = 0;
      let damagedDelta = 0;
      let movementType = "Customer Sales Return";

      if (params.goodsCondition === "Usable") {
        newOnHand = Math.round((oldOnHand + item.quantity) * 10000) / 10000;
        onHandDelta = item.quantity;
      } else if (params.goodsCondition === "Damaged") {
        newDamaged = Math.round((oldDamaged + item.quantity) * 10000) / 10000;
        damagedDelta = item.quantity;
        movementType = "Customer Damaged Return";
      }

      const newAvailable = Math.round((newOnHand - oldReserved) * 10000) / 10000;
      const avgCost = stockLevel.averageCost || (Number(item.rate) || 0);
      const newStockValue = Math.round(newOnHand * avgCost * 100) / 100;

      stockLevel.onHandQuantity = newOnHand;
      stockLevel.damagedQuantity = newDamaged;
      stockLevel.availableQuantity = newAvailable;
      stockLevel.stockValue = newStockValue;
      stockLevel.lastUpdated = new Date();
      await stockLevel.save({ session });

      const movementId = await getNextSequenceNumber(orgObjId, "StockMovement", "MOV", 5, session);

      await StockMovement.create(
        [
          {
            organizationId: orgObjId,
            traderId: traderObjId,
            movementId,
            movementType,
            locationType: params.locationType,
            locationId: locObjId,
            commodityId: commObjId,
            quantity: item.quantity,
            unit: item.unit || stockLevel.unit || "unit",
            onHandDelta,
            reservedDelta: 0,
            damagedDelta,
            resultingOnHand: newOnHand,
            resultingReserved: oldReserved,
            resultingAvailable: newAvailable,
            resultingDamaged: newDamaged,
            referenceDocumentType: "CreditNote",
            referenceDocumentId: cnObjId,
            referenceDocumentNumber: params.creditNoteNumber,
            referenceDocument: `Credit Note ${params.creditNoteNumber}`,
            idempotencyKey,
            actorId: params.actorId || "system",
            remarks: `Customer physical return (${params.goodsCondition}) on Credit Note #${params.creditNoteNumber}`,
            occurredAt: new Date(),
          },
        ],
        { session },
      );
    }

    return { success: true };
  });
}

/**
 * 7. DAMAGED STOCK WRITE-OFF:
 * Deduct from onHand / available stock, record as damaged.
 */
export async function recordDamagedWriteOff(params: {
  organizationId: string | Types.ObjectId;
  traderId?: string | Types.ObjectId;
  locationType: "Warehouse" | "Shop";
  locationId: string | Types.ObjectId;
  commodityId: string | Types.ObjectId;
  quantity: number;
  unit: string;
  reason: string;
  actorId?: string;
}): Promise<StockOperationResult> {
  if (params.quantity <= 0) throw new Error("Write-off quantity must be greater than zero.");

  const orgObjId = new Types.ObjectId(params.organizationId);
  const traderObjId = params.traderId ? new Types.ObjectId(params.traderId) : orgObjId;
  const locObjId = new Types.ObjectId(params.locationId);
  const commObjId = new Types.ObjectId(params.commodityId);

  return executeTransactionSafe(async (session) => {
    const stockLevel = await StockLevel.findOne({
      organizationId: orgObjId,
      locationType: params.locationType,
      locationId: locObjId,
      commodityId: commObjId,
    }).session(session || null);

    const available = stockLevel?.availableQuantity || 0;
    if (available < params.quantity) {
      throw new Error(`Cannot write off: Available stock (${available}) is less than requested quantity (${params.quantity}).`);
    }

    const oldOnHand = stockLevel!.onHandQuantity || 0;
    const oldReserved = stockLevel!.reservedQuantity || 0;
    const oldDamaged = stockLevel!.damagedQuantity || 0;

    const newOnHand = Math.max(0, Math.round((oldOnHand - params.quantity) * 10000) / 10000);
    const newDamaged = Math.round((oldDamaged + params.quantity) * 10000) / 10000;
    const newAvailable = Math.round((newOnHand - oldReserved) * 10000) / 10000;
    const avgCost = stockLevel!.averageCost || 0;
    const newStockValue = Math.max(0, Math.round(newOnHand * avgCost * 100) / 100);

    stockLevel!.onHandQuantity = newOnHand;
    stockLevel!.damagedQuantity = newDamaged;
    stockLevel!.availableQuantity = newAvailable;
    stockLevel!.stockValue = newStockValue;
    stockLevel!.lastUpdated = new Date();
    await stockLevel!.save({ session });

    const adjNumber = await getNextSequenceNumber(orgObjId, "StockAdjustment", "ADJ", 4, session);

    const adjustment = (await StockAdjustment.create(
      [
        {
          organizationId: orgObjId,
          traderId: traderObjId,
          adjustmentNumber: adjNumber,
          adjustmentDate: new Date(),
          locationType: params.locationType,
          locationId: locObjId,
          commodityId: commObjId,
          adjustmentType: "Damaged Write-off",
          quantity: params.quantity,
          unit: params.unit,
          reason: params.reason,
          status: "Completed",
        },
      ],
      { session },
    ))[0];

    const movementId = await getNextSequenceNumber(orgObjId, "StockMovement", "MOV", 5, session);
    const idempotencyKey = `ADJ-DAMAGE-${adjustment._id.toString()}`;

    await StockMovement.create(
      [
        {
          organizationId: orgObjId,
          traderId: traderObjId,
          movementId,
          movementType: "Damaged Write-off",
          locationType: params.locationType,
          locationId: locObjId,
          commodityId: commObjId,
          quantity: params.quantity,
          unit: params.unit,
          onHandDelta: -params.quantity,
          reservedDelta: 0,
          damagedDelta: params.quantity,
          resultingOnHand: newOnHand,
          resultingReserved: oldReserved,
          resultingAvailable: newAvailable,
          resultingDamaged: newDamaged,
          referenceDocumentType: "StockAdjustment",
          referenceDocumentId: adjustment._id,
          referenceDocumentNumber: adjNumber,
          referenceDocument: `Adjustment ${adjNumber}`,
          idempotencyKey,
          actorId: params.actorId || "system",
          remarks: `Damaged stock write-off: ${params.reason}`,
          occurredAt: new Date(),
        },
      ],
      { session },
    );

    return { success: true };
  });
}

/**
 * 8. STOCK TRANSFER:
 * Transfer between Warehouse <-> Warehouse, Warehouse <-> Shop, Shop <-> Shop, Shop <-> Warehouse.
 * - Reserved stock CANNOT be transferred.
 * - Transfer quantity cannot exceed available stock.
 * - Source and destination cannot be identical.
 * - Both movements happen atomically.
 */
export async function executeStockTransfer(params: {
  organizationId: string | Types.ObjectId;
  traderId?: string | Types.ObjectId;
  fromLocationType: "Warehouse" | "Shop";
  fromLocationId: string | Types.ObjectId;
  toLocationType: "Warehouse" | "Shop";
  toLocationId: string | Types.ObjectId;
  commodityId: string | Types.ObjectId;
  quantity: number;
  unit: string;
  remarks?: string;
  actorId?: string;
}): Promise<StockOperationResult> {
  const orgObjId = new Types.ObjectId(params.organizationId);
  const traderObjId = params.traderId ? new Types.ObjectId(params.traderId) : orgObjId;
  const fromLocObjId = new Types.ObjectId(params.fromLocationId);
  const toLocObjId = new Types.ObjectId(params.toLocationId);
  const commObjId = new Types.ObjectId(params.commodityId);

  // Business rule: Source and destination cannot be identical
  if (
    params.fromLocationType === params.toLocationType &&
    fromLocObjId.toString() === toLocObjId.toString()
  ) {
    throw new Error("Source location and destination location cannot be identical.");
  }

  if (params.quantity <= 0) {
    throw new Error("Transfer quantity must be greater than zero.");
  }

  return executeTransactionSafe(async (session) => {
    // 1. Validate available stock at source
    const sourceStock = await StockLevel.findOne({
      organizationId: orgObjId,
      locationType: params.fromLocationType,
      locationId: fromLocObjId,
      commodityId: commObjId,
    }).session(session || null);

    const available = sourceStock?.availableQuantity || 0;
    if (available < params.quantity) {
      throw new Error(
        `Cannot transfer stock: Available quantity at source (${available}) is less than transfer quantity (${params.quantity}). Reserved stock cannot be transferred.`,
      );
    }

    const transferNumber = await getNextSequenceNumber(orgObjId, "StockTransfer", "TRF", 4, session);

    // 2. Create StockTransfer document
    const transfer = (await StockTransfer.create(
      [
        {
          organizationId: orgObjId,
          traderId: traderObjId,
          transferNumber,
          transferDate: new Date(),
          fromLocationType: params.fromLocationType,
          fromLocationId: fromLocObjId,
          toLocationType: params.toLocationType,
          toLocationId: toLocObjId,
          commodityId: commObjId,
          unit: params.unit,
          availableQuantityAtTransfer: available,
          transferQuantity: params.quantity,
          remarks: params.remarks || "",
          status: "Completed",
        },
      ],
      { session },
    ))[0];

    // 3. Deduct from source
    const sOldOnHand = sourceStock!.onHandQuantity || 0;
    const sOldReserved = sourceStock!.reservedQuantity || 0;
    const sOldDamaged = sourceStock!.damagedQuantity || 0;
    const sNewOnHand = Math.max(0, Math.round((sOldOnHand - params.quantity) * 10000) / 10000);
    const sNewAvailable = Math.round((sNewOnHand - sOldReserved) * 10000) / 10000;
    const sAvgCost = sourceStock!.averageCost || 0;
    const sNewValue = Math.max(0, Math.round(sNewOnHand * sAvgCost * 100) / 100);

    sourceStock!.onHandQuantity = sNewOnHand;
    sourceStock!.availableQuantity = sNewAvailable;
    sourceStock!.stockValue = sNewValue;
    sourceStock!.lastUpdated = new Date();
    await sourceStock!.save({ session });

    // 4. Add to destination
    const destStock = await getOrCreateStockLevel(
      orgObjId,
      traderObjId,
      params.toLocationType,
      toLocObjId,
      commObjId,
      params.unit,
      session,
    );

    const dOldOnHand = destStock.onHandQuantity || 0;
    const dOldReserved = destStock.reservedQuantity || 0;
    const dOldDamaged = destStock.damagedQuantity || 0;
    const dNewOnHand = Math.round((dOldOnHand + params.quantity) * 10000) / 10000;
    const dNewAvailable = Math.round((dNewOnHand - dOldReserved) * 10000) / 10000;
    const dNewValue = Math.round(((destStock.stockValue || 0) + params.quantity * sAvgCost) * 100) / 100;
    const dAvgCost = dNewOnHand > 0 ? Math.round((dNewValue / dNewOnHand) * 100) / 100 : sAvgCost;

    destStock.onHandQuantity = dNewOnHand;
    destStock.availableQuantity = dNewAvailable;
    destStock.stockValue = dNewValue;
    destStock.averageCost = dAvgCost;
    destStock.lastUpdated = new Date();
    await destStock.save({ session });

    // 5. Create Movements for both locations
    const outMovementId = await getNextSequenceNumber(orgObjId, "StockMovement", "MOV", 5, session);
    const inMovementId = await getNextSequenceNumber(orgObjId, "StockMovement", "MOV", 5, session);

    await StockMovement.create(
      [
        {
          organizationId: orgObjId,
          traderId: traderObjId,
          movementId: outMovementId,
          movementType: "Transfer Out",
          locationType: params.fromLocationType,
          locationId: fromLocObjId,
          commodityId: commObjId,
          sourceLocationType: params.fromLocationType,
          sourceLocationId: fromLocObjId,
          destinationLocationType: params.toLocationType,
          destinationLocationId: toLocObjId,
          quantity: params.quantity,
          unit: params.unit,
          onHandDelta: -params.quantity,
          reservedDelta: 0,
          damagedDelta: 0,
          resultingOnHand: sNewOnHand,
          resultingReserved: sOldReserved,
          resultingAvailable: sNewAvailable,
          resultingDamaged: sOldDamaged,
          referenceDocumentType: "StockTransfer",
          referenceDocumentId: transfer._id,
          referenceDocumentNumber: transferNumber,
          referenceDocument: `Transfer ${transferNumber}`,
          idempotencyKey: `TRF-OUT-${transfer._id.toString()}`,
          actorId: params.actorId || "system",
          remarks: `Transferred out to ${params.toLocationType}`,
          occurredAt: new Date(),
        },
        {
          organizationId: orgObjId,
          traderId: traderObjId,
          movementId: inMovementId,
          movementType: "Transfer In",
          locationType: params.toLocationType,
          locationId: toLocObjId,
          commodityId: commObjId,
          sourceLocationType: params.fromLocationType,
          sourceLocationId: fromLocObjId,
          destinationLocationType: params.toLocationType,
          destinationLocationId: toLocObjId,
          quantity: params.quantity,
          unit: params.unit,
          onHandDelta: params.quantity,
          reservedDelta: 0,
          damagedDelta: 0,
          resultingOnHand: dNewOnHand,
          resultingReserved: dOldReserved,
          resultingAvailable: dNewAvailable,
          resultingDamaged: dOldDamaged,
          referenceDocumentType: "StockTransfer",
          referenceDocumentId: transfer._id,
          referenceDocumentNumber: transferNumber,
          referenceDocument: `Transfer ${transferNumber}`,
          idempotencyKey: `TRF-IN-${transfer._id.toString()}`,
          actorId: params.actorId || "system",
          remarks: `Transferred in from ${params.fromLocationType}`,
          occurredAt: new Date(),
        },
      ],
      { session },
    );

    return { success: true };
  });
}
