import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Vendor, PurchaseBill, VendorPayment, DocumentSequence, Organization, PurchaseOrder, type VendorPaymentRecord } from "@/models";

interface VendorRow {
  id: string;
  name: string;
}

interface BillRow {
  id: string;
  number: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  dueDate?: string;
}

interface PaymentRow {
  id: string;
  number: string;
  vendorId: string;
  vendorName: string;
  billId: string;
  billNumber: string;
  amount: number;
  paymentDate: Date | string;
  paymentMode: string;
  referenceNumber: string;
  notes: string;
  status: string;
}

interface RecordPaymentPayload {
  vendorId?: string;
  vendorName?: string;
  billId?: string;
  amount?: number | string;
  paymentDate?: string;
  paymentMode?: "Cash" | "UPI" | "Cheque" | "Bank Transfer" | "NEFT / RTGS" | "Credit Card";
  referenceNumber?: string;
  notes?: string;
  organizationId?: string;
}

const DEMO_PAYMENTS = [
  {
    id: "demo-vpay-1",
    number: "VPAY-0895",
    vendorId: "demo-vend-1",
    vendorName: "Mohan Traders",
    billId: "demo-bill-1",
    billNumber: "BILL-4421",
    amount: 35000,
    paymentDate: "2026-10-18T16:45:00.000Z",
    paymentMode: "NEFT / RTGS",
    referenceNumber: "HDFCN2629381920",
    notes: "Part payment against lot A",
    status: "Cleared",
  },
  {
    id: "demo-vpay-2",
    number: "VPAY-0891",
    vendorId: "demo-vend-2",
    vendorName: "Shree Packaging Industries",
    billId: "demo-bill-2",
    billNumber: "BILL-4424",
    amount: 15000,
    paymentDate: "2026-10-07T11:30:00.000Z",
    paymentMode: "UPI",
    referenceNumber: "UPI/261007/4412",
    notes: "Advance delivery settlement",
    status: "Cleared",
  },
  {
    id: "demo-vpay-3",
    number: "VPAY-0888",
    vendorId: "demo-vend-3",
    vendorName: "Metro Logistics & Warehousing",
    billId: "",
    billNumber: "On Account",
    amount: 12000,
    paymentDate: "2026-10-02T10:15:00.000Z",
    paymentMode: "Cheque",
    referenceNumber: "CHQ-004412",
    notes: "Freight handling fees",
    status: "In Clearing",
  },
];

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") ?? undefined;
    const vendorId = url.searchParams.get("vendorId") ?? undefined;
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const mode = url.searchParams.get("mode") ?? "";
    const startDate = url.searchParams.get("startDate") ?? undefined;
    const endDate = url.searchParams.get("endDate") ?? undefined;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to view vendor payments.", 401);
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

    if (!organizationId || !isValidObjectId(organizationId)) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) organizationId = String(defaultOrg._id);
    }

    let payments: PaymentRow[] = [];
    let vendors: VendorRow[] = [];
    let bills: BillRow[] = [];

    if (isDbConnected && organizationId && isValidObjectId(organizationId)) {
      const orgObjId = new Types.ObjectId(organizationId);

      const [vendorsDb, paymentsDb, billsDb, posDb] = await Promise.all([
        Vendor.find({
          $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
        })
          .select("_id name displayName companyName email phone openingBalance status")
          .sort({ displayName: 1, name: 1 })
          .lean(),
        VendorPayment.find({
          $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
          ...(vendorId && isValidObjectId(vendorId) ? { vendorId: new Types.ObjectId(vendorId) } : {}),
        })
          .sort({ paymentDate: -1, createdAt: -1 })
          .lean(),
        PurchaseBill.find({
          $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
        })
          .select("_id billNumber orderNumber vendorId vendorName total amountPaid status dueDate")
          .lean(),
        PurchaseOrder.find({
          $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
        })
          .select("purchaseOrderNumber vendorId vendorName vendorDetails total orderDate deliveryDate items paymentTerms")
          .lean(),
      ]);

      vendors = vendorsDb.map((v) => ({
        id: String(v._id),
        name: String(v.displayName || v.name || v.companyName || "Vendor"),
      }));

      const vendorMap = new Map(
        vendorsDb.map((v) => [String(v._id), String(v.displayName || v.name || v.companyName || "Vendor")]),
      );
      const billMap = new Map(billsDb.map((b) => [String(b._id), b.billNumber]));

      bills = billsDb.map((b) => {
        const total = Number(b.total || 0);
        const paid = Number(b.amountPaid || 0);
        const credit = Number(b.vendorCreditApplied || 0);
        const balanceDue = Math.max(0, Math.round((total - credit - paid) * 100) / 100);
        return {
          id: String(b._id),
          number: b.billNumber,
          orderNumber: b.orderNumber || "",
          vendorId: String(b.vendorId),
          vendorName: b.vendorName || vendorMap.get(String(b.vendorId)) || "Vendor",
          total,
          amountPaid: paid,
          balanceDue,
          status: b.status,
          dueDate: b.dueDate ? new Date(b.dueDate).toISOString() : "",
        };
      });

      // Include all vendors from purchase orders
      const existingVendorIds = new Set(vendors.map((v) => v.id));
      const existingVendorNames = new Set(vendors.map((v) => v.name.toLowerCase().trim()));

      for (const po of posDb) {
        if (po.vendorName) {
          const vName = po.vendorName.trim();
          const vId = po.vendorId ? String(po.vendorId) : `po-vend-${encodeURIComponent(vName)}`;
          if (!existingVendorIds.has(vId) && !existingVendorNames.has(vName.toLowerCase())) {
            vendors.push({
              id: vId,
              name: vName,
            });
            existingVendorIds.add(vId);
            existingVendorNames.add(vName.toLowerCase());
            vendorMap.set(vId, vName);
          }
        }
      }

      // Ensure every vendor with a bill is also in the vendors list
      for (const b of bills) {
        if (b.vendorId && !existingVendorIds.has(b.vendorId)) {
          const vName = b.vendorName || vendorMap.get(b.vendorId) || "Vendor";
          vendors.push({
            id: b.vendorId,
            name: vName,
          });
          existingVendorIds.add(b.vendorId);
          existingVendorNames.add(vName.toLowerCase());
        }
      }

      payments = paymentsDb.map((p) => {
        const vId = String(p.vendorId);
        const relatedBillId = p.billId ? String(p.billId) : "";
        return {
          id: String(p._id),
          number: p.paymentNumber || String(p._id).slice(-6),
          vendorId: vId,
          vendorName: p.vendorName || vendorMap.get(vId) || "Vendor",
          billId: relatedBillId,
          billNumber: p.billNumber || (relatedBillId ? billMap.get(relatedBillId) || "BILL-REF" : "On Account"),
          amount: Number(p.amount || 0),
          paymentDate: p.paymentDate || p.createdAt || new Date(),
          paymentMode: p.paymentMode || "Bank Transfer",
          referenceNumber: p.referenceNumber || "",
          notes: p.notes || "",
          status: p.status || "Cleared",
        };
      });
    }

    // Only provide fallback if database is not connected AND no real records were fetched
    if (!isDbConnected && vendors.length === 0 && payments.length === 0 && bills.length === 0) {
      payments = DEMO_PAYMENTS;
      vendors = [
        { id: "demo-vend-1", name: "Mohan Traders" },
        { id: "demo-vend-2", name: "Shree Packaging Industries" },
        { id: "demo-vend-3", name: "Metro Logistics & Warehousing" },
      ];
      bills = [
        {
          id: "demo-bill-1",
          number: "BILL-4421",
          orderNumber: "PO-2026-0041",
          vendorId: "demo-vend-1",
          vendorName: "Mohan Traders",
          total: 68000,
          amountPaid: 35000,
          balanceDue: 33000,
          status: "Partially Paid",
        },
        {
          id: "demo-bill-2",
          number: "BILL-4424",
          orderNumber: "PO-2026-0040",
          vendorId: "demo-vend-2",
          vendorName: "Shree Packaging Industries",
          total: 32000,
          amountPaid: 15000,
          balanceDue: 17000,
          status: "Partially Paid",
        },
      ];
    }

    // Apply filters
    let filtered = payments;
    if (search) {
      filtered = filtered.filter(
        (p) =>
          p.number.toLowerCase().includes(search) ||
          p.vendorName.toLowerCase().includes(search) ||
          p.referenceNumber.toLowerCase().includes(search) ||
          p.billNumber.toLowerCase().includes(search) ||
          p.notes.toLowerCase().includes(search),
      );
    }

    if (mode && mode !== "all") {
      filtered = filtered.filter((p) => p.paymentMode.toLowerCase() === mode.toLowerCase());
    }

    if (startDate) {
      const sMs = new Date(startDate).getTime();
      filtered = filtered.filter((p) => new Date(p.paymentDate).getTime() >= sMs);
    }

    if (endDate) {
      const eMs = new Date(endDate).getTime();
      filtered = filtered.filter((p) => new Date(p.paymentDate).getTime() <= eMs);
    }

    const totalDisbursed = filtered.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthAmount = filtered
      .filter((p) => {
        const d = new Date(p.paymentDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const pendingClearing = filtered
      .filter((p) => p.status === "In Clearing")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return NextResponse.json({
      payments: filtered,
      vendors,
      pendingBills: bills.filter((b) => b.balanceDue > 0),
      metrics: {
        totalDisbursed: Math.round(totalDisbursed * 100) / 100,
        disbursedThisMonth: Math.round(monthAmount * 100) / 100,
        pendingClearing: Math.round(pendingClearing * 100) / 100,
        transactionCount: filtered.length,
      },
    });
  } catch (error) {
    console.error("GET /api/purchases/payments error:", error);
    return respondError("Failed to fetch vendor payments.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to record payment.", 401);
    }

    let payload: RecordPaymentPayload;
    try {
      payload = (await request.json()) as RecordPaymentPayload;
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    const {
      vendorId,
      billId,
      amount,
      paymentDate,
      paymentMode,
      referenceNumber,
      notes,
      organizationId: customOrgId,
    } = payload;

    if (!vendorId) {
      return respondError("Please select a vendor.", 400);
    }

    const payAmount = Math.round((Number(amount) || 0) * 100) / 100;
    if (payAmount <= 0) {
      return respondError("Payment amount must be greater than zero.", 400);
    }

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && customOrgId && isValidObjectId(customOrgId)) {
      organizationId = customOrgId;
    }

    await connectToDatabase();

    if (!organizationId || !isValidObjectId(organizationId)) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) organizationId = String(defaultOrg._id);
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Organization ID is required.", 400);
    }

    const orgObjId = new Types.ObjectId(organizationId);

    // Get vendor name
    let vendorObjId: Types.ObjectId;
    let vendorName = "Vendor";
    if (isValidObjectId(vendorId)) {
      vendorObjId = new Types.ObjectId(vendorId);
      const vend = await Vendor.findOne({
        _id: vendorObjId,
        $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
      }).select("name displayName companyName");
      if (vend) vendorName = String(vend.displayName || vend.name || vend.companyName || "Vendor");
      else if (payload.vendorName) vendorName = String(payload.vendorName);
    } else {
      // Find vendor by name
      const searchName = payload.vendorName || vendorId;
      const escaped = String(searchName).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      const nameRegex = { $regex: new RegExp(`^${escaped}$`, "i") };
      const vend = await Vendor.findOne({
        organizationId: { $in: [orgObjId, String(orgObjId)] },
        $or: [{ name: nameRegex }, { displayName: nameRegex }, { companyName: nameRegex }],
      });
      if (vend) {
        vendorObjId = new Types.ObjectId(String(vend._id));
        vendorName = String(vend.displayName || vend.name || vend.companyName);
      } else {
        vendorObjId = new Types.ObjectId();
        if (payload.vendorName) vendorName = String(payload.vendorName);
      }
    }

    // Verify duplicate payment
    const checkDate = paymentDate ? new Date(paymentDate) : new Date();
    if (referenceNumber && referenceNumber.trim()) {
      const existing = await VendorPayment.findOne({
        organizationId: orgObjId,
        referenceNumber: referenceNumber.trim(),
        amount: payAmount,
      });
      if (existing) {
        return respondError(
          `A payment with reference "${referenceNumber.trim()}" and amount ₹${payAmount} has already been recorded.`,
          409,
        );
      }
    }

    // If linked to a bill, validate remaining balance
    let linkedBill: Awaited<ReturnType<typeof PurchaseBill.findOne>> = null;
    if (billId && isValidObjectId(billId)) {
      linkedBill = await PurchaseBill.findOne({
        _id: new Types.ObjectId(billId),
        organizationId: orgObjId,
      });

      if (!linkedBill) {
        return respondError("The selected purchase bill was not found.", 404);
      }

      const billTotal = Number(linkedBill.total || 0);
      const billPaid = Number(linkedBill.amountPaid || 0);
      const billCredit = Number(linkedBill.vendorCreditApplied || 0);
      const balanceDue = Math.max(0, Math.round((billTotal - billCredit - billPaid) * 100) / 100);

      if (payAmount > balanceDue + 0.05) {
        return respondError(
          `Payment amount (₹${payAmount}) exceeds bill outstanding balance (₹${balanceDue}).`,
          400,
        );
      }
    }

    // Allocate next sequence number
    const sequence = await DocumentSequence.findOneAndUpdate(
      { organizationId: orgObjId, modelName: "Vendor Payment" },
      { $inc: { nextNumber: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const vpaySeq = sequence?.nextNumber || 1;
    const paymentNumber = `VPAY-${String(vpaySeq).padStart(4, "0")}`;

    // Create VendorPayment record
    const paymentDoc = (await VendorPayment.create({
      organizationId: orgObjId,
      paymentNumber,
      vendorId: linkedBill ? linkedBill.vendorId : vendorObjId,
      vendorName: linkedBill ? linkedBill.vendorName : vendorName,
      billId: linkedBill ? linkedBill._id : undefined,
      billNumber: linkedBill ? linkedBill.billNumber : "",
      paymentDate: checkDate,
      amount: payAmount,
      paymentMode: paymentMode || "Bank Transfer",
      referenceNumber: (referenceNumber || "").trim(),
      notes: (notes || "").trim(),
      status: paymentMode === "Cheque" ? "In Clearing" : "Cleared",
      currency: "INR",
    })) as unknown as VendorPaymentRecord & { _id: Types.ObjectId };

    // Update bill if linked
    if (linkedBill) {
      const currentPaid = Number(linkedBill.amountPaid || 0);
      const currentTotal = Number(linkedBill.total || 0);
      const currentCredit = Number(linkedBill.vendorCreditApplied || 0);

      const newPaid = Math.round((currentPaid + payAmount) * 100) / 100;
      const newBalance = Math.max(0, Math.round((currentTotal - currentCredit - newPaid) * 100) / 100);

      linkedBill.amountPaid = newPaid;
      linkedBill.status = newBalance <= 0 ? "Paid" : "Partially Paid";
      await linkedBill.save();

      // If linked to a purchase order, update the PO's paymentStatus
      if (linkedBill.orderNumber) {
        await PurchaseOrder.findOneAndUpdate(
          { organizationId: orgObjId, purchaseOrderNumber: linkedBill.orderNumber },
          { paymentStatus: newBalance <= 0 ? "Paid" : "Partially Paid" },
        ).catch(() => null);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        payment: {
          id: String(paymentDoc._id),
          paymentNumber,
          vendorName,
          amount: payAmount,
          paymentDate: checkDate.toISOString(),
          paymentMode: paymentDoc.paymentMode,
          referenceNumber: paymentDoc.referenceNumber,
          status: paymentDoc.status,
          billNumber: linkedBill ? linkedBill.billNumber : "On Account",
        },
        bill: linkedBill
          ? {
              id: String(linkedBill._id),
              billNumber: linkedBill.billNumber,
              orderNumber: linkedBill.orderNumber || "",
              total: Number(linkedBill.total || 0),
              amountPaid: Number(linkedBill.amountPaid || 0),
              balanceDue: Math.max(
                0,
                Math.round(
                  (Number(linkedBill.total || 0) - Number(linkedBill.amountPaid || 0)) * 100,
                ) / 100,
              ),
              status: linkedBill.status,
            }
          : null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/purchases/payments error:", error);
    return respondError("Failed to record vendor payment.", 500);
  }
}
