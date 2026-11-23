import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Item, Organization, StockLevel, StockLocation, Warehouse } from "@/models";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to access inventory." }, { status: 401 });
    }

    const url = new URL(request.url);
    const locationType = url.searchParams.get("locationType"); // "Warehouse" | "Shop"
    const locationId = url.searchParams.get("locationId");
    const commodityId = url.searchParams.get("commodityId");
    const search = url.searchParams.get("search")?.toLowerCase().trim() || "";
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

    const filter: Record<string, unknown> = { organizationId: orgObjId };
    if (locationType === "Warehouse" || locationType === "Shop") {
      filter.locationType = locationType;
    }
    if (locationId && isValidObjectId(locationId)) {
      filter.locationId = new Types.ObjectId(locationId);
    }
    if (commodityId && isValidObjectId(commodityId)) {
      filter.commodityId = new Types.ObjectId(commodityId);
    }

    const stockLevels = await StockLevel.find(filter)
      .populate({ path: "commodityId", select: "name sku unit purchasePrice salesPrice" })
      .sort({ updatedAt: -1 })
      .lean();

    // Load location names map and lookup any unpopulated commodities from Item master
    const unpopulatedIds = stockLevels
      .filter((lvl) => !lvl.commodityId || typeof (lvl.commodityId as unknown as { name?: string })?.name !== "string")
      .map((lvl) => lvl.commodityId)
      .filter((id) => id && isValidObjectId(id));

    const [warehouses, shops, extraItems] = await Promise.all([
      Warehouse.find({ organizationId: orgObjId }).select("_id name code").lean(),
      StockLocation.find({ organizationId: orgObjId }).select("_id name code locationType").lean(),
      unpopulatedIds.length > 0
        ? Item.find({ _id: { $in: unpopulatedIds } }).select("_id name sku unit").lean()
        : Promise.resolve([]),
    ]);

    const itemMasterMap = new Map<string, { name: string; sku?: string; unit?: string }>();
    for (const rawIt of extraItems) {
      const it = rawIt as unknown as { _id?: unknown; name?: string; sku?: string; unit?: string };
      itemMasterMap.set(String(it._id), {
        name: String(it.name || "Commodity"),
        sku: it.sku ? String(it.sku) : undefined,
        unit: it.unit ? String(it.unit) : undefined,
      });
    }

    const locationNameMap: Record<string, { name: string; code: string; type: string }> = {};
    for (const w of warehouses) {
      locationNameMap[String(w._id)] = { name: w.name, code: w.code, type: "Warehouse" };
    }
    for (const s of shops) {
      locationNameMap[String(s._id)] = { name: s.name, code: s.code, type: s.locationType || "Shop" };
    }

    let results = stockLevels.map((lvl) => {
      const comm = lvl.commodityId as unknown as { _id?: unknown; name?: string; sku?: string; unit?: string; purchasePrice?: number; salesPrice?: number } | null;
      const unpop = itemMasterMap.get(String(lvl.commodityId));
      const locInfo = locationNameMap[String(lvl.locationId)] || {
        name: `${lvl.locationType} #${String(lvl.locationId).slice(-4)}`,
        code: String(lvl.locationId).slice(-4),
        type: lvl.locationType,
      };

      const onHand = Number(lvl.onHandQuantity || 0);
      const reserved = Number(lvl.reservedQuantity || 0);
      const available = Math.max(0, Math.round((onHand - reserved) * 10000) / 10000);
      const damaged = Number(lvl.damagedQuantity || 0);
      const avgCost = Number(lvl.averageCost || comm?.purchasePrice || 0);
      const stockValue = Number(lvl.stockValue || Math.round(onHand * avgCost * 100) / 100);

      const commodityName = comm?.name || unpop?.name || "Commodity";
      const commoditySku = comm?.sku || unpop?.sku || "";
      const unit = comm?.unit || unpop?.unit || lvl.unit || "unit";

      return {
        id: String(lvl._id),
        locationType: lvl.locationType,
        locationId: String(lvl.locationId),
        locationName: locInfo.name,
        locationCode: locInfo.code,
        commodityId: comm?._id ? String(comm._id) : String(lvl.commodityId),
        commodityName,
        commoditySku,
        unit,
        onHandStock: onHand,
        reservedStock: reserved,
        availableStock: available,
        damagedStock: damaged,
        averageCost: avgCost,
        stockValue,
        lastUpdated: lvl.lastUpdated ? new Date(lvl.lastUpdated).toISOString() : new Date().toISOString(),
      };
    });

    if (search) {
      results = results.filter(
        (r) =>
          r.commodityName.toLowerCase().includes(search) ||
          r.commoditySku.toLowerCase().includes(search) ||
          r.unit.toLowerCase().includes(search) ||
          r.locationName.toLowerCase().includes(search),
      );
    }

    return NextResponse.json({
      stockLevels: results,
      totalOnHand: results.reduce((acc, r) => acc + r.onHandStock, 0),
      totalReserved: results.reduce((acc, r) => acc + r.reservedStock, 0),
      totalAvailable: results.reduce((acc, r) => acc + r.availableStock, 0),
      totalDamaged: results.reduce((acc, r) => acc + r.damagedStock, 0),
      totalStockValue: Math.round(results.reduce((acc, r) => acc + r.stockValue, 0) * 100) / 100,
    });
  } catch (error) {
    console.error("GET /api/inventory/stock-levels error:", error);
    return NextResponse.json({ error: "Failed to load stock levels." }, { status: 500 });
  }
}
