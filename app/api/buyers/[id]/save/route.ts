import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getBuyingScope, recordBuyingAudit } from "@/lib/buying-access";
import { BuyerProfile, SavedBuyer } from "@/models";

export async function POST(
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
    const { organizationId, actorId } = scopeResult.scope;

    if (!Types.ObjectId.isValid(actorId)) {
      return NextResponse.json({ error: "User identity required to save buyer" }, { status: 400 });
    }

    const orgObjectId = new Types.ObjectId(organizationId);
    const userObjectId = new Types.ObjectId(actorId);
    const buyerObjectId = new Types.ObjectId(id);

    const buyer = await BuyerProfile.findOne({ _id: buyerObjectId, organizationId: orgObjectId }).select("companyName buyerCode").lean();
    if (!buyer) {
      return NextResponse.json({ error: "Buyer profile not found" }, { status: 404 });
    }

    const existing = await SavedBuyer.findOne({ userId: userObjectId, buyerId: buyerObjectId });

    let isSaved: boolean;
    if (existing) {
      await SavedBuyer.deleteOne({ _id: existing._id });
      isSaved = false;
    } else {
      await SavedBuyer.create({
        organizationId: orgObjectId,
        userId: userObjectId,
        buyerId: buyerObjectId,
      });
      isSaved = true;
    }

    await recordBuyingAudit({
      organizationId,
      actorId,
      action: isSaved ? "buyer.saved" : "buyer.unsaved",
      entityType: "BuyerProfile",
      entityId: id,
      changes: { companyName: buyer.companyName, buyerCode: buyer.buyerCode, isSaved },
    });

    return NextResponse.json({
      ok: true,
      isSaved,
      message: isSaved ? "Buyer added to your saved list" : "Buyer removed from your saved list",
    });
  } catch (error) {
    console.error("POST /api/buyers/[id]/save error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to toggle saved buyer" },
      { status: 500 },
    );
  }
}
