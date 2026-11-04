import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Item, ItemPreference, Organization, PurchaseBill, SalesDocument } from "@/models";
import { items as fallbackDemoItems } from "@/lib/demo-data";

const itemInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(["goods", "service"]).default("goods"),
  unit: z.string().trim().default("pcs"),
  sku: z.string().trim().optional(),
  hsnCode: z.string().trim().optional(),
  trackSales: z.boolean().default(true),
  salesPrice: z.coerce.number().min(0).default(0),
  salesAccount: z.string().trim().default("Sales"),
  salesDescription: z.string().trim().default(""),
  trackPurchase: z.boolean().default(true),
  purchasePrice: z.coerce.number().min(0).default(0),
  purchaseAccount: z.string().trim().default("Cost of Goods Sold"),
  purchaseDescription: z.string().trim().default(""),
  preferredVendor: z.string().trim().default(""),
  openingStock: z.coerce.number().min(0).default(0),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean();
      if (defaultOrg) {
        orgId = String(defaultOrg._id);
      }
    }

    const pref = orgId
      ? await ItemPreference.findOne({ organizationId: orgId }).lean().catch(() => null)
      : null;
    const inventoryEnabled = Boolean(pref?.inventoryEnabled);

    const query = orgId ? { organizationId: orgId, active: true } : { active: true };
    const dbItems = await Item.find(query).sort({ createdAt: -1 }).lean().catch(() => []);

    if (!dbItems || dbItems.length === 0) {
      return NextResponse.json({
        inventoryEnabled,
        items: fallbackDemoItems.map((item, idx) => ({
          id: `demo-${idx + 1}`,
          name: item.name,
          sku: item.sku,
          type: item.unit.toLowerCase().includes("service") ? "service" : "goods",
          unit: item.unit,
          salesPrice: item.rate,
          purchasePrice: Math.round(item.rate * 0.7),
          salesAccount: "Sales",
          purchaseAccount: "Cost of Goods Sold",
          salesDescription: `${item.name} for standard billing`,
          purchaseDescription: `${item.name} procurement`,
          preferredVendor: "Mohan Traders",
          stock: inventoryEnabled ? item.stock : 0,
          inventoryTracking: inventoryEnabled,
          active: true,
        })),
      });
    }

    // When inventory is enabled, calculate stock from opening stock + purchases - sales transactions
    const purchasesMap = new Map<string, number>();
    const salesMap = new Map<string, number>();

    if (inventoryEnabled) {
      try {
        const [purchaseBills, salesInvoices] = await Promise.all([
          PurchaseBill.find({
            ...(orgId ? { organizationId: orgId } : {}),
            status: { $ne: "Void" },
          })
            .select("items")
            .lean()
            .catch(() => []),
          SalesDocument.find({
            ...(orgId ? { organizationId: orgId } : {}),
            type: "Invoice",
            status: { $nin: ["Draft", "Cancelled", "Void"] },
          })
            .select("items")
            .lean()
            .catch(() => []),
        ]);

        for (const bill of purchaseBills) {
          for (const it of (bill as { items?: { itemId?: unknown; name?: string; quantity?: number }[] }).items || []) {
            const qty = Number(it.quantity) || 0;
            if (it.itemId) purchasesMap.set(String(it.itemId), (purchasesMap.get(String(it.itemId)) || 0) + qty);
            if (it.name) purchasesMap.set(it.name.toLowerCase().trim(), (purchasesMap.get(it.name.toLowerCase().trim()) || 0) + qty);
          }
        }

        for (const doc of salesInvoices) {
          for (const it of (doc as { items?: { itemId?: unknown; name?: string; quantity?: number }[] }).items || []) {
            const qty = Number(it.quantity) || 0;
            if (it.itemId) salesMap.set(String(it.itemId), (salesMap.get(String(it.itemId)) || 0) + qty);
            if (it.name) salesMap.set(it.name.toLowerCase().trim(), (salesMap.get(it.name.toLowerCase().trim()) || 0) + qty);
          }
        }
      } catch (calcErr) {
        console.error("Error calculating inventory stock levels:", calcErr);
      }
    }

    return NextResponse.json({
      inventoryEnabled,
      items: (dbItems as Array<{
        _id: unknown;
        name?: string;
        sku?: string;
        type?: string;
        unit?: string;
        salesPrice?: number;
        purchasePrice?: number;
        salesAccount?: string;
        purchaseAccount?: string;
        salesDescription?: string;
        purchaseDescription?: string;
        preferredVendor?: string;
        openingStock?: number;
        active?: boolean;
      }>).map((item) => {
        let stock = 0;
        if (inventoryEnabled) {
          const itemIdStr = String(item._id);
          const itemNameKey = String(item.name || "").toLowerCase().trim();
          const purchased = purchasesMap.get(itemIdStr) ?? purchasesMap.get(itemNameKey) ?? 0;
          const sold = salesMap.get(itemIdStr) ?? salesMap.get(itemNameKey) ?? 0;
          const opening = Number(item.openingStock) || 0;
          stock = Math.max(0, opening + purchased - sold);
        }

        return {
          id: String(item._id),
          name: item.name,
          sku: item.sku,
          type: item.type ?? "goods",
          unit: item.unit ?? "pcs",
          salesPrice: item.salesPrice ?? 0,
          purchasePrice: item.purchasePrice ?? 0,
          salesAccount: item.salesAccount ?? "Sales",
          purchaseAccount: item.purchaseAccount ?? "Cost of Goods Sold",
          salesDescription: item.salesDescription ?? "",
          purchaseDescription: item.purchaseDescription ?? "",
          preferredVendor: item.preferredVendor ?? "",
          stock,
          inventoryTracking: inventoryEnabled,
          active: item.active ?? true,
        };
      }),
    });
  } catch (err) {
    console.error("GET /api/items error:", err);
    return NextResponse.json(
      {
        items: fallbackDemoItems.map((item, idx) => ({
          id: `demo-${idx + 1}`,
          name: item.name,
          sku: item.sku,
          type: item.unit.toLowerCase().includes("service") ? "service" : "goods",
          unit: item.unit,
          salesPrice: item.rate,
          purchasePrice: Math.round(item.rate * 0.7),
          stock: item.stock,
          active: true,
        })),
      },
      { status: 200 },
    );
  }
}

export async function POST(request: Request) {
  try {
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

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean();
      if (!defaultOrg) {
        return NextResponse.json({ error: "No active organization found" }, { status: 400 });
      }
      orgId = String(defaultOrg._id);
    }

    const pref = orgId
      ? await ItemPreference.findOne({ organizationId: orgId }).lean().catch(() => null)
      : null;
    const inventoryEnabled = Boolean(pref?.inventoryEnabled);

    const sku =
      data.sku?.trim() ||
      `SKU-${data.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newItem = await Item.create({
      organizationId: orgId,
      name: data.name,
      sku,
      hsnCode: data.hsnCode || undefined,
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
      openingStock: inventoryEnabled ? data.openingStock : 0,
      active: true,
    });

    return NextResponse.json(
      {
        message: "Item created successfully",
        item: {
          id: String(newItem._id),
          name: newItem.name,
          sku: newItem.sku,
          type: newItem.type,
          unit: newItem.unit,
          salesPrice: newItem.salesPrice,
          purchasePrice: newItem.purchasePrice,
          salesAccount: newItem.salesAccount,
          purchaseAccount: newItem.purchaseAccount,
          preferredVendor: newItem.preferredVendor,
          stock: newItem.openingStock,
          active: newItem.active,
        },
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("POST /api/items error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
