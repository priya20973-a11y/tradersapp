import { NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { getBuyingScope, seedInitialRequestsIfEmpty, recordBuyingAudit } from "@/lib/buying-access";
import { BuyingRequest, RequestOffer } from "@/models";

const buyingRequestCreateSchema = z.object({
  commodity: z.string().trim().min(2, "Commodity name is required").max(100),
  requiredQuantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: z.string().trim().min(1).default("MT"),
  targetPrice: z.union([z.coerce.number().positive(), z.null()]).optional(),
  qualitySpecs: z.string().trim().max(1000).optional(),
  deliveryLocation: z.string().trim().min(2, "Delivery location is required").max(200),
  requiredDeliveryDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Valid delivery date is required"),
  description: z.string().trim().max(2000).optional(),
  buyerCompany: z.string().trim().max(160).optional(),
  buyerPhone: z.string().trim().max(30).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") || undefined;
    const scopeResult = await getBuyingScope(requestedOrgId, "view-buying-requests", { req: request });
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId, actorId, name, email, isAdmin, role } = scopeResult.scope;

    // Seed sample requests if empty
    await seedInitialRequestsIfEmpty(organizationId, actorId, name, email);

    // Existing data: set requests without a status to Pending without overwriting approved ones
    const missingStatusFilter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      $or: [{ status: { $exists: false } }, { status: null }, { status: "" }],
    };
    await BuyingRequest.updateMany(
      missingStatusFilter,
      { $set: { status: "Pending", adminStatus: "Pending" } },
    );

    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 12) || 12));
    const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);
    const commodity = (url.searchParams.get("commodity") ?? "").trim();
    const status = (url.searchParams.get("status") ?? "").trim();
    const view = (url.searchParams.get("view") ?? "all").trim(); // 'all', 'my-requests', 'open-market', 'my-offers'

    const orgObjectId = new Types.ObjectId(organizationId);
    const userObjectId = Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null;

    const filter: Record<string, unknown> = {
      organizationId: orgObjectId,
    };

    // Role or view based filtering
    if (view === "my-requests" && userObjectId) {
      filter.buyerId = userObjectId;
    } else if (view === "open-market") {
      // Marketplace for sellers: requests that are Approved, Open, or Offers Received
      filter.status = { $in: ["Approved", "Open", "Offers Received"] };
    } else if (view === "my-offers" && userObjectId) {
      // Requests where the current user has submitted an offer
      const myOffers = await RequestOffer.find({ sellerId: userObjectId }).select("requestId").lean();
      const reqIds = myOffers.map((o) => o.requestId);
      filter._id = { $in: reqIds };
    } else if (role === "Buyer" && userObjectId && view !== "open-market") {
      // Default view for Buyer role if not browsing open market
      filter.buyerId = userObjectId;
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { requestId: { $regex: escaped, $options: "i" } },
        { commodity: { $regex: escaped, $options: "i" } },
        { deliveryLocation: { $regex: escaped, $options: "i" } },
        { buyerCompany: { $regex: escaped, $options: "i" } },
        { buyerName: { $regex: escaped, $options: "i" } },
      ];
    }

    if (commodity && commodity !== "all") {
      filter.commodity = { $regex: new RegExp(`^${commodity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") };
    }

    if (status && status !== "all") {
      if (status === "In Progress") {
        filter.status = { $in: ["In Progress", "Offers Received", "Accepted"] };
      } else if (status === "Closed") {
        filter.status = { $in: ["Closed", "Fulfilled", "Cancelled", "Rejected"] };
      } else if (status === "Pending") {
        filter.$or = [{ status: "Pending" }, { adminStatus: "Pending" }];
      } else if (status === "Approved") {
        filter.$or = [{ status: "Approved" }, { adminStatus: "Approved" }];
      } else {
        filter.status = status;
      }
    }

    const [requests, total, allCommoditiesAgg] = await Promise.all([
      BuyingRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BuyingRequest.countDocuments(filter),
      BuyingRequest.distinct("commodity", { organizationId: orgObjectId }),
    ]);

    // Find if user submitted offers for these requests
    const requestIds = requests.map((r) => r._id);
    const userOffers = userObjectId
      ? await RequestOffer.find({
          requestId: { $in: requestIds },
          sellerId: userObjectId,
        }).lean()
      : [];

    const offerMap = new Map(
      userOffers.map((o) => [
        String(o.requestId),
        {
          id: String(o._id),
          offerId: o.offerId,
          offeredPrice: o.offeredPrice,
          availableQuantity: o.availableQuantity,
          deliveryTerms: o.deliveryTerms,
          status: o.status,
          createdAt: o.createdAt,
        },
      ]),
    );

    const formattedRequests = requests.map((r) => {
      const isMine = userObjectId ? String(r.buyerId) === String(userObjectId) : false;
      return {
        id: String(r._id),
        requestId: r.requestId,
        commodity: r.commodity,
        requiredQuantity: r.requiredQuantity,
        unit: r.unit,
        targetPrice: r.targetPrice ?? null,
        qualitySpecs: r.qualitySpecs || "",
        deliveryLocation: r.deliveryLocation,
        requiredDeliveryDate: r.requiredDeliveryDate,
        description: r.description || "",
        status: r.status || "Pending",
        adminStatus: (r as unknown as { adminStatus?: string }).adminStatus || (r.status === "Approved" ? "Approved" : "Pending"),
        offersCount: r.offersCount ?? 0,
        acceptedOfferId: r.acceptedOfferId ? String(r.acceptedOfferId) : null,
        buyerId: String(r.buyerId),
        buyerName: r.buyerName,
        buyerCompany: r.buyerCompany,
        buyerEmail: r.buyerEmail || "",
        buyerPhone: r.buyerPhone || "",
        isMine,
        myOffer: offerMap.get(String(r._id)) || null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return NextResponse.json({
      requests: formattedRequests,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      availableCommodities: (allCommoditiesAgg as string[]).sort(),
      currentUser: {
        id: actorId,
        name,
        email,
        role,
        isAdmin,
      },
    });
  } catch (error) {
    console.error("GET /api/buying-requests error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load buying requests" },
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

    const parsed = buyingRequestCreateSchema.safeParse(payload);
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

    const scopeResult = await getBuyingScope(requestedOrgId, "manage-buying-requests", { req: request });
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId, actorId, name, email } = scopeResult.scope;

    const orgObjectId = new Types.ObjectId(organizationId);
    const userObjectId = Types.ObjectId.isValid(actorId)
      ? new Types.ObjectId(actorId)
      : new Types.ObjectId("6ad5bbebc705e44f38b65451");

    // Generate unique sequential request ID
    let nextNum = 2001;
    const existingReqs = await BuyingRequest.find({ organizationId: orgObjectId })
      .select("requestId")
      .lean();
    const existingIds = new Set(existingReqs.map((r) => r.requestId));
    while (existingIds.has(`BR-${nextNum}`)) {
      nextNum++;
    }
    const requestId = `BR-${nextNum}`;

    const newRequest = await BuyingRequest.create({
      requestId,
      organizationId: orgObjectId,
      buyerId: userObjectId,
      buyerName: name || "Buyer",
      buyerCompany: parsed.data.buyerCompany || name || "BharatGodam Trading",
      buyerEmail: email || undefined,
      buyerPhone: parsed.data.buyerPhone || undefined,
      commodity: parsed.data.commodity,
      requiredQuantity: parsed.data.requiredQuantity,
      unit: parsed.data.unit || "MT",
      targetPrice: parsed.data.targetPrice ?? null,
      qualitySpecs: parsed.data.qualitySpecs || undefined,
      deliveryLocation: parsed.data.deliveryLocation,
      requiredDeliveryDate: new Date(parsed.data.requiredDeliveryDate),
      description: parsed.data.description || undefined,
      status: "Pending",
      adminStatus: "Pending",
      offersCount: 0,
    });

    await recordBuyingAudit({
      organizationId,
      actorId,
      action: "buying_request.created",
      entityType: "BuyingRequest",
      entityId: String(newRequest._id),
      changes: {
        requestId,
        commodity: parsed.data.commodity,
        requiredQuantity: parsed.data.requiredQuantity,
        unit: parsed.data.unit,
        status: "Pending",
      },
    });

    return NextResponse.json(
      {
        ok: true,
        id: String(newRequest._id),
        requestId: newRequest.requestId,
        message: "Buying request published successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/buying-requests error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create buying request" },
      { status: 500 },
    );
  }
}
