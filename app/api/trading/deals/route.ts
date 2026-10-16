import { startSession, Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getTradingScope, recordTradingAudit, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { calculateCommission } from "@/lib/trading-calculations";
import { Item, TradeDeal, TraderProfile, Warehouse } from "@/models";

const dealSchema = z.object({
  dealReference: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9_-]+$/),
  dealType: z.enum(["Purchase", "Sale", "Buy-Sell", "Brokered Deal", "Consignment"]),
  tradeDate: z.coerce.date().optional(),
  buyerTraderId: z.string().refine(Types.ObjectId.isValid).optional(),
  sellerTraderId: z.string().refine(Types.ObjectId.isValid).optional(),
  brokerTraderId: z.string().refine(Types.ObjectId.isValid).optional(),
  commodityItemId: z.string().refine(Types.ObjectId.isValid),
  variety: z.string().trim().max(100).optional(),
  grade: z.string().trim().max(100).optional(),
  cropYear: z.string().trim().max(20).optional(),
  originMarket: z.string().trim().max(120).optional(),
  contractedQuantity: z.coerce.number().positive().max(1_000_000_000),
  unit: z.string().trim().min(1).max(30),
  actualBagWeight: z.coerce.number().positive().max(1_000_000).optional(),
  agreedRate: z.coerce.number().positive().max(1_000_000_000),
  rateBasis: z.string().trim().min(1).max(50).default("per unit"),
  commissionRate: z.coerce.number().min(0).max(100).default(0),
  commissionAmount: z.coerce.number().min(0).max(1_000_000_000).optional(),
  otherCharges: z.coerce.number().min(0).max(1_000_000_000).default(0),
  expectedDeliveryDate: z.coerce.date().optional(),
  deliveryLocation: z.string().trim().max(200).optional(),
  warehouseId: z.string().refine(Types.ObjectId.isValid).optional(),
  advanceAmount: z.coerce.number().min(0).max(1_000_000_000).default(0),
  settlementTerms: z.string().trim().max(1000).optional(),
  internalRemarks: z.string().trim().max(3000).optional(),
  estimatedCosts: z.array(z.object({
    category: z.string().trim().min(1).max(100),
    amount: z.coerce.number().min(0).max(1_000_000_000),
  })).max(50).default([]),
}).superRefine((deal, context) => {
  if (["Sale", "Buy-Sell", "Brokered Deal"].includes(deal.dealType) && !deal.buyerTraderId) {
    context.addIssue({ code: "custom", path: ["buyerTraderId"], message: "Select a buyer for this deal." });
  }
  if (["Purchase", "Buy-Sell", "Brokered Deal", "Consignment"].includes(deal.dealType) && !deal.sellerTraderId) {
    context.addIssue({ code: "custom", path: ["sellerTraderId"], message: "Select a seller or consignment owner." });
  }
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scopeResult = await getTradingScope(
      url.searchParams.get("organizationId") ?? undefined,
      "manage-deals",
    );
    if ("response" in scopeResult) return scopeResult.response;
    const filter: Record<string, unknown> = { organizationId: scopeResult.scope.organizationId };
    const status = url.searchParams.get("status");
    if (status) filter.status = status;
    const deals = await TradeDeal.find(filter)
      .populate({ path: "buyerTraderId", select: "traderCode legalBusinessName" })
      .populate({ path: "sellerTraderId", select: "traderCode legalBusinessName" })
      .populate({ path: "commodityItemId", select: "name sku" })
      .sort({ tradeDate: -1, createdAt: -1 })
      .limit(200)
      .lean();
    return NextResponse.json({ deals });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}

export async function POST(request: Request) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Submit valid JSON data." }, { status: 400 });
    }
    const parsed = dealSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Check the deal details and try again.", issues: parsed.error.issues }, { status: 400 });
    }
    const organizationId =
      typeof payload === "object" && payload !== null && "organizationId" in payload
        ? String(payload.organizationId)
        : undefined;
    const scopeResult = await getTradingScope(organizationId, "manage-deals");
    if ("response" in scopeResult) return scopeResult.response;
    const orgId = scopeResult.scope.organizationId;
    const reference = parsed.data.dealReference.toUpperCase();
    if (await TradeDeal.exists({ organizationId: orgId, dealReference: reference })) {
      return NextResponse.json({ error: "That deal reference is already in use." }, { status: 409 });
    }

    const { buyerTraderId, sellerTraderId, brokerTraderId, commodityItemId, warehouseId } = parsed.data;
    const traderIds = [buyerTraderId, sellerTraderId, brokerTraderId].filter(Boolean);
    const traders = traderIds.length
      ? await TraderProfile.find({
        organizationId: orgId,
        _id: { $in: traderIds },
        tradingStatus: "Active",
      }).select("_id roles")
      : [];
    if (traders.length !== traderIds.length) {
      return NextResponse.json({ error: "Select active traders from this organization only." }, { status: 400 });
    }
    const buyer = buyerTraderId ? traders.find((trader) => String(trader._id) === buyerTraderId) : undefined;
    const seller = sellerTraderId ? traders.find((trader) => String(trader._id) === sellerTraderId) : undefined;
    if (buyer && !buyer.roles.includes("Buyer")) return NextResponse.json({ error: "Selected buyer is not registered as a buyer." }, { status: 400 });
    if (seller && !seller.roles.some((role) => ["Seller", "Consignment Owner"].includes(role))) {
      return NextResponse.json({ error: "Selected seller is not registered as a seller or consignment owner." }, { status: 400 });
    }
    const commodity = await Item.exists({
      _id: commodityItemId,
      organizationId: orgId,
      type: "goods",
      active: true,
    });
    if (!commodity) return NextResponse.json({ error: "Select an active commodity from this organization." }, { status: 400 });
    if (warehouseId && !await Warehouse.exists({ _id: warehouseId, organizationId: orgId, status: "Active" })) {
      return NextResponse.json({ error: "Select an active warehouse from this organization." }, { status: 400 });
    }
    const baseAmount = parsed.data.contractedQuantity * parsed.data.agreedRate;
    const commissionAmount = parsed.data.commissionAmount ?? calculateCommission(baseAmount, parsed.data.commissionRate);
    const session = await startSession();
    let dealId = "";
    try {
      await session.withTransaction(async () => {
        const [deal] = await TradeDeal.create([{
          ...parsed.data,
          dealReference: reference,
          organizationId: orgId,
          buyerTraderId,
          sellerTraderId,
          brokerTraderId,
          commodityItemId,
          warehouseId,
          commissionAmount,
          linkedInvoiceIds: [],
          deliveredQuantity: 0,
          acceptedQuantity: 0,
          rejectedQuantity: 0,
          settledAmount: 0,
          status: "Draft",
        }], { session });
        dealId = String(deal._id);
        await recordTradingAudit({
          organizationId: orgId,
          actorId: scopeResult.scope.actorId,
          action: "deal.created",
          entityType: "TradeDeal",
          entityId: dealId,
          changes: { dealReference: reference, dealType: parsed.data.dealType, contractedQuantity: parsed.data.contractedQuantity },
          session,
        });
      });
      return NextResponse.json({ ok: true, id: dealId, dealReference: reference }, { status: 201 });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}
