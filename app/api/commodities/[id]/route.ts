import { isValidObjectId, startSession } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getTradingScope, recordTradingAudit, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { Item } from "@/models";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  commodityCategory: z.string().trim().min(2).max(80).optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  varieties: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  grades: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  sizeCalibres: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  alternateUnits: z.array(z.object({
    unit: z.string().trim().min(1).max(30),
    kilogramsPerUnit: z.coerce.number().positive().max(1_000_000),
  })).max(20).optional(),
  standardBagWeightKg: z.coerce.number().positive().max(1_000_000).nullable().optional(),
  packagingTypes: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  qualityParameters: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    unit: z.string().trim().max(30).optional(),
    required: z.boolean().default(false),
  })).max(30).optional(),
  shelfLifeDays: z.coerce.number().int().positive().max(36500).nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: "Commodity not found." }, { status: 404 });
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Submit valid JSON data." }, { status: 400 });
    }
    if (typeof payload !== "object" || payload === null) {
      return NextResponse.json({ error: "Submit commodity update data." }, { status: 400 });
    }
    const body = payload as Record<string, unknown>;
    const parsed = updateSchema.safeParse(body.data);
    if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
      return NextResponse.json({ error: "Check the commodity details and try again.", issues: parsed.success ? [] : parsed.error.issues }, { status: 400 });
    }
    const scopeResult = await getTradingScope(
      typeof body.organizationId === "string" ? body.organizationId : undefined,
      "manage-commodities",
    );
    if ("response" in scopeResult) return scopeResult.response;
    const session = await startSession();
    try {
      let found = false;
      await session.withTransaction(async () => {
        const commodity = await Item.findOneAndUpdate(
          { _id: id, organizationId: scopeResult.scope.organizationId, type: "goods" },
          { $set: parsed.data },
          { new: true, runValidators: true, session },
        );
        if (!commodity) return;
        found = true;
        await recordTradingAudit({
          organizationId: scopeResult.scope.organizationId,
          actorId: scopeResult.scope.actorId,
          action: "commodity.updated",
          entityType: "Item",
          entityId: id,
          changes: { fields: Object.keys(parsed.data) },
          session,
        });
      });
      if (!found) return NextResponse.json({ error: "Commodity not found." }, { status: 404 });
      return NextResponse.json({ ok: true });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}
