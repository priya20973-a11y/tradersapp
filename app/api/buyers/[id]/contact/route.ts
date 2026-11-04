import { NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { getBuyingScope, recordBuyingAudit } from "@/lib/buying-access";
import { BuyerProfile } from "@/models";

const contactInquirySchema = z.object({
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(200),
  message: z.string().trim().min(5, "Message must be at least 5 characters").max(2000),
  offeredCommodity: z.string().trim().max(100).optional(),
  proposedQuantity: z.coerce.number().min(0).optional(),
  proposedPrice: z.coerce.number().min(0).optional(),
  senderPhone: z.string().trim().max(30).optional(),
  senderEmail: z.union([z.string().email(), z.literal("")]).optional(),
});

export async function POST(
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

    const parsed = contactInquirySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const scopeResult = await getBuyingScope(undefined, "view-buyers", { req: request });
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId, actorId, name, email } = scopeResult.scope;

    const orgObjectId = new Types.ObjectId(organizationId);
    const buyerObjectId = new Types.ObjectId(id);

    const buyer = await BuyerProfile.findOne({ _id: buyerObjectId, organizationId: orgObjectId }).lean();
    if (!buyer) {
      return NextResponse.json({ error: "Buyer profile not found" }, { status: 404 });
    }

    // Record inquiry as an audit event
    await recordBuyingAudit({
      organizationId,
      actorId,
      action: "buyer.inquiry_sent",
      entityType: "BuyerProfile",
      entityId: id,
      changes: {
        buyerCompany: buyer.companyName,
        buyerContact: buyer.contactPerson,
        buyerEmail: buyer.email,
        buyerPhone: buyer.phone,
        senderName: name,
        senderEmail: parsed.data.senderEmail || email,
        senderPhone: parsed.data.senderPhone || "",
        subject: parsed.data.subject,
        message: parsed.data.message,
        offeredCommodity: parsed.data.offeredCommodity || "",
        proposedQuantity: parsed.data.proposedQuantity || null,
        proposedPrice: parsed.data.proposedPrice || null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Your inquiry has been sent to ${buyer.companyName} (${buyer.contactPerson}). They will contact you shortly.`,
      buyer: {
        companyName: buyer.companyName,
        contactPerson: buyer.contactPerson,
        email: buyer.email,
        phone: buyer.phone,
        whatsapp: buyer.whatsapp,
      },
    });
  } catch (error) {
    console.error("POST /api/buyers/[id]/contact error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send inquiry" },
      { status: 500 },
    );
  }
}
