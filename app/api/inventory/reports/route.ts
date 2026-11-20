import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  Item,
  Organization,
  StockLevel,
  StockLocation,
  StockLot,
  StockMovement,
  StockReservation,
  User,
  Warehouse,
} from "@/models";

interface AggregatedStockEntry {
  onHand: number;
  reserved: number;
  available: number;
  damaged: number;
  stockValue: number;
  averageCost: number;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to view inventory reports." }, { status: 401 });
    }

    await connectToDatabase();

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId");
    const search = url.searchParams.get("search")?.toLowerCase().trim() || "";

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin") {
      if (requestedOrgId && isValidObjectId(requestedOrgId)) {
        organizationId = requestedOrgId;
      } else {
        const defaultOrg =
          (await Organization.findOne({ status: "active" }).select("_id").lean().catch(() => null)) ||
          (await Organization.findOne().select("_id").lean().catch(() => null));
        if (defaultOrg) organizationId = String(defaultOrg._id);
      }
    } else {
      // Tenant boundary check for non-admin
      if (requestedOrgId && organizationId && requestedOrgId !== String(organizationId)) {
        return NextResponse.json({ error: "You can only access your own organization." }, { status: 403 });
      }

      if (!organizationId || !isValidObjectId(organizationId)) {
        const userDoc = await User.findById(session.user.id).select("organizationId").lean().catch(() => null);
        if (userDoc?.organizationId) {
          organizationId = String(userDoc.organizationId);
        } else {
          const fallbackOrg = await Organization.findOne({ status: "active" }).select("_id").lean().catch(() => null);
          if (fallbackOrg) organizationId = String(fallbackOrg._id);
        }
      }
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return NextResponse.json({ error: "Organization required." }, { status: 400 });
    }

    const orgObjId = new Types.ObjectId(organizationId);
    const orgFilter = {
      $or: [
        { organizationId: orgObjId },
        { organizationId: String(orgObjId) },
        { traderId: orgObjId },
        { traderId: String(orgObjId) },
      ],
    };

    // 1. Fetch all active warehouses, shops, commodities, stock levels, lots, movements, and reservations
    const [whCollectionDocs, stockLocWarehouses, shopCollectionDocs, itemDocs, allStockLevels, allStockLots, allMovements, allReservations] =
      await Promise.all([
        (Warehouse.find({
          ...orgFilter,
          status: { $ne: "Inactive" },
        })
          .sort({ name: 1 })
          .lean() as unknown as Promise<Array<{ _id: Types.ObjectId | string; name: string; code?: string }>>),

        (StockLocation.find({
          ...orgFilter,
          locationType: "Warehouse",
          status: { $ne: "Inactive" },
        })
          .sort({ name: 1 })
          .lean() as unknown as Promise<Array<{ _id: Types.ObjectId | string; name: string; code?: string }>>),

        // 2. Fetch all active shops
        (StockLocation.find({
          ...orgFilter,
          locationType: "Shop",
          status: { $ne: "Inactive" },
        })
          .sort({ isDefault: -1, name: 1 })
          .lean() as unknown as Promise<Array<{ _id: Types.ObjectId | string; name: string; code?: string }>>),

        // 3. Fetch all commodities/items
        Item.find({
          ...orgFilter,
          active: { $ne: false },
        })
          .select("_id name sku unit purchasePrice salesPrice openingStock inventoryTracking")
          .sort({ name: 1 })
          .lean(),

        // 4. Fetch stock levels
        StockLevel.find(orgFilter).lean(),

        // 5. Fetch stock lots (from trading module)
        StockLot.find(orgFilter).lean(),

        // 6. Fetch stock movements (for verification and fallback calculation)
        StockMovement.find(orgFilter).lean(),

        // 7. Fetch active sales order reservations
        StockReservation.find({
          ...orgFilter,
          status: "Active",
        }).lean(),
      ]);

    // Build deduplicated Warehouses list
    const warehouseMap = new Map<string, { id: string; name: string; code?: string; type: "Warehouse" }>();
    for (const w of whCollectionDocs) {
      const id = String(w._id);
      warehouseMap.set(id, { id, name: String(w.name || "Warehouse"), code: w.code, type: "Warehouse" });
    }
    for (const w of stockLocWarehouses) {
      const id = String(w._id);
      if (!warehouseMap.has(id)) {
        warehouseMap.set(id, { id, name: String(w.name || "Warehouse"), code: w.code, type: "Warehouse" });
      }
    }
    for (const lot of allStockLots) {
      if (!lot.warehouseId) continue;
      const id = String(lot.warehouseId);
      if (!warehouseMap.has(id)) {
        const wh = (await Warehouse.findById(lot.warehouseId).select("name code").lean().catch(() => null)) as { name?: string; code?: string } | null;
        warehouseMap.set(id, {
          id,
          name: wh?.name || `Warehouse #${id.slice(-4)}`,
          code: wh?.code || id.slice(-4),
          type: "Warehouse",
        });
      }
    }

    // Build deduplicated Shops list
    let shopDocs: Array<{ _id: Types.ObjectId | string; name: string; code?: string }> = [
      ...shopCollectionDocs,
    ];
    if (shopDocs.length === 0) {
      // Auto-create default shop if none exists
      try {
        const defaultShop = await StockLocation.create({
          organizationId: orgObjId,
          traderId: orgObjId,
          locationType: "Shop",
          name: "Main Shop",
          code: "SHOP-MAIN",
          address: "APMC Market Yard",
          status: "Active",
          isDefault: true,
        });
        shopDocs = [defaultShop.toObject() as { _id: Types.ObjectId | string; name: string; code?: string }];
      } catch {
        // Ignored if created concurrently
      }
    }

    const shopMap = new Map<string, { id: string; name: string; code?: string; type: "Shop" }>();
    for (const s of shopDocs) {
      const id = String(s._id);
      shopMap.set(id, { id, name: String(s.name || "Shop"), code: s.code, type: "Shop" });
    }

    // Ensure any location referenced in StockLevel is represented in warehouseMap or shopMap
    for (const lvl of allStockLevels) {
      const locIdStr = String(lvl.locationId);
      if (lvl.locationType === "Warehouse" && !warehouseMap.has(locIdStr)) {
        const wh =
          (await Warehouse.findById(lvl.locationId).select("name code").lean().catch(() => null)) ||
          (await StockLocation.findById(lvl.locationId).select("name code").lean().catch(() => null));
        warehouseMap.set(locIdStr, {
          id: locIdStr,
          name: wh ? String((wh as { name?: string }).name) : `Warehouse #${locIdStr.slice(-4)}`,
          code: wh ? String((wh as { code?: string }).code || "") : locIdStr.slice(-4),
          type: "Warehouse",
        });
      } else if (lvl.locationType === "Shop" && !shopMap.has(locIdStr)) {
        const sh = await StockLocation.findById(lvl.locationId).select("name code").lean().catch(() => null);
        shopMap.set(locIdStr, {
          id: locIdStr,
          name: sh ? String((sh as { name?: string }).name) : `Shop #${locIdStr.slice(-4)}`,
          code: sh ? String((sh as { code?: string }).code || "") : locIdStr.slice(-4),
          type: "Shop",
        });
      }
    }

    // Also check StockMovements for any location referenced
    for (const mov of allMovements) {
      if (!mov.locationId) continue;
      const locIdStr = String(mov.locationId);
      const locType = mov.locationType === "Shop" ? "Shop" : "Warehouse";
      if (locType === "Warehouse" && !warehouseMap.has(locIdStr)) {
        const wh =
          (await Warehouse.findById(mov.locationId).select("name code").lean().catch(() => null)) ||
          (await StockLocation.findById(mov.locationId).select("name code").lean().catch(() => null));
        warehouseMap.set(locIdStr, {
          id: locIdStr,
          name: wh ? String((wh as { name?: string }).name) : `Warehouse #${locIdStr.slice(-4)}`,
          code: wh ? String((wh as { code?: string }).code || "") : locIdStr.slice(-4),
          type: "Warehouse",
        });
      } else if (locType === "Shop" && !shopMap.has(locIdStr)) {
        const sh = await StockLocation.findById(mov.locationId).select("name code").lean().catch(() => null);
        shopMap.set(locIdStr, {
          id: locIdStr,
          name: sh ? String((sh as { name?: string }).name) : `Shop #${locIdStr.slice(-4)}`,
          code: sh ? String((sh as { code?: string }).code || "") : locIdStr.slice(-4),
          type: "Shop",
        });
      }
    }

    // Build Location Headers for Response
    const warehouseHeaders = Array.from(warehouseMap.values()).map((w) => ({
      id: w.id,
      name: w.name,
      code: w.code,
      type: "Warehouse" as const,
    }));

    const shopHeaders = Array.from(shopMap.values()).map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      type: "Shop" as const,
    }));

    // Build Location + Commodity Stock Map
    const stockMap = new Map<string, AggregatedStockEntry>();
    const stockLevelKeys = new Set<string>();

    // 1. Ingest StockLevel records (primary source of truth)
    for (const lvl of allStockLevels) {
      const locIdStr = String(lvl.locationId);
      const commIdStr = String(lvl.commodityId);
      const key = `${locIdStr}_${commIdStr}`;
      stockLevelKeys.add(key);

      const existing = stockMap.get(key) || {
        onHand: 0,
        reserved: 0,
        available: 0,
        damaged: 0,
        stockValue: 0,
        averageCost: 0,
      };

      const onHand = Number(lvl.onHandQuantity || 0);
      const reserved = Number(lvl.reservedQuantity || 0);
      const damaged = Number(lvl.damagedQuantity || 0);
      const val = Number(lvl.stockValue || 0);
      const avg = Number(lvl.averageCost || 0);

      existing.onHand += onHand;
      existing.reserved += reserved;
      existing.damaged += damaged;
      existing.stockValue += val;
      if (avg > 0) existing.averageCost = avg;

      stockMap.set(key, existing);
    }

    // 2. Ingest StockLot records for any lot not represented in StockLevel
    for (const lot of allStockLots) {
      if (!lot.warehouseId || !lot.commodityItemId) continue;
      const locIdStr = String(lot.warehouseId);
      const commIdStr = String(lot.commodityItemId);
      const key = `${locIdStr}_${commIdStr}`;

      if (stockLevelKeys.has(key)) {
        continue;
      }

      const existing = stockMap.get(key) || {
        onHand: 0,
        reserved: 0,
        available: 0,
        damaged: 0,
        stockValue: 0,
        averageCost: 0,
      };

      const onHand = Number(lot.physicalQuantity || 0);
      const reserved = Number(lot.reservedQuantity || 0);
      const damaged = Number(lot.damagedQuantity || 0);
      const cost = Number(lot.purchaseCost || lot.allocatedLandedCost || 0);
      const val = Math.round(onHand * cost * 100) / 100;

      existing.onHand += onHand;
      existing.reserved += reserved;
      existing.damaged += damaged;
      existing.stockValue += val;
      if (cost > 0) existing.averageCost = cost;

      stockMap.set(key, existing);
    }

    // 3. Fallback: Ingest StockMovements for any location+commodity not in StockLevel or StockLot
    const movementMap = new Map<string, AggregatedStockEntry>();
    for (const mov of allMovements) {
      if (!mov.locationId || !mov.commodityId) continue;
      const locIdStr = String(mov.locationId);
      const commIdStr = String(mov.commodityId);
      const key = `${locIdStr}_${commIdStr}`;

      if (stockLevelKeys.has(key)) continue;

      const entry = movementMap.get(key) || {
        onHand: 0,
        reserved: 0,
        available: 0,
        damaged: 0,
        stockValue: 0,
        averageCost: 0,
      };

      entry.onHand += Number(mov.onHandDelta || 0);
      entry.reserved += Number(mov.reservedDelta || 0);
      entry.damaged += Number(mov.damagedDelta || 0);
      movementMap.set(key, entry);
    }

    for (const [key, entry] of movementMap.entries()) {
      if (!stockMap.has(key)) {
        stockMap.set(key, entry);
      }
    }

    // 4. Reconcile Reservations from active StockReservation documents
    const activeReservationsMap = new Map<string, number>();
    for (const res of allReservations) {
      if (!res.locationId || !res.commodityId) continue;
      if (res.status && res.status !== "Active") continue;
      const locIdStr = String(res.locationId);
      const commIdStr = String(res.commodityId);
      const key = `${locIdStr}_${commIdStr}`;

      const unfulfilled = Math.max(
        0,
        Number(res.reservedQuantity || 0) - Number(res.invoicedQuantity || 0) - Number(res.releasedQuantity || 0),
      );
      activeReservationsMap.set(key, (activeReservationsMap.get(key) || 0) + unfulfilled);
    }

    for (const [key, totalUnfulfilled] of activeReservationsMap.entries()) {
      const entry = stockMap.get(key);
      if (entry && entry.reserved < totalUnfulfilled) {
        entry.reserved = totalUnfulfilled;
      }
    }

    // Normalize available stock
    for (const [, entry] of stockMap) {
      entry.onHand = Math.max(0, Math.round(entry.onHand * 10000) / 10000);
      entry.reserved = Math.max(0, Math.round(entry.reserved * 10000) / 10000);
      entry.available = Math.max(0, Math.round((entry.onHand - entry.reserved) * 10000) / 10000);
      entry.damaged = Math.max(0, Math.round(entry.damaged * 10000) / 10000);
    }

    // Collect all Commodities from itemDocs + stockMap
    const itemMap = new Map<
      string,
      { id: string; name: string; sku?: string; unit?: string; purchasePrice: number; salesPrice: number; openingStock: number }
    >();

    for (const it of itemDocs) {
      itemMap.set(String(it._id), {
        id: String(it._id),
        name: String(it.name || "Commodity"),
        sku: String(it.sku || ""),
        unit: String(it.unit || "unit"),
        purchasePrice: Number(it.purchasePrice || 0),
        salesPrice: Number(it.salesPrice || 0),
        openingStock: Number(it.openingStock || 0),
      });
    }

    // If any commodity ID in stockMap is not in itemDocs, resolve it
    for (const key of stockMap.keys()) {
      const commIdStr = key.split("_")[1];
      if (commIdStr && !itemMap.has(commIdStr)) {
        const extraItem = await Item.findById(commIdStr).select("name sku unit purchasePrice salesPrice").lean().catch(() => null);
        if (extraItem) {
          itemMap.set(commIdStr, {
            id: commIdStr,
            name: String((extraItem as { name?: string }).name || `Commodity #${commIdStr.slice(-4)}`),
            sku: String((extraItem as { sku?: string }).sku || ""),
            unit: String((extraItem as { unit?: string }).unit || "unit"),
            purchasePrice: Number((extraItem as { purchasePrice?: number }).purchasePrice || 0),
            salesPrice: Number((extraItem as { salesPrice?: number }).salesPrice || 0),
            openingStock: 0,
          });
        }
      }
    }

    // Build Consolidated Rows
    let rows = Array.from(itemMap.values()).map((it) => {
      let totalOnHand = 0;
      let totalReserved = 0;
      let totalDamaged = 0;
      let totalStockValue = 0;

      // Warehouse-wise stock
      const warehouseStocks: Record<string, {
        onHandStock: number;
        reservedStock: number;
        availableStock: number;
        damagedStock: number;
        onHand: number;
        reserved: number;
        available: number;
        damaged: number;
        value: number;
        stockValue: number;
      }> = {};

      for (const w of warehouseHeaders) {
        const key = `${w.id}_${it.id}`;
        const st = stockMap.get(key);
        const onHand = st ? st.onHand : 0;
        const reserved = st ? st.reserved : 0;
        const available = st ? st.available : 0;
        const damaged = st ? st.damaged : 0;
        const costRate = st && st.averageCost > 0 ? st.averageCost : it.purchasePrice || it.salesPrice || 0;
        const value = st && st.stockValue > 0 ? st.stockValue : Math.round(onHand * costRate * 100) / 100;

        const locEntry = {
          onHandStock: onHand,
          reservedStock: reserved,
          availableStock: available,
          damagedStock: damaged,
          onHand,
          reserved,
          available,
          damaged,
          value,
          stockValue: value,
        };

        warehouseStocks[w.id] = locEntry;
        totalOnHand += onHand;
        totalReserved += reserved;
        totalDamaged += damaged;
        totalStockValue += value;
      }

      // Shop-wise stock
      const shopStocks: Record<string, {
        onHandStock: number;
        reservedStock: number;
        availableStock: number;
        damagedStock: number;
        onHand: number;
        reserved: number;
        available: number;
        damaged: number;
        value: number;
        stockValue: number;
      }> = {};

      for (const s of shopHeaders) {
        const key = `${s.id}_${it.id}`;
        const st = stockMap.get(key);
        const onHand = st ? st.onHand : 0;
        const reserved = st ? st.reserved : 0;
        const available = st ? st.available : 0;
        const damaged = st ? st.damaged : 0;
        const costRate = st && st.averageCost > 0 ? st.averageCost : it.purchasePrice || it.salesPrice || 0;
        const value = st && st.stockValue > 0 ? st.stockValue : Math.round(onHand * costRate * 100) / 100;

        const locEntry = {
          onHandStock: onHand,
          reservedStock: reserved,
          availableStock: available,
          damagedStock: damaged,
          onHand,
          reserved,
          available,
          damaged,
          value,
          stockValue: value,
        };

        shopStocks[s.id] = locEntry;
        totalOnHand += onHand;
        totalReserved += reserved;
        totalDamaged += damaged;
        totalStockValue += value;
      }

      const totalAvailable = Math.max(0, Math.round((totalOnHand - totalReserved) * 10000) / 10000);

      return {
        commodityId: it.id,
        commodityName: it.name,
        sku: it.sku || "",
        commoditySku: it.sku || "",
        unit: it.unit || "unit",
        purchasePrice: it.purchasePrice,
        warehouses: warehouseStocks,
        warehouseStocks,
        shops: shopStocks,
        shopStocks,
        totalOnHand: Math.round(totalOnHand * 10000) / 10000,
        totalReserved: Math.round(totalReserved * 10000) / 10000,
        totalAvailable: Math.round(totalAvailable * 10000) / 10000,
        totalDamaged: Math.round(totalDamaged * 10000) / 10000,
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        totalValue: Math.round(totalStockValue * 100) / 100,
      };
    });

    // Apply optional search filter
    if (search) {
      rows = rows.filter(
        (r) =>
          r.commodityName.toLowerCase().includes(search) ||
          r.sku.toLowerCase().includes(search),
      );
    }

    const summary = {
      totalCommodities: rows.length,
      totalOnHand: Math.round(rows.reduce((a, r) => a + r.totalOnHand, 0) * 10000) / 10000,
      totalReserved: Math.round(rows.reduce((a, r) => a + r.totalReserved, 0) * 10000) / 10000,
      totalAvailable: Math.round(rows.reduce((a, r) => a + r.totalAvailable, 0) * 10000) / 10000,
      totalDamaged: Math.round(rows.reduce((a, r) => a + r.totalDamaged, 0) * 10000) / 10000,
      totalStockValue: Math.round(rows.reduce((a, r) => a + r.totalStockValue, 0) * 100) / 100,
    };

    return NextResponse.json({
      rows,
      reportRows: rows,
      warehouses: warehouseHeaders,
      shops: shopHeaders,
      summary,
    });
  } catch (error) {
    console.error("GET /api/inventory/reports error:", error);
    return NextResponse.json({ error: "Failed to generate inventory report." }, { status: 500 });
  }
}
