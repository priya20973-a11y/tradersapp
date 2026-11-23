import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isValidObjectId } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Item, ItemPreference } from "@/models";
import { itemInputSchema } from "../route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
    }

    await connectToDatabase();
    const session = await getServerSession(authOptions).catch(() => null);
    const requestedOrgId = new URL(request.url).searchParams.get("organizationId");
    const orgId = session?.user?.id === "admin" && requestedOrgId ? requestedOrgId : session?.user?.organizationId;

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const item = await Item.findOne({ _id: id, organizationId: orgId }).lean();
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const itemDoc = item as {
      _id: unknown;
      name?: string;
      sku?: string;
      type?: "goods" | "service";
      unit?: string;
      hsnCode?: string;
      commodityCategory?: string;
      salesPrice?: number;
      gstRate?: number;
      purchasePrice?: number;
      salesAccount?: string;
      purchaseAccount?: string;
      salesDescription?: string;
      purchaseDescription?: string;
      preferredVendor?: string;
      openingStock?: number;
      inventoryTracking?: boolean;
      active?: boolean;
    };
    return NextResponse.json({
      item: {
        id: String(itemDoc._id),
        name: itemDoc.name,
        sku: itemDoc.sku,
        type: itemDoc.type ?? "goods",
        unit: itemDoc.unit ?? "pcs",
        hsnCode: itemDoc.hsnCode ?? "",
        commodityCategory: itemDoc.commodityCategory ?? "",
        category: itemDoc.commodityCategory ?? "",
        salesPrice: itemDoc.salesPrice ?? 0,
        gstRate: itemDoc.gstRate ?? 18,
        purchasePrice: itemDoc.purchasePrice ?? 0,
        salesAccount: itemDoc.salesAccount ?? "Sales",
        purchaseAccount: itemDoc.purchaseAccount ?? "Cost of Goods Sold",
        salesDescription: itemDoc.salesDescription ?? "",
        purchaseDescription: itemDoc.purchaseDescription ?? "",
        preferredVendor: itemDoc.preferredVendor ?? "",
        openingStock: Number(itemDoc.openingStock) || 0,
        stock: Number(itemDoc.openingStock) || 0,
        inventoryTracking: itemDoc.inventoryTracking ?? true,
        active: itemDoc.active ?? true,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/items/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch item" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const parseResult = itemInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parseResult.data;
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase();

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId");
    const orgId = session?.user?.id === "admin" && requestedOrgId ? requestedOrgId : session?.user?.organizationId;

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized: organization context required" }, { status: 401 });
    }

    const item = await Item.findOne({ _id: id, organizationId: orgId });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const itemDoc = item as {
      _id: unknown;
      name?: string;
      sku?: string;
      type?: "goods" | "service";
      unit?: string;
      commodityCategory?: string;
      salesPrice?: number;
      purchasePrice?: number;
      salesAccount?: string;
      purchaseAccount?: string;
      salesDescription?: string;
      purchaseDescription?: string;
      preferredVendor?: string;
      openingStock?: number;
      active?: boolean;
      save: () => Promise<unknown>;
    };
    const targetSku = (data.sku?.trim() || String(itemDoc.sku || "")).trim();
    if (targetSku) {
      const existingSku = await Item.findOne({
        _id: { $ne: id },
        organizationId: orgId,
        sku: { $regex: new RegExp(`^${targetSku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      }).lean();
      if (existingSku) {
        return NextResponse.json({ error: "An item with this SKU already exists" }, { status: 409 });
      }
    }

    const pref = await ItemPreference.findOne({ organizationId: orgId }).lean().catch(() => null);
    const inventoryEnabled = Boolean(pref?.inventoryEnabled);

    Object.assign(itemDoc, {
      name: data.name,
      sku: targetSku,
      hsnCode: data.hsnCode || undefined,
      commodityCategory: data.commodityCategory || data.category || undefined,
      type: data.type,
      unit: data.unit,
      salesPrice: data.salesPrice,
      purchasePrice: data.purchasePrice,
      salesAccount: data.salesAccount,
      salesDescription: data.salesDescription,
      purchaseAccount: data.purchaseAccount,
      purchaseDescription: data.purchaseDescription,
      preferredVendor: data.preferredVendor,
      trackSales: data.trackSales,
      trackPurchase: data.trackPurchase,
      inventoryTracking: inventoryEnabled,
      openingStock: inventoryEnabled ? data.openingStock : itemDoc.openingStock,
    });

    await itemDoc.save();

    return NextResponse.json({
      message: "Item updated successfully",
      item: {
        id: String(itemDoc._id),
        name: itemDoc.name,
        sku: itemDoc.sku,
        type: itemDoc.type,
        unit: itemDoc.unit,
        commodityCategory: itemDoc.commodityCategory ?? "",
        salesPrice: itemDoc.salesPrice,
        purchasePrice: itemDoc.purchasePrice,
        salesAccount: itemDoc.salesAccount,
        purchaseAccount: itemDoc.purchaseAccount,
        salesDescription: itemDoc.salesDescription,
        purchaseDescription: itemDoc.purchaseDescription,
        preferredVendor: itemDoc.preferredVendor,
        stock: itemDoc.openingStock,
        active: itemDoc.active,
      },
    });
  } catch (err: unknown) {
    console.error("PUT /api/items/[id] error:", err);
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json({ error: "An item with this SKU already exists" }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return PUT(request, context);
}
