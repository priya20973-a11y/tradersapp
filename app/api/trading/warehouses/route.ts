import { NextResponse } from "next/server";
import { isValidObjectId, startSession } from "mongoose";
import { z } from "zod";
import { getTradingScope, recordTradingAudit, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { Organization, Warehouse } from "@/models";

const warehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Warehouse code must be at least 2 characters.")
    .max(30, "Warehouse code cannot exceed 30 characters.")
    .regex(/^[a-zA-Z0-9_\-\s./]+$/, "Warehouse code can only contain letters, numbers, hyphens, slashes, underscores, and spaces."),
  name: z.string().trim().min(2, "Warehouse name must be at least 2 characters.").max(120, "Warehouse name cannot exceed 120 characters."),
  address: z.string().trim().max(250).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  locations: z.array(z.object({
    code: z.string().trim().min(1, "Location code is required.").max(30),
    name: z.string().trim().min(1, "Location name is required.").max(100),
    type: z.enum(["Chamber", "Floor", "Stack", "Rack", "Other"]).default("Other"),
    capacity: z.coerce.number().positive().optional(),
    unit: z.string().trim().max(30).optional(),
  })).max(200).default([]),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    let organizationId = url.searchParams.get("organizationId")?.trim() || undefined;
    if (!organizationId) {
      const defaultOrg = await Organization.findOne({ status: "active" }).select("_id").lean();
      if (defaultOrg) organizationId = String(defaultOrg._id);
    }

    const scopeResult = await getTradingScope(organizationId, "manage-stock-lots");
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
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(" ");
      return NextResponse.json(
        { error: errorMsg || "Check the warehouse details and try again.", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    let organizationId =
      typeof payload === "object" && payload !== null && "organizationId" in payload
        ? String(payload.organizationId).trim()
        : undefined;

    if (!organizationId) {
      const defaultOrg = await Organization.findOne({ status: "active" }).select("_id").lean();
      if (defaultOrg) organizationId = String(defaultOrg._id);
    }

    const scopeResult = await getTradingScope(organizationId, "manage-stock-lots");
    if ("response" in scopeResult) return scopeResult.response;

    const code = parsed.data.code.toUpperCase();
    if (await Warehouse.exists({ organizationId: scopeResult.scope.organizationId, code })) {
      return NextResponse.json({ error: "That warehouse code is already in use." }, { status: 409 });
    }

    let warehouseId = "";
    try {
      const session = await startSession();
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
      } finally {
        await session.endSession();
      }
    } catch (txError) {
      // Fallback for standalone MongoDB deployments where transactions or retryable writes are not enabled
      if (
        txError instanceof Error &&
        /Transaction numbers are only allowed|transactions are not supported|replica set|retryable writes/i.test(txError.message)
      ) {
        const [warehouse] = await Warehouse.create([{
          ...parsed.data,
          code,
          organizationId: scopeResult.scope.organizationId,
          status: "Active",
        }]);
        warehouseId = String(warehouse._id);
        await recordTradingAudit({
          organizationId: scopeResult.scope.organizationId,
          actorId: scopeResult.scope.actorId,
          action: "warehouse.created",
          entityType: "Warehouse",
          entityId: warehouseId,
          changes: { code, name: parsed.data.name },
        });
      } else {
        throw txError;
      }
    }

    return NextResponse.json({ ok: true, id: warehouseId }, { status: 201 });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    let organizationId = url.searchParams.get("organizationId")?.trim() || undefined;
    if (!organizationId) {
      const defaultOrg = await Organization.findOne({ status: "active" }).select("_id").lean();
      if (defaultOrg) organizationId = String(defaultOrg._id);
    }

    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid warehouse ID." }, { status: 400 });
    }

    const scopeResult = await getTradingScope(organizationId, "manage-stock-lots");
    if ("response" in scopeResult) return scopeResult.response;

    const warehouse = await Warehouse.findOne({ _id: id, organizationId: scopeResult.scope.organizationId });
    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found." }, { status: 404 });
    }

    await Warehouse.deleteOne({ _id: id });
    return NextResponse.json({ ok: true, message: "Warehouse deleted successfully." });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}
