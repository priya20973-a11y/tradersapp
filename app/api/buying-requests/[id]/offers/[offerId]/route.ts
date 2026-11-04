import { NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { getBuyingScope, recordBuyingAudit } from "@/lib/buying-access";
import { BuyingRequest, RequestOffer } from "@/models";

const offerActionSchema = z.object({
  action: z.enum(["accept", "reject", "withdraw"]),
  reason: z.string().trim().max(500).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; offerId: string }> },
) {
  try {
    const { id, offerId } = await params;
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(offerId)) {
      return NextResponse.json({ error: "Invalid request or offer ID" }, { status: 400 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parsed = offerActionSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const reqObjectId = new Types.ObjectId(id);
    const offerObjectId = new Types.ObjectId(offerId);

    // Depending on action, check appropriate permission
    const requiredPermission =
      parsed.data.action === "withdraw" ? "manage-my-offers" : "accept-reject-offers";

    const scopeResult = await getBuyingScope(undefined, requiredPermission, { req: request });
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId, actorId, isAdmin } = scopeResult.scope;

    const orgObjectId = new Types.ObjectId(organizationId);
    const userObjectId = Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null;

    const [buyingReq, offer] = await Promise.all([
      BuyingRequest.findOne({ _id: reqObjectId, organizationId: orgObjectId }),
      RequestOffer.findOne({ _id: offerObjectId, requestId: reqObjectId, organizationId: orgObjectId }),
    ]);

    if (!buyingReq) {
      return NextResponse.json({ error: "Buying request not found" }, { status: 404 });
    }
    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // 1. ACCEPT ACTION
    if (parsed.data.action === "accept") {
      const isBuyer = userObjectId && String(buyingReq.buyerId) === String(userObjectId);
      if (!isBuyer && !isAdmin) {
        return NextResponse.json(
          { error: "Only the buyer who created this request can accept an offer" },
          { status: 403 },
        );
      }

      if (!["Open", "Offers Received"].includes(buyingReq.status)) {
        return NextResponse.json(
          { error: `Cannot accept offer because request is already ${buyingReq.status.toLowerCase()}` },
          { status: 400 },
        );
      }

      if (offer.status !== "Pending") {
        return NextResponse.json(
          { error: `Cannot accept an offer that is already ${offer.status.toLowerCase()}` },
          { status: 400 },
        );
      }

      // Mark this offer as Accepted
      offer.status = "Accepted";
      await offer.save();

      // Automatically reject all other pending offers on this request
      await RequestOffer.updateMany(
        {
          requestId: reqObjectId,
          _id: { $ne: offerObjectId },
          status: "Pending",
        },
        { $set: { status: "Rejected" } },
      );

      // Update buying request to Accepted and set acceptedOfferId
      buyingReq.status = "Accepted";
      buyingReq.acceptedOfferId = offerObjectId;
      await buyingReq.save();

      await recordBuyingAudit({
        organizationId,
        actorId,
        action: "request_offer.accepted",
        entityType: "RequestOffer",
        entityId: offerId,
        changes: {
          requestId: buyingReq.requestId,
          offerId: offer.offerId,
          sellerName: offer.sellerName,
          offeredPrice: offer.offeredPrice,
          availableQuantity: offer.availableQuantity,
        },
      });

      return NextResponse.json({
        ok: true,
        message: `Offer ${offer.offerId} has been accepted. Other pending offers have been closed.`,
        offer,
        requestStatus: "Accepted",
      });
    }

    // 2. REJECT ACTION
    if (parsed.data.action === "reject") {
      const isBuyer = userObjectId && String(buyingReq.buyerId) === String(userObjectId);
      if (!isBuyer && !isAdmin) {
        return NextResponse.json(
          { error: "Only the buyer who created this request can reject an offer" },
          { status: 403 },
        );
      }

      if (offer.status !== "Pending") {
        return NextResponse.json(
          { error: `Cannot reject an offer that is already ${offer.status.toLowerCase()}` },
          { status: 400 },
        );
      }

      offer.status = "Rejected";
      await offer.save();

      // Check if any other pending offers exist
      const remainingPending = await RequestOffer.countDocuments({
        requestId: reqObjectId,
        status: "Pending",
      });

      if (remainingPending === 0 && buyingReq.status === "Offers Received") {
        // If all offers are rejected, request can go back to Open
        buyingReq.status = "Open";
        await buyingReq.save();
      }

      await recordBuyingAudit({
        organizationId,
        actorId,
        action: "request_offer.rejected",
        entityType: "RequestOffer",
        entityId: offerId,
        changes: {
          requestId: buyingReq.requestId,
          offerId: offer.offerId,
          reason: parsed.data.reason || "Rejected by buyer",
        },
      });

      return NextResponse.json({
        ok: true,
        message: `Offer ${offer.offerId} has been rejected`,
        offer,
        requestStatus: buyingReq.status,
      });
    }

    // 3. WITHDRAW ACTION
    if (parsed.data.action === "withdraw") {
      const isSeller = userObjectId && String(offer.sellerId) === String(userObjectId);
      if (!isSeller && !isAdmin) {
        return NextResponse.json(
          { error: "Only the seller who submitted this offer can withdraw it" },
          { status: 403 },
        );
      }

      if (offer.status !== "Pending") {
        return NextResponse.json(
          { error: `Cannot withdraw an offer that is already ${offer.status.toLowerCase()}` },
          { status: 400 },
        );
      }

      offer.status = "Withdrawn";
      await offer.save();

      // Decrement offers count on request
      const remainingActive = await RequestOffer.countDocuments({
        requestId: reqObjectId,
        status: { $in: ["Pending", "Accepted"] },
      });

      if (remainingActive === 0 && buyingReq.status === "Offers Received") {
        buyingReq.status = "Open";
      }
      buyingReq.offersCount = Math.max(0, (buyingReq.offersCount || 1) - 1);
      await buyingReq.save();

      await recordBuyingAudit({
        organizationId,
        actorId,
        action: "request_offer.withdrawn",
        entityType: "RequestOffer",
        entityId: offerId,
        changes: {
          requestId: buyingReq.requestId,
          offerId: offer.offerId,
          reason: parsed.data.reason || "Withdrawn by seller",
        },
      });

      return NextResponse.json({
        ok: true,
        message: `Offer ${offer.offerId} has been withdrawn`,
        offer,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /api/buying-requests/[id]/offers/[offerId] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update offer" },
      { status: 500 },
    );
  }
}
