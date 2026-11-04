import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  Customer,
  Expense,
  Item,
  Payment,
  PurchaseBill,
  PurchaseOrder,
  SalesDocument,
  StockLot,
  Vendor,
  VendorPayment,
  Warehouse,
} from "@/models";
import type { ReportModuleId } from "@/lib/custom-reports/modules";

interface CustomReportDataPayload {
  organizationId?: string;
  module?: ReportModuleId;
  filters?: {
    status?: string;
    partyId?: string;
    startDate?: string;
    endDate?: string;
    dateField?: string;
    minAmount?: number | string;
    maxAmount?: number | string;
    searchTerm?: string;
  };
  sort?: {
    field?: string;
    direction?: "asc" | "desc";
  };
  limit?: number;
}

type ReportRow = Record<string, unknown>;
type QueryFilter = Record<string, unknown>;

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to access custom reports.", 401);
    }

    let payload: CustomReportDataPayload = {};
    try {
      payload = (await request.json()) as CustomReportDataPayload;
    } catch {
      payload = {};
    }

    const requestedOrgId = payload.organizationId;
    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && requestedOrgId && isValidObjectId(requestedOrgId)) {
      organizationId = requestedOrgId;
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    const reportModule: ReportModuleId = payload.module || "Sales";
    const filters = payload.filters || {};
    const sortField = payload.sort?.field || "createdAt";
    const sortDirection = payload.sort?.direction === "asc" ? 1 : -1;
    const limit = Number(payload.limit) || 2000; // high limit for export

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    // Pre-fetch party lookups for customer and vendor names
    const [customerMap, vendorMap, warehouseMap] = await Promise.all([
      Customer.find({ organizationId: orgObjId }).select("_id name email phone").lean(),
      Vendor.find({ organizationId: orgObjId }).select("_id name email phone").lean(),
      Warehouse.find({ organizationId: orgObjId }).select("_id name code").lean(),
    ]);

    const customersById = new Map(
      (customerMap as unknown as Array<{ _id: Types.ObjectId; name?: string; email?: string; phone?: string }>).map((c) => [
        String(c._id),
        c,
      ]),
    );
    const vendorsById = new Map(
      (vendorMap as unknown as Array<{ _id: Types.ObjectId; name?: string; email?: string; phone?: string }>).map((v) => [
        String(v._id),
        v,
      ]),
    );
    const warehousesById = new Map(
      (warehouseMap as unknown as Array<{ _id: Types.ObjectId; name?: string; code?: string }>).map((w) => [
        String(w._id),
        w.name || w.code || "",
      ]),
    );

    let rawRows: ReportRow[] = [];

    // Module 1: Sales (Sales Orders and Invoices)
    if (reportModule === "Sales") {
      const query: QueryFilter = {
        organizationId: orgObjId,
        type: { $in: ["Sales Order", "Invoice"] },
      };
      if (filters.status && filters.status !== "all") query.status = filters.status;
      if (filters.partyId) query.customerId = new Types.ObjectId(filters.partyId);

      const docs = await SalesDocument.find(query).sort({ createdAt: -1 }).limit(limit).lean();
      rawRows = (docs as unknown as ReportRow[]).map((d) => {
        const cust = d.customerId ? customersById.get(String(d.customerId)) : null;
        return {
          id: String(d._id),
          number: d.number || "—",
          issueDate: d.issueDate || d.createdAt,
          customerName: cust?.name || d.customerName || "Walk-in Customer",
          customerEmail: cust?.email || "",
          customerPhone: cust?.phone || "",
          status: d.status || "Draft",
          subTotal: Number(d.subTotal || d.total || 0),
          discount: Number(d.discount || 0),
          taxAmount: Number(d.taxAmount || 0),
          total: Number(d.total || 0),
          dueDate: d.dueDate || d.expiryDate || null,
          referenceNumber: d.referenceNumber || "",
          salesperson: d.salesperson || "",
          itemsCount: Array.isArray(d.items) ? d.items.length : 0,
          createdAt: d.createdAt,
        };
      });
    }

    // Module 2: Quotes
    else if (reportModule === "Quotes") {
      const query: QueryFilter = {
        organizationId: orgObjId,
        type: "Quote",
      };
      if (filters.status && filters.status !== "all") query.status = filters.status;
      if (filters.partyId) query.customerId = new Types.ObjectId(filters.partyId);

      const docs = await SalesDocument.find(query).sort({ createdAt: -1 }).limit(limit).lean();
      rawRows = (docs as unknown as ReportRow[]).map((d) => {
        const cust = d.customerId ? customersById.get(String(d.customerId)) : null;
        return {
          id: String(d._id),
          number: d.number || "—",
          issueDate: d.issueDate || d.createdAt,
          expiryDate: d.expiryDate || null,
          customerName: cust?.name || d.customerName || "Customer",
          status: d.status || "Draft",
          subTotal: Number(d.subTotal || d.total || 0),
          discount: Number(d.discount || 0),
          taxAmount: Number(d.taxAmount || 0),
          total: Number(d.total || 0),
          referenceNumber: d.referenceNumber || "",
          subject: d.subject || "",
          createdAt: d.createdAt,
        };
      });
    }

    // Module 3: Purchase Orders
    else if (reportModule === "Purchase") {
      const query: QueryFilter = { organizationId: orgObjId };
      if (filters.status && filters.status !== "all") query.status = filters.status;
      if (filters.partyId) query.vendorId = new Types.ObjectId(filters.partyId);

      const pos = await PurchaseOrder.find(query).sort({ createdAt: -1 }).limit(limit).lean();
      rawRows = (pos as unknown as ReportRow[]).map((p) => ({
        id: String(p._id),
        poNumber: p.poNumber || "—",
        orderDate: p.orderDate || p.createdAt,
        vendorName: p.vendorName || "Vendor",
        status: p.status || "Draft",
        expectedDeliveryDate: p.expectedDeliveryDate || null,
        paymentTerms: p.paymentTerms || "Due on Receipt",
        subTotal: Number(p.subTotal || p.total || 0),
        taxAmount: Number(p.taxAmount || 0),
        total: Number(p.total || 0),
        referenceNumber: p.referenceNumber || "",
        createdAt: p.createdAt,
      }));
    }

    // Module 4: Bills (Purchase Bills)
    else if (reportModule === "Bills") {
      const query: QueryFilter = { organizationId: orgObjId };
      if (filters.status && filters.status !== "all") query.status = filters.status;
      if (filters.partyId) query.vendorId = new Types.ObjectId(filters.partyId);

      const bills = await PurchaseBill.find(query).sort({ createdAt: -1 }).limit(limit).lean();
      rawRows = (bills as unknown as ReportRow[]).map((b) => ({
        id: String(b._id),
        billNumber: b.billNumber || "—",
        billDate: b.billDate || b.createdAt,
        dueDate: b.dueDate || null,
        vendorName: b.vendorName || "Vendor",
        status: b.status || "Open",
        subTotal: Number(b.subTotal || b.total || 0),
        discountAmount: Number(b.discountAmount || 0),
        taxAmount: Number(b.taxAmount || 0),
        total: Number(b.total || 0),
        amountPaid: Number(b.amountPaid || 0),
        balanceDue: Number(b.balanceDue || 0),
        orderNumber: b.orderNumber || "",
        paymentTerms: b.paymentTerms || "",
        createdAt: b.createdAt,
      }));
    }

    // Module 5: Operating Expenses
    else if (reportModule === "Expenses") {
      const query: QueryFilter = { organizationId: orgObjId };
      if (filters.status && filters.status !== "all") query.status = filters.status;

      const expenses = await Expense.find(query).sort({ date: -1 }).limit(limit).lean();
      rawRows = (expenses as unknown as ReportRow[]).map((e) => ({
        id: String(e._id),
        expenseNumber: e.expenseNumber || `EXP-${String(e._id).slice(-6).toUpperCase()}`,
        date: e.date || e.createdAt,
        category: e.category || "General",
        vendorName: e.vendor || e.merchant || e.vendorName || "Direct Vendor",
        amount: Number(e.amount || 0),
        taxAmount: Number(e.taxAmount || 0),
        paymentMethod: e.paymentMethod || "Bank Transfer",
        paidThrough: e.paidThrough || "Primary Bank",
        status: e.status || "Paid",
        referenceNumber: e.reference || e.referenceNumber || "",
        notes: e.notes || e.description || "",
        createdAt: e.createdAt,
      }));
    }

    // Module 6: Payments (Both Customer receipts & Vendor settlements)
    else if (reportModule === "Payments") {
      const [custPayments, vendPayments] = await Promise.all([
        Payment.find({ organizationId: orgObjId }).sort({ paymentDate: -1 }).limit(limit).lean(),
        VendorPayment.find({ organizationId: orgObjId }).sort({ paymentDate: -1 }).limit(limit).lean(),
      ]);

      const mappedCust = (custPayments as unknown as ReportRow[]).map((p) => ({
        id: String(p._id),
        paymentNumber: p.paymentNumber || p.reference || `REC-${String(p._id).slice(-6).toUpperCase()}`,
        date: p.paymentDate || p.createdAt,
        partyType: "Received (Customer)",
        partyName: p.customerName || (p.customerId ? customersById.get(String(p.customerId))?.name : "Customer"),
        amount: Number(p.amount || 0),
        paymentMode: p.paymentMode || "Bank Transfer",
        reference: p.reference || "",
        bankAccount: p.bankAccount || "Settlement Account",
        notes: p.notes || "",
        createdAt: p.createdAt,
      }));

      const mappedVend = (vendPayments as unknown as ReportRow[]).map((p) => ({
        id: String(p._id),
        paymentNumber: p.paymentNumber || `PAY-${String(p._id).slice(-6).toUpperCase()}`,
        date: p.paymentDate || p.createdAt,
        partyType: "Paid (Vendor)",
        partyName: p.vendorName || (p.vendorId ? vendorsById.get(String(p.vendorId))?.name : "Vendor"),
        amount: Number(p.amount || 0),
        paymentMode: p.paymentMode || "NEFT",
        reference: p.reference || "",
        bankAccount: p.paidFromAccount || "Primary Account",
        notes: p.notes || "",
        createdAt: p.createdAt,
      }));

      rawRows = [...mappedCust, ...mappedVend];
    }

    // Module 7: Customers
    else if (reportModule === "Customers") {
      const query: QueryFilter = { organizationId: orgObjId };
      const customers = await Customer.find(query).sort({ name: 1 }).limit(limit).lean();
      rawRows = (customers as unknown as ReportRow[]).map((c) => ({
        id: String(c._id),
        name: c.name || "—",
        companyName: c.companyName || c.tradeName || "",
        email: c.email || "",
        phone: c.phone || c.mobile || "",
        gstin: c.gstin || "",
        pan: c.pan || "",
        city: (c.billingAddress as Record<string, unknown> | undefined)?.city || c.city || "",
        state: (c.billingAddress as Record<string, unknown> | undefined)?.state || c.state || "",
        outstanding: Number(c.outstanding || c.openingBalance || 0),
        createdAt: c.createdAt,
      }));
    }

    // Module 8: Vendors
    else if (reportModule === "Vendors") {
      const query: QueryFilter = { organizationId: orgObjId };
      const vendors = await Vendor.find(query).sort({ name: 1 }).limit(limit).lean();
      rawRows = (vendors as unknown as ReportRow[]).map((v) => ({
        id: String(v._id),
        name: v.name || "—",
        companyName: v.companyName || v.tradeName || "",
        email: v.email || "",
        phone: v.phone || "",
        gstin: v.gstin || "",
        pan: v.pan || "",
        city: (v.address as Record<string, unknown> | undefined)?.city || v.city || "",
        state: (v.address as Record<string, unknown> | undefined)?.state || v.state || "",
        paymentTerms: v.paymentTerms || "Due on Receipt",
        tds: v.tds || "No TDS",
        createdAt: v.createdAt,
      }));
    }

    // Module 9: Items
    else if (reportModule === "Items") {
      const query: QueryFilter = { organizationId: orgObjId };
      const items = await Item.find(query).sort({ name: 1 }).limit(limit).lean();
      rawRows = (items as unknown as ReportRow[]).map((i) => ({
        id: String(i._id),
        name: i.name || "—",
        sku: i.sku || "",
        unit: i.unit || "kg",
        salesPrice: Number(i.salesPrice || 0),
        purchasePrice: Number(i.purchasePrice || 0),
        taxRate: Number(i.taxRate || 0),
        hsnCode: i.hsnCode || "",
        description: i.salesDescription || i.description || "",
        createdAt: i.createdAt,
      }));
    }

    // Module 10: Inventory
    else if (reportModule === "Inventory") {
      const query: QueryFilter = { organizationId: orgObjId };
      if (filters.status && filters.status !== "all") query.status = filters.status;

      const lots = await StockLot.find(query).sort({ createdAt: -1 }).limit(limit).lean();
      rawRows = (lots as unknown as ReportRow[]).map((l) => ({
        id: String(l._id),
        lotNumber: l.lotNumber || "—",
        commodityName: l.commodityName || "Commodity",
        warehouse: l.warehouseId ? warehousesById.get(String(l.warehouseId)) || "Main Warehouse" : "Main Warehouse",
        variety: l.variety || "",
        grade: l.grade || "",
        bagCount: Number(l.bagCount || 0),
        quantityKg: Number(l.quantityKg || l.netWeight || 0),
        inwardDate: l.inwardDate || l.createdAt,
        status: l.status || "In Stock",
        createdAt: l.createdAt,
      }));
    }

    // Apply client filter criteria (Date Range, Amount range, Search Term)
    const filtered = rawRows.filter((row) => {
      // Date range filtering
      if (filters.startDate || filters.endDate) {
        const dateKey = filters.dateField || "issueDate";
        const rowDateVal =
          (row[dateKey] as string | Date | undefined) ||
          (row.date as string | Date | undefined) ||
          (row.createdAt as string | Date | undefined) ||
          (row.inwardDate as string | Date | undefined) ||
          (row.orderDate as string | Date | undefined) ||
          (row.billDate as string | Date | undefined);
        if (rowDateVal) {
          const rowDateStr = new Date(rowDateVal).toISOString().split("T")[0];
          if (filters.startDate && rowDateStr < filters.startDate) return false;
          if (filters.endDate && rowDateStr > filters.endDate) return false;
        }
      }

      // Amount range filtering
      if (filters.minAmount !== undefined && filters.minAmount !== null && filters.minAmount !== "") {
        const amt = Number(row.total ?? row.amount ?? row.salesPrice ?? 0);
        if (amt < Number(filters.minAmount)) return false;
      }
      if (filters.maxAmount !== undefined && filters.maxAmount !== null && filters.maxAmount !== "") {
        const amt = Number(row.total ?? row.amount ?? row.salesPrice ?? 0);
        if (amt > Number(filters.maxAmount)) return false;
      }

      // Search term filtering across text fields
      if (filters.searchTerm) {
        const term = String(filters.searchTerm).toLowerCase().trim();
        const matches = Object.values(row).some(
          (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(term),
        );
        if (!matches) return false;
      }

      return true;
    });

    // Apply Sorting
    filtered.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      // Date comparison
      if (valA instanceof Date || (typeof valA === "string" && !isNaN(Date.parse(valA)) && valA.includes("-"))) {
        const timeA = new Date(valA).getTime();
        const timeB = new Date(valB as string | number | Date).getTime();
        if (!isNaN(timeA) && !isNaN(timeB)) {
          return (timeA - timeB) * sortDirection;
        }
      }

      // Numeric comparison
      if (typeof valA === "number" || typeof valB === "number") {
        return (Number(valA) - Number(valB)) * sortDirection;
      }

      // String comparison
      return String(valA).localeCompare(String(valB)) * sortDirection;
    });

    // Compute aggregate summary
    let totalMonetary = 0;
    filtered.forEach((r) => {
      const val = Number(r.total ?? r.amount ?? r.salesPrice ?? 0);
      if (!isNaN(val)) totalMonetary += val;
    });

    return NextResponse.json({
      ok: true,
      module: reportModule,
      totalCount: filtered.length,
      summary: {
        totalRecords: filtered.length,
        totalAmount: Math.round(totalMonetary * 100) / 100,
      },
      rows: filtered,
    });
  } catch (error: unknown) {
    console.error("Custom report data error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate report data.";
    return respondError(message, 500);
  }
}
