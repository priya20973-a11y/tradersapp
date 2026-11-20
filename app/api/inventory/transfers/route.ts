import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Item, Organization, StockLocation, StockTransfer, Warehouse } from "@/models";
import { executeStockTransfer } from "@/lib/inventory-service";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to view transfers." }, { status: 401 });
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

    const transfers = await StockTransfer.find({ organizationId: orgObjId })
      .populate({ path: "commodityId", select: "name sku unit" })
      .sort({ transferDate: -1, createdAt: -1 })
      .lean();

    // Map location names
    const [warehouses, shops] = await Promise.all([
      Warehouse.find({ organizationId: orgObjId }).select("_id name code").lean(),
      StockLocation.find({ organizationId: orgObjId }).select("_id name code locationType").lean(),
    ]);

    const locMap: Record<string, string> = {};
    for (const w of warehouses) locMap[String(w._id)] = `${w.name} (${w.code})`;
    for (const s of shops) locMap[String(s._id)] = `${s.name} (${s.code})`;

    let formatted = transfers.map((t) => {
      const comm = t.commodityId as unknown as { _id?: unknown; name?: string; sku?: string; unit?: string } | null;
      return {
        id: String(t._id),
        transferNumber: t.transferNumber,
        transferDate: t.transferDate ? new Date(t.transferDate).toISOString() : new Date().toISOString(),
        fromLocationType: t.fromLocationType,
        fromLocationId: String(t.fromLocationId),
        fromLocationName: locMap[String(t.fromLocationId)] || `${t.fromLocationType} #${String(t.fromLocationId).slice(-4)}`,
        toLocationType: t.toLocationType,
        toLocationId: String(t.toLocationId),
        toLocationName: locMap[String(t.toLocationId)] || `${t.toLocationType} #${String(t.toLocationId).slice(-4)}`,
        commodityId: comm?._id ? String(comm._id) : String(t.commodityId),
        commodityName: comm?.name || "Commodity",
        commoditySku: comm?.sku || "",
        unit: t.unit || comm?.unit || "unit",
        availableQuantityAtTransfer: t.availableQuantityAtTransfer || 0,
        transferQuantity: t.transferQuantity,
        remarks: t.remarks || "",
        status: t.status,
      };
    });

    if (search) {
      formatted = formatted.filter(
        (t) =>
          t.transferNumber.toLowerCase().includes(search) ||
          t.commodityName.toLowerCase().includes(search) ||
          t.fromLocationName.toLowerCase().includes(search) ||
          t.toLocationName.toLowerCase().includes(search),
      );
    }

    return NextResponse.json({ transfers: formatted });
  } catch (error) {
    console.error("GET /api/inventory/transfers error:", error);
    return NextResponse.json({ error: "Failed to load stock transfers." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to transfer stock." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      fromLocationType,
      fromLocationId,
      toLocationType,
      toLocationId,
      commodityId,
      quantity,
      unit = "unit",
      remarks = "",
      organizationId: customOrgId,
    } = body;

    if (!fromLocationType || !fromLocationId || !toLocationType || !toLocationId) {
      return NextResponse.json({ error: "Source and destination locations are required." }, { status: 400 });
    }

    if (!commodityId || !isValidObjectId(commodityId)) {
      return NextResponse.json({ error: "Please select a valid commodity." }, { status: 400 });
    }

    const transferQty = Number(quantity);
    if (!transferQty || transferQty <= 0) {
      return NextResponse.json({ error: "Transfer quantity must be greater than zero." }, { status: 400 });
    }

    if (fromLocationType === toLocationType && String(fromLocationId) === String(toLocationId)) {
      return NextResponse.json({ error: "Source and destination locations cannot be identical." }, { status: 400 });
    }

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && customOrgId && isValidObjectId(customOrgId)) {
      organizationId = customOrgId;
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return NextResponse.json({ error: "Organization required." }, { status: 400 });
    }

    await connectToDatabase();

    const result = await executeStockTransfer({
      organizationId,
      fromLocationType,
      fromLocationId,
      toLocationType,
      toLocationId,
      commodityId,
      quantity: transferQty,
      unit,
      remarks: String(remarks || "").trim(),
      actorId: String(session.user.id),
    });

    return NextResponse.json({ ok: true, result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/inventory/transfers error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute stock transfer." },
      { status: 400 },
    );
  }
}
