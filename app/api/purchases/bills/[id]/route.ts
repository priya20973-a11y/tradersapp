import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { PurchaseBill, Vendor, VendorPayment, type PurchaseBillAttachment } from "@/models";
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

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return respondError("Invalid bill ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to view bill.", 401);
    }

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") ?? undefined;

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && requestedOrgId && isValidObjectId(requestedOrgId)) {
      organizationId = requestedOrgId;
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    const bill = await PurchaseBill.findOne({
      _id: new Types.ObjectId(id),
      organizationId: orgObjId,
    }).lean();

    if (!bill) {
      return respondError("Bill not found.", 404);
    }

    // Fetch payments applied to this bill
    const payments = await VendorPayment.find({
      organizationId: orgObjId,
      billId: new Types.ObjectId(id),
    })
      .sort({ paymentDate: -1 })
      .lean();

    const total = Number(bill.total || 0);
    const amountPaid = Number(bill.amountPaid || 0);
    const vendorCreditApplied = Number(bill.vendorCreditApplied || 0);
    const balanceDue = Math.max(0, Math.round((total - vendorCreditApplied - amountPaid) * 100) / 100);

    return NextResponse.json({
      bill: {
        id: String(bill._id),
        billNumber: bill.billNumber,
        vendorId: String(bill.vendorId),
        vendorName: bill.vendorName,
        orderNumber: bill.orderNumber || "",
        billDate: bill.billDate ? new Date(bill.billDate).toISOString() : "",
        dueDate: bill.dueDate ? new Date(bill.dueDate).toISOString() : "",
        paymentTerms: bill.paymentTerms || "Due on Receipt",
        accountsPayable: bill.accountsPayable || "Accounts Payable",
        subject: bill.subject || "",
        subTotal: Number(bill.subTotal || 0),
        discount: Number(bill.discount || 0),
        discountType: bill.discountType || "percent",
        discountAmount: Number(bill.discountAmount || 0),
        taxType: bill.taxType || "GST",
        taxRate: Number(bill.taxRate || 0),
        taxAmount: Number(bill.taxAmount || 0),
        cgst: Number(bill.cgst || 0),
        sgst: Number(bill.sgst || 0),
        igst: Number(bill.igst || 0),
        adjustment: Number(bill.adjustment || 0),
        total,
        amountPaid,
        vendorCreditApplied,
        balanceDue,
        status: bill.status,
        creditsApplied: (bill.creditsApplied || []).map((c: { creditId?: unknown; creditNoteNumber?: string; amount?: number; appliedDate?: Date | string; notes?: string }) => ({
          creditId: String(c.creditId),
          creditNoteNumber: c.creditNoteNumber,
          amount: Number(c.amount || 0),
          appliedDate: c.appliedDate ? new Date(c.appliedDate).toISOString() : "",
          notes: c.notes || "",
        })),
        items: (bill.items || []).map((it: { itemId?: unknown; name?: string; description?: string; account?: string; quantity?: number; rate?: number; taxRate?: number; taxAmount?: number; customerId?: unknown; customerName?: string; amount?: number }) => ({
          itemId: it.itemId ? String(it.itemId) : undefined,
          name: it.name,
          description: it.description || "",
          account: it.account || "Cost of Goods Sold",
          quantity: Number(it.quantity || 1),
          rate: Number(it.rate || 0),
          taxRate: Number(it.taxRate || 0),
          taxAmount: Number(it.taxAmount || 0),
          customerId: it.customerId ? String(it.customerId) : undefined,
          customerName: it.customerName || "",
          amount: Number(it.amount || 0),
        })),
        notes: bill.notes || "",
        termsAndConditions: bill.termsAndConditions || "",
        attachments: (bill.attachments || []).map((a: { name?: string; size?: number; type?: string; dataUrl?: string; uploadedAt?: Date | string }) => ({
          name: a.name,
          size: a.size,
          type: a.type,
          dataUrl: a.dataUrl,
          uploadedAt: a.uploadedAt ? new Date(a.uploadedAt).toISOString() : "",
        })),
        payments: payments.map((p) => ({
          id: String(p._id),
          paymentNumber: p.paymentNumber,
          amount: Number(p.amount || 0),
          paymentDate: p.paymentDate ? new Date(p.paymentDate).toISOString() : "",
          paymentMode: p.paymentMode,
          referenceNumber: p.referenceNumber,
          status: p.status,
        })),
        createdAt: bill.createdAt ? new Date(bill.createdAt).toISOString() : "",
        updatedAt: bill.updatedAt ? new Date(bill.updatedAt).toISOString() : "",
      },
    });
  } catch (error) {
    console.error("GET /api/purchases/bills/[id] error:", error);
    return respondError("Failed to fetch bill details.", 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return respondError("Invalid bill ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to edit bill.", 401);
    }

    let payload: BillPayload;
    try {
      payload = (await request.json()) as BillPayload;
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && payload.organizationId && isValidObjectId(payload.organizationId)) {
      organizationId = payload.organizationId;
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    const bill = await PurchaseBill.findOne({
      _id: new Types.ObjectId(id),
      organizationId: orgObjId,
    });

    if (!bill) {
      return respondError("Bill not found.", 404);
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
    } = payload;

    if (vendorId && isValidObjectId(vendorId)) {
      bill.vendorId = new Types.ObjectId(vendorId);
      const vend = await Vendor.findOne({ _id: bill.vendorId, organizationId: orgObjId }).select("name");
      if (vend && vend.name) bill.vendorName = String(vend.name);
    }

    if (customBillNumber && customBillNumber.trim()) {
      const trimmed = customBillNumber.trim();
      if (trimmed !== bill.billNumber) {
        const existing = await PurchaseBill.findOne({
          _id: { $ne: bill._id },
          organizationId: orgObjId,
          billNumber: { $regex: new RegExp(`^${trimmed}$`, "i") },
        });
        if (existing) {
          return respondError(`Bill number "${trimmed}" is already used by another bill.`, 409);
        }
        bill.billNumber = trimmed;
      }
    }

    if (orderNumber !== undefined) bill.orderNumber = orderNumber ? orderNumber.trim() : "";
    if (subject !== undefined) bill.subject = subject ? subject.trim() : "";
    if (paymentTerms !== undefined) bill.paymentTerms = paymentTerms;
    if (accountsPayable !== undefined) bill.accountsPayable = accountsPayable;
    if (notes !== undefined) bill.notes = notes ? notes.trim() : "";
    if (termsAndConditions !== undefined) bill.termsAndConditions = termsAndConditions ? termsAndConditions.trim() : "";

    if (billDate) {
      bill.billDate = new Date(billDate);
    }

    if (customDueDate) {
      bill.dueDate = new Date(customDueDate);
    } else if (bill.billDate && bill.paymentTerms) {
      const calcStr = calculateDueDate(
        bill.billDate.toISOString().split("T")[0],
        bill.paymentTerms,
      );
      if (calcStr) bill.dueDate = new Date(calcStr);
    }

    // If items provided, recalculate totals
    if (Array.isArray(items) && items.length > 0) {
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
        taxType: taxType || (bill.taxType as "GST" | "TDS" | "None") || "GST",
        taxRate: Number(taxRate) || 0,
        adjustment: Number(adjustment) || 0,
      });

      bill.items = calcOutput.items as unknown as typeof bill.items;
      bill.subTotal = calcOutput.subTotal;
      bill.discount = Number(discount) || 0;
      bill.discountType = discountType || "percent";
      bill.discountAmount = calcOutput.discountAmount;
      bill.taxType = taxType || "GST";
      bill.taxRate = Number(taxRate) || 0;
      bill.taxAmount = calcOutput.taxAmount;
      bill.cgst = calcOutput.cgst;
      bill.sgst = calcOutput.sgst;
      bill.igst = calcOutput.igst;
      bill.adjustment = calcOutput.adjustment;
      bill.total = calcOutput.total;

      // Recalculate status based on amountPaid and vendorCreditApplied
      const currentPaid = Number(bill.amountPaid || 0);
      const currentCredit = Number(bill.vendorCreditApplied || 0);
      const remainingDue = Math.max(0, Math.round((bill.total - currentCredit - currentPaid) * 100) / 100);
      if (remainingDue === 0 && bill.total > 0) {
        bill.status = "Paid";
      } else if (currentPaid > 0 || currentCredit > 0) {
        bill.status = "Partially Paid";
      } else if (requestedStatus) {
        bill.status = requestedStatus;
      }
    } else if (requestedStatus) {
      bill.status = requestedStatus;
    }

    // Attachments
    if (Array.isArray(attachments)) {
      if (attachments.length > 5) {
        return respondError("A maximum of 5 attachments is allowed per bill.", 400);
      }
      for (const att of attachments) {
        if (typeof att.size === "number" && att.size > 10 * 1024 * 1024) {
          return respondError(`File "${att.name}" exceeds the maximum allowed size of 10 MB.`, 400);
        }
      }
      bill.attachments = attachments.map((att) => ({
        name: att.name || "attachment",
        size: Number(att.size) || 0,
        type: att.type || "",
        dataUrl: att.dataUrl || "",
        uploadedAt: att.uploadedAt ? new Date(att.uploadedAt) : new Date(),
      }));
    }

    await bill.save();

    return NextResponse.json({
      ok: true,
      bill: {
        id: String(bill._id),
        billNumber: bill.billNumber,
        vendorName: bill.vendorName,
        total: bill.total,
        amountPaid: bill.amountPaid,
        status: bill.status,
      },
    });
  } catch (error) {
    console.error("PUT /api/purchases/bills/[id] error:", error);
    return respondError("Failed to update bill.", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return respondError("Invalid bill ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to delete bill.", 401);
    }

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") ?? undefined;

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && requestedOrgId && isValidObjectId(requestedOrgId)) {
      organizationId = requestedOrgId;
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    const bill = await PurchaseBill.findOne({
      _id: new Types.ObjectId(id),
      organizationId: orgObjId,
    });

    if (!bill) {
      return respondError("Bill not found.", 404);
    }

    if (bill.amountPaid > 0) {
      return respondError(
        `Cannot delete bill "${bill.billNumber}" because ₹${bill.amountPaid} has already been recorded in payments against it. Delete the payments first.`,
        400,
      );
    }

    await PurchaseBill.deleteOne({ _id: bill._id });

    return NextResponse.json({
      ok: true,
      message: `Bill ${bill.billNumber} deleted successfully.`,
    });
  } catch (error) {
    console.error("DELETE /api/purchases/bills/[id] error:", error);
    return respondError("Failed to delete bill.", 500);
  }
}
