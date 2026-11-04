import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Organization, SalesDocument } from "@/models";
import { formatDateOnly } from "@/lib/bill-utils";

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
      return respondError("Invalid invoice ID.", 400);
    }

    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    if (!orgId) {
      return respondError("Valid organization ID is required.", 400);
    }

    const orgObjId = new Types.ObjectId(orgId);
    const invObjId = new Types.ObjectId(id);

    const invoice = await SalesDocument.findOne({
      _id: invObjId,
      organizationId: orgObjId,
      type: "Invoice",
    }).lean();

    if (!invoice) {
      return respondError("Invoice not found.", 404);
    }

    const invoiceTotal = Number(invoice.total || 0);
    const amountPaid = Number(invoice.amountPaid || 0);
    const creditedAmount = Number(invoice.creditedAmount || 0);
    const balanceDue = Math.max(
      0,
      Math.round((invoiceTotal - amountPaid - creditedAmount) * 100) / 100,
    );

    // Fetch all open/partially-applied credit notes for this customer with balanceRemaining > 0
    const availableCreditDocs = await SalesDocument.find({
      organizationId: orgObjId,
      customerId: invoice.customerId,
      type: "Credit Note",
      status: { $in: ["Open", "Partially Applied"] },
    })
      .sort({ issueDate: 1, createdAt: 1 })
      .lean();

    const availableCredits = availableCreditDocs.map((c) => {
        const tot = Number(c.total || 0);
        const cred = Number(c.creditedAmount || 0);
        const bal =
          c.balanceRemaining !== undefined
            ? Number(c.balanceRemaining)
            : Math.max(0, Math.round((tot - cred) * 100) / 100);

        return {
          id: String(c._id),
          creditNoteNumber: c.number,
          customerId: String(c.customerId),
          customerName:
            c.customerSnapshot?.companyName ||
            c.customerSnapshot?.name ||
            invoice.customerSnapshot?.name ||
            "Customer",
          creditNoteDate: c.issueDate ? formatDateOnly(new Date(c.issueDate)) : "",
          referenceNumber: c.referenceNumber || "",
          subject: c.subject || "",
          total: tot,
          creditedAmount: cred,
          balanceRemaining: bal,
          status: c.status,
        };
      })
      .filter((c) => c.balanceRemaining > 0);

    const totalAvailableCredit = availableCredits.reduce(
      (sum, c) => sum + c.balanceRemaining,
      0,
    );

    return NextResponse.json({
      invoice: {
        id: String(invoice._id),
        invoiceNumber: invoice.number,
        customerId: String(invoice.customerId),
        customerName:
          invoice.customerSnapshot?.companyName ||
          invoice.customerSnapshot?.name ||
          "Customer",
        total: invoiceTotal,
        amountPaid,
        creditedAmount,
        balanceDue,
        status: invoice.status,
        creditsApplied: ((invoice.creditsApplied || []) as Array<Record<string, unknown>>).map((c) => ({
          creditNoteId: String(c.creditNoteId),
          creditNoteNumber: c.creditNoteNumber as string | undefined,
          amount: Number(c.amount || 0),
          appliedDate: c.appliedDate ? new Date(c.appliedDate as string | number | Date).toISOString() : "",
          notes: (c.notes as string) || "",
        })),
      },
      availableCredits,
      totalAvailableCredit: Math.round(totalAvailableCredit * 100) / 100,
    });
  } catch (error) {
    console.error("GET /api/sales/invoices/[id]/credit-notes error:", error);
    return respondError("Failed to fetch available credit notes for invoice.", 500);
  }
}
