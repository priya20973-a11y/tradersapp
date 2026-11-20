import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Item, Organization, StockLocation, StockMovement, StockReservation, Warehouse } from "@/models";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to view stock ledger." }, { status: 401 });
    }

    const url = new URL(request.url);
    const locationType = url.searchParams.get("locationType"); // "Warehouse" | "Shop"
    const locationId = url.searchParams.get("locationId");
    const commodityId = url.searchParams.get("commodityId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const search = url.searchParams.get("search")?.toLowerCase().trim() || "";
    const requestedOrgId = url.searchParams.get("organizationId");
    const includeReservations = url.searchParams.get("includeReservations") === "true";

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

    const query: Record<string, unknown> = { organizationId: orgObjId };
    if (locationType === "Warehouse" || locationType === "Shop") {
      query.locationType = locationType;
    }
    if (locationId && isValidObjectId(locationId)) {
      query.locationId = new Types.ObjectId(locationId);
    }
    if (commodityId && isValidObjectId(commodityId)) {
      query.commodityId = new Types.ObjectId(commodityId);
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      query.occurredAt = dateFilter;
    }

    const movements = await StockMovement.find(query)
      .populate({ path: "commodityId", select: "name sku unit" })
      .sort({ occurredAt: -1, createdAt: -1 })
      .limit(500)
      .lean();

    const [warehouses, shops] = await Promise.all([
      Warehouse.find({ organizationId: orgObjId }).select("_id name code").lean(),
      StockLocation.find({ organizationId: orgObjId }).select("_id name code locationType").lean(),
    ]);

    const locMap: Record<string, string> = {};
    for (const w of warehouses) locMap[String(w._id)] = `${w.name} (${w.code})`;
    for (const s of shops) locMap[String(s._id)] = `${s.name} (${s.code})`;

    let formattedMovements = movements.map((m) => {
      const comm = m.commodityId as unknown as { _id?: unknown; name?: string; sku?: string; unit?: string } | null;
      return {
        id: String(m._id),
        movementId: m.movementId,
        movementType: m.movementType,
        occurredAt: m.occurredAt ? new Date(m.occurredAt).toISOString() : new Date().toISOString(),
        locationType: m.locationType,
        locationId: String(m.locationId),
        locationName: locMap[String(m.locationId)] || `${m.locationType} #${String(m.locationId).slice(-4)}`,
        commodityId: comm?._id ? String(comm._id) : String(m.commodityId),
        commodityName: comm?.name || "Commodity",
        commoditySku: comm?.sku || "",
        quantity: m.quantity,
        unit: m.unit || comm?.unit || "unit",
        onHandDelta: m.onHandDelta ?? 0,
        reservedDelta: m.reservedDelta ?? 0,
        damagedDelta: m.damagedDelta ?? 0,
        resultingOnHand: m.resultingOnHand ?? 0,
        resultingReserved: m.resultingReserved ?? 0,
        resultingAvailable: m.resultingAvailable ?? 0,
        resultingDamaged: m.resultingDamaged ?? 0,
        referenceDocument: m.referenceDocument || m.referenceDocumentNumber || "",
        referenceDocumentType: m.referenceDocumentType || "",
        referenceDocumentNumber: m.referenceDocumentNumber || "",
        remarks: m.remarks || "",
        actorId: m.actorId,
      };
    });

    if (search) {
      formattedMovements = formattedMovements.filter(
        (m) =>
          m.commodityName.toLowerCase().includes(search) ||
          m.commoditySku.toLowerCase().includes(search) ||
          m.movementType.toLowerCase().includes(search) ||
          m.referenceDocument.toLowerCase().includes(search) ||
          m.remarks.toLowerCase().includes(search),
      );
    }

    // Optionally include active reservation details
    let activeReservations: unknown[] = [];
    if (includeReservations) {
      const resQuery: Record<string, unknown> = {
        organizationId: orgObjId,
        status: { $in: ["Active", "Partially Invoiced"] },
      };
      if (locationType) resQuery.locationType = locationType;
      if (locationId && isValidObjectId(locationId)) resQuery.locationId = new Types.ObjectId(locationId);
      if (commodityId && isValidObjectId(commodityId)) resQuery.commodityId = new Types.ObjectId(commodityId);

      const resDocs = await StockReservation.find(resQuery)
        .populate({ path: "commodityId", select: "name sku unit" })
        .populate({ path: "salesOrderId", select: "number total customerSnapshot status issueDate" })
        .sort({ createdAt: -1 })
        .lean();

      activeReservations = resDocs.map((r) => {
        const comm = r.commodityId as unknown as { name?: string; sku?: string; unit?: string } | null;
        const so = r.salesOrderId as unknown as { number?: string; customerSnapshot?: { name?: string }; status?: string; issueDate?: Date } | null;
        const remaining = Math.max(0, r.reservedQuantity - r.invoicedQuantity);
        return {
          id: String(r._id),
          salesOrderId: String(r.salesOrderId?._id || r.salesOrderId),
          salesOrderNumber: so?.number || r.salesOrderNumber,
          customerName: so?.customerSnapshot?.name || "Customer",
          orderStatus: so?.status || "Confirmed",
          orderDate: so?.issueDate ? new Date(so?.issueDate).toISOString() : "",
          commodityName: comm?.name || "Commodity",
          commoditySku: comm?.sku || "",
          totalReserved: r.reservedQuantity,
          invoicedQuantity: r.invoicedQuantity,
          remainingReserved: remaining,
          unit: r.unit,
          locationName: locMap[String(r.locationId)] || `${r.locationType} #${String(r.locationId).slice(-4)}`,
          status: r.status,
        };
      });
    }

    return NextResponse.json({
      movements: formattedMovements,
      reservations: activeReservations,
    });
  } catch (error) {
    console.error("GET /api/inventory/ledger error:", error);
    return NextResponse.json({ error: "Failed to load stock ledger." }, { status: 500 });
  }
}
