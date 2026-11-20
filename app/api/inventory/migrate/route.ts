import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  Item,
  Organization,
  StockLevel,
  StockLocation,
  StockLot,
  StockMovement,
  Warehouse,
} from "@/models";
import { getNextSequenceNumber } from "@/lib/inventory-service";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to inspect inventory data." }, { status: 401 });
    }

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId");

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && requestedOrgId && isValidObjectId(requestedOrgId)) {
      organizationId = requestedOrgId;
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      const defaultOrg = await Organization.findOne({ status: "active" }).select("_id").lean();
      if (defaultOrg) organizationId = String(defaultOrg._id);
      else return NextResponse.json({ error: "Organization required." }, { status: 400 });
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    // 1. Inspect existing StockLots
    const existingLots = await StockLot.find({ organizationId: orgObjId }).lean();
    // 2. Inspect existing Items with openingStock
    const itemsWithOpening = await Item.find({ organizationId: orgObjId, openingStock: { $gt: 0 } }).lean();
    // 3. Inspect existing StockLevels
    const migratedStockLevels = await StockLevel.find({ organizationId: orgObjId }).lean();

    const lotsSummary = existingLots.map((lot) => ({
      lotId: lot.lotId,
      commodityId: String(lot.commodityItemId),
      warehouseId: String(lot.warehouseId),
      physicalQuantity: lot.physicalQuantity,
      reservedQuantity: lot.reservedQuantity,
      damagedQuantity: lot.damagedQuantity,
      status: lot.status,
    }));

    const itemsSummary = itemsWithOpening.map((it) => ({
      id: String(it._id),
      name: it.name,
      sku: it.sku,
      openingStock: it.openingStock,
      unit: it.unit || "unit",
      hasLocationReference: false, // Flagged for manual reconciliation if no location is specified
    }));

    return NextResponse.json({
      totalLots: existingLots.length,
      totalItemsWithOpeningStock: itemsWithOpening.length,
      alreadyMigratedLevels: migratedStockLevels.length,
      lots: lotsSummary,
      unassignedItems: itemsSummary,
      status: migratedStockLevels.length > 0 ? "Partially/Fully Migrated" : "Pending Migration",
    });
  } catch (error) {
    console.error("GET /api/inventory/migrate error:", error);
    return NextResponse.json({ error: "Failed to inspect inventory data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to migrate inventory." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { organizationId: customOrgId, reconcileUnassignedToLocationId, locationType = "Warehouse" } = body;

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && customOrgId && isValidObjectId(customOrgId)) {
      organizationId = customOrgId;
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      const defaultOrg = await Organization.findOne({ status: "active" }).select("_id").lean();
      if (defaultOrg) organizationId = String(defaultOrg._id);
      else return NextResponse.json({ error: "Organization required." }, { status: 400 });
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    let migratedLotsCount = 0;
    let reconciledItemsCount = 0;

    // 1. Migrate existing StockLots (these HAVE warehouseId historical references)
    const existingLots = await StockLot.find({ organizationId: orgObjId }).lean();

    for (const lot of existingLots) {
      if (!lot.warehouseId || !lot.commodityItemId) continue;

      const commObjId = new Types.ObjectId(String(lot.commodityItemId));
      const whObjId = new Types.ObjectId(String(lot.warehouseId));
      const idempotencyKey = `MIGRATE-LOT-${lot.lotId}`;

      const existingMovement = await StockMovement.findOne({
        organizationId: orgObjId,
        idempotencyKey,
      });

      if (!existingMovement) {
        const stockLevel = await StockLevel.findOneAndUpdate(
          {
            organizationId: orgObjId,
            locationType: "Warehouse",
            locationId: whObjId,
            commodityId: commObjId,
          },
          {
            $inc: {
              onHandQuantity: lot.physicalQuantity || 0,
              reservedQuantity: lot.reservedQuantity || 0,
              availableQuantity: (lot.physicalQuantity || 0) - (lot.reservedQuantity || 0),
              damagedQuantity: lot.damagedQuantity || 0,
              stockValue: Math.round((lot.physicalQuantity || 0) * (lot.purchaseCost || 0) * 100) / 100,
            },
            $setOnInsert: {
              traderId: orgObjId,
              unit: lot.unit || "unit",
              averageCost: lot.purchaseCost || 0,
            },
            $set: { lastUpdated: new Date() },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        const movementId = await getNextSequenceNumber(orgObjId, "StockMovement", "MOV", 5);

        await StockMovement.create({
          organizationId: orgObjId,
          traderId: orgObjId,
          movementId,
          movementType: "Opening Stock",
          lotId: lot._id,
          locationType: "Warehouse",
          locationId: whObjId,
          commodityId: commObjId,
          quantity: lot.physicalQuantity || 0,
          unit: lot.unit || "unit",
          onHandDelta: lot.physicalQuantity || 0,
          reservedDelta: lot.reservedQuantity || 0,
          damagedDelta: lot.damagedQuantity || 0,
          resultingOnHand: stockLevel?.onHandQuantity || (lot.physicalQuantity || 0),
          resultingReserved: stockLevel?.reservedQuantity || (lot.reservedQuantity || 0),
          resultingAvailable: stockLevel?.availableQuantity || 0,
          resultingDamaged: stockLevel?.damagedQuantity || (lot.damagedQuantity || 0),
          referenceDocumentType: "OpeningStock",
          referenceDocumentNumber: lot.lotId,
          referenceDocument: `Historical Lot ${lot.lotId}`,
          idempotencyKey,
          actorId: String(session.user.id),
          remarks: `Migrated from historical stock lot #${lot.lotId}`,
          occurredAt: lot.inwardDate || new Date(),
        });

        migratedLotsCount++;
      }
    }

    // 2. If the user explicitly provided reconcileUnassignedToLocationId for items with openingStock
    if (reconcileUnassignedToLocationId && isValidObjectId(reconcileUnassignedToLocationId)) {
      const targetLocId = new Types.ObjectId(reconcileUnassignedToLocationId);
      const itemsWithOpening = await Item.find({ organizationId: orgObjId, openingStock: { $gt: 0 } }).lean();

      for (const it of itemsWithOpening) {
        const commObjId = new Types.ObjectId(String(it._id));
        const idempotencyKey = `MIGRATE-ITEM-OPENING-${commObjId.toString()}`;

        const existingMovement = await StockMovement.findOne({
          organizationId: orgObjId,
          idempotencyKey,
        });

        if (!existingMovement) {
          const itName = String(it.name || "Item");
          const itSku = String(it.sku || "");
          const itUnit = typeof it.unit === "string" ? it.unit : "unit";
          const qty = Number(it.openingStock || 0);
          const rate = Number(it.purchasePrice || 0);

          const stockLevel = await StockLevel.findOneAndUpdate(
            {
              organizationId: orgObjId,
              locationType,
              locationId: targetLocId,
              commodityId: commObjId,
            },
            {
              $inc: {
                onHandQuantity: qty,
                availableQuantity: qty,
                stockValue: Math.round(qty * rate * 100) / 100,
              },
              $setOnInsert: {
                traderId: orgObjId,
                unit: itUnit,
                reservedQuantity: 0,
                damagedQuantity: 0,
                averageCost: rate,
              },
              $set: { lastUpdated: new Date() },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );

          const movementId = await getNextSequenceNumber(orgObjId, "StockMovement", "MOV", 5);

          await StockMovement.create({
            organizationId: orgObjId,
            traderId: orgObjId,
            movementId,
            movementType: "Opening Stock",
            locationType,
            locationId: targetLocId,
            commodityId: commObjId,
            quantity: qty,
            unit: itUnit,
            onHandDelta: qty,
            reservedDelta: 0,
            damagedDelta: 0,
            resultingOnHand: stockLevel?.onHandQuantity || qty,
            resultingReserved: stockLevel?.reservedQuantity || 0,
            resultingAvailable: stockLevel?.availableQuantity || qty,
            resultingDamaged: stockLevel?.damagedQuantity || 0,
            referenceDocumentType: "ItemOpeningStock",
            referenceDocumentNumber: itSku || itName,
            referenceDocument: `Item Opening Stock ${itName}`,
            idempotencyKey,
            actorId: String(session.user.id),
            remarks: `Reconciled opening stock for ${itName}`,
            occurredAt: new Date(),
          });

          reconciledItemsCount++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      migratedLotsCount,
      reconciledItemsCount,
      message: `Successfully migrated ${migratedLotsCount} stock lots and reconciled ${reconciledItemsCount} unassigned commodity stocks.`,
    });
  } catch (error) {
    console.error("POST /api/inventory/migrate error:", error);
    return NextResponse.json({ error: "Failed to execute inventory migration." }, { status: 500 });
  }
}
