import { NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { getBuyingScope, recordBuyingAudit } from "@/lib/buying-access";
import { BuyingRequest, RequestOffer } from "@/models";

const updateRequestSchema = z.object({
  commodity: z.string().trim().min(2).max(100).optional(),
  requiredQuantity: z.coerce.number().positive().optional(),
  unit: z.string().trim().min(1).optional(),
  targetPrice: z.union([z.coerce.number().positive(), z.null()]).optional(),
  qualitySpecs: z.string().trim().max(1000).optional(),
  deliveryLocation: z.string().trim().min(2).max(200).optional(),
  requiredDeliveryDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Valid date required").optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum([
    "Pending",
    "Approved",
    "Open",
    "In Progress",
    "Offers Received",
    "Accepted",
    "Rejected",
    "Fulfilled",
    "Closed",
    "Cancelled",
  ]).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid buying request ID" }, { status: 400 });
    }

    const scopeResult = await getBuyingScope(undefined, "view-buying-requests", { req: request });
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId, actorId, isAdmin } = scopeResult.scope;

    const orgObjectId = new Types.ObjectId(organizationId);
    const userObjectId = Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null;
    const reqObjectId = new Types.ObjectId(id);

    const buyingReq = await BuyingRequest.findOne({
      _id: reqObjectId,
      organizationId: orgObjectId,
    }).lean();

    if (!buyingReq) {
      return NextResponse.json({ error: "Buying request not found" }, { status: 404 });
    }

    const isMine = userObjectId ? String(buyingReq.buyerId) === String(userObjectId) : false;

    // Retrieve offers:
    // If request owner or admin -> can view all offers for this request.
    // If seller -> can view only their own offer.
    let offers: unknown[] = [];
    if (isMine || isAdmin) {
      const allOffers = await RequestOffer.find({ requestId: reqObjectId })
        .sort({ createdAt: -1 })
        .lean();
      offers = allOffers.map((o) => ({
        id: String(o._id),
        offerId: o.offerId,
        sellerId: String(o.sellerId),
        sellerName: o.sellerName,
        sellerCompany: o.sellerCompany,
        sellerEmail: o.sellerEmail || "",
        sellerPhone: o.sellerPhone || "",
        offeredPrice: o.offeredPrice,
        availableQuantity: o.availableQuantity,
        unit: o.unit,
        deliveryTerms: o.deliveryTerms,
        validTill: o.validTill,
        remarks: o.remarks || "",
        status: o.status,
        createdAt: o.createdAt,
      }));
    } else if (userObjectId) {
      const myOffer = await RequestOffer.findOne({
        requestId: reqObjectId,
        sellerId: userObjectId,
      }).lean();
      if (myOffer) {
        offers = [
          {
            id: String(myOffer._id),
            offerId: myOffer.offerId,
            sellerId: String(myOffer.sellerId),
            sellerName: myOffer.sellerName,
            sellerCompany: myOffer.sellerCompany,
            offeredPrice: myOffer.offeredPrice,
            availableQuantity: myOffer.availableQuantity,
            unit: myOffer.unit,
            deliveryTerms: myOffer.deliveryTerms,
            validTill: myOffer.validTill,
            remarks: myOffer.remarks || "",
            status: myOffer.status,
            createdAt: myOffer.createdAt,
          },
        ];
      }
    }

    return NextResponse.json({
      request: {
        id: String(buyingReq._id),
        requestId: buyingReq.requestId,
        commodity: buyingReq.commodity,
        requiredQuantity: buyingReq.requiredQuantity,
        unit: buyingReq.unit,
        targetPrice: buyingReq.targetPrice ?? null,
        qualitySpecs: buyingReq.qualitySpecs || "",
        deliveryLocation: buyingReq.deliveryLocation,
        requiredDeliveryDate: buyingReq.requiredDeliveryDate,
        description: buyingReq.description || "",
        status: buyingReq.status,
        offersCount: buyingReq.offersCount ?? 0,
        acceptedOfferId: buyingReq.acceptedOfferId ? String(buyingReq.acceptedOfferId) : null,
        buyerId: String(buyingReq.buyerId),
        buyerName: buyingReq.buyerName,
        buyerCompany: buyingReq.buyerCompany,
        buyerEmail: buyingReq.buyerEmail || "",
        buyerPhone: buyingReq.buyerPhone || "",
        isMine,
        createdAt: buyingReq.createdAt,
        updatedAt: buyingReq.updatedAt,
      },
      offers,
    });
  } catch (error) {
    console.error("GET /api/buying-requests/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load buying request details" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid buying request ID" }, { status: 400 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parsed = updateRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const scopeResult = await getBuyingScope(undefined, "manage-buying-requests", { req: request });
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId, actorId, isAdmin } = scopeResult.scope;

    const orgObjectId = new Types.ObjectId(organizationId);
    const userObjectId = Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null;
    const reqObjectId = new Types.ObjectId(id);

    const existingReq = await BuyingRequest.findOne({
      _id: reqObjectId,
      organizationId: orgObjectId,
    });

    if (!existingReq) {
      return NextResponse.json({ error: "Buying request not found" }, { status: 404 });
    }

    // Authorization check: Only request creator or admin can modify
    const isOwner = userObjectId && String(existingReq.buyerId) === String(userObjectId);
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "You are not authorized to edit or cancel this buying request" },
        { status: 403 },
      );
    }

    // Do not allow edits to already cancelled or fulfilled requests
    if (["Cancelled", "Fulfilled"].includes(existingReq.status) && parsed.data.status !== existingReq.status) {
      return NextResponse.json(
        { error: `Cannot modify a request that is already ${existingReq.status.toLowerCase()}` },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.commodity) updates.commodity = parsed.data.commodity;
    if (parsed.data.requiredQuantity !== undefined) updates.requiredQuantity = parsed.data.requiredQuantity;
    if (parsed.data.unit) updates.unit = parsed.data.unit;
    if (parsed.data.targetPrice !== undefined) updates.targetPrice = parsed.data.targetPrice;
    if (parsed.data.qualitySpecs !== undefined) updates.qualitySpecs = parsed.data.qualitySpecs;
    if (parsed.data.deliveryLocation) updates.deliveryLocation = parsed.data.deliveryLocation;
    if (parsed.data.requiredDeliveryDate) {
      updates.requiredDeliveryDate = new Date(parsed.data.requiredDeliveryDate);
    }
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.status) {
      updates.status = parsed.data.status;
      // If cancelled, reject any pending offers
      if (parsed.data.status === "Cancelled") {
        await RequestOffer.updateMany(
          { requestId: reqObjectId, status: "Pending" },
          { $set: { status: "Rejected" } },
        );
      }
    }

    const updated = await BuyingRequest.findByIdAndUpdate(reqObjectId, { $set: updates }, { new: true });

    await recordBuyingAudit({
      organizationId,
      actorId,
      action: parsed.data.status === "Cancelled" ? "buying_request.cancelled" : "buying_request.updated",
      entityType: "BuyingRequest",
      entityId: id,
      changes: updates,
    });

    return NextResponse.json({
      ok: true,
      request: updated,
      message: parsed.data.status === "Cancelled" ? "Request cancelled successfully" : "Request updated successfully",
    });
  } catch (error) {
    console.error("PATCH /api/buying-requests/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update buying request" },
      { status: 500 },
    );
  }
}
