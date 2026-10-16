import { isValidObjectId, startSession } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getTradingScope, recordTradingAudit, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { TraderPayment, TraderProfile, TradeDeal } from "@/models";

const transitions: Record<string, string[]> = {
  Draft: ["Negotiation", "Confirmed", "Cancelled"],
  Negotiation: ["Confirmed", "Cancelled"],
  Confirmed: ["Cancelled", "Disputed"],
  "Partially Delivered": ["Disputed"],
  Delivered: ["Partially Invoiced", "Invoiced", "Partially Settled", "Settled", "Disputed"],
  "Partially Invoiced": ["Invoiced", "Partially Settled", "Settled", "Disputed"],
  Invoiced: ["Partially Settled", "Settled", "Disputed"],
  "Partially Settled": ["Settled", "Disputed"],
  Disputed: ["Confirmed", "Cancelled"],
  Cancelled: [],
  Settled: [],
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Submit valid JSON data." }, { status: 400 });
    }
    if (typeof payload !== "object" || payload === null) {
      return NextResponse.json({ error: "Submit a valid deal action." }, { status: 400 });
    }
    const body = payload as Record<string, unknown>;
    const permission = body.action === "record-settlement" ? "approve-settlements" : "manage-deals";
    const scopeResult = await getTradingScope(
      typeof body.organizationId === "string" ? body.organizationId : undefined,
      permission,
    );
    if ("response" in scopeResult) return scopeResult.response;
    const filter = { _id: id, organizationId: scopeResult.scope.organizationId };
    const deal = await TradeDeal.findOne(filter);
    if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });

    let action: string;
    let changes: Record<string, unknown>;
    let pendingPayment: {
      traderId: string;
      direction: "Receipt" | "Payment";
      amount: number;
      method: "Cash" | "Bank" | "UPI" | "Cheque" | "RTGS" | "NEFT";
      referenceNumber?: string;
      idempotencyKey: string;
    } | undefined;
    if (body.action === "transition") {
      const parsed = z.object({
        status: z.enum(["Negotiation", "Confirmed", "Cancelled", "Disputed", "Partially Invoiced", "Invoiced", "Partially Settled", "Settled"]),
        reason: z.string().trim().max(1000).optional(),
      }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Choose a valid deal status." }, { status: 400 });
      if (!transitions[deal.status]?.includes(parsed.data.status)) {
        return NextResponse.json({ error: `Deal cannot move from ${deal.status} to ${parsed.data.status}.` }, { status: 409 });
      }
      if (parsed.data.status === "Settled" && deal.settledAmount < deal.contractedQuantity * deal.agreedRate + deal.commissionAmount + deal.otherCharges) {
        return NextResponse.json({ error: "The deal cannot be settled until the full contract amount is recorded as settled." }, { status: 409 });
      }
      deal.status = parsed.data.status;
      action = "deal.status.changed";
      changes = { status: parsed.data.status, reason: parsed.data.reason ?? "" };
    } else if (body.action === "record-delivery") {
      const parsed = z.object({
        quantity: z.coerce.number().positive(),
        acceptedQuantity: z.coerce.number().min(0),
        rejectedQuantity: z.coerce.number().min(0),
      }).safeParse(body.data);
      if (!parsed.success || Math.abs(parsed.data.acceptedQuantity + parsed.data.rejectedQuantity - parsed.data.quantity) > 0.000001) {
        return NextResponse.json({ error: "Accepted and rejected quantities must add up to the delivered quantity." }, { status: 400 });
      }
      if (!["Confirmed", "Partially Delivered"].includes(deal.status)) {
        return NextResponse.json({ error: "Only confirmed deals can receive delivery records." }, { status: 409 });
      }
      const newDelivered = deal.deliveredQuantity + parsed.data.quantity;
      if (newDelivered > deal.contractedQuantity + 0.000001) {
        return NextResponse.json({ error: "Delivery exceeds the remaining contracted quantity." }, { status: 409 });
      }
      deal.deliveredQuantity = newDelivered;
      deal.acceptedQuantity += parsed.data.acceptedQuantity;
      deal.rejectedQuantity += parsed.data.rejectedQuantity;
      deal.status = newDelivered >= deal.contractedQuantity - 0.000001 ? "Delivered" : "Partially Delivered";
      action = "deal.delivery.recorded";
      changes = { quantity: parsed.data.quantity, acceptedQuantity: parsed.data.acceptedQuantity, rejectedQuantity: parsed.data.rejectedQuantity };
    } else if (body.action === "record-settlement") {
      const parsed = z.object({
        amount: z.coerce.number().positive(),
        direction: z.enum(["Receipt", "Payment"]),
        method: z.enum(["Cash", "Bank", "UPI", "Cheque", "RTGS", "NEFT"]),
        reference: z.string().trim().max(120).optional(),
        idempotencyKey: z.string().trim().min(8).max(120),
      }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Enter a valid settlement amount." }, { status: 400 });
      if (!["Delivered", "Partially Invoiced", "Invoiced", "Partially Settled"].includes(deal.status)) {
        return NextResponse.json({ error: "Record settlement only after delivery or invoicing." }, { status: 409 });
      }
      const maximum = deal.contractedQuantity * deal.agreedRate + deal.commissionAmount + deal.otherCharges;
      if (deal.settledAmount + parsed.data.amount > maximum + 0.000001) {
        return NextResponse.json({ error: "Settlement exceeds the outstanding contract amount." }, { status: 409 });
      }
      const counterpartyId = parsed.data.direction === "Receipt" ? deal.buyerTraderId : deal.sellerTraderId;
      if (!counterpartyId || !await TraderProfile.exists({
        _id: counterpartyId,
        organizationId: scopeResult.scope.organizationId,
        tradingStatus: "Active",
      })) {
        return NextResponse.json({ error: `This deal has no active ${parsed.data.direction === "Receipt" ? "buyer" : "seller"} trader to associate with the settlement.` }, { status: 400 });
      }
      const existingPayment = await TraderPayment.findOne({
        organizationId: scopeResult.scope.organizationId,
        idempotencyKey: parsed.data.idempotencyKey,
      }).lean();
      if (existingPayment) {
        const isSameSettlement = existingPayment.direction === parsed.data.direction &&
          existingPayment.amount === parsed.data.amount &&
          String(existingPayment.traderId) === String(counterpartyId) &&
          existingPayment.allocations.some((allocation) =>
            allocation.targetType === "Deal" &&
            String(allocation.targetId) === id &&
            allocation.amount === parsed.data.amount,
          );
        if (!isSameSettlement) return NextResponse.json({ error: "This idempotency key was already used for a different payment." }, { status: 409 });
        return NextResponse.json({ ok: true, replayed: true, status: deal.status, settledAmount: deal.settledAmount });
      }
      deal.settledAmount += parsed.data.amount;
      deal.status = deal.settledAmount >= maximum - 0.000001 ? "Settled" : "Partially Settled";
      action = "deal.settlement.recorded";
      changes = { amount: parsed.data.amount, direction: parsed.data.direction, reference: parsed.data.reference ?? "", settledAmount: deal.settledAmount };
      pendingPayment = {
        traderId: String(counterpartyId),
        direction: parsed.data.direction,
        amount: parsed.data.amount,
        method: parsed.data.method,
        referenceNumber: parsed.data.reference,
        idempotencyKey: parsed.data.idempotencyKey,
      };
    } else if (body.action === "record-cost") {
      const parsed = z.object({
        category: z.string().trim().min(1).max(100),
        amount: z.coerce.number().min(0).max(1_000_000_000),
        realized: z.boolean().default(false),
      }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Enter a valid deal cost." }, { status: 400 });
      const cost = { category: parsed.data.category, amount: parsed.data.amount };
      if (parsed.data.realized) deal.realizedCosts.push(cost);
      else deal.estimatedCosts.push(cost);
      action = parsed.data.realized ? "deal.realized-cost.recorded" : "deal.estimated-cost.recorded";
      changes = cost;
    } else {
      return NextResponse.json({ error: "Choose a valid deal action." }, { status: 400 });
    }

    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        await deal.save({ session });
        if (pendingPayment) {
          await TraderPayment.create([{
            organizationId: scopeResult.scope.organizationId,
            traderId: pendingPayment.traderId,
            direction: pendingPayment.direction,
            paymentDate: new Date(),
            method: pendingPayment.method,
            amount: pendingPayment.amount,
            unallocatedAmount: 0,
            allocations: [{ targetType: "Deal", targetId: id, amount: pendingPayment.amount }],
            referenceNumber: pendingPayment.referenceNumber,
            status: "Posted",
            idempotencyKey: pendingPayment.idempotencyKey,
            actorId: scopeResult.scope.actorId,
          }], { session });
        }
        await recordTradingAudit({
          organizationId: scopeResult.scope.organizationId,
          actorId: scopeResult.scope.actorId,
          action,
          entityType: "TradeDeal",
          entityId: id,
          changes,
          session,
        });
      });
    } catch (error) {
      if (error instanceof Error && /Transaction numbers are only allowed|transactions are not supported|replica set/i.test(error.message)) {
        return NextResponse.json({ error: "Deal updates and settlements require MongoDB transactions. Configure MongoDB as a replica set or Atlas cluster." }, { status: 503 });
      }
      if (error instanceof Error && error.name === "VersionError") {
        return NextResponse.json({ error: "This deal changed in another request. Refresh and try again." }, { status: 409 });
      }
      throw error;
    } finally {
      await session.endSession();
    }
    return NextResponse.json({
      ok: true,
      status: deal.status,
      deliveredQuantity: deal.deliveredQuantity,
      settledAmount: deal.settledAmount,
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "This settlement was already recorded. Refresh to see its latest status." }, { status: 409 });
    }
    return tradingDatabaseUnavailable(error);
  }
}
