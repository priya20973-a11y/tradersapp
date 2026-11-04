import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  Customer,
  Organization,
  SalesDocument,
  type CustomerRecord,
} from "@/models";

interface ChallanItemInput {
  itemId?: string | Types.ObjectId;
  name?: string;
  description?: string;
  unit?: string;
  quantity?: number;
  rate?: number;
  amount?: number;
}

interface ChallanAttachmentInput {
  name?: string;
  size?: number;
  type?: string;
  data?: string;
  url?: string;
}

interface DeliveryChallanPayload {
  customerId?: string;
  items?: ChallanItemInput[];
  attachments?: ChallanAttachmentInput[];
  discount?: number;
  discountType?: "percent" | "amount";
  adjustment?: number;
  deliveryChallanDate?: string | number;
  deliveryChallanNumber?: string;
  challanType?: string;
  referenceNumber?: string;
  status?: string;
  customerNotes?: string;
  termsAndConditions?: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid delivery challan ID" }, { status: 400 });
    }

    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const orgObjId = new Types.ObjectId(orgId);
    const doc = await SalesDocument.findOne({
      _id: new Types.ObjectId(id),
      organizationId: orgObjId,
      type: "Delivery Challan",
    }).lean();

    if (!doc) {
      return NextResponse.json({ error: "Delivery Challan not found" }, { status: 404 });
    }

    let customerDoc: CustomerRecord | null = null;
    if (doc.customerId) {
      customerDoc = await Customer.findById(doc.customerId).lean();
    }

    const challan = {
      id: String(doc._id),
      deliveryChallanNumber: doc.number,
      customerId: String(doc.customerId),
      customerName:
        doc.customerSnapshot?.companyName ||
        doc.customerSnapshot?.name ||
        customerDoc?.companyName ||
        customerDoc?.name ||
        "Customer",
      customerSnapshot: doc.customerSnapshot || customerDoc || {},
      referenceNumber: doc.referenceNumber || "",
      challanType: doc.challanType || "Supply on Approval",
      deliveryChallanDate: doc.issueDate ? new Date(doc.issueDate).toISOString().split("T")[0] : "",
      status: doc.status || "Draft",
      total: Number(doc.total || 0),
      subTotal: Number(doc.subTotal || 0),
      discount: Number(doc.discount || 0),
      discountType: doc.discountType || "percent",
      adjustment: Number(doc.adjustment || 0),
      customerNotes: doc.customerNotes || "",
      termsAndConditions: doc.termsAndConditions || "",
      items: (doc.items || []).map((item) => ({
        itemId: item.itemId ? String(item.itemId) : undefined,
        name: item.name,
        description: item.description || "",
        unit: item.unit || "pcs",
        quantity: Number(item.quantity || 1),
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
      })),
      attachments: (doc.attachments || []).map((att) => ({
        name: att.name,
        size: att.size,
        type: att.type,
        data: att.data,
        url: att.url,
      })),
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    };

    return NextResponse.json({ deliveryChallan: challan });
  } catch (error: unknown) {
    console.error("GET /api/sales/delivery-challans/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
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
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid delivery challan ID" }, { status: 400 });
    }

    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const orgObjId = new Types.ObjectId(orgId);
    const body: DeliveryChallanPayload = await request.json().catch(() => ({}));

    const existing = await SalesDocument.findOne({
      _id: new Types.ObjectId(id),
      organizationId: orgObjId,
      type: "Delivery Challan",
    });

    if (!existing) {
      return NextResponse.json({ error: "Delivery Challan not found" }, { status: 404 });
    }

    let customerObjId = existing.customerId;
    let customerDoc: CustomerRecord | null = null;

    if (body.customerId && isValidObjectId(body.customerId)) {
      customerObjId = new Types.ObjectId(body.customerId);
      customerDoc = await Customer.findOne({ _id: customerObjId, organizationId: orgObjId }).lean();
    }

    const customerSnapshot = customerDoc
      ? {
          name: customerDoc.name,
          companyName: customerDoc.companyName || customerDoc.name,
          gstin: customerDoc.gstin || "",
          pan: customerDoc.pan || "",
          email: customerDoc.email || "",
          phone: customerDoc.phone || customerDoc.mobile || "",
          billingAddress: customerDoc.billingAddress || {},
          shippingAddress: customerDoc.shippingAddress || customerDoc.billingAddress || {},
        }
      : existing.customerSnapshot;

    // Items calculation
    const rawItems: ChallanItemInput[] = Array.isArray(body.items)
      ? body.items
      : existing.items || [];
    const items = rawItems.map((item) => {
      const name = (item.name || "Item").trim();
      const quantity = Math.max(0, Number(item.quantity) || 1);
      const rate = Math.max(0, Number(item.rate) || 0);
      const amount = Math.round(quantity * rate * 100) / 100;
      let itemIdObj: Types.ObjectId | undefined = undefined;
      if (item.itemId && isValidObjectId(item.itemId)) {
        itemIdObj = new Types.ObjectId(item.itemId);
      }

      return {
        itemId: itemIdObj,
        name,
        description: (item.description || "").trim(),
        unit: (item.unit || "pcs").trim(),
        quantity,
        rate,
        amount,
      };
    });

    const subTotal = items.reduce((sum: number, it) => sum + it.amount, 0);

    const discountType = body.discountType === "amount" ? "amount" : "percent";
    const rawDiscount = Math.max(0, Number(body.discount !== undefined ? body.discount : existing.discount) || 0);
    let discountAmount = 0;
    if (discountType === "percent") {
      discountAmount = Math.round((subTotal * (rawDiscount / 100)) * 100) / 100;
    } else {
      discountAmount = Math.min(subTotal, rawDiscount);
    }

    const adjustment = Number(body.adjustment !== undefined ? body.adjustment : existing.adjustment) || 0;
    const total = Math.max(0, Math.round((subTotal - discountAmount + adjustment) * 100) / 100);

    // Attachments
    let attachments = existing.attachments;
    if (Array.isArray(body.attachments)) {
      attachments = body.attachments.slice(0, 5).map((att) => ({
        name: String(att.name || "attachment"),
        size: Number(att.size || 0),
        type: String(att.type || ""),
        data: String(att.data || ""),
        url: String(att.url || ""),
      }));
    }

    let issueDate = existing.issueDate;
    if (body.deliveryChallanDate) {
      const parsed = new Date(body.deliveryChallanDate);
      if (!isNaN(parsed.getTime())) issueDate = parsed;
    }

    existing.customerId = customerObjId;
    existing.customerSnapshot = customerSnapshot;
    if (body.deliveryChallanNumber) existing.number = body.deliveryChallanNumber.trim();
    if (body.challanType) existing.challanType = body.challanType.trim();
    if (body.referenceNumber !== undefined) existing.referenceNumber = body.referenceNumber.trim();
    if (body.status) existing.status = body.status.trim();
    existing.issueDate = issueDate;
    existing.items = items;
    existing.subTotal = Math.round(subTotal * 100) / 100;
    existing.discount = rawDiscount;
    existing.discountType = discountType;
    existing.adjustment = Math.round(adjustment * 100) / 100;
    existing.total = total;
    if (body.customerNotes !== undefined) existing.customerNotes = body.customerNotes.trim();
    if (body.termsAndConditions !== undefined) existing.termsAndConditions = body.termsAndConditions.trim();
    existing.attachments = attachments;

    await existing.save();

    return NextResponse.json({
      message: "Delivery Challan updated successfully",
      deliveryChallan: existing,
    });
  } catch (error: unknown) {
    console.error("PUT /api/sales/delivery-challans/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
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
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid delivery challan ID" }, { status: 400 });
    }

    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const orgObjId = new Types.ObjectId(orgId);
    const body = await request.json().catch(() => ({}));

    if (!body.status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    const updated = await SalesDocument.findOneAndUpdate(
      { _id: new Types.ObjectId(id), organizationId: orgObjId, type: "Delivery Challan" },
      { $set: { status: body.status } },
      { new: true },
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Delivery Challan not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: `Delivery Challan status updated to ${body.status}`,
      status: updated.status,
    });
  } catch (error: unknown) {
    console.error("PATCH /api/sales/delivery-challans/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid delivery challan ID" }, { status: 400 });
    }

    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const orgObjId = new Types.ObjectId(orgId);
    const deleted = await SalesDocument.findOneAndDelete({
      _id: new Types.ObjectId(id),
      organizationId: orgObjId,
      type: "Delivery Challan",
    }).lean();

    if (!deleted) {
      return NextResponse.json({ error: "Delivery Challan not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: `Delivery Challan #${deleted.number} deleted successfully`,
    });
  } catch (error: unknown) {
    console.error("DELETE /api/sales/delivery-challans/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
