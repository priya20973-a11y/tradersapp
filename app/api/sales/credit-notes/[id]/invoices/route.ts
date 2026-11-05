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
      return respondError("Invalid credit note ID.", 400);
    }

    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    if (!orgId) {
      return respondError("Organization not found.", 400);
    }

    const orgObjId = new Types.ObjectId(orgId);
    const cnObjId = new Types.ObjectId(id);

    const creditNote = await SalesDocument.findOne({
      _id: cnObjId,
      organizationId: orgObjId,
      type: "Credit Note",
    }).lean();

    if (!creditNote) {
      return respondError("Credit note not found.", 404);
    }

    const total = Number(creditNote.total || 0);
    const credited = Number(creditNote.creditedAmount || 0);
    const balanceRemaining =
      creditNote.balanceRemaining !== undefined
        ? Number(creditNote.balanceRemaining)
        : Math.max(0, Math.round((total - credited) * 100) / 100);

    // Fetch all invoices for THIS EXACT CUSTOMER with balanceDue > 0
    const invoicesDocs = await SalesDocument.find({
      organizationId: orgObjId,
      customerId: creditNote.customerId,
      type: "Invoice",
      status: { $nin: ["Void", "Draft"] },
    })
      .sort({ issueDate: 1, createdAt: 1 })
      .lean();

    const openInvoices = invoicesDocs
      .map((inv) => {
        const invTotal = Number(inv.total || 0);
        const invPaid = Number(inv.amountPaid || 0);
        const invCredited = Number(inv.creditedAmount || 0);
        const balanceDue = Math.max(
          0,
          Math.round((invTotal - invPaid - invCredited) * 100) / 100,
        );

        return {
          id: String(inv._id),
          invoiceNumber: String(inv.number ?? ""),
          invoiceDate: inv.issueDate ? formatDateOnly(new Date(inv.issueDate as string | number | Date)) : "",
          dueDate: inv.dueDate ? formatDateOnly(new Date(inv.dueDate as string | number | Date)) : "",
          total: invTotal,
          amountPaid: invPaid,
          creditedAmount: invCredited,
          balanceDue,
          status: String(inv.status ?? ""),
          subject: String(inv.subject ?? ""),
        };
      })
      .filter((inv) => inv.balanceDue > 0);

    return NextResponse.json({
      creditNote: {
        id: String(creditNote._id),
        creditNoteNumber: creditNote.number,
        customerId: String(creditNote.customerId),
        customerName:
          creditNote.customerSnapshot?.companyName ||
          creditNote.customerSnapshot?.name ||
          "Unknown Customer",
        total,
        balanceRemaining,
        creditedAmount: credited,
        status: creditNote.status,
      },
      openInvoices,
    });
  } catch (error) {
    console.error("GET /api/sales/credit-notes/[id]/invoices error:", error);
    return respondError("Failed to fetch customer invoices.", 500);
  }
}

