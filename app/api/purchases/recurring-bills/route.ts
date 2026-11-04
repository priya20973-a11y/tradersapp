import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Customer, Item, Organization, RecurringBill, Vendor } from "@/models";
import { calculateBillTotals, formatDateOnly } from "@/lib/bill-utils";
import {
  readRecurringBillRequestMetadata,
  recurringBillSchema,
} from "@/lib/recurring-bill-utils";

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
      return respondError("Sign in to view recurring bills.", 401);
    }

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && requestedOrgId && isValidObjectId(requestedOrgId)) {
      organizationId = requestedOrgId;
    }

    await connectToDatabase();

    if (!organizationId || !isValidObjectId(organizationId)) {
      const defaultOrg = await Organization.findOne({ status: "active" }).select("_id").lean();
      if (defaultOrg) {
        organizationId = String(defaultOrg._id);
      }
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }
    const orgObjId = new Types.ObjectId(organizationId);

    const [vendorsDb, itemsDb, customersDb, profilesDb] = await Promise.all([
      Vendor.find({ organizationId: orgObjId }).select("_id name email phone gstin state").sort({ name: 1 }).lean(),
      Item.find({ organizationId: orgObjId, active: true }).select("_id name sku purchasePrice purchaseAccount unit").lean(),
      Customer.find({ organizationId: orgObjId }).select("_id name companyName").sort({ name: 1 }).lean(),
      RecurringBill.find({ organizationId: orgObjId }).sort({ createdAt: -1 }).lean(),
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

    const customers = customersDb.map((c) => ({
      id: String(c._id),
      name: c.name,
      companyName: c.companyName || "",
    }));

    const profiles = profilesDb.map((p) => ({
      id: String(p._id),
      _id: String(p._id),
      profileName: p.profileName,
      vendorId: String(p.vendorId),
      vendorName: p.vendorName,
      repeatEvery: p.repeatEvery,
      startDate: p.startDate ? formatDateOnly(new Date(p.startDate)) : "",
      endsOn: p.endsOn ? formatDateOnly(new Date(p.endsOn)) : "",
      neverExpires: Boolean(p.neverExpires),
      nextBillDate: p.nextBillDate ? formatDateOnly(new Date(p.nextBillDate)) : "",
      lastGeneratedDate: p.lastGeneratedDate ? new Date(p.lastGeneratedDate).toISOString() : null,
      billsGeneratedCount: p.billsGeneratedCount || 0,
      paymentTerms: p.paymentTerms || "Due on Receipt",
      accountsPayable: p.accountsPayable || "Accounts Payable",
      items: p.items || [],
      subTotal: Number(p.subTotal || 0),
      discount: Number(p.discount || 0),
      discountType: p.discountType || "percent",
      discountAmount: Number(p.discountAmount || 0),
      taxType: p.taxType || "GST",
      taxRate: Number(p.taxRate || 0),
      taxAmount: Number(p.taxAmount || 0),
      cgst: Number(p.cgst || 0),
      sgst: Number(p.sgst || 0),
      igst: Number(p.igst || 0),
      adjustment: Number(p.adjustment || 0),
      total: Number(p.total || 0),
      currency: p.currency || "INR",
      notes: p.notes || "",
      termsAndConditions: p.termsAndConditions || "",
      status: p.status || "Active",
      generatedBillsCount: Array.isArray(p.generatedBills) ? p.generatedBills.length : 0,
      lastBill: Array.isArray(p.generatedBills) && p.generatedBills.length > 0 ? p.generatedBills[0] : null,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : "",
    }));

    // Calculate metrics
    const statusCounts = {
      total: profiles.length,
      active: profiles.filter((p) => p.status === "Active").length,
      paused: profiles.filter((p) => p.status === "Paused").length,
      expired: profiles.filter((p) => p.status === "Expired").length,
    };

    const todayStr = formatDateOnly(new Date());
    const dueCount = profiles.filter((p) => p.status === "Active" && p.nextBillDate && p.nextBillDate <= todayStr).length;

    // Monthly commitment estimation for active profiles
    const monthlyCommitment = profiles
      .filter((p) => p.status === "Active")
      .reduce((sum, p) => {
        const amt = Number(p.total || 0);
        switch (p.repeatEvery) {
          case "Week":
            return sum + amt * 4.33;
          case "2 Weeks":
            return sum + amt * 2.16;
          case "Month":
            return sum + amt;
          case "2 Months":
            return sum + amt / 2;
          case "3 Months":
            return sum + amt / 3;
          case "6 Months":
            return sum + amt / 6;
          case "Year":
            return sum + amt / 12;
          default:
            return sum + amt;
        }
      }, 0);

    // Apply filtering
    let filtered = profiles;
    if (vendorId && vendorId !== "all") {
      filtered = filtered.filter((p) => p.vendorId === vendorId);
    }

    if (statusFilter && statusFilter.toLowerCase() !== "all") {
      filtered = filtered.filter((p) => p.status.toLowerCase() === statusFilter.toLowerCase());
    }

    if (search) {
      filtered = filtered.filter(
        (p) =>
          p.profileName.toLowerCase().includes(search) ||
          p.vendorName.toLowerCase().includes(search) ||
          p.paymentTerms.toLowerCase().includes(search) ||
          p.repeatEvery.toLowerCase().includes(search) ||
          p.notes.toLowerCase().includes(search),
      );
    }

    return NextResponse.json({
      profiles: filtered,
      vendors,
      items,
      customers,
      metrics: {
        totalProfiles: profiles.length,
        statusCounts,
        monthlyCommitment: Math.round(monthlyCommitment * 100) / 100,
        dueCount,
      },
    });
  } catch (error) {
    console.error("GET /api/purchases/recurring-bills error:", error);
    return respondError("Failed to fetch recurring bills.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to create a recurring bill profile.", 401);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    const validation = recurringBillSchema.safeParse(payload);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0]?.message || "Invalid input data.";
      return respondError(firstIssue, 400);
    }

    const data = validation.data;
    const requestMetadata = readRecurringBillRequestMetadata(payload);

    let organizationId = session.user.organizationId;
    if (
      session.user.id === "admin" &&
      requestMetadata.organizationId &&
      isValidObjectId(requestMetadata.organizationId)
    ) {
      organizationId = requestMetadata.organizationId;
    }

    await connectToDatabase();

    if (!organizationId || !isValidObjectId(organizationId)) {
      const defaultOrg = await Organization.findOne({ status: "active" }).select("_id").lean();
      if (defaultOrg) {
        organizationId = String(defaultOrg._id);
      }
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }
    const orgObjId = new Types.ObjectId(organizationId);

    // Validate vendor exists or get vendor details
    let vendorObjId: Types.ObjectId;
    let vendorName = data.vendorName;
    if (isValidObjectId(data.vendorId)) {
      vendorObjId = new Types.ObjectId(data.vendorId);
      const vend = await Vendor.findOne({ _id: vendorObjId, organizationId: orgObjId }).select("name");
      if (vend && vend.name) vendorName = String(vend.name);
    } else {
      vendorObjId = new Types.ObjectId();
    }

    // Determine initial nextBillDate
    const startDateStr = data.startDate;
    const startDateObj = new Date(startDateStr);
    const endsOnObj = data.neverExpires || !data.endsOn ? null : new Date(data.endsOn);

    // Initial nextBillDate starts at startDate (or next cycle if start date has passed)
    const nextBillDateObj = new Date(startDateStr);

    // Authoritative totals calculation
    const calcOutput = calculateBillTotals({
      items: data.items.map((it) => ({
        itemId: it.itemId ? String(it.itemId) : undefined,
        name: it.name.trim(),
        description: it.description?.trim() || "",
        account: it.account || "Cost of Goods Sold",
        quantity: Math.max(0.001, Number(it.quantity) || 1),
        rate: Math.max(0, Number(it.rate) || 0),
        taxRate: Number(it.taxRate) || 0,
        customerId: it.customerId ? String(it.customerId) : undefined,
        customerName: it.customerName || "",
        amount: Math.round(Number(it.quantity || 1) * Number(it.rate || 0) * 100) / 100,
      })),
      discount: Number(data.discount) || 0,
      discountType: data.discountType,
      taxType: data.taxType,
      taxRate: Number(data.taxRate) || 0,
      adjustment: Number(data.adjustment) || 0,
    });

    if (calcOutput.total < 0) {
      return respondError("Recurring bill total cannot be negative.", 400);
    }

    const newProfile = await RecurringBill.create({
      organizationId: orgObjId,
      profileName: data.profileName.trim(),
      vendorId: vendorObjId,
      vendorName,
      repeatEvery: data.repeatEvery,
      startDate: startDateObj,
      endsOn: endsOnObj,
      neverExpires: data.neverExpires,
      nextBillDate: nextBillDateObj,
      paymentTerms: data.paymentTerms || "Due on Receipt",
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
        customerId: it.customerId,
        customerName: it.customerName || "",
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
      currency: "INR",
      notes: data.notes || "",
      termsAndConditions: data.termsAndConditions || "",
      status: data.status || "Active",
      billsGeneratedCount: 0,
      generatedBills: [],
    });

    return NextResponse.json({
      success: true,
      message: "Recurring bill profile created successfully.",
      profile: newProfile,
    });
  } catch (error) {
    console.error("POST /api/purchases/recurring-bills error:", error);
    return respondError("Failed to create recurring bill profile.", 500);
  }
}
