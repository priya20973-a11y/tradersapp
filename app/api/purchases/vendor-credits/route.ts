import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { DocumentSequence, Item, Vendor, VendorCredit } from "@/models";
import { formatDateOnly } from "@/lib/bill-utils";
import { calculateCreditTotals, vendorCreditSchema } from "@/lib/vendor-credit-utils";

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase().trim() ?? "";
    const statusFilter = url.searchParams.get("status") ?? "all";
    const vendorId = url.searchParams.get("vendorId") ?? undefined;
    const requestedOrgId = url.searchParams.get("organizationId") ?? undefined;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to view vendor credits.", 401);
    }

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && requestedOrgId && isValidObjectId(requestedOrgId)) {
      organizationId = requestedOrgId;
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    const [vendorsDb, itemsDb, creditsDb] = await Promise.all([
      Vendor.find({ organizationId: orgObjId }).select("_id name email phone gstin state").sort({ name: 1 }).lean(),
      Item.find({ organizationId: orgObjId, active: true }).select("_id name sku purchasePrice purchaseAccount unit").lean(),
      VendorCredit.find({ organizationId: orgObjId }).sort({ vendorCreditDate: -1, createdAt: -1 }).lean(),
    ]);

    const vendors = vendorsDb.map((v) => ({
      id: String(v._id),
      name: v.name,
      email: v.email || "",
      phone: v.phone || "",
      gstin: v.gstin || "",
      state: v.state || "",
    }));

    const items = itemsDb.map((it) => ({
      id: String(it._id),
      name: it.name,
      sku: it.sku,
      rate: Number(it.purchasePrice || 0),
      account: it.purchaseAccount || "Cost of Goods Sold",
      unit: it.unit || "unit",
    }));

    const credits = creditsDb.map((c) => ({
      id: String(c._id),
      _id: String(c._id),
      creditNoteNumber: c.creditNoteNumber,
      vendorId: String(c.vendorId),
      vendorName: c.vendorName,
      orderNumber: c.orderNumber || "",
      vendorCreditDate: c.vendorCreditDate ? formatDateOnly(new Date(c.vendorCreditDate)) : "",
      subject: c.subject || "",
      accountsPayable: c.accountsPayable || "Accounts Payable",
      items: c.items || [],
      subTotal: Number(c.subTotal || 0),
      discount: Number(c.discount || 0),
      discountType: c.discountType || "percent",
      discountAmount: Number(c.discountAmount || 0),
      taxType: c.taxType || "GST",
      taxRate: Number(c.taxRate || 0),
      taxAmount: Number(c.taxAmount || 0),
      cgst: Number(c.cgst || 0),
      sgst: Number(c.sgst || 0),
      igst: Number(c.igst || 0),
      adjustment: Number(c.adjustment || 0),
      total: Number(c.total || 0),
      balanceRemaining: Number(c.balanceRemaining ?? c.total ?? 0),
      appliedAmount: Number(c.appliedAmount || 0),
      currency: c.currency || "INR",
      notes: c.notes || "",
      status: c.status || "Open",
      attachmentsCount: Array.isArray(c.attachments) ? c.attachments.length : 0,
      billsAppliedCount: Array.isArray(c.billsApplied) ? c.billsApplied.length : 0,
      billsApplied: c.billsApplied || [],
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : "",
    }));

    // Metrics summary
    let totalCreditValue = 0;
    let totalAvailableBalance = 0;
    let totalAppliedAmount = 0;

    const statusCounts = {
      total: credits.length,
      draft: 0,
      open: 0,
      partiallyApplied: 0,
      closed: 0,
    };

    for (const c of credits) {
      totalCreditValue += c.total;
      totalAvailableBalance += c.balanceRemaining;
      totalAppliedAmount += c.appliedAmount;

      const st = c.status.toLowerCase();
      if (st === "draft") statusCounts.draft++;
      else if (st === "open") statusCounts.open++;
      else if (st === "partially applied") statusCounts.partiallyApplied++;
      else if (st === "closed") statusCounts.closed++;
    }

    // Filter
    let filtered = credits;
    if (vendorId && vendorId !== "all") {
      filtered = filtered.filter((c) => c.vendorId === vendorId);
    }

    if (statusFilter && statusFilter.toLowerCase() !== "all") {
      filtered = filtered.filter((c) => c.status.toLowerCase() === statusFilter.toLowerCase());
    }

    if (search) {
      filtered = filtered.filter(
        (c) =>
          c.creditNoteNumber.toLowerCase().includes(search) ||
          c.vendorName.toLowerCase().includes(search) ||
          c.orderNumber.toLowerCase().includes(search) ||
          c.subject.toLowerCase().includes(search) ||
          c.notes.toLowerCase().includes(search),
      );
    }

    return NextResponse.json({
      credits: filtered,
      vendors,
      items,
      metrics: {
        totalCreditValue: Math.round(totalCreditValue * 100) / 100,
        totalAvailableBalance: Math.round(totalAvailableBalance * 100) / 100,
        totalAppliedAmount: Math.round(totalAppliedAmount * 100) / 100,
        statusCounts,
      },
    });
  } catch (error) {
    console.error("GET /api/purchases/vendor-credits error:", error);
    return respondError("Failed to fetch vendor credits.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to create a vendor credit.", 401);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    const validation = vendorCreditSchema.safeParse(payload);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0]?.message || "Invalid input data.";
      return respondError(firstIssue, 400);
    }

    const data = validation.data;
    const rawPayload = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && rawPayload.organizationId && isValidObjectId(rawPayload.organizationId)) {
      organizationId = String(rawPayload.organizationId);
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    // Validate vendor exists or get vendor name
    let vendorObjId: Types.ObjectId;
    let vendorName = data.vendorName;
    if (isValidObjectId(data.vendorId)) {
      vendorObjId = new Types.ObjectId(data.vendorId);
      const vend = await Vendor.findOne({ _id: vendorObjId, organizationId: orgObjId }).select("name");
      if (vend && vend.name) vendorName = String(vend.name);
    } else {
      vendorObjId = new Types.ObjectId();
    }

    // Allocate or validate Credit Note Number
    let creditNoteNumber = (data.creditNoteNumber || "").trim();
    if (!creditNoteNumber) {
      const sequence = await DocumentSequence.findOneAndUpdate(
        { organizationId: orgObjId, modelName: "Vendor Credit" },
        { $inc: { nextNumber: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      const nextSeq = sequence?.nextNumber || 1;
      creditNoteNumber = `VCR-${String(nextSeq).padStart(4, "0")}`;
    } else {
      const existing = await VendorCredit.findOne({
        organizationId: orgObjId,
        creditNoteNumber: { $regex: new RegExp(`^${creditNoteNumber}$`, "i") },
      });
      if (existing) {
        return respondError(`Credit note number "${creditNoteNumber}" already exists in your organization.`, 409);
      }
    }

    // Recalculate totals authoritatively
    const calcOutput = calculateCreditTotals({
      items: data.items.map((it) => ({
        quantity: Math.max(0.001, Number(it.quantity) || 1),
        rate: Math.max(0, Number(it.rate) || 0),
        taxRate: Number(it.taxRate) || 0,
      })),
      discount: Number(data.discount) || 0,
      discountType: data.discountType,
      taxType: data.taxType,
      taxRate: Number(data.taxRate) || 0,
      adjustment: Number(data.adjustment) || 0,
    });

    if (calcOutput.total < 0) {
      return respondError("Vendor credit total cannot be negative.", 400);
    }

    const createdCredit = await VendorCredit.create({
      organizationId: orgObjId,
      creditNoteNumber,
      vendorId: vendorObjId,
      vendorName,
      orderNumber: data.orderNumber || "",
      vendorCreditDate: new Date(data.vendorCreditDate),
      subject: data.subject || "",
      accountsPayable: data.accountsPayable || "Accounts Payable",
      items: data.items.map((it) => ({
        itemId: it.itemId,
        name: it.name.trim(),
        description: it.description?.trim() || "",
        account: it.account || "Cost of Goods Sold",
        quantity: Math.max(0.001, Number(it.quantity) || 1),
        rate: Math.max(0, Number(it.rate) || 0),
        taxRate: Number(it.taxRate) || 0,
        taxAmount: Math.round(((Number(it.quantity || 1) * Number(it.rate || 0) * (Number(it.taxRate) || 0)) / 100) * 100) / 100,
        amount: Math.round(Number(it.quantity || 1) * Number(it.rate || 0) * 100) / 100,
      })),
      subTotal: calcOutput.subTotal,
      discount: data.discount,
      discountType: data.discountType,
      discountAmount: calcOutput.discountAmount,
      taxType: data.taxType,
      taxRate: data.taxRate,
      taxAmount: calcOutput.taxAmount,
      cgst: calcOutput.cgst,
      sgst: calcOutput.sgst,
      igst: calcOutput.igst,
      adjustment: data.adjustment,
      total: calcOutput.total,
      balanceRemaining: calcOutput.total,
      appliedAmount: 0,
      currency: "INR",
      notes: data.notes || "",
      status: data.status || "Open",
      attachments: data.attachments || [],
      billsApplied: [],
    });

    return NextResponse.json({
      success: true,
      message: `Vendor credit ${creditNoteNumber} created successfully.`,
      credit: createdCredit,
    });
  } catch (error) {
    console.error("POST /api/purchases/vendor-credits error:", error);
    return respondError("Failed to create vendor credit.", 500);
  }
}
