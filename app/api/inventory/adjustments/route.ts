import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Item, Organization, StockAdjustment, StockLocation, Warehouse } from "@/models";
import { recordDamagedWriteOff } from "@/lib/inventory-service";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to view stock adjustments." }, { status: 401 });
    }

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId");
    const search = url.searchParams.get("search")?.toLowerCase().trim() || "";

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

    const adjustments = await StockAdjustment.find({ organizationId: orgObjId })
      .populate({ path: "commodityId", select: "name sku unit" })
      .sort({ adjustmentDate: -1, createdAt: -1 })
      .lean();

    const [warehouses, shops] = await Promise.all([
      Warehouse.find({ organizationId: orgObjId }).select("_id name code").lean(),
      StockLocation.find({ organizationId: orgObjId }).select("_id name code locationType").lean(),
    ]);

    const locMap: Record<string, string> = {};
    for (const w of warehouses) locMap[String(w._id)] = `${w.name} (${w.code})`;
    for (const s of shops) locMap[String(s._id)] = `${s.name} (${s.code})`;

    let formatted = adjustments.map((adj) => {
      const comm = adj.commodityId as unknown as { _id?: unknown; name?: string; sku?: string; unit?: string } | null;
      return {
        id: String(adj._id),
        adjustmentNumber: adj.adjustmentNumber,
        adjustmentDate: adj.adjustmentDate ? new Date(adj.adjustmentDate).toISOString() : new Date().toISOString(),
        locationType: adj.locationType,
        locationId: String(adj.locationId),
        locationName: locMap[String(adj.locationId)] || `${adj.locationType} #${String(adj.locationId).slice(-4)}`,
        commodityId: comm?._id ? String(comm._id) : String(adj.commodityId),
        commodityName: comm?.name || "Commodity",
        commoditySku: comm?.sku || "",
        adjustmentType: adj.adjustmentType,
        quantity: adj.quantity,
        unit: adj.unit || comm?.unit || "unit",
        reason: adj.reason,
        status: adj.status,
      };
    });

    if (search) {
      formatted = formatted.filter(
        (a) =>
          a.adjustmentNumber.toLowerCase().includes(search) ||
          a.commodityName.toLowerCase().includes(search) ||
          a.locationName.toLowerCase().includes(search) ||
          a.reason.toLowerCase().includes(search),
      );
    }

    return NextResponse.json({ adjustments: formatted });
  } catch (error) {
    console.error("GET /api/inventory/adjustments error:", error);
    return NextResponse.json({ error: "Failed to load stock adjustments." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to record adjustment." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      locationType,
      locationId,
      commodityId,
      quantity,
      unit = "unit",
      reason,
      organizationId: customOrgId,
    } = body;

    if (!locationType || !locationId || !isValidObjectId(locationId)) {
      return NextResponse.json({ error: "Valid location is required." }, { status: 400 });
    }

    if (!commodityId || !isValidObjectId(commodityId)) {
      return NextResponse.json({ error: "Valid commodity is required." }, { status: 400 });
    }

    const writeOffQty = Number(quantity);
    if (!writeOffQty || writeOffQty <= 0) {
      return NextResponse.json({ error: "Quantity must be greater than zero." }, { status: 400 });
    }

    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ error: "Reason for write-off is required." }, { status: 400 });
    }

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && customOrgId && isValidObjectId(customOrgId)) {
      organizationId = customOrgId;
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return NextResponse.json({ error: "Organization required." }, { status: 400 });
    }

    await connectToDatabase();

    const result = await recordDamagedWriteOff({
      organizationId,
      locationType,
      locationId,
      commodityId,
      quantity: writeOffQty,
      unit,
      reason: String(reason).trim(),
      actorId: String(session.user.id),
    });

    return NextResponse.json({ ok: true, result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/inventory/adjustments error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record stock adjustment." },
      { status: 400 },
    );
  }
}
