import { NextResponse } from "next/server";
import { startSession } from "mongoose";
import { z } from "zod";
import { getTradingScope, recordTradingAudit, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { Item } from "@/models";

const commoditySchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9_-]+$/),
  hsnCode: z.string().trim().max(20).optional(),
  commodityCategory: z.string().trim().min(2).max(80),
  unit: z.string().trim().min(1).max(30),
  varieties: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  grades: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  sizeCalibres: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  alternateUnits: z.array(z.object({
    unit: z.string().trim().min(1).max(30),
    kilogramsPerUnit: z.coerce.number().positive().max(1_000_000),
  })).max(20).default([]),
  standardBagWeightKg: z.coerce.number().positive().max(1_000_000).optional(),
  packagingTypes: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  qualityParameters: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    unit: z.string().trim().max(30).optional(),
    required: z.boolean().default(false),
  })).max(30).default([]),
  shelfLifeDays: z.coerce.number().int().positive().max(36500).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scopeResult = await getTradingScope(
      url.searchParams.get("organizationId") ?? undefined,
      "view-traders",
    );
    if ("response" in scopeResult) return scopeResult.response;
    const commodities = await Item.find({
      organizationId: scopeResult.scope.organizationId,
      type: "goods",
      active: true,
    }).sort({ name: 1 }).lean();
    return NextResponse.json({
      commodities: commodities.map((item) => ({
        id: String(item._id),
        name: item.name,
        sku: item.sku,
        category: item.commodityCategory ?? "",
        unit: item.unit ?? "",
        varieties: item.varieties ?? [],
        grades: item.grades ?? [],
        sizeCalibres: item.sizeCalibres ?? [],
        alternateUnits: item.alternateUnits ?? [],
        standardBagWeightKg: item.standardBagWeightKg ?? null,
        packagingTypes: item.packagingTypes ?? [],
        qualityParameters: item.qualityParameters ?? [],
        shelfLifeDays: item.shelfLifeDays ?? null,
      })),
    });
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
    const parsed = commoditySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Check the commodity details and try again.", issues: parsed.error.issues }, { status: 400 });
    }
    const organizationId =
      typeof payload === "object" && payload !== null && "organizationId" in payload
        ? String(payload.organizationId)
        : undefined;
    const scopeResult = await getTradingScope(organizationId, "manage-commodities");
    if ("response" in scopeResult) return scopeResult.response;
    const sku = parsed.data.sku.toUpperCase();
    if (await Item.exists({ organizationId: scopeResult.scope.organizationId, sku })) {
      return NextResponse.json({ error: "That commodity code is already in use." }, { status: 409 });
    }
    const session = await startSession();
    let commodityId = "";
    try {
      await session.withTransaction(async () => {
        const [commodity] = await Item.create([{
          ...parsed.data,
          sku,
          type: "goods",
          inventoryTracking: true,
          organizationId: scopeResult.scope.organizationId,
          active: true,
        }], { session });
        commodityId = String(commodity._id);
        await recordTradingAudit({
          organizationId: scopeResult.scope.organizationId,
          actorId: scopeResult.scope.actorId,
          action: "commodity.created",
          entityType: "Item",
          entityId: commodityId,
          changes: { name: commodity.name, sku },
          session,
        });
      });
      return NextResponse.json({ ok: true, id: commodityId }, { status: 201 });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}
