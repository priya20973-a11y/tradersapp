import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  Customer,
  DeliveryChallanSettings,
  Organization,
  SalesDocument,
  type CustomerRecord,
  type InvoiceItemRecord,
} from "@/models";
import {
  formatDeliveryChallanNumber,
  extractNumberPart,
} from "@/lib/delivery-challan-numbering";

interface DeliveryChallanItemPayload {
  itemId?: string;
  itemName?: string;
  name?: string;
  description?: string;
  unit?: string;
  quantity?: number;
  rate?: number;
}

interface DeliveryChallanAttachmentPayload {
  name?: string;
  size?: number;
  type?: string;
  data?: string;
  url?: string;
}

interface DeliveryChallanPayload {
  customerId?: string;
  customerName?: string;
  customerCompanyName?: string;
  challanType?: string;
  referenceNumber?: string;
  status?: string;
  deliveryChallanDate?: string | number;
  deliveryChallanNumber?: string;
  items?: DeliveryChallanItemPayload[];
  discountType?: "percent" | "amount";
  discount?: number;
  adjustment?: number;
  attachments?: DeliveryChallanAttachmentPayload[];
  customerNotes?: string;
  termsAndConditions?: string;
}

export async function GET(request: Request) {
  try {
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
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim().toLowerCase();
    const statusParam = url.searchParams.get("status")?.trim();
    const customerId = url.searchParams.get("customerId")?.trim();
    const startDate = url.searchParams.get("startDate")?.trim();
    const endDate = url.searchParams.get("endDate")?.trim();

    const query: Record<string, unknown> = {
      organizationId: orgObjId,
      type: "Delivery Challan",
    };

    if (customerId && isValidObjectId(customerId)) {
      query.customerId = new Types.ObjectId(customerId);
    }

    if (statusParam && statusParam.toUpperCase() !== "ALL") {
      const statusMap: Record<string, string> = {
        draft: "Draft",
        open: "Open",
        delivered: "Delivered",
        closed: "Closed",
        void: "Void",
      };
      const mapped = statusMap[statusParam.toLowerCase()] || statusParam;
      query.status = mapped;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          dateFilter.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          dateFilter.$lte = end;
        }
      }
      if (Object.keys(dateFilter).length > 0) {
        query.issueDate = dateFilter;
      }
    }

    const [challanDocsRaw, customersDocsRaw] = await Promise.all([
      SalesDocument.find(query).sort({ issueDate: -1, createdAt: -1 }).lean(),
      Customer.find({ organizationId: orgObjId })
        .select("_id name companyName")
        .sort({ name: 1 })
        .lean(),
    ]);

    const challanDocs = challanDocsRaw;
    const customersDocs = customersDocsRaw;

    let challans = challanDocs.map((doc) => {
      const total = Number(doc.total || 0);

      return {
        id: String(doc._id),
        deliveryChallanNumber: doc.number || "",
        customerId: String(doc.customerId || ""),
        customerName:
          doc.customerSnapshot?.companyName ||
          doc.customerSnapshot?.name ||
          "Unknown Customer",
        referenceNumber: doc.referenceNumber || "",
        challanType: doc.challanType || "Supply on Approval",
        deliveryChallanDate: doc.issueDate ? new Date(doc.issueDate).toISOString() : "",
        status: doc.status || "Draft",
        total,
        subTotal: Number(doc.subTotal || 0),
        discount: Number(doc.discount || 0),
        discountType: doc.discountType || "percent",
        adjustment: Number(doc.adjustment || 0),
        customerNotes: doc.customerNotes || "",
        termsAndConditions: doc.termsAndConditions || "",
        items: (doc.items || []).map((item) => ({
          itemId: item.itemId ? String(item.itemId) : undefined,
          name: item.name || "",
          description: item.description || "",
          quantity: Number(item.quantity || 1),
          rate: Number(item.rate || 0),
          amount: Number(item.amount || 0),
          unit: item.unit || "pcs",
        })),
        attachments: (doc.attachments || []).map((att) => ({
          name: att.name || "",
          size: att.size || 0,
          type: att.type || "",
          data: att.data || "",
          url: att.url || "",
        })),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
      };
    });

    if (search) {
      challans = challans.filter((c) => {
        return (
          c.deliveryChallanNumber.toLowerCase().includes(search) ||
          c.customerName.toLowerCase().includes(search) ||
          c.referenceNumber.toLowerCase().includes(search) ||
          c.challanType.toLowerCase().includes(search)
        );
      });
    }

    // Calculate metrics
    const metrics = {
      totalChallans: challanDocs.length,
      draftCount: challanDocs.filter((d) => d.status === "Draft").length,
      openCount: challanDocs.filter((d) => d.status === "Open").length,
      deliveredCount: challanDocs.filter((d) => d.status === "Delivered").length,
      closedCount: challanDocs.filter((d) => d.status === "Closed").length,
      totalValue: Math.round(challanDocs.reduce((sum: number, d) => sum + Number(d.total || 0), 0) * 100) / 100,
    };

    return NextResponse.json({
      deliveryChallans: challans,
      customers: customersDocs.map((c) => ({
        id: String(c._id),
        name: c.companyName || c.name || "",
      })),
      metrics,
    });
  } catch (error: unknown) {
    console.error("GET /api/sales/delivery-challans error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
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

    // Mandatory validations
    if (!body.customerId) {
      return NextResponse.json({ error: "Customer is required" }, { status: 400 });
    }

    let customerObjId: Types.ObjectId | null = null;
    let customerDoc: CustomerRecord | null = null;

    if (isValidObjectId(body.customerId)) {
      customerObjId = new Types.ObjectId(body.customerId);
      customerDoc = await Customer.findOne({ _id: customerObjId, organizationId: orgObjId }).lean();
    }

    // Customer Snapshot
    const customerSnapshot = {
      name: customerDoc?.name || body.customerName || "Customer",
      companyName: customerDoc?.companyName || body.customerCompanyName || customerDoc?.name || body.customerName || "Customer",
      gstin: customerDoc?.gstin || "",
      pan: customerDoc?.pan || "",
      email: customerDoc?.email || "",
      phone: customerDoc?.phone || customerDoc?.mobile || "",
      billingAddress: customerDoc?.billingAddress || {},
      shippingAddress: customerDoc?.shippingAddress || customerDoc?.billingAddress || {},
    };

    if (!customerObjId) {
      // Find or create customer
      const existing = await Customer.findOne({
        organizationId: orgObjId,
        $or: [
          { name: customerSnapshot.name },
          { companyName: customerSnapshot.companyName },
        ],
      }).lean();

      if (existing) {
        customerObjId = existing._id as Types.ObjectId;
      } else {
        const createdCustomer = await Customer.create({
          organizationId: orgObjId,
          name: customerSnapshot.name,
          companyName: customerSnapshot.companyName,
          email: customerSnapshot.email,
          phone: customerSnapshot.phone,
        });
        customerObjId = createdCustomer._id as Types.ObjectId;
      }
    }

    const challanType = (body.challanType || "Supply on Approval").trim();
    const referenceNumber = (body.referenceNumber || "").trim();
    const status = (body.status || "Draft").trim();

    // Date parsing
    let issueDate = new Date();
    if (body.deliveryChallanDate) {
      const parsedDate = new Date(body.deliveryChallanDate);
      if (!isNaN(parsedDate.getTime())) {
        issueDate = parsedDate;
      }
    }

    // Number generation / validation
    let number = (body.deliveryChallanNumber || "").trim();
    const settings = await DeliveryChallanSettings.findOne({ organizationId: orgObjId }).lean();
    const prefix = settings?.prefix || "DC-";
    const padding = settings?.numberZeroPadding || 5;

    if (!number) {
      const currentNext = settings?.nextNumber || 1;
      number = formatDeliveryChallanNumber(prefix, currentNext, padding);
    }

    // Check duplicate number within organization for Delivery Challan
    const existingChallan = await SalesDocument.findOne({
      organizationId: orgObjId,
      type: "Delivery Challan",
      number,
    }).lean();

    if (existingChallan) {
      return NextResponse.json(
        { error: `Delivery Challan number "${number}" already exists. Please choose a unique number.` },
        { status: 400 },
      );
    }

    // Items validation & calculation
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      return NextResponse.json({ error: "At least one line item is required." }, { status: 400 });
    }

    const items: InvoiceItemRecord[] = rawItems.map((item) => {
      const name = String(item.name || item.itemName || "Item").trim();
      const quantity = Math.max(0, Number(item.quantity) || 1);
      const rate = Math.max(0, Number(item.rate) || 0);
      const amount = Math.round(quantity * rate * 100) / 100;
      let itemIdObj: Types.ObjectId | undefined = undefined;
      if (item.itemId && typeof item.itemId === "string" && isValidObjectId(item.itemId)) {
        itemIdObj = new Types.ObjectId(item.itemId);
      }

      return {
        itemId: itemIdObj,
        name,
        description: String(item.description || "").trim(),
        unit: String(item.unit || "pcs").trim(),
        quantity,
        rate,
        amount,
      };
    });

    const subTotal = items.reduce((sum: number, it) => sum + it.amount, 0);

    // Discount
    const discountType = body.discountType === "amount" ? "amount" : "percent";
    const rawDiscount = Math.max(0, Number(body.discount) || 0);
    let discountAmount = 0;
    if (discountType === "percent") {
      discountAmount = Math.round((subTotal * (rawDiscount / 100)) * 100) / 100;
    } else {
      discountAmount = Math.min(subTotal, rawDiscount);
    }

    // Adjustment
    const adjustment = Number(body.adjustment) || 0;

    // Grand Total
    const total = Math.max(0, Math.round((subTotal - discountAmount + adjustment) * 100) / 100);

    // Attachments
    const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
    const attachments = rawAttachments.slice(0, 5).map((att) => ({
      name: String(att.name || "attachment"),
      size: Number(att.size || 0),
      type: String(att.type || ""),
      data: String(att.data || ""),
      url: String(att.url || ""),
    }));

    // Save document
    const createdDoc = await SalesDocument.create({
      organizationId: orgObjId,
      type: "Delivery Challan",
      number,
      customerId: customerObjId,
      customerSnapshot,
      status,
      issueDate,
      referenceNumber,
      challanType,
      items,
      subTotal: Math.round(subTotal * 100) / 100,
      discount: rawDiscount,
      discountType,
      adjustment: Math.round(adjustment * 100) / 100,
      total,
      customerNotes: (body.customerNotes || "").trim(),
      termsAndConditions: (body.termsAndConditions || "").trim(),
      attachments,
    });

    // Auto-increment sequence if enabled and number matched current prefix
    if (settings?.autoGenerateNumbering !== false) {
      const extracted = extractNumberPart(number, prefix);
      if (extracted !== null) {
        const nextNum = Math.max(extracted + 1, (settings?.nextNumber || 1) + 1);
        await DeliveryChallanSettings.updateOne(
          { organizationId: orgObjId },
          { $set: { nextNumber: nextNum } },
        );
      }
    }

    return NextResponse.json({
      message: "Delivery Challan created successfully",
      id: String(createdDoc._id),
      number: createdDoc.number,
      deliveryChallan: {
        id: String(createdDoc._id),
        deliveryChallanNumber: createdDoc.number,
        customerId: String(createdDoc.customerId),
        customerName: customerSnapshot.companyName,
        referenceNumber: createdDoc.referenceNumber,
        challanType: createdDoc.challanType,
        deliveryChallanDate: createdDoc.issueDate,
        status: createdDoc.status,
        total: createdDoc.total,
        subTotal: createdDoc.subTotal,
        discount: createdDoc.discount,
        adjustment: createdDoc.adjustment,
        customerNotes: createdDoc.customerNotes,
        termsAndConditions: createdDoc.termsAndConditions,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/sales/delivery-challans error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
