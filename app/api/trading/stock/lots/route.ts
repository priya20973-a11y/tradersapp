import { randomUUID } from "node:crypto";
import { startSession, Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getTradingScope, recordTradingAudit, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { availableStock } from "@/lib/trading-calculations";
import { Item, StockLot, StockMovement, TradeDeal, TraderProfile, Warehouse } from "@/models";

class StockConflictError extends Error {}

const lotSchema = z.object({
  lotId: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9_-]+$/),
  externalLotNumber: z.string().trim().max(80).optional(),
  commodityItemId: z.string().refine(Types.ObjectId.isValid),
  variety: z.string().trim().max(100).optional(),
  grade: z.string().trim().max(100).optional(),
  cropYear: z.string().trim().max(20).optional(),
  ownershipType: z.enum(["Trader-owned", "Customer-owned", "Consignment", "Warehouse-owned"]),
  ownerTraderId: z.string().refine(Types.ObjectId.isValid).optional(),
  supplierTraderId: z.string().refine(Types.ObjectId.isValid).optional(),
  tradeDealId: z.string().refine(Types.ObjectId.isValid).optional(),
  warehouseId: z.string().refine(Types.ObjectId.isValid),
  locationCode: z.string().trim().max(40).optional(),
  numberOfBags: z.coerce.number().min(0).default(0),
  bagWeight: z.coerce.number().positive().optional(),
  grossWeight: z.coerce.number().min(0).default(0),
  tareWeight: z.coerce.number().min(0).default(0),
  unit: z.string().trim().min(1).max(30),
  openingQuantity: z.coerce.number().min(0).max(1_000_000_000).default(0),
  purchaseCost: z.coerce.number().min(0).default(0),
  allocatedLandedCost: z.coerce.number().min(0).default(0),
  purchaseDate: z.coerce.date().optional(),
  inwardDate: z.coerce.date().optional(),
  moisturePercent: z.coerce.number().min(0).max(100).optional(),
  defectPercent: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().trim().max(3000).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scopeResult = await getTradingScope(
      url.searchParams.get("organizationId") ?? undefined,
      "manage-stock-lots",
    );
    if ("response" in scopeResult) return scopeResult.response;
    const filter: Record<string, unknown> = { organizationId: scopeResult.scope.organizationId };
    const warehouseId = url.searchParams.get("warehouseId");
    const commodityItemId = url.searchParams.get("commodityItemId");
    if (warehouseId && Types.ObjectId.isValid(warehouseId)) filter.warehouseId = warehouseId;
    if (commodityItemId && Types.ObjectId.isValid(commodityItemId)) filter.commodityItemId = commodityItemId;
    const lots = await StockLot.find(filter)
      .populate({ path: "commodityItemId", select: "name sku" })
      .populate({ path: "warehouseId", select: "name code" })
      .populate({ path: "ownerTraderId", select: "traderCode legalBusinessName" })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    return NextResponse.json({
      lots: lots.map((lot) => ({
        id: String(lot._id),
        lotId: lot.lotId,
        externalLotNumber: lot.externalLotNumber ?? "",
        commodity: lot.commodityItemId,
        variety: lot.variety ?? "",
        grade: lot.grade ?? "",
        ownershipType: lot.ownershipType,
        owner: lot.ownerTraderId ?? null,
        warehouse: lot.warehouseId,
        locationCode: lot.locationCode ?? "",
        numberOfBags: lot.numberOfBags,
        unit: lot.unit,
        physicalQuantity: lot.physicalQuantity,
        reservedQuantity: lot.reservedQuantity,
        availableQuantity: availableStock(lot.physicalQuantity, lot.reservedQuantity),
        dispatchedQuantity: lot.dispatchedQuantity,
        damagedQuantity: lot.damagedQuantity,
        status: lot.status,
        inwardDate: lot.inwardDate,
        purchaseCost: lot.purchaseCost,
        allocatedLandedCost: lot.allocatedLandedCost,
      })),
    });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof startSession>> | undefined;
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Submit valid JSON data." }, { status: 400 });
    }
    const parsed = lotSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Check the stock lot details and try again.", issues: parsed.error.issues }, { status: 400 });
    }
    const organizationId =
      typeof payload === "object" && payload !== null && "organizationId" in payload
        ? String(payload.organizationId)
        : undefined;
    const scopeResult = await getTradingScope(organizationId, "manage-stock-lots");
    if ("response" in scopeResult) return scopeResult.response;
    const orgId = scopeResult.scope.organizationId;
    const input = parsed.data;
    const [commodity, warehouse] = await Promise.all([
      Item.exists({ _id: input.commodityItemId, organizationId: orgId, type: "goods", active: true }),
      Warehouse.exists({ _id: input.warehouseId, organizationId: orgId, status: "Active" }),
    ]);
    if (!commodity) return NextResponse.json({ error: "Select an active commodity from this organization." }, { status: 400 });
    if (!warehouse) return NextResponse.json({ error: "Select an active warehouse from this organization." }, { status: 400 });
    const traderIds = [input.ownerTraderId, input.supplierTraderId].filter(Boolean);
    const linkedTraders = traderIds.length ? await TraderProfile.find({
      _id: { $in: traderIds },
      organizationId: orgId,
      tradingStatus: "Active",
    }).select("_id roles") : [];
    if (traderIds.length !== linkedTraders.length) {
      return NextResponse.json({ error: "Select active traders from this organization only." }, { status: 400 });
    }
    if (input.ownershipType !== "Warehouse-owned" && !input.ownerTraderId) {
      return NextResponse.json({ error: "Select the owner trader for this ownership type." }, { status: 400 });
    }
    const ownerTrader = input.ownerTraderId
      ? linkedTraders.find((trader) => String(trader._id) === input.ownerTraderId)
      : undefined;
    if (input.ownershipType === "Customer-owned" && !ownerTrader?.roles.includes("Buyer")) {
      return NextResponse.json({ error: "Customer-owned stock must belong to a buyer trader." }, { status: 400 });
    }
    if (input.ownershipType === "Consignment" && !ownerTrader?.roles.includes("Consignment Owner")) {
      return NextResponse.json({ error: "Consignment stock must belong to a consignment owner trader." }, { status: 400 });
    }
    const supplierTrader = input.supplierTraderId
      ? linkedTraders.find((trader) => String(trader._id) === input.supplierTraderId)
      : undefined;
    if (supplierTrader && !supplierTrader.roles.includes("Seller")) {
      return NextResponse.json({ error: "The supplier must be registered as a seller." }, { status: 400 });
    }
    if (input.tradeDealId && !await TradeDeal.exists({ _id: input.tradeDealId, organizationId: orgId })) {
      return NextResponse.json({ error: "Select a deal from this organization." }, { status: 400 });
    }
    const lotId = input.lotId.toUpperCase();
    if (await StockLot.exists({ organizationId: orgId, lotId })) {
      return NextResponse.json({ error: "That lot number is already in use." }, { status: 409 });
    }

    session = await startSession();
    let createdId = "";
    const { openingQuantity, ...lotFields } = input;
    await session.withTransaction(async () => {
      const [lot] = await StockLot.create([{
        ...lotFields,
        organizationId: orgId,
        lotId,
        physicalQuantity: openingQuantity,
        reservedQuantity: 0,
        dispatchedQuantity: 0,
        damagedQuantity: 0,
        status: openingQuantity > 0 ? "In Stock" : "Expected",
      }], { session });
      createdId = String(lot._id);
      if (openingQuantity > 0) {
        await StockMovement.create([{
          organizationId: orgId,
          movementId: `OPEN-${randomUUID()}`,
          lotId: lot._id,
          movementType: "Opening Stock",
          destinationWarehouseId: input.warehouseId,
          quantity: openingQuantity,
          unit: input.unit,
          referenceDocument: lotId,
          occurredAt: input.inwardDate ?? new Date(),
          actorId: scopeResult.scope.actorId,
          remarks: "Opening stock entered when lot was created.",
          idempotencyKey: `opening-${lot._id}`,
        }], { session });
      }
      await recordTradingAudit({
        organizationId: orgId,
        actorId: scopeResult.scope.actorId,
        action: "stock-lot.created",
        entityType: "StockLot",
        entityId: createdId,
        changes: { lotId, openingQuantity, warehouseId: input.warehouseId },
        session,
      });
    });
    return NextResponse.json({ ok: true, id: createdId, lotId }, { status: 201 });
  } catch (error) {
    if (error instanceof StockConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "That lot number is already in use." }, { status: 409 });
    }
    return tradingDatabaseUnavailable(error);
  } finally {
    await session?.endSession();
  }
}
