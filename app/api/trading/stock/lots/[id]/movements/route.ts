import { randomUUID } from "node:crypto";
import { isValidObjectId, startSession, Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getTradingScope, recordTradingAudit, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { availableStock, stockLotStatus } from "@/lib/trading-calculations";
import { StockLot, StockMovement, Warehouse } from "@/models";

class StockConflictError extends Error {}

const actionSchema = z.object({
  action: z.enum(["Inward", "Reserve", "Release", "Dispatch", "Damage", "Transfer", "Reverse"]),
  quantity: z.coerce.number().positive().max(1_000_000_000),
  idempotencyKey: z.string().trim().min(8).max(120),
  originalMovementId: z.string().trim().min(1).max(120).optional(),
  reservationId: z.string().trim().min(1).max(120).optional(),
  destinationWarehouseId: z.string().refine(isValidObjectId).optional(),
  referenceDocument: z.string().trim().max(120).optional(),
  remarks: z.string().trim().max(1000).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };
type MovementInput = z.infer<typeof actionSchema>;

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: "Stock lot not found." }, { status: 404 });
    const url = new URL(request.url);
    const scopeResult = await getTradingScope(
      url.searchParams.get("organizationId") ?? undefined,
      "manage-stock-lots",
    );
    if ("response" in scopeResult) return scopeResult.response;
    const organizationId = scopeResult.scope.organizationId;
    if (!await StockLot.exists({ _id: id, organizationId })) {
      return NextResponse.json({ error: "Stock lot not found." }, { status: 404 });
    }
    const movements = await StockMovement.find({ lotId: id, organizationId }).sort({ occurredAt: -1 }).limit(200).lean();
    const reversedIds = new Set(
      movements
        .filter((movement) => movement.movementType === "Reversal" && movement.reversedMovementId)
        .map((movement) => String(movement.reversedMovementId)),
    );
    return NextResponse.json({
      movements: movements.map((movement) => ({
        ...movement,
        isReversal: movement.movementType === "Reversal",
        hasBeenReversed: reversedIds.has(String(movement._id)),
      })),
    });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}

function movementTypeForAction(action: MovementInput["action"]) {
  return {
    Inward: "Inward",
    Reserve: "Reservation",
    Release: "Reservation Release",
    Dispatch: "Sales Dispatch",
    Damage: "Damage",
    Transfer: "Transfer",
    Reverse: "Reversal",
  }[action];
}

function matchesReplay(
  existing: { lotId: unknown; movementType: string; quantity: number; reservationId?: string; destinationWarehouseId?: unknown; reversedMovementId?: unknown },
  lotObjectId: string,
  input: MovementInput,
) {
  return String(existing.lotId) === lotObjectId &&
    existing.movementType === movementTypeForAction(input.action) &&
    existing.quantity === input.quantity &&
    (input.action === "Reverse" || (existing.reservationId ?? "") === (input.reservationId ?? "")) &&
    (input.action !== "Reverse" || String(existing.reversedMovementId ?? "") === input.originalMovementId) &&
    (input.action !== "Transfer" ||
      String(existing.destinationWarehouseId ?? "") === String(input.destinationWarehouseId ?? ""));
}

