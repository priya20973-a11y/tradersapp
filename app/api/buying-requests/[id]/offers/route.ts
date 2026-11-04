import { NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { getBuyingScope, recordBuyingAudit } from "@/lib/buying-access";
import { BuyingRequest, RequestOffer } from "@/models";

const offerSubmitSchema = z.object({
  offeredPrice: z.coerce.number().positive("Offered price must be greater than 0"),
  availableQuantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: z.string().trim().min(1).default("MT"),
  deliveryTerms: z.string().trim().min(2, "Delivery terms are required").max(300),
  validTill: z.union([z.string().refine((val) => !isNaN(Date.parse(val))), z.literal(""), z.null()]).optional(),
  remarks: z.string().trim().max(1000).optional(),
  sellerCompany: z.string().trim().max(160).optional(),
  sellerPhone: z.string().trim().max(30).optional(),
});

export async function POST(
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

    const parsed = offerSubmitSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const scopeResult = await getBuyingScope(undefined, "submit-offers", { req: request });
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId, actorId, name, email, isAdmin } = scopeResult.scope;

    const orgObjectId = new Types.ObjectId(organizationId);
    const userObjectId = Types.ObjectId.isValid(actorId)
      ? new Types.ObjectId(actorId)
      : new Types.ObjectId("6ad5bbebc705e44f38b65451");
    const reqObjectId = new Types.ObjectId(id);

    const buyingReq = await BuyingRequest.findOne({
      _id: reqObjectId,
      organizationId: orgObjectId,
    });

    if (!buyingReq) {
      return NextResponse.json({ error: "Buying request not found" }, { status: 404 });
    }

    // Check request status
    if (!["Open", "Offers Received"].includes(buyingReq.status)) {
      return NextResponse.json(
        { error: `This buying request is currently ${buyingReq.status.toLowerCase()} and cannot accept new offers` },
        { status: 400 },
      );
    }

    // A buyer cannot submit an offer on their own request (unless admin testing)
    if (!isAdmin && String(buyingReq.buyerId) === String(userObjectId)) {
      return NextResponse.json(
        { error: "You cannot submit an offer on your own buying request" },
        { status: 400 },
      );
    }

    // Check if seller already has an active pending offer
    const existingOffer = await RequestOffer.findOne({
      requestId: reqObjectId,
      sellerId: userObjectId,
      status: "Pending",
    });

    if (existingOffer) {
      return NextResponse.json(
        { error: `You already have an active pending offer (${existingOffer.offerId}) on this request. Withdraw or modify it instead.` },
        { status: 409 },
      );
    }

    // Generate unique sequential offer ID
    const totalOffersCount = await RequestOffer.countDocuments({ organizationId: orgObjectId });
    const offerId = `OFF-${3000 + totalOffersCount + 1}`;

    const newOffer = await RequestOffer.create({
      offerId,
      requestId: reqObjectId,
      organizationId: orgObjectId,
      sellerId: userObjectId,
      sellerName: name || "Seller",
      sellerCompany: parsed.data.sellerCompany || name || "Agro Trader",
      sellerEmail: email || undefined,
      sellerPhone: parsed.data.sellerPhone || undefined,
      offeredPrice: parsed.data.offeredPrice,
      availableQuantity: parsed.data.availableQuantity,
      unit: parsed.data.unit || "MT",
      deliveryTerms: parsed.data.deliveryTerms,
      validTill: parsed.data.validTill ? new Date(parsed.data.validTill) : null,
      remarks: parsed.data.remarks || undefined,
      status: "Pending",
    });

    // Update buying request offers count and status
    const newStatus = buyingReq.status === "Open" ? "Offers Received" : buyingReq.status;
    await BuyingRequest.findByIdAndUpdate(reqObjectId, {
      $inc: { offersCount: 1 },
      $set: { status: newStatus },
    });

    await recordBuyingAudit({
      organizationId,
      actorId,
      action: "request_offer.submitted",
      entityType: "RequestOffer",
      entityId: String(newOffer._id),
      changes: {
        offerId,
        requestId: buyingReq.requestId,
        offeredPrice: parsed.data.offeredPrice,
        availableQuantity: parsed.data.availableQuantity,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        id: String(newOffer._id),
        offerId: newOffer.offerId,
        message: "Your offer has been submitted to the buyer successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/buying-requests/[id]/offers error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit offer" },
      { status: 500 },
    );
  }
}
