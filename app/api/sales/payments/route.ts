import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Customer, DocumentSequence, Organization, SalesDocument } from "@/models";
import {
  databaseUnavailable,
  isDatabaseConnectionError,
  respondError,
} from "../sales-service";

const DEMO_PAYMENTS = [
  {
    id: "demo-pay-1",
    number: "PAY-0048",
    customerId: "demo-cust-1",
    customerName: "Astra Foods Ltd.",
    invoiceId: "demo-inv-2",
    invoiceNumber: "INV-1028",
    amount: 40000,
    paymentDate: "2026-10-19T09:45:00.000Z",
    paymentMode: "UPI",
    referenceNumber: "UPI/261019/9912",
    notes: "Payment received for partial INV-1028",
    status: "Posted",
  },
  {
    id: "demo-pay-2",
    number: "PAY-0042",
    customerId: "demo-cust-1",
    customerName: "Astra Foods Ltd.",
    invoiceId: "demo-inv-1",
    invoiceNumber: "INV-1025",
    amount: 30000,
    paymentDate: "2026-10-06T14:30:00.000Z",
    paymentMode: "Bank Transfer",
    referenceNumber: "HDFCN2628001",
    notes: "RTGS settlement",
    status: "Posted",
  },
  {
    id: "demo-pay-3",
    number: "PAY-0039",
    customerId: "demo-cust-2",
    customerName: "City Retail Supermarket",
    invoiceId: "demo-inv-3",
    invoiceNumber: "INV-1019",
    amount: 17800,
    paymentDate: "2026-10-01T16:20:00.000Z",
    paymentMode: "Cheque",
    referenceNumber: "CHQ-009182",
    notes: "Full settlement for invoice 1019",
    status: "Posted",
  },
];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") ?? undefined;
    const customerId = url.searchParams.get("customerId") ?? undefined;
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const mode = url.searchParams.get("mode") ?? "";
    const startDate = url.searchParams.get("startDate") ?? undefined;
    const endDate = url.searchParams.get("endDate") ?? undefined;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to view payments.", 401);
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
      const defaultOrg =
        (await Organization.findOne({ status: "active" }).select("_id").lean().catch(() => null)) ||
        (await Organization.findOne().select("_id").lean().catch(() => null));
      if (defaultOrg) organizationId = String(defaultOrg._id);
    }

interface CustomerOptionItem {
  id: string;
  name: string;
  companyName?: string;
}

interface PaymentItem {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  paymentDate: string | Date;
  paymentMode: string;
  referenceNumber: string;
  notes: string;
  status: string;
}

interface InvoiceOptionItem {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  dueDate?: string;
}

