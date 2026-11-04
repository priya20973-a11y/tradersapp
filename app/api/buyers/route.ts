import { NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { getBuyingScope, seedInitialBuyersIfEmpty, recordBuyingAudit } from "@/lib/buying-access";
import { BuyerProfile, SavedBuyer } from "@/models";

const buyerCreateSchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(160),
  contactPerson: z.string().trim().min(2, "Contact person must be at least 2 characters").max(100),
  designation: z.string().trim().max(100).optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().trim().min(5, "Phone number is too short").max(30),
  whatsapp: z.string().trim().max(30).optional(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
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
  ]),
  commodities: z.array(z.string().trim().min(1)).min(1, "Select at least one commodity"),
  annualVolume: z.string().trim().max(100).optional(),
  minQuantity: z.coerce.number().min(0).default(0),
  maxQuantity: z.coerce.number().min(0).default(0),
  unit: z.string().trim().default("MT"),
  paymentTerms: z.string().trim().max(200).optional(),
  gstin: z.string().trim().max(20).optional(),
  description: z.string().trim().max(2000).optional(),
  yearEstablished: z.coerce.number().int().min(1800).max(2100).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") || undefined;
    const scopeResult = await getBuyingScope(requestedOrgId, "view-buyers", { req: request });
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId, actorId, role, isAdmin, name, email } = scopeResult.scope;

    // Ensure initial sample buyers exist for smooth out-of-the-box experience
    await seedInitialBuyersIfEmpty(organizationId);

    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 12) || 12));
    const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);
    const commodity = (url.searchParams.get("commodity") ?? "").trim();
    const state = (url.searchParams.get("state") ?? "").trim();
    const city = (url.searchParams.get("city") ?? "").trim();
    const businessType = (url.searchParams.get("businessType") ?? "").trim();
    const minQtyParam = url.searchParams.get("minQuantity");
    const maxQtyParam = url.searchParams.get("maxQuantity");
    const savedOnly = url.searchParams.get("savedOnly") === "true";

    const orgObjectId = new Types.ObjectId(organizationId);
    const userObjectId = Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null;

    const filter: Record<string, unknown> = {
      organizationId: orgObjectId,
      status: "Active",
    };

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { companyName: { $regex: escaped, $options: "i" } },
        { contactPerson: { $regex: escaped, $options: "i" } },
        { buyerCode: { $regex: escaped, $options: "i" } },
        { city: { $regex: escaped, $options: "i" } },
        { state: { $regex: escaped, $options: "i" } },
        { commodities: { $elemMatch: { $regex: escaped, $options: "i" } } },
      ];
    }

    if (commodity && commodity !== "all") {
      filter.commodities = { $regex: new RegExp(`^${commodity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") };
    }

    if (state && state !== "all") {
      filter.state = { $regex: new RegExp(`^${state.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") };
    }

    if (city && city !== "all") {
      filter.city = { $regex: new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") };
    }

    if (businessType && businessType !== "all") {
      filter.businessType = businessType;
    }

    if (minQtyParam && !isNaN(Number(minQtyParam)) && Number(minQtyParam) > 0) {
      filter.maxQuantity = { $gte: Number(minQtyParam) };
    }

    if (maxQtyParam && !isNaN(Number(maxQtyParam)) && Number(maxQtyParam) > 0) {
      filter.minQuantity = { $lte: Number(maxQtyParam) };
    }

    // Handle savedOnly filter
    let savedBuyerIds: string[] = [];
    if (userObjectId) {
      const savedDocs = await SavedBuyer.find({ userId: userObjectId }).select("buyerId").lean();
      savedBuyerIds = savedDocs.map((s) => String(s.buyerId));
    }

    if (savedOnly) {
      if (savedBuyerIds.length === 0) {
        return NextResponse.json({
          buyers: [],
          total: 0,
          page,
          limit,
          pages: 0,
          availableCommodities: [],
          availableStates: [],
          availableBusinessTypes: [],
        });
      }
      filter._id = { $in: savedBuyerIds.map((id) => new Types.ObjectId(id)) };
    }

    const [buyers, total, allCommoditiesAgg, allStatesAgg, allBusinessTypesAgg] = await Promise.all([
      BuyerProfile.find(filter)
        .sort({ rating: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BuyerProfile.countDocuments(filter),
      BuyerProfile.distinct("commodities", { organizationId: orgObjectId }),
      BuyerProfile.distinct("state", { organizationId: orgObjectId }),
      BuyerProfile.distinct("businessType", { organizationId: orgObjectId }),
    ]);

    const savedSet = new Set(savedBuyerIds);

    const formattedBuyers = buyers.map((b) => ({
      id: String(b._id),
      buyerCode: b.buyerCode,
      companyName: b.companyName,
      contactPerson: b.contactPerson,
      designation: b.designation || "",
      email: b.email || "",
      phone: b.phone || "",
      whatsapp: b.whatsapp || "",
      city: b.city,
      state: b.state,
      businessType: b.businessType,
      commodities: b.commodities || [],
      annualVolume: b.annualVolume || "",
      minQuantity: b.minQuantity ?? 0,
      maxQuantity: b.maxQuantity ?? 0,
      unit: b.unit || "MT",
      paymentTerms: b.paymentTerms || "",
      gstin: b.gstin || "",
      verified: b.verified ?? true,
      rating: b.rating ?? 4.5,
      status: b.status || "Active",
      description: b.description || "",
      yearEstablished: b.yearEstablished || null,
      isSaved: savedSet.has(String(b._id)),
      createdAt: b.createdAt,
    }));

    const isPlatformAdmin = actorId === "admin" || role === "Super Admin";

    return NextResponse.json({
      buyers: formattedBuyers,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      availableCommodities: (allCommoditiesAgg as string[]).sort(),
      availableStates: (allStatesAgg as string[]).sort(),
      availableBusinessTypes: (allBusinessTypesAgg as string[]).sort(),
      currentUser: {
        id: actorId,
        name,
        email,
        role,
        isAdmin: Boolean(isAdmin && isPlatformAdmin),
        isPlatformAdmin,
        isSystemAdmin: isPlatformAdmin,
      },
      canAddBuyer: Boolean(isAdmin),
      canManageBuyers: Boolean(isAdmin),
    });
  } catch (error) {
    console.error("GET /api/buyers error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load buyers directory" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parsed = buyerCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const requestedOrgId =
      typeof payload === "object" && payload !== null && "organizationId" in payload
        ? String(payload.organizationId)
        : undefined;

    const scopeResult = await getBuyingScope(requestedOrgId, "manage-buyers", { req: request });
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId, actorId, role, isAdmin } = scopeResult.scope;

    const isPlatformAdmin = actorId === "admin" || role === "Super Admin";

    // Strict backend enforcement: Non-admin users are forbidden from creating buyers
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only administrators can add new buyers." },
        { status: 403 },
      );
    }
    if (!isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only administrators can add new buyers." },
        { status: 403 },
      );
    }

    const orgObjectId = new Types.ObjectId(organizationId);

    // Generate unique sequential buyer code
    const count = await BuyerProfile.countDocuments({ organizationId: orgObjectId });
    const buyerCode = `BYR-${1000 + count + 1}`;

    const newBuyer = await BuyerProfile.create({
      ...parsed.data,
      organizationId: orgObjectId,
      buyerCode,
      verified: true,
      rating: 4.5,
      status: "Active",
    });

    await recordBuyingAudit({
      organizationId,
      actorId,
      action: "buyer.created",
      entityType: "BuyerProfile",
      entityId: String(newBuyer._id),
      changes: {
        companyName: newBuyer.companyName,
        buyerCode: newBuyer.buyerCode,
        contactPerson: newBuyer.contactPerson,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        id: String(newBuyer._id),
        buyerCode: newBuyer.buyerCode,
        message: "Buyer profile created successfully",
        buyer: {
          id: String(newBuyer._id),
          buyerCode: newBuyer.buyerCode,
          companyName: newBuyer.companyName,
          contactPerson: newBuyer.contactPerson,
          designation: newBuyer.designation || "",
          email: newBuyer.email || "",
          phone: newBuyer.phone || "",
          whatsapp: newBuyer.whatsapp || "",
          city: newBuyer.city,
          state: newBuyer.state,
          businessType: newBuyer.businessType,
          commodities: newBuyer.commodities || [],
          annualVolume: newBuyer.annualVolume || "",
          minQuantity: newBuyer.minQuantity ?? 0,
          maxQuantity: newBuyer.maxQuantity ?? 0,
          unit: newBuyer.unit || "MT",
          paymentTerms: newBuyer.paymentTerms || "",
          gstin: newBuyer.gstin || "",
          verified: newBuyer.verified,
          rating: newBuyer.rating,
          status: newBuyer.status,
          description: newBuyer.description || "",
          yearEstablished: newBuyer.yearEstablished || null,
          createdAt: newBuyer.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/buyers error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create buyer profile" },
      { status: 500 },
    );
  }
}
