import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Organization, StockLocation, Warehouse } from "@/models";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to access locations." }, { status: 401 });
    }

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId");
    const typeFilter = url.searchParams.get("type"); // "Warehouse" | "Shop"

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

    // 1. Fetch Warehouses
    let warehousesList: Array<{ id: string; name: string; code: string; type: "Warehouse"; address?: string }> = [];
    if (!typeFilter || typeFilter === "Warehouse") {
      const whDocs = await Warehouse.find({ organizationId: orgObjId, status: "Active" }).sort({ name: 1 }).lean();
      warehousesList = whDocs.map((wh) => ({
        id: String(wh._id),
        name: wh.name,
        code: wh.code,
        type: "Warehouse" as const,
        address: wh.address || "",
      }));
    }

    // 2. Fetch Shops
    let shopsList: Array<{ id: string; name: string; code: string; type: "Shop"; address?: string; isDefault?: boolean }> = [];
    if (!typeFilter || typeFilter === "Shop") {
      let shopDocs = await StockLocation.find({
        organizationId: orgObjId,
        locationType: "Shop",
        status: "Active",
      })
        .sort({ isDefault: -1, name: 1 })
        .lean();

      // If no shop exists for this organization, create a default Shop
      if (shopDocs.length === 0) {
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
        shopDocs = [defaultShop.toObject()];
      }

      shopsList = shopDocs.map((s) => ({
        id: String(s._id),
        name: s.name,
        code: s.code,
        type: "Shop" as const,
        address: s.address || "",
        isDefault: Boolean(s.isDefault),
      }));
    }

    const allLocations = [...warehousesList, ...shopsList];
    return NextResponse.json({
      warehouses: warehousesList,
      shops: shopsList,
      locations: allLocations,
      all: allLocations,
    });
  } catch (error) {
    console.error("GET /api/inventory/locations error:", error);
    return NextResponse.json({ error: "Failed to load stock locations." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to create a location." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, code, locationType = "Shop", address, city, state, organizationId: customOrgId } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Location name is required." }, { status: 400 });
    }

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && customOrgId && isValidObjectId(customOrgId)) {
      organizationId = customOrgId;
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return NextResponse.json({ error: "Organization required." }, { status: 400 });
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    const cleanCode = (code || `${locationType.toUpperCase()}-${Date.now().toString().slice(-4)}`).trim().toUpperCase();

    // Check code uniqueness
    const existing = await StockLocation.findOne({
      organizationId: orgObjId,
      locationType,
      code: cleanCode,
    });
    if (existing) {
      return NextResponse.json({ error: `A ${locationType.toLowerCase()} with code "${cleanCode}" already exists.` }, { status: 409 });
    }

    const newLoc = await StockLocation.create({
      organizationId: orgObjId,
      traderId: orgObjId,
      locationType,
      name: String(name).trim(),
      code: cleanCode,
      address: address ? String(address).trim() : "",
      city: city ? String(city).trim() : "",
      state: state ? String(state).trim() : "",
      status: "Active",
      isDefault: false,
    });

    return NextResponse.json({
      ok: true,
      location: {
        id: String(newLoc._id),
        name: newLoc.name,
        code: newLoc.code,
        type: newLoc.locationType,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/inventory/locations error:", error);
    return NextResponse.json({ error: "Failed to create location." }, { status: 500 });
  }
}
