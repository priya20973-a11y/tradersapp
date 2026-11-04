import { NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { getBuyingScope, recordBuyingAudit } from "@/lib/buying-access";
import { BuyerProfile, SavedBuyer } from "@/models";

const buyerUpdateSchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(160).optional(),
  contactPerson: z.string().trim().min(2, "Contact person must be at least 2 characters").max(100).optional(),
  designation: z.string().trim().max(100).optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().trim().min(5, "Phone number is too short").max(30).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().min(2).max(100).optional(),
  businessType: z.enum([
    "Proprietorship",
    "Partnership",
    "LLP",
    "Private Limited",
    "Public Limited",
    "FPO",
    "Cooperative",
    "Processor / Miller",
    "Exporter",
    "Wholesaler",
    "Retailer",
    "Other",
  ]).optional(),
  commodities: z.array(z.string().trim().min(1)).min(1, "Select at least one commodity").optional(),
  annualVolume: z.string().trim().max(100).optional(),
  minQuantity: z.coerce.number().min(0).optional(),
  maxQuantity: z.coerce.number().min(0).optional(),
  unit: z.string().trim().optional(),
  paymentTerms: z.string().trim().max(200).optional(),
  gstin: z.string().trim().max(20).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  verified: z.boolean().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  description: z.string().trim().max(2000).optional(),
  yearEstablished: z.coerce.number().int().min(1800).max(2100).nullable().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid buyer ID" }, { status: 400 });
    }

    const scopeResult = await getBuyingScope(undefined, "view-buyers", { req: request });
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId, actorId, isAdmin } = scopeResult.scope;

    const orgObjectId = new Types.ObjectId(organizationId);
    const buyer = await BuyerProfile.findOne({
      _id: new Types.ObjectId(id),
      organizationId: orgObjectId,
    }).lean();

    if (!buyer) {
      return NextResponse.json({ error: "Buyer profile not found" }, { status: 404 });
    }

    let isSaved = false;
    if (Types.ObjectId.isValid(actorId)) {
      const saved = await SavedBuyer.exists({
        userId: new Types.ObjectId(actorId),
        buyerId: buyer._id,
      });
      isSaved = !!saved;
    }

    return NextResponse.json({
      buyer: {
        id: String(buyer._id),
        buyerCode: buyer.buyerCode,
        companyName: buyer.companyName,
        contactPerson: buyer.contactPerson,
        designation: buyer.designation || "",
        email: buyer.email || "",
        phone: buyer.phone || "",
        whatsapp: buyer.whatsapp || "",
        city: buyer.city,
        state: buyer.state,
        businessType: buyer.businessType,
        commodities: buyer.commodities || [],
        annualVolume: buyer.annualVolume || "",
        minQuantity: buyer.minQuantity ?? 0,
        maxQuantity: buyer.maxQuantity ?? 0,
        unit: buyer.unit || "MT",
        paymentTerms: buyer.paymentTerms || "",
        gstin: buyer.gstin || "",
        verified: buyer.verified ?? true,
        rating: buyer.rating ?? 4.5,
        status: buyer.status,
        description: buyer.description || "",
        yearEstablished: buyer.yearEstablished || null,
        isSaved,
        createdAt: buyer.createdAt,
      },
      canEdit: Boolean(isAdmin),
      canManage: Boolean(isAdmin),
    });
  } catch (error) {
    console.error("GET /api/buyers/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load buyer details" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid buyer ID" }, { status: 400 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parsed = buyerUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const scopeResult = await getBuyingScope(undefined, "manage-buyers", { req: request });
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId, actorId, role, isAdmin } = scopeResult.scope;

    const isPlatformAdmin = actorId === "admin" || role === "Super Admin";

    // Strict backend enforcement: Non-admin users are forbidden from editing or modifying buyers
    if (!isAdmin || !isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only administrators can edit or manage buyers." },
        { status: 403 },
      );
    }

    const orgObjectId = new Types.ObjectId(organizationId);
    const buyerObjectId = new Types.ObjectId(id);

    const buyer = await BuyerProfile.findOne({
      _id: buyerObjectId,
      organizationId: orgObjectId,
    });

    if (!buyer) {
      return NextResponse.json({ error: "Buyer profile not found" }, { status: 404 });
    }

    Object.assign(buyer, parsed.data);
    await buyer.save();

    await recordBuyingAudit({
      organizationId,
      actorId,
      action: "buyer.updated",
      entityType: "BuyerProfile",
      entityId: id,
      changes: parsed.data,
    });

    return NextResponse.json({
      ok: true,
      message: "Buyer profile updated successfully",
      buyer: {
        id: String(buyer._id),
        buyerCode: buyer.buyerCode,
        companyName: buyer.companyName,
        contactPerson: buyer.contactPerson,
        designation: buyer.designation || "",
        email: buyer.email || "",
        phone: buyer.phone || "",
        whatsapp: buyer.whatsapp || "",
        city: buyer.city,
        state: buyer.state,
        businessType: buyer.businessType,
        commodities: buyer.commodities || [],
        annualVolume: buyer.annualVolume || "",
        minQuantity: buyer.minQuantity ?? 0,
        maxQuantity: buyer.maxQuantity ?? 0,
        unit: buyer.unit || "MT",
        paymentTerms: buyer.paymentTerms || "",
        gstin: buyer.gstin || "",
        verified: buyer.verified ?? true,
        rating: buyer.rating ?? 4.5,
        status: buyer.status,
        description: buyer.description || "",
        yearEstablished: buyer.yearEstablished || null,
        createdAt: buyer.createdAt,
      },
    });
  } catch (error) {
    console.error("PUT /api/buyers/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update buyer profile" },
      { status: 500 },
    );
  }
}

export const PATCH = PUT;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid buyer ID" }, { status: 400 });
    }

    const scopeResult = await getBuyingScope(undefined, "manage-buyers", { req: request });
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId, actorId, role, isAdmin } = scopeResult.scope;

    const isPlatformAdmin = actorId === "admin" || role === "Super Admin";

    // Strict backend enforcement: Only administrators can delete or manage buyers
    if (!isAdmin || !isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only administrators can delete or manage buyers." },
        { status: 403 },
      );
    }

    const orgObjectId = new Types.ObjectId(organizationId);
    const buyerObjectId = new Types.ObjectId(id);

    const buyer = await BuyerProfile.findOneAndDelete({
      _id: buyerObjectId,
      organizationId: orgObjectId,
    });

    if (!buyer) {
      return NextResponse.json({ error: "Buyer profile not found" }, { status: 404 });
    }

    await SavedBuyer.deleteMany({ buyerId: buyerObjectId });

    await recordBuyingAudit({
      organizationId,
      actorId,
      action: "buyer.deleted",
      entityType: "BuyerProfile",
      entityId: id,
      changes: { companyName: buyer.companyName, buyerCode: buyer.buyerCode },
    });

    return NextResponse.json({
      ok: true,
      message: "Buyer profile deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/buyers/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete buyer profile" },
      { status: 500 },
    );
  }
}
