import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Customer, SalesDocument } from "@/models";
import {
  databaseUnavailable,
  getSalesScope,
  isDatabaseConnectionError,
  respondError,
} from "../../sales-service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrganizationId = url.searchParams.get("organizationId") ?? undefined;
    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to view reports.", 401);

    const scope = await getSalesScope(requestedOrganizationId, session);
    if ("error" in scope) return scope.error;

    const { organizationId } = scope;
    await connectToDatabase();

    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const customerId = url.searchParams.get("customerId");

    const invoiceQuery: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      type: "Invoice",
      status: { $ne: "Void" },
    };

    if (customerId && isValidObjectId(customerId)) {
      invoiceQuery.customerId = new Types.ObjectId(customerId);
    }

    if (startDate || endDate) {
      const d: Record<string, unknown> = {};
      if (startDate) d.$gte = new Date(startDate);
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        d.$lte = e;
      }
      invoiceQuery.issueDate = d;
    }

    const [invoices, customers, payments] = await Promise.all([
      SalesDocument.find(invoiceQuery).sort({ issueDate: -1 }).lean(),
      Customer.find({ organizationId }).select("_id name companyName phone email creditLimit").lean(),
      SalesDocument.find({
        organizationId: new Types.ObjectId(organizationId),
        type: "Payment Received",
      })
        .sort({ issueDate: -1, createdAt: -1 })
        .lean(),
    ]);

    const customerMap = new Map(customers.map((c) => [String(c._id), c]));
    const invoiceMap = new Map(invoices.map((i) => [String(i._id), i]));

    const now = new Date();

    // 1. Overdue Invoices
    interface OverdueInvoiceReportItem {
      id: string;
      number: string;
      customerId: string;
      customerName: string;
      customerCompany: string;
      issueDate: string;
      dueDate: string;
      daysOverdue: number;
      total: number;
      amountPaid: number;
      balanceDue: number;
      status: string;
    }
    const overdueInvoices: OverdueInvoiceReportItem[] = [];
    invoices.forEach((inv) => {
      const total = Number(inv.total || 0);
      const paid = Number(inv.amountPaid || 0);
      const credited = Number(inv.creditedAmount || 0);
      const balance = Math.max(0, Math.round((total - paid - credited) * 100) / 100);

      if (balance > 0 && inv.dueDate && new Date(inv.dueDate) < now && inv.status !== "Draft") {
        const due = new Date(inv.dueDate);
        const diffMs = now.getTime() - due.getTime();
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const cust = customerMap.get(String(inv.customerId));

        overdueInvoices.push({
          id: String(inv._id),
          number: inv.number,
          customerId: String(inv.customerId),
          customerName: inv.customerSnapshot?.name || cust?.name || "Customer",
          customerCompany: inv.customerSnapshot?.companyName || cust?.companyName || "",
          issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString() : "",
          dueDate: due.toISOString(),
          daysOverdue,
          total,
          amountPaid: paid,
          balanceDue: balance,
          status: "Overdue",
        });
      }
    });

    overdueInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue);

    // 2. Customer Outstanding Aggregation
    interface CustomerOutstandingReportItem {
      customerId: string;
      customerName: string;
      companyName: string;
      creditLimit: number;
      invoiceCount: number;
      totalInvoiced: number;
      totalPaid: number;
      totalOutstanding: number;
      totalOverdue: number;
      oldestInvoiceDate: string;
    }
    const customerStats = new Map<string, CustomerOutstandingReportItem>();

    customers.forEach((c) => {
      customerStats.set(String(c._id), {
        customerId: String(c._id),
        customerName: c.name,
        companyName: c.companyName || "",
        creditLimit: Number(c.creditLimit || 0),
        invoiceCount: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        totalOverdue: 0,
        oldestInvoiceDate: "",
      });
    });

    invoices.forEach((inv) => {
      const cId = String(inv.customerId);
      let entry = customerStats.get(cId);
      if (!entry) {
        entry = {
          customerId: cId,
          customerName: inv.customerSnapshot?.name || "Customer",
          companyName: inv.customerSnapshot?.companyName || "",
          creditLimit: 0,
          invoiceCount: 0,
          totalInvoiced: 0,
          totalPaid: 0,
          totalOutstanding: 0,
          totalOverdue: 0,
          oldestInvoiceDate: "",
        };
        customerStats.set(cId, entry);
      }

      const total = Number(inv.total || 0);
      const paid = Number(inv.amountPaid || 0);
      const credited = Number(inv.creditedAmount || 0);
      const balance = Math.max(0, Math.round((total - paid - credited) * 100) / 100);

      entry.invoiceCount += 1;
      entry.totalInvoiced = Math.round((entry.totalInvoiced + total) * 100) / 100;
      entry.totalPaid = Math.round((entry.totalPaid + paid) * 100) / 100;
      entry.totalOutstanding = Math.round((entry.totalOutstanding + balance) * 100) / 100;

      if (balance > 0 && inv.dueDate && new Date(inv.dueDate) < now && inv.status !== "Draft") {
        entry.totalOverdue = Math.round((entry.totalOverdue + balance) * 100) / 100;
      }

      if (balance > 0 && inv.issueDate) {
        const dateStr = new Date(inv.issueDate).toISOString().split("T")[0];
        if (!entry.oldestInvoiceDate || dateStr < entry.oldestInvoiceDate) {
          entry.oldestInvoiceDate = dateStr;
        }
      }
    });

    const customerOutstanding = Array.from(customerStats.values())
      .filter((c) => c.invoiceCount > 0 || c.totalOutstanding > 0)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    // 3. Payment Collections
    const paymentHistory = payments.map((p) => {
      const inv = p.relatedDocumentId ? invoiceMap.get(String(p.relatedDocumentId)) : null;
      const cust = customerMap.get(String(p.customerId));
      return {
        id: String(p._id),
        receiptNumber: p.receiptNumber || p.number,
        paymentDate: p.issueDate ? new Date(p.issueDate).toISOString() : "",
        amount: Number(p.total || 0),
        method: p.method || "Bank",
        referenceNumber: p.referenceNumber || "",
        notes: p.notes || "",
        invoiceId: p.relatedDocumentId ? String(p.relatedDocumentId) : "",
        invoiceNumber: inv?.number || "Direct Payment",
        customerName: cust?.name || inv?.customerSnapshot?.name || "Customer",
      };
    });

    return NextResponse.json({
      customerOutstanding,
      overdueInvoices,
      paymentHistory,
      summary: {
        totalOutstanding: customerOutstanding.reduce((s, c) => s + c.totalOutstanding, 0),
        totalOverdue: overdueInvoices.reduce((s, i) => s + i.balanceDue, 0),
        totalCollected: paymentHistory.reduce((s, p) => s + p.amount, 0),
      },
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("GET reports error:", error);
    return respondError("Failed to generate invoice reports.", 500);
  }
}
