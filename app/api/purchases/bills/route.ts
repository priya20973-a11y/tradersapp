import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Customer, DocumentSequence, Item, PurchaseBill, Vendor, type PurchaseBillRecord, type PurchaseBillAttachment } from "@/models";
import { calculateBillTotals, calculateDueDate } from "@/lib/bill-utils";

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
  items: unknown[];
  notes: string;
  termsAndConditions: string;
  attachmentsCount: number;
  createdAt: string;
}

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

    let bills: BillDetailRow[] = [];
    let vendors: Array<{ id: string; name: string; email: string; phone: string; gstin: string; state: string }> = [];
    let items: Array<{ id: string; name: string; sku?: string; rate: number; account: string; unit: string }> = [];
    let customers: Array<{ id: string; name: string; companyName: string }> = [];

    if (isDbConnected && organizationId && isValidObjectId(organizationId)) {
      const orgObjId = new Types.ObjectId(organizationId);

      const [vendorsDb, itemsDb, customersDb, billsDb] = await Promise.all([
        Vendor.find({ organizationId: orgObjId }).select("_id name email phone gstin state").sort({ name: 1 }).lean(),
        Item.find({ organizationId: orgObjId, active: true }).select("_id name sku purchasePrice purchaseAccount unit").lean(),
        Customer.find({ organizationId: orgObjId }).select("_id name companyName").sort({ name: 1 }).lean(),
        PurchaseBill.find({ organizationId: orgObjId }).sort({ billDate: -1, createdAt: -1 }).lean(),
      ]);

      vendors = vendorsDb.map((v) => ({
        id: String(v._id),
        name: String(v.name || ""),
        email: String(v.email || ""),
        phone: String(v.phone || ""),
        gstin: String(v.gstin || ""),
        state: String(v.state || ""),
      }));

      items = itemsDb.map((it) => ({
        id: String(it._id),
        name: String(it.name || ""),
        sku: it.sku ? String(it.sku) : undefined,
        rate: Number(it.purchasePrice || 0),
        account: String(it.purchaseAccount || "Cost of Goods Sold"),
        unit: String(it.unit || "unit"),
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
      return respondError("Organization ID is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    // Validate vendor exists or get vendor info
    let vendorObjId: Types.ObjectId;
    let vendorName = "Vendor";
    if (isValidObjectId(vendorId)) {
      vendorObjId = new Types.ObjectId(vendorId);
      const vend = await Vendor.findOne({ _id: vendorObjId, organizationId: orgObjId }).select("name");
      if (vend && vend.name) vendorName = String(vend.name);
    } else {
      vendorObjId = new Types.ObjectId();
      if (payload.vendorName) vendorName = String(payload.vendorName);
    }

    // Allocate or validate bill number
    let billNumber = (customBillNumber || "").trim();
    if (!billNumber) {
      const sequence = await DocumentSequence.findOneAndUpdate(
        { organizationId: orgObjId, modelName: "Purchase Bill" },
        { $inc: { nextNumber: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      const bSeq = sequence?.nextNumber || 1;
      billNumber = `BILL-${String(bSeq).padStart(4, "0")}`;
    } else {
      // Check for duplicate bill number
      const existing = await PurchaseBill.findOne({
        organizationId: orgObjId,
        billNumber: { $regex: new RegExp(`^${billNumber}$`, "i") },
      });
      if (existing) {
        return respondError(`Bill number "${billNumber}" already exists in your organization.`, 409);
      }
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

    // Calculate totals on backend
    const calcOutput = calculateBillTotals({
      items: (items as Array<Record<string, unknown>>).map((it) => ({
        itemId: it.itemId as string | undefined,
        name: (String(it.name || "")).trim() || "Item",
        description: (String(it.description || "")).trim(),
        account: (it.account as string) || "Cost of Goods Sold",
        quantity: Math.max(0, Number(it.quantity) || 1),
        rate: Math.max(0, Number(it.rate) || 0),
        taxRate: Number(it.taxRate) || 0,
        customerId: it.customerId as string | undefined,
        customerName: (it.customerName as string) || "",
        amount: Math.round((Number(it.quantity || 1) * Number(it.rate || 0)) * 100) / 100,
      })),
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

    const billStatus = requestedStatus === "Draft" ? "Draft" : "Pending";

    const newBill = (await PurchaseBill.create({
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
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/purchases/bills error:", error);
    return respondError("Failed to create purchase bill.", 500);
  }
}
