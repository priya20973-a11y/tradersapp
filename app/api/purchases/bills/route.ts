import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Customer, DocumentSequence, Item, Organization, PurchaseBill, Vendor, type PurchaseBillRecord, type PurchaseBillAttachment } from "@/models";
import { calculateBillTotals, calculateDueDate } from "@/lib/bill-utils";
import { recordPurchaseInward } from "@/lib/inventory-service";
import { StockLocation, Warehouse } from "@/models";
import { escapeRegex } from "@/lib/bill-numbering";

interface BillPayload {
  organizationId?: string;
  vendorId?: string;
  vendorName?: string;
  billNumber?: string;
  orderNumber?: string;
  billDate?: string | Date;
  dueDate?: string | Date;
  paymentTerms?: string;
  accountsPayable?: string;
  subject?: string;
  items?: Array<Record<string, unknown>>;
  discount?: number | string;
  discountType?: "percent" | "amount";
  taxType?: "GST" | "TDS" | "None";
  taxRate?: number | string;
  adjustment?: number | string;
  notes?: string;
  termsAndConditions?: string;
  attachments?: PurchaseBillAttachment[];
  stockLocationType?: "Warehouse" | "Shop";
  stockLocationId?: string;
  stockLocationName?: string;
  status?: "Draft" | "Pending" | "Partially Paid" | "Paid" | "Void";
}