interface SalesOrderOptionItem {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  orderDate?: string;
}

    let payments: PaymentItem[] = [];
    let customers: CustomerOptionItem[] = [];
    let invoices: InvoiceOptionItem[] = [];
    let salesOrders: SalesOrderOptionItem[] = [];

    if (isDbConnected && organizationId && isValidObjectId(organizationId)) {
      const orgObjId = new Types.ObjectId(organizationId);

      const [customersDb, paymentsDb, invoicesDb, salesOrdersDb] = await Promise.all([
        Customer.find({
          $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
        })
          .select("_id name companyName firstName lastName email phone openingBalance status")
          .sort({ name: 1 })
          .lean(),
        SalesDocument.find({
          $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
          type: "Payment Received",
          ...(customerId && isValidObjectId(customerId) ? { customerId: new Types.ObjectId(customerId) } : {}),
        })
          .sort({ issueDate: -1, createdAt: -1 })
          .lean(),
        SalesDocument.find({
          $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
          type: "Invoice",
          ...(customerId && isValidObjectId(customerId) ? { customerId: new Types.ObjectId(customerId) } : {}),
        })
          .select("_id number customerId total amountPaid creditedAmount status dueDate issueDate")
          .lean(),
        SalesDocument.find({
          $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
          type: "Sales Order",
          ...(customerId && isValidObjectId(customerId) ? { customerId: new Types.ObjectId(customerId) } : {}),
        })
          .select("_id number customerId total amountPaid creditedAmount status dueDate issueDate customerSnapshot")
          .sort({ issueDate: -1, createdAt: -1 })
          .lean(),
      ]);

      customers = customersDb.map((c) => ({
        id: String(c._id),
        name: String(c.name || c.companyName || "Customer"),
        companyName: String(c.companyName || ""),
      }));

      const existingCustomerIds = new Set(customers.map((c) => c.id));
      const existingCustomerNames = new Set(customers.map((c) => c.name.toLowerCase().trim()));
      const customerMap = new Map(
        customersDb.map((c) => [String(c._id), String(c.name || c.companyName || "Customer")]),
      );

      // Ensure every customer from sales orders and invoices is in the customers list
      for (const so of salesOrdersDb) {
        const cId = String(so.customerId);
        const snap = (so as unknown as { customerSnapshot?: { name?: string; companyName?: string } }).customerSnapshot;
        const snapName = snap?.name || snap?.companyName;
        if (!existingCustomerIds.has(cId)) {
          const cName = snapName || customerMap.get(cId) || "Customer";
          customers.push({ id: cId, name: cName, companyName: "" });
          existingCustomerIds.add(cId);
          existingCustomerNames.add(cName.toLowerCase());
          customerMap.set(cId, cName);
        }
      }
      for (const inv of invoicesDb) {
        const cId = String(inv.customerId);
        if (!existingCustomerIds.has(cId)) {
          const cName = customerMap.get(cId) || "Customer";
          customers.push({ id: cId, name: cName, companyName: "" });
          existingCustomerIds.add(cId);
          existingCustomerNames.add(cName.toLowerCase());
          customerMap.set(cId, cName);
        }
      }

      const invoiceMap = new Map(invoicesDb.map((inv) => [String(inv._id), String(inv.number || "") ]));
      const salesOrderMap = new Map(salesOrdersDb.map((so) => [String(so._id), String(so.number || "") ]));

      salesOrders = salesOrdersDb.map((so) => {
        const total = Number(so.total || 0);
        const paid = Number(so.amountPaid || 0);
        const credited = Number(so.creditedAmount || 0);
        const balanceDue = Math.max(0, Math.round((total - paid - credited) * 100) / 100);
        return {
          id: String(so._id),
          number: String(so.number || ""),
          customerId: String(so.customerId),
          customerName: customerMap.get(String(so.customerId)) || (so as unknown as { customerSnapshot?: { name?: string } }).customerSnapshot?.name || "Customer",
          total,
          amountPaid: paid,
          balanceDue,
          status: String(so.status || ""),
          orderDate: so.issueDate ? new Date(so.issueDate).toISOString() : "",
        };
      });

      invoices = invoicesDb.map((inv) => {
        const total = Number(inv.total || 0);
        const paid = Number(inv.amountPaid || 0);
        const credited = Number(inv.creditedAmount || 0);
        const balanceDue = Math.max(0, Math.round((total - paid - credited) * 100) / 100);
        return {
          id: String(inv._id),
          number: String(inv.number || ""),
          customerId: String(inv.customerId),
          customerName: customerMap.get(String(inv.customerId)) || "Unknown",
          total,
          amountPaid: paid,
          balanceDue,
          status: String(inv.status || ""),
          dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : "",
        };
      });

      payments = paymentsDb.map((p) => {
        const custId = String(p.customerId);
        const relatedDocId = p.relatedDocumentId ? String(p.relatedDocumentId) : "";
        const linkedNumber = relatedDocId
          ? invoiceMap.get(relatedDocId) || salesOrderMap.get(relatedDocId) || "REF-DOC"
          : "On Account";
        return {
          id: String(p._id),
          number: String(p.number || p.receiptNumber || String(p._id).slice(-6)),
          customerId: custId,
          customerName: customerMap.get(custId) || "Customer",
          invoiceId: relatedDocId,
          invoiceNumber: linkedNumber,
          amount: Number(p.total || 0),
          paymentDate: p.issueDate || p.createdAt || new Date(),
          paymentMode: String(p.method || "Bank Transfer"),
          referenceNumber: String(p.referenceNumber || ""),
          notes: String(p.notes || ""),
          status: String(p.status || "Posted"),
        };
      });
    }

    // Only provide fallback if database is not connected AND no real records were fetched
    if (
      !isDbConnected &&
      customers.length === 0 &&
      payments.length === 0 &&
      invoices.length === 0 &&
      salesOrders.length === 0
    ) {
      payments = DEMO_PAYMENTS;
      customers = [
        { id: "demo-cust-1", name: "Astra Foods Ltd." },
        { id: "demo-cust-2", name: "City Retail Supermarket" },
        { id: "demo-cust-3", name: "Ganga Stores & Provisions" },
      ];
      invoices = [
        {
          id: "demo-inv-2",
          number: "INV-1028",
          customerId: "demo-cust-1",
          customerName: "Astra Foods Ltd.",
          total: 42500,
          amountPaid: 40000,
          balanceDue: 2500,
          status: "Partly paid",
        },
        {
          id: "demo-inv-4",
          number: "INV-1030",
          customerId: "demo-cust-2",
          customerName: "City Retail Supermarket",
          total: 23900,
          amountPaid: 0,
          balanceDue: 23900,
          status: "Sent",
        },
      ];
      salesOrders = [
        {
          id: "demo-so-1",
          number: "SO-2026-001",
          customerId: "demo-cust-1",
          customerName: "Astra Foods Ltd.",
          total: 85000,
          amountPaid: 45000,
          balanceDue: 40000,
          status: "Confirmed",
          orderDate: "2026-10-15T10:00:00.000Z",
        },
        {
          id: "demo-so-2",
          number: "SO-2026-002",
          customerId: "demo-cust-2",
          customerName: "City Retail Supermarket",
          total: 50000,
          amountPaid: 0,
          balanceDue: 50000,
          status: "Confirmed",
          orderDate: "2026-10-20T11:30:00.000Z",
        },
      ];
    }

    // Apply filters
    let filtered = payments;
    if (search) {
      filtered = filtered.filter(
        (p) =>
          p.number.toLowerCase().includes(search) ||
          p.customerName.toLowerCase().includes(search) ||
          p.referenceNumber.toLowerCase().includes(search) ||
          p.invoiceNumber.toLowerCase().includes(search) ||
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

    // Compute metrics
    const totalAmount = filtered.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthAmount = filtered
      .filter((p) => {
        const d = new Date(p.paymentDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return NextResponse.json({
      payments: filtered,
      customers,
      unpaidInvoices: invoices.filter((inv) => inv.balanceDue > 0),
      salesOrders: salesOrders.filter((so) => so.balanceDue > 0 || !so.status.toLowerCase().includes("cancel")),
      metrics: {
        totalReceived: Math.round(totalAmount * 100) / 100,
        receivedThisMonth: Math.round(monthAmount * 100) / 100,
        transactionCount: filtered.length,
      },
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("GET /api/sales/payments error:", error);
    return respondError("Failed to fetch customer payments.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to record payment.", 401);
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    const {
      customerId,
      invoiceId,
      salesOrderId,
      orderId,
      amount,
      paymentDate,
      paymentMode,
      referenceNumber,
      notes,
      organizationId: customOrgId,
    } = payload;

    if (!customerId) {
      return respondError("Please select a customer.", 400);
    }

    const payAmount = Math.round((Number(amount) || 0) * 100) / 100;
    if (payAmount <= 0) {
      return respondError("Payment amount must be greater than zero.", 400);
    }

    let organizationId: string | undefined = session.user.organizationId;
    if (session.user.id === "admin" && customOrgId && isValidObjectId(String(customOrgId))) {
      organizationId = String(customOrgId);
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

    // Verify customer exists
    let customerObjId: Types.ObjectId;
    let customerName = "Customer";
    if (typeof customerId === "string" && isValidObjectId(customerId)) {
      customerObjId = new Types.ObjectId(customerId);
      const cust = await Customer.findOne({
        _id: customerObjId,
        $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
      }).select("name companyName");
      if (cust) customerName = String(cust.name || cust.companyName || "Customer");
    } else {
      customerObjId = new Types.ObjectId();
    }

    // Verify duplicate payment
    const checkDate = paymentDate ? new Date(String(paymentDate)) : new Date();
    const normalizedReference = typeof referenceNumber === "string" ? referenceNumber.trim() : "";
    if (normalizedReference) {
      const existing = await SalesDocument.findOne({
        $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
        type: "Payment Received",
        referenceNumber: normalizedReference,
        total: payAmount,
      });
      if (existing) {
        return respondError(
          `A payment with reference "${normalizedReference}" and amount ₹${payAmount} has already been recorded.`,
          409,
        );
      }
    }

    // If linked to a sales order or invoice, validate balance and update
    const linkedDocId = (salesOrderId || orderId || invoiceId) as string | undefined;
    let linkedDoc: Awaited<ReturnType<typeof SalesDocument.findOne>> = null;
    if (linkedDocId && isValidObjectId(linkedDocId)) {
      linkedDoc = await SalesDocument.findOne({
        _id: new Types.ObjectId(linkedDocId),
        $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
        type: { $in: ["Invoice", "Sales Order"] },
      });

      if (!linkedDoc) {
        return respondError("The selected document was not found.", 404);
      }

      const docTotal = Number(linkedDoc.total || 0);
      const docPaid = Number(linkedDoc.amountPaid || 0);
      const docCredited = Number(linkedDoc.creditedAmount || 0);
      const balanceDue = Math.max(0, Math.round((docTotal - docPaid - docCredited) * 100) / 100);

      if (payAmount > balanceDue + 0.05) {
        const docLabel = linkedDoc.type === "Sales Order" ? "sales order" : "invoice";
        return respondError(
          `Payment amount (₹${payAmount}) exceeds ${docLabel} outstanding balance (₹${balanceDue}).`,
          400,
        );
      }
    }

    // Allocate next receipt number
    const sequence = await DocumentSequence.findOneAndUpdate(
      { organizationId: orgObjId, modelName: "Payment Received" },
      { $inc: { nextNumber: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const receiptSeq = sequence?.nextNumber || 1;
    const paymentNumber = `PAY-${String(receiptSeq).padStart(4, "0")}`;

    // Create Payment Received document
    const paymentDoc = await SalesDocument.create({
      organizationId: orgObjId,
      type: "Payment Received",
      number: paymentNumber,
      receiptNumber: paymentNumber,
      customerId: linkedDoc ? linkedDoc.customerId : customerObjId,
      relatedDocumentId: linkedDoc ? linkedDoc._id : undefined,
      status: "Posted",
      issueDate: checkDate,
      paymentDate: checkDate,
      total: payAmount,
      method: typeof paymentMode === "string" && ["Cash", "Bank", "UPI", "Cheque"].includes(paymentMode as "Cash" | "Bank" | "UPI" | "Cheque") ? paymentMode as "Cash" | "Bank" | "UPI" | "Cheque" : "Bank",
      referenceNumber: String(referenceNumber ?? "").trim(),
      notes: String(notes ?? "").trim(),
      currency: "INR",
    });

    // Update document if linked
    if (linkedDoc) {
      const currentPaid = Number(linkedDoc.amountPaid || 0);
      const currentTotal = Number(linkedDoc.total || 0);
      const currentCredited = Number(linkedDoc.creditedAmount || 0);

      const newPaid = Math.round((currentPaid + payAmount) * 100) / 100;
      const newBalance = Math.max(0, Math.round((currentTotal - newPaid - currentCredited) * 100) / 100);

      linkedDoc.amountPaid = newPaid;
      if (linkedDoc.type === "Invoice") {
        linkedDoc.status = newBalance === 0 ? "Paid" : "Partly paid";
      }
      await linkedDoc.save();
    }

    return NextResponse.json(
      {
        ok: true,
        payment: {
          id: String(paymentDoc._id),
          number: paymentNumber,
          customerName,
          amount: payAmount,
          paymentDate: checkDate.toISOString(),
          paymentMode: paymentDoc.method,
          referenceNumber: paymentDoc.referenceNumber,
          status: paymentDoc.status,
          invoiceNumber: linkedDoc ? linkedDoc.number : "On Account",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("POST /api/sales/payments error:", error);
    return respondError("Failed to record customer payment.", 500);
  }
}