export async function POST(request: Request, { params }: RouteContext) {
  let session: Awaited<ReturnType<typeof startSession>> | undefined;
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: "Stock lot not found." }, { status: 404 });
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Submit valid JSON data." }, { status: 400 });
    }
    const parsed = actionSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Check the stock movement details and try again.", issues: parsed.error.issues }, { status: 400 });
    }
    const organizationId =
      typeof payload === "object" && payload !== null && "organizationId" in payload
        ? String(payload.organizationId)
        : undefined;
    const input = parsed.data;
    const permission = input.action === "Damage" || input.action === "Reverse" ? "approve-stock-adjustments" : "manage-stock-lots";
    const scopeResult = await getTradingScope(organizationId, permission);
    if ("response" in scopeResult) return scopeResult.response;
    const orgId = scopeResult.scope.organizationId;
    const existing = await StockMovement.findOne({ organizationId: orgId, idempotencyKey: input.idempotencyKey }).lean();
    if (existing) {
      if (!matchesReplay(existing, id, input)) {
        return NextResponse.json({ error: "This idempotency key was already used for a different movement." }, { status: 409 });
      }
      return NextResponse.json({ ok: true, replayed: true, movementId: existing.movementId });
    }

    if (input.action === "Reserve" && !input.reservationId) {
      return NextResponse.json({ error: "A reservation ID is required." }, { status: 400 });
    }
    if (input.action === "Reverse" && !input.originalMovementId) {
      return NextResponse.json({ error: "Choose the original movement to reverse." }, { status: 400 });
    }
    if (input.action === "Transfer" && !input.destinationWarehouseId) {
      return NextResponse.json({ error: "Select a destination warehouse." }, { status: 400 });
    }
    if (input.action === "Transfer" && !await Warehouse.exists({
      _id: input.destinationWarehouseId,
      organizationId: orgId,
      status: "Active",
    })) {
      return NextResponse.json({ error: "Select an active warehouse from this organization." }, { status: 400 });
    }

    session = await startSession();
    const transactionSession = session;
    let movementId = "";
    let resultingStatus = "";
    await transactionSession.withTransaction(async () => {
      const replay = await StockMovement.findOne({
        organizationId: orgId,
        idempotencyKey: input.idempotencyKey,
      }).session(transactionSession);
      if (replay) {
        if (!matchesReplay(replay, id, input)) {
          throw new StockConflictError("This idempotency key was already used for a different movement.");
        }
        movementId = replay.movementId;
        resultingStatus = "replayed";
        return;
      }
      const lot = await StockLot.findOne({ _id: id, organizationId: orgId }).session(transactionSession);
      if (!lot) throw new StockConflictError("Stock lot not found.");
      const available = availableStock(lot.physicalQuantity, lot.reservedQuantity);
      const previousWarehouseId = lot.warehouseId;
      let movementType: string = input.action;
      let sourceWarehouseId: Types.ObjectId | undefined;
      let destinationWarehouseId: Types.ObjectId | undefined;
      let reversedMovementId: Types.ObjectId | undefined;
      let movementReservationId = input.reservationId;

      if (input.action === "Inward") {
        lot.physicalQuantity += input.quantity;
        destinationWarehouseId = previousWarehouseId;
      } else if (input.action === "Reserve") {
        if (lot.physicalQuantity <= 0 || input.quantity > available + 0.000001) {
          throw new StockConflictError("Reservation exceeds available, unreserved stock.");
        }
        if (await StockMovement.exists({
          organizationId: orgId,
          lotId: id,
          movementType: "Reservation",
          reservationId: input.reservationId,
        }).session(transactionSession)) {
          throw new StockConflictError("Use a unique reservation ID for each reservation.");
        }
        lot.reservedQuantity += input.quantity;
        movementType = "Reservation";
      } else if (input.action === "Release") {
        if (!input.reservationId) throw new StockConflictError("A reservation ID is required to release stock.");
        const reservation = await StockMovement.findOne({
          organizationId: orgId,
          lotId: id,
          movementType: "Reservation",
          reservationId: input.reservationId,
        }).session(transactionSession);
        if (!reservation) throw new StockConflictError("Reservation not found.");
        const releases = await StockMovement.aggregate([
          { $match: { organizationId: lot.organizationId, lotId: lot._id, movementType: "Reservation Release", reservationId: input.reservationId } },
          { $group: { _id: null, total: { $sum: "$quantity" } } },
        ]).session(transactionSession);
        const remainingReserved = reservation.quantity - Number(releases[0]?.total ?? 0);
        if (input.quantity > remainingReserved + 0.000001) {
          throw new StockConflictError("Release exceeds the remaining reserved quantity.");
        }
        if (input.quantity > lot.reservedQuantity + 0.000001) {
          throw new StockConflictError("Lot reserved quantity is inconsistent; investigate stock movements.");
        }
        movementType = "Reservation Release";
        lot.reservedQuantity -= input.quantity;
      } else if (input.action === "Dispatch") {
        if (input.quantity > available + 0.000001) throw new StockConflictError("Dispatch exceeds available, unreserved stock.");
        lot.physicalQuantity -= input.quantity;
        lot.dispatchedQuantity += input.quantity;
        movementType = "Sales Dispatch";
        sourceWarehouseId = previousWarehouseId;
      } else if (input.action === "Damage") {
        if (input.quantity > available + 0.000001) throw new StockConflictError("Damage quantity exceeds available, unreserved stock.");
        lot.physicalQuantity -= input.quantity;
        lot.damagedQuantity += input.quantity;
        movementType = "Damage";
        sourceWarehouseId = previousWarehouseId;
      } else if (input.action === "Transfer") {
        if (!input.destinationWarehouseId || input.destinationWarehouseId === String(previousWarehouseId)) {
          throw new StockConflictError("Choose a different destination warehouse.");
        }
        if (input.quantity !== lot.physicalQuantity || lot.reservedQuantity > 0) {
          throw new StockConflictError("A transfer moves the entire unreserved remainder of a lot.");
        }
        lot.warehouseId = new Types.ObjectId(input.destinationWarehouseId);
        movementType = "Transfer";
        sourceWarehouseId = previousWarehouseId;
        destinationWarehouseId = new Types.ObjectId(input.destinationWarehouseId);
      } else {
        const original = await StockMovement.findOne({
          organizationId: orgId,
          lotId: id,
          movementId: input.originalMovementId,
        }).session(transactionSession);
        if (!original || original.movementType === "Reversal") {
          throw new StockConflictError("The original stock movement could not be reversed.");
        }
        const previousReversals = await StockMovement.aggregate([
          { $match: { organizationId: lot.organizationId, lotId: lot._id, movementType: "Reversal", reversedMovementId: original._id } },
          { $group: { _id: null, total: { $sum: "$quantity" } } },
        ]).session(transactionSession);
        const remainingToReverse = original.quantity - Number(previousReversals[0]?.total ?? 0);
        if (input.quantity > remainingToReverse + 0.000001) {
          throw new StockConflictError("Reversal exceeds the original movement's remaining quantity.");
        }
        if (original.movementType === "Inward" || original.movementType === "Opening Stock") {
          if (String(original.destinationWarehouseId ?? "") !== String(lot.warehouseId)) {
            throw new StockConflictError("The lot has moved warehouses since this inward movement.");
          }
          if (input.quantity > available + 0.000001) throw new StockConflictError("Stock already reserved or dispatched cannot be removed by this reversal.");
          lot.physicalQuantity -= input.quantity;
          sourceWarehouseId = previousWarehouseId;
        } else if (original.movementType === "Reservation") {
          const reservationReleases = await StockMovement.aggregate([
            { $match: { organizationId: lot.organizationId, lotId: lot._id, movementType: "Reservation Release", reservationId: original.reservationId } },
            { $group: { _id: null, total: { $sum: "$quantity" } } },
          ]).session(transactionSession);
          const activeOriginalReservation = original.quantity -
            Number(reservationReleases[0]?.total ?? 0) -
            Number(previousReversals[0]?.total ?? 0);
          if (input.quantity > activeOriginalReservation + 0.000001 || input.quantity > lot.reservedQuantity + 0.000001) {
            throw new StockConflictError("This reservation has already been released or used.");
          }
          lot.reservedQuantity -= input.quantity;
        } else if (original.movementType === "Reservation Release") {
          if (input.quantity > available + 0.000001) throw new StockConflictError("Reinstating this reservation exceeds available stock.");
          lot.reservedQuantity += input.quantity;
        } else if (original.movementType === "Sales Dispatch") {
          if (String(original.sourceWarehouseId ?? "") !== String(lot.warehouseId)) {
            throw new StockConflictError("The lot has moved warehouses since this dispatch.");
          }
          if (input.quantity > lot.dispatchedQuantity + 0.000001) throw new StockConflictError("Reversal exceeds dispatched quantity.");
          lot.physicalQuantity += input.quantity;
          lot.dispatchedQuantity -= input.quantity;
          destinationWarehouseId = previousWarehouseId;
        } else if (original.movementType === "Damage") {
          if (input.quantity > lot.damagedQuantity + 0.000001) throw new StockConflictError("Reversal exceeds damaged quantity.");
          lot.physicalQuantity += input.quantity;
          lot.damagedQuantity -= input.quantity;
          destinationWarehouseId = previousWarehouseId;
        } else if (original.movementType === "Transfer") {
          if (
            input.quantity !== original.quantity ||
            String(lot.warehouseId) !== String(original.destinationWarehouseId) ||
            lot.reservedQuantity > 0
          ) {
            throw new StockConflictError("This transfer can only be reversed while the complete lot remains at its destination and unreserved.");
          }
          sourceWarehouseId = lot.warehouseId;
          destinationWarehouseId = original.sourceWarehouseId;
          if (!original.sourceWarehouseId) throw new StockConflictError("Original transfer has no source warehouse.");
          lot.warehouseId = original.sourceWarehouseId;
        } else {
          throw new StockConflictError(`A ${original.movementType} movement cannot be reversed.`);
        }
        movementType = "Reversal";
        movementReservationId = original.reservationId;
        reversedMovementId = original._id;
      }

      lot.status = stockLotStatus(lot.physicalQuantity, lot.reservedQuantity, lot.damagedQuantity);
      await lot.save({ session: transactionSession });
      movementId = `MOV-${randomUUID()}`;
      await StockMovement.create([{
        organizationId: orgId,
        movementId,
        lotId: lot._id,
        movementType,
        sourceWarehouseId,
        destinationWarehouseId,
        quantity: input.quantity,
        unit: lot.unit,
        referenceDocument: input.referenceDocument,
        reservationId: movementReservationId,
        reversedMovementId,
        actorId: scopeResult.scope.actorId,
        remarks: input.remarks,
        idempotencyKey: input.idempotencyKey,
      }], { session: transactionSession });
      resultingStatus = lot.status;
      await recordTradingAudit({
        organizationId: orgId,
        actorId: scopeResult.scope.actorId,
        action: `stock.${input.action.toLowerCase()}`,
        entityType: "StockLot",
        entityId: id,
        changes: {
          quantity: input.quantity,
          idempotencyKey: input.idempotencyKey,
          sourceWarehouseId,
          destinationWarehouseId,
          status: lot.status,
          originalMovementId: input.originalMovementId ?? "",
        },
        session: transactionSession,
      });
    });
    return NextResponse.json({ ok: true, movementId, status: resultingStatus, replayed: resultingStatus === "replayed" });
  } catch (error) {
    if (error instanceof StockConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "This idempotency key or movement ID has already been recorded. Retry with the same key to retrieve its result." }, { status: 409 });
    }
    if (error instanceof Error && /Transaction numbers are only allowed|transactions are not supported|replica set/i.test(error.message)) {
      return NextResponse.json({ error: "Stock movements require MongoDB transactions. Configure MongoDB as a replica set or Atlas cluster." }, { status: 503 });
    }
    return tradingDatabaseUnavailable(error);
  } finally {
    await session?.endSession();
  }
}