interface BillDetailRow {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  orderNumber: string;
  billDate: string;
  dueDate: string;
  paymentTerms: string;
  accountsPayable: string;
  subject: string;
  subTotal: number;
  discount: number;
  discountType: "percent" | "amount";
  discountAmount: number;
  taxType: "GST" | "TDS" | "None";
  taxRate: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  adjustment: number;
  total: number;
  amountPaid: number;
  vendorCreditApplied: number;
  creditsApplied: unknown[];
  balanceDue: number;
  status: "Draft" | "Pending" | "Partially Paid" | "Paid" | "Void";
  stockLocationType?: string;
  stockLocationId?: string;
  stockLocationName?: string;
  items: unknown[];
  notes: string;
  termsAndConditions: string;
  attachmentsCount: number;
  createdAt: string;
}

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function matchesBillSubmission(
  existing: PurchaseBillRecord,
  submitted: {
    vendorId: Types.ObjectId;
    billDate: Date;
    orderNumber: string;
    stockLocationType?: "Warehouse" | "Shop";
    stockLocationId?: Types.ObjectId;
    items: Array<Record<string, unknown>>;
    total: number;
    status: "Draft" | "Pending";
  },
) {
  const normalizeItems = (billItems: Array<Record<string, unknown>> = []) =>
    billItems.map((item) => ({
      itemId: item.itemId ? String(item.itemId) : "",
      name: String(item.name || ""),
      description: String(item.description || ""),
      account: String(item.account || "Cost of Goods Sold"),
      quantity: Number(item.quantity || 0),
      unit: String(item.unit || ""),
      rate: Number(item.rate || 0),
      taxRate: Number(item.taxRate || 0),
      customerId: item.customerId ? String(item.customerId) : "",
      customerName: String(item.customerName || ""),
    }));

  return (
    String(existing.vendorId) === String(submitted.vendorId) &&
    new Date(existing.billDate).getTime() === submitted.billDate.getTime() &&
    String(existing.orderNumber || "") === submitted.orderNumber &&
    existing.stockLocationType === submitted.stockLocationType &&
    String(existing.stockLocationId || "") === String(submitted.stockLocationId || "") &&
    Number(existing.total) === submitted.total &&
    existing.status === submitted.status &&
    JSON.stringify(normalizeItems(existing.items as unknown as Array<Record<string, unknown>>)) ===
      JSON.stringify(normalizeItems(submitted.items))
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") ?? undefined;
    const vendorId = url.searchParams.get("vendorId") ?? undefined;
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const statusFilter = url.searchParams.get("status") ?? "all";
    const startDate = url.searchParams.get("startDate") ?? undefined;
    const endDate = url.searchParams.get("endDate") ?? undefined;
    const unpaidOnly = url.searchParams.get("unpaidOnly") === "true";

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to view bills.", 401);
    }

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && requestedOrgId && isValidObjectId(requestedOrgId)) {
      organizationId = requestedOrgId;
    }

    let isDbConnected = false;
    try {
      await connectToDatabase();
      isDbConnected = true;
    } catch {
      isDbConnected = false;
    }

    if (isDbConnected && (!organizationId || !isValidObjectId(organizationId))) {
      const defaultOrg =
        (await Organization.findOne({ status: "active" }).select("_id").lean().catch(() => null)) ||
        (await Organization.findOne().select("_id").lean().catch(() => null));
      if (defaultOrg) organizationId = String(defaultOrg._id);
    }

    let bills: BillDetailRow[] = [];
    let vendors: Array<{ id: string; name: string; email: string; phone: string; gstin: string; state: string }> = [];
    let items: Array<{ id: string; name: string; sku?: string; rate: number; account: string; unit: string }> = [];
    let customers: Array<{ id: string; name: string; companyName: string }> = [];

    if (isDbConnected && organizationId && isValidObjectId(organizationId)) {
      const orgObjId = new Types.ObjectId(organizationId);

      const [vendorsDbRaw, itemsDb, customersDb, billsDb] = await Promise.all([
        Vendor.find({
          $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
        })
          .select("_id name displayName companyName email phone workPhone gstin state billingAddress")
          .sort({ name: 1 })
          .lean()
          .catch(() => []),
        Item.find({ organizationId: orgObjId, active: true }).select("_id name sku purchasePrice purchaseAccount unit").lean(),
        Customer.find({ organizationId: orgObjId }).select("_id name companyName").sort({ name: 1 }).lean(),
        PurchaseBill.find({ organizationId: orgObjId }).sort({ billDate: -1, createdAt: -1 }).lean(),
      ]);

      let vendorsDb = vendorsDbRaw;
      if (vendorsDb.length === 0) {
        vendorsDb = await Vendor.find()
          .select("_id name displayName companyName email phone workPhone gstin state billingAddress")
          .sort({ name: 1 })
          .limit(100)
          .lean()
          .catch(() => []);
      }

      vendors = vendorsDb.map((v: Record<string, unknown>) => ({
        id: String(v._id),
        name: String(v.displayName || v.name || v.companyName || "Vendor"),
        email: String(v.email || ""),
        phone: String(v.workPhone || v.phone || ""),
        gstin: String(v.gstin || ""),
        state: String(v.state || (v.billingAddress as { state?: string })?.state || ""),
      }));

      let itemsDbList = itemsDb;
      if (itemsDbList.length === 0) {
        itemsDbList = await Item.find({ active: true })
          .select("_id name sku purchasePrice purchaseAccount unit")
          .limit(100)
          .lean()
          .catch(() => []);
      }

      items = itemsDbList.map((it) => ({
        id: String(it._id),
        name: String(it.name || ""),
        sku: it.sku ? String(it.sku) : undefined,
        rate: Number(it.purchasePrice || 0),
        account: String(it.purchaseAccount || "Cost of Goods Sold"),
        unit: String(it.unit || ""),
      }));

      customers = customersDb.map((c) => ({
        id: String(c._id),
        name: String(c.name || ""),
        companyName: String(c.companyName || ""),
      }));

      bills = billsDb.map((b) => {
        const total = Number(b.total || 0);
        const amountPaid = Number(b.amountPaid || 0);
        const vendorCreditApplied = Number(b.vendorCreditApplied || 0);
        const balanceDue = Math.max(0, Math.round((total - vendorCreditApplied - amountPaid) * 100) / 100);
        return {
          id: String(b._id),
          billNumber: String(b.billNumber || ""),
          vendorId: String(b.vendorId || ""),
          vendorName: String(b.vendorName || ""),
          orderNumber: String(b.orderNumber || ""),
          billDate: b.billDate ? new Date(b.billDate).toISOString() : "",
          dueDate: b.dueDate ? new Date(b.dueDate).toISOString() : "",
          paymentTerms: String(b.paymentTerms || "Due on Receipt"),
          accountsPayable: String(b.accountsPayable || "Accounts Payable"),
          subject: String(b.subject || ""),
          subTotal: Number(b.subTotal || 0),
          discount: Number(b.discount || 0),
          discountType: (b.discountType as "percent" | "amount") || "percent",
          discountAmount: Number(b.discountAmount || 0),
          taxType: (b.taxType as "GST" | "TDS" | "None") || "GST",
          taxRate: Number(b.taxRate || 0),
          taxAmount: Number(b.taxAmount || 0),
          cgst: Number(b.cgst || 0),
          sgst: Number(b.sgst || 0),
          igst: Number(b.igst || 0),
          adjustment: Number(b.adjustment || 0),
          total,
          amountPaid,
          vendorCreditApplied,
          creditsApplied: (b.creditsApplied as unknown[]) || [],
          balanceDue,
          status: (b.status as "Draft" | "Pending" | "Partially Paid" | "Paid" | "Void") || "Pending",
          stockLocationType: b.stockLocationType ? String(b.stockLocationType) : "",
          stockLocationId: b.stockLocationId ? String(b.stockLocationId) : "",
          stockLocationName: b.stockLocationName ? String(b.stockLocationName) : "",
          items: (b.items as unknown[]) || [],
          notes: String(b.notes || ""),
          termsAndConditions: String(b.termsAndConditions || ""),
          attachmentsCount: Array.isArray(b.attachments) ? b.attachments.length : 0,
          createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : "",
        };
      });
    }

    // Apply filtering
    let filtered = bills;
    if (vendorId && vendorId !== "all") {
      filtered = filtered.filter((b) => b.vendorId === vendorId);
    }

    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter((b) => b.status.toLowerCase() === statusFilter.toLowerCase());
    }

    if (unpaidOnly) {
      filtered = filtered.filter((b) => b.balanceDue > 0);
    }

    if (search) {
      filtered = filtered.filter(
        (b) =>
          b.billNumber.toLowerCase().includes(search) ||
          b.vendorName.toLowerCase().includes(search) ||
          b.orderNumber.toLowerCase().includes(search) ||
          b.subject.toLowerCase().includes(search) ||
          b.notes.toLowerCase().includes(search),
      );
    }

    if (startDate) {
      const sMs = new Date(startDate).getTime();
      filtered = filtered.filter((b) => new Date(b.billDate).getTime() >= sMs);
    }

    if (endDate) {
      const eMs = new Date(endDate).getTime();
      filtered = filtered.filter((b) => new Date(b.billDate).getTime() <= eMs);
    }

    // Summary calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalAmount = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let totalOverdue = 0;
    let countDue = 0;
    let countOverdue = 0;

    const counts = {
      total: bills.length,
      draft: 0,
      pending: 0,
      partiallyPaid: 0,
      paid: 0,
      overdue: 0,
      void: 0,
    };

    for (const b of bills) {
      totalAmount += b.total;
      totalPaid += b.amountPaid;
      totalDue += b.balanceDue;

      if (b.balanceDue > 0) {
        countDue++;
      }

      const isOverdue = b.dueDate && new Date(b.dueDate) < today && b.balanceDue > 0;
      if (isOverdue) {
        totalOverdue += b.balanceDue;
        countOverdue++;
        counts.overdue++;
      }

      const st = b.status.toLowerCase();
      if (st === "draft") counts.draft++;
      else if (st === "pending") counts.pending++;
      else if (st === "partially paid") counts.partiallyPaid++;
      else if (st === "paid") counts.paid++;
      else if (st === "void") counts.void++;
    }

    return NextResponse.json({
      bills: filtered,
      vendors,
      items,
      customers,
      metrics: {
        totalBills: bills.length,
        totalBillsValue: Math.round(totalAmount * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalDue: Math.round(totalDue * 100) / 100,
        totalOverdue: Math.round(totalOverdue * 100) / 100,
        countDue,
        countOverdue,
        counts,
        statusCounts: counts,
      },
    });
  } catch (error) {
    console.error("GET /api/purchases/bills error:", error);
    return respondError("Failed to fetch purchase bills.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to create a purchase bill.", 401);
    }

    let payload: BillPayload;
    try {
      payload = (await request.json()) as BillPayload;
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    const {
      vendorId,
      billNumber: customBillNumber,
      orderNumber,
      billDate,
      dueDate: customDueDate,
      paymentTerms,
      accountsPayable,
      subject,
      items,
      discount,
      discountType,
      taxType,
      taxRate,
      adjustment,
      notes,
      termsAndConditions,
      attachments,
      stockLocationType,
      stockLocationId,
      stockLocationName,
      status: requestedStatus,
      organizationId: customOrgId,
    } = payload;

    if (!vendorId) {
      return respondError("Please select a vendor.", 400);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return respondError("Please add at least one line item.", 400);
    }

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && customOrgId && isValidObjectId(customOrgId)) {
      organizationId = customOrgId;
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      const defaultOrg =
        (await Organization.findOne({ status: "active" }).select("_id").lean().catch(() => null)) ||
        (await Organization.findOne().select("_id").lean().catch(() => null));
      if (defaultOrg) organizationId = String(defaultOrg._id);
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Organization ID is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    // Validate vendor exists or get vendor info
    let vendorObjId: Types.ObjectId;
    let vendorName = "Vendor";
    if (isValidObjectId(vendorId)) {
      vendorObjId = new Types.ObjectId(vendorId);
      const vend =
        (await Vendor.findOne({
          _id: vendorObjId,
          $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
        })
          .select("name displayName companyName")
          .lean()) ||
        (await Vendor.findById(vendorObjId).select("name displayName companyName").lean());
      if (vend) {
        const vRec = vend as Record<string, unknown>;
        vendorName = String(vRec.displayName || vRec.name || vRec.companyName || "Vendor");
      }
    } else {
      vendorObjId = new Types.ObjectId();
      if (payload.vendorName) vendorName = String(payload.vendorName);
    }

    // Validate bill number
    const billNumber = (customBillNumber || "").trim();
    if (!billNumber) {
      return respondError("Bill number is required.", 400);
    }

    let existingBillCandidate: (PurchaseBillRecord & { _id: Types.ObjectId }) | null = null;
    const existing = await PurchaseBill.findOne({
      $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
      billNumber: { $regex: new RegExp(`^${escapeRegex(billNumber)}$`, "i") },
    });

    if (existing) {
      existingBillCandidate = existing as unknown as PurchaseBillRecord & { _id: Types.ObjectId };
    }

    // Calculate due date
    const finalBillDate = billDate ? new Date(billDate) : new Date();
    let finalDueDate: Date;
    if (customDueDate) {
      finalDueDate = new Date(customDueDate);
    } else {
      const calcStr = calculateDueDate(
        finalBillDate.toISOString().split("T")[0],
        paymentTerms || "Due on Receipt",
      );
      finalDueDate = calcStr ? new Date(calcStr) : finalBillDate;
    }

    // Pre-fetch units from Item master if not supplied in payload
    const submittedItems = items as Array<Record<string, unknown>>;
    const needUnitIds = submittedItems
      .filter((it) => !it.unit && it.itemId && isValidObjectId(String(it.itemId)))
      .map((it) => new Types.ObjectId(String(it.itemId)));
    const itemMasterUnitMap = new Map<string, string>();
    if (typeof Item !== "undefined" && typeof Item.find === "function" && needUnitIds.length > 0) {
      const foundItems = await Item.find({ _id: { $in: needUnitIds } })
        .select("_id unit")
        .lean()
        .catch(() => []);
      for (const fi of foundItems) {
        if (fi.unit) itemMasterUnitMap.set(String(fi._id), String(fi.unit));
      }
    }

    // Calculate totals on backend
    const calcOutput = calculateBillTotals({
      items: submittedItems.map((it) => {
        const resolvedUnit =
          typeof it.unit === "string" && it.unit.trim()
            ? it.unit.trim()
            : it.itemId
              ? itemMasterUnitMap.get(String(it.itemId)) || ""
              : "";
        return {
          itemId: it.itemId as string | undefined,
          name: (String(it.name || "")).trim() || "Item",
          description: (String(it.description || "")).trim(),
          account: (it.account as string) || "Cost of Goods Sold",
          quantity: Math.max(0, Number(it.quantity) || 1),
          unit: resolvedUnit,
          rate: Math.max(0, Number(it.rate) || 0),
          taxRate: Number(it.taxRate) || 0,
          customerId: it.customerId as string | undefined,
          customerName: (it.customerName as string) || "",
          amount: Math.round((Number(it.quantity || 1) * Number(it.rate || 0)) * 100) / 100,
        };
      }),
      discount: Number(discount) || 0,
      discountType: discountType === "amount" ? "amount" : "percent",
      taxType: (taxType as "GST" | "TDS" | "None") || "GST",
      taxRate: Number(taxRate) || 0,
      adjustment: Number(adjustment) || 0,
    });

    if (calcOutput.total < 0) {
      return respondError("Bill total cannot be negative.", 400);
    }

    // Validate attachments (max 5 files, <= 10MB each)
    const validatedAttachments: Array<{ name: string; size: number; type: string; dataUrl: string; uploadedAt: Date }> = [];
    if (Array.isArray(attachments)) {
      if (attachments.length > 5) {
        return respondError("A maximum of 5 attachments is allowed per bill.", 400);
      }
      for (const att of attachments) {
        if (typeof att.size === "number" && att.size > 10 * 1024 * 1024) {
          return respondError(`File "${att.name}" exceeds the maximum allowed size of 10 MB.`, 400);
        }
        validatedAttachments.push({
          name: att.name || "attachment",
          size: Number(att.size) || 0,
          type: att.type || "",
          dataUrl: att.dataUrl || "",
          uploadedAt: att.uploadedAt ? new Date(att.uploadedAt) : new Date(),
        });
      }
    }

    let finalLocationType: "Warehouse" | "Shop" | undefined =
      stockLocationType === "Shop" ? "Shop" : stockLocationType === "Warehouse" ? "Warehouse" : undefined;
    let finalLocationId: Types.ObjectId | undefined =
      stockLocationId && isValidObjectId(stockLocationId) ? new Types.ObjectId(stockLocationId) : undefined;
    let finalLocationName = (stockLocationName || "").trim();

    if (stockLocationType && !finalLocationId) {
      return respondError(`Please select a ${stockLocationType.toLowerCase()}.`, 400);
    }

    if (!finalLocationType || !finalLocationId) {
      // Default fallback if not supplied (for backward compatibility)
      const defaultWh = await Warehouse.findOne({ organizationId: orgObjId, status: "Active" }).select("_id name").lean();
      if (defaultWh) {
        finalLocationType = "Warehouse";
        finalLocationId = new Types.ObjectId(String(defaultWh._id));
        finalLocationName = String(defaultWh.name || "Main Warehouse");
      } else {
        const defaultShop = await StockLocation.findOne({ organizationId: orgObjId, locationType: "Shop" }).select("_id name").lean();
        if (defaultShop) {
          finalLocationType = "Shop";
          finalLocationId = new Types.ObjectId(String(defaultShop._id));
          finalLocationName = String(defaultShop.name || "Main Shop");
        }
      }
    }

    if (finalLocationType === "Warehouse" && finalLocationId) {
      const warehouse = await Warehouse.findOne({
        _id: finalLocationId,
        organizationId: orgObjId,
        status: "Active",
      })
        .select("_id name")
        .lean();
      if (!warehouse) {
        return respondError("Select an active warehouse from your organization.", 400);
      }
      finalLocationName = String(warehouse.name || finalLocationName);
    } else if (finalLocationType === "Shop" && finalLocationId) {
      const shop = await StockLocation.findOne({
        _id: finalLocationId,
        organizationId: orgObjId,
        locationType: "Shop",
        status: "Active",
      })
        .select("_id name")
        .lean();
      if (!shop) {
        return respondError("Select an active shop from your organization.", 400);
      }
      finalLocationName = String(shop.name || finalLocationName);
    }

    const commodityIds = (items as Array<Record<string, unknown>>)
      .map((item) => item.itemId)
      .filter((itemId): itemId is string => typeof itemId === "string" && itemId.length > 0);
    if ((items as Array<Record<string, unknown>>).some((item) => item.itemId && !isValidObjectId(String(item.itemId)))) {
      return respondError("One or more selected commodities are invalid. Re-select them and try again.", 400);
    }
    if (commodityIds.length > 0) {
      const validCommodities = await Item.countDocuments({
        _id: { $in: commodityIds.map((id) => new Types.ObjectId(id)) },
        organizationId: orgObjId,
        active: true,
      });
      if (validCommodities !== new Set(commodityIds).size) {
        return respondError("One or more selected commodities are unavailable in your organization.", 400);
      }
    }

    const billStatus = requestedStatus === "Draft" ? "Draft" : "Pending";

    let newBill: (PurchaseBillRecord & { _id: Types.ObjectId }) | null = null;
    let reusedExistingBill = false;
    if (
      existingBillCandidate &&
      matchesBillSubmission(existingBillCandidate, {
        vendorId: vendorObjId,
        billDate: finalBillDate,
        orderNumber: (orderNumber || "").trim(),
        stockLocationType: finalLocationType,
        stockLocationId: finalLocationId,
        items: calcOutput.items as unknown as Array<Record<string, unknown>>,
        total: calcOutput.total,
        status: billStatus,
      })
    ) {
      newBill = existingBillCandidate;
      reusedExistingBill = true;
    } else if (existingBillCandidate) {
      return respondError(`Bill number "${billNumber}" already exists in your organization.`, 409);
    }

    let createAttempts = 0;
    const maxCreateAttempts = 3;

    while (!newBill && createAttempts < maxCreateAttempts) {
      createAttempts++;
      try {
        newBill = (await PurchaseBill.create({
          organizationId: orgObjId,
          billNumber,
          vendorId: vendorObjId,
          vendorName,
          orderNumber: (orderNumber || "").trim(),
          billDate: finalBillDate,
          dueDate: finalDueDate,
          paymentTerms: paymentTerms || "Due on Receipt",
          accountsPayable: accountsPayable || "Accounts Payable",
          subject: (subject || "").trim(),
          stockLocationType: finalLocationType,
          stockLocationId: finalLocationId,
          stockLocationName: finalLocationName,
          items: calcOutput.items,
          subTotal: calcOutput.subTotal,
          discount: Number(discount) || 0,
          discountType: discountType || "percent",
          discountAmount: calcOutput.discountAmount,
          taxType: taxType || "GST",
          taxRate: Number(taxRate) || 0,
          taxAmount: calcOutput.taxAmount,
          cgst: calcOutput.cgst,
          sgst: calcOutput.sgst,
          igst: calcOutput.igst,
          adjustment: calcOutput.adjustment,
          total: calcOutput.total,
          amountPaid: 0,
          status: billStatus,
          notes: (notes || "").trim(),
          termsAndConditions: (termsAndConditions || "").trim(),
          attachments: validatedAttachments,
          currency: "INR",
        })) as unknown as PurchaseBillRecord & { _id: Types.ObjectId };
        break;
      } catch (createErr: unknown) {
        const isDuplicateKey =
          typeof createErr === "object" &&
          createErr !== null &&
          "code" in createErr &&
          (createErr as { code?: number }).code === 11000;

        if (isDuplicateKey) {
          const racedBill = await PurchaseBill.findOne({
            organizationId: orgObjId,
            billNumber,
          }).lean();
          if (
            racedBill &&
            matchesBillSubmission(racedBill as unknown as PurchaseBillRecord, {
              vendorId: vendorObjId,
              billDate: finalBillDate,
              orderNumber: (orderNumber || "").trim(),
              stockLocationType: finalLocationType,
              stockLocationId: finalLocationId,
              items: calcOutput.items as unknown as Array<Record<string, unknown>>,
              total: calcOutput.total,
              status: billStatus,
            })
          ) {
            newBill = racedBill as unknown as PurchaseBillRecord & { _id: Types.ObjectId };
            reusedExistingBill = true;
            break;
          }
        }

        if (isDuplicateKey) {
          return respondError(`Bill number "${billNumber}" already exists in your organization.`, 409);
        }

        throw createErr;
      }
    }

    if (!newBill) {
      return respondError("Failed to create purchase bill.", 500);
    }

    // Automatically add the purchased commodity quantities to the selected location's stock
    if (finalLocationType && finalLocationId) {
      try {
        const stockResult = await recordPurchaseInward({
          organizationId: orgObjId,
          billId: newBill._id,
          billNumber: newBill.billNumber,
          locationType: finalLocationType,
          locationId: finalLocationId,
          items: calcOutput.items.map((it) => ({
            commodityId: it.itemId ? String(it.itemId) : "",
            quantity: it.quantity,
            unit: it.unit || "",
            rate: it.rate,
            name: it.name,
          })),
          actorId: String(session.user.id),
        });
        if (!stockResult.success) {
          throw new Error(stockResult.error || stockResult.message || "Inventory service did not confirm the stock update.");
        }
      } catch (stockErr) {
        console.error("POST /api/purchases/bills stock update error:", stockErr);
        const message = stockErr instanceof Error ? stockErr.message : "Unknown stock update error.";
        return NextResponse.json(
          {
            error: `Bill ${newBill.billNumber} was created, but warehouse stock could not be updated: ${message}`,
            billId: String(newBill._id),
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        bill: {
          id: String(newBill._id),
          billNumber: newBill.billNumber,
          vendorName: newBill.vendorName,
          total: newBill.total,
          balanceDue: newBill.total,
          status: newBill.status,
          billDate: newBill.billDate ? new Date(newBill.billDate).toISOString() : "",
          dueDate: newBill.dueDate ? new Date(newBill.dueDate).toISOString() : "",
        },
      },
      { status: reusedExistingBill ? 200 : 201 },
    );
  } catch (error) {
    console.error("POST /api/purchases/bills error:", error);
    return respondError("Failed to create purchase bill.", 500);
  }
}
