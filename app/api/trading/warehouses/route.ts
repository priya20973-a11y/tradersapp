import { NextResponse } from "next/server";
import { startSession } from "mongoose";
import { z } from "zod";
import { getTradingScope, recordTradingAudit, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { Warehouse } from "@/models";

const warehouseSchema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(250).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  locations: z.array(z.object({
    code: z.string().trim().min(1).max(30),
    name: z.string().trim().min(1).max(100),
    type: z.enum(["Chamber", "Floor", "Stack", "Rack", "Other"]).default("Other"),
    capacity: z.coerce.number().positive().optional(),
    unit: z.string().trim().max(30).optional(),
  })).max(200).default([]),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scopeResult = await getTradingScope(
      url.searchParams.get("organizationId") ?? undefined,
      "manage-stock-lots",
    );
    if ("response" in scopeResult) return scopeResult.response;
    const warehouses = await Warehouse.find({ organizationId: scopeResult.scope.organizationId })
      .sort({ name: 1 })
      .lean();
    return NextResponse.json({
      warehouses: warehouses.map((warehouse) => ({
        id: String(warehouse._id),
        code: warehouse.code,
        name: warehouse.name,
        address: warehouse.address ?? "",
        city: warehouse.city ?? "",
        state: warehouse.state ?? "",
        status: warehouse.status,
        locations: warehouse.locations ?? [],
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
    const parsed = warehouseSchema.safeParse(payload);
    if (!parsed.success) return NextResponse.json({ error: "Check the warehouse details and try again.", issues: parsed.error.issues }, { status: 400 });
    const organizationId =
      typeof payload === "object" && payload !== null && "organizationId" in payload
        ? String(payload.organizationId)
        : undefined;
    const scopeResult = await getTradingScope(organizationId, "manage-stock-lots");
    if ("response" in scopeResult) return scopeResult.response;
    const code = parsed.data.code.toUpperCase();
    if (await Warehouse.exists({ organizationId: scopeResult.scope.organizationId, code })) {
      return NextResponse.json({ error: "That warehouse code is already in use." }, { status: 409 });
    }
    const session = await startSession();
    let warehouseId = "";
    try {
      await session.withTransaction(async () => {
        const [warehouse] = await Warehouse.create([{
          ...parsed.data,
          code,
          organizationId: scopeResult.scope.organizationId,
          status: "Active",
        }], { session });
        warehouseId = String(warehouse._id);
        await recordTradingAudit({
          organizationId: scopeResult.scope.organizationId,
          actorId: scopeResult.scope.actorId,
          action: "warehouse.created",
          entityType: "Warehouse",
          entityId: warehouseId,
          changes: { code, name: parsed.data.name },
          session,
        });
      });
      return NextResponse.json({ ok: true, id: warehouseId }, { status: 201 });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}
