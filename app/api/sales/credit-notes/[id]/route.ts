import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Customer, Organization, SalesDocument } from "@/models";

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

    const doc = await SalesDocument.findOne({
      _id: cnObjId,
      organizationId: orgObjId,
      type: "Credit Note",
    }).lean();

    if (!doc) {
      return respondError("Credit Note not found.", 404);
    }

    const total = Number(doc.total || 0);
    const credited = Number(doc.creditedAmount || 0);
    const balance =
      doc.balanceRemaining !== undefined
        ? Number(doc.balanceRemaining)
        : Math.max(0, Math.round((total - credited) * 100) / 100);

    return NextResponse.json({
      creditNote: {
        id: String(doc._id),
        creditNoteNumber: doc.number,
        customerId: String(doc.customerId),
        customerName:
          doc.customerSnapshot?.companyName ||
          doc.customerSnapshot?.name ||
          "Unknown Customer",
        customerSnapshot: doc.customerSnapshot,
        referenceNumber: doc.referenceNumber || "",
        creditNoteDate: doc.issueDate ? new Date(doc.issueDate as string | number | Date).toISOString() : "",
        status: doc.status || "Draft",
        accountsReceivable: doc.accountsReceivable || "Accounts Receivable",
        salesperson: doc.salesperson || "",
        subject: doc.subject || "",
        items: ((doc.items || []) as unknown[]).map((it) => {
          const item = it as Record<string, unknown>;
          return {
            id: item._id ? String(item._id) : undefined,
            itemId: item.itemId ? String(item.itemId) : undefined,
            name: typeof item.name === "string" ? item.name : undefined,
            description: typeof item.description === "string" ? item.description : "",
            account: typeof item.account === "string" ? item.account : "Sales",
            quantity: Number(item.quantity || 1),
            rate: Number(item.rate || 0),
            amount: Number(item.amount || 0),
          };
        }),
        subTotal: Number(doc.subTotal || 0),
        discount: Number(doc.discount || 0),
        discountType: doc.discountType || "percent",
        tdsTcsType: doc.tdsTcsType || "None",
        tdsTcsRate: Number(doc.tdsTcsRate || 0),
        tdsTcsAmount: Number(doc.tdsTcsAmount || 0),
        adjustment: Number(doc.adjustment || 0),
        total,
        creditedAmount: credited,
        balanceRemaining: balance,
        customerNotes: doc.customerNotes || "",
        termsAndConditions: doc.termsAndConditions || "",
        invoicesApplied: ((doc.invoicesApplied || []) as Array<Record<string, unknown>>).map((app) => ({
          invoiceId: String(app.invoiceId),
          invoiceNumber: typeof app.invoiceNumber === "string" ? app.invoiceNumber : undefined,
          amountApplied: Number(app.amountApplied || 0),
          appliedDate: app.appliedDate ? new Date(app.appliedDate as string | number | Date).toISOString() : "",
          notes: typeof app.notes === "string" ? app.notes : "",
        })),
        createdAt: doc.createdAt ? new Date(doc.createdAt as string | number | Date).toISOString() : "",
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt as string | number | Date).toISOString() : "",
      },
    });
  } catch (error) {
    console.error("GET /api/sales/credit-notes/[id] error:", error);
    return respondError("Failed to fetch credit note.", 500);
  }
}

export async function PUT(
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
    });

    if (!creditNote) {
      return respondError("Credit note not found.", 404);
    }

    // If already has applied invoices, restrict altering amounts/customer
    const hasApplications = (creditNote.invoicesApplied || []).length > 0;

    const body = await request.json().catch(() => ({}));

    // Customer cannot change if credits have already been applied
    if (hasApplications && body.customerId && String(body.customerId) !== String(creditNote.customerId)) {
      return respondError("Cannot change customer because credits have already been applied to invoices.", 400);
    }

    if (body.customerId && String(body.customerId) !== String(creditNote.customerId)) {
      const customer = await Customer.findOne({
        _id: new Types.ObjectId(body.customerId),
        organizationId: orgObjId,
      }).lean();

      if (!customer) {
        return respondError("Customer not found.", 404);
      }
      creditNote.customerId = customer._id;
      creditNote.customerSnapshot = {
        name: customer.name,
        companyName: customer.companyName,
        gstin: customer.gstin,
        pan: customer.pan,
        email: customer.email,
        phone: customer.phone,
        billingAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress,
      };
    }

    if (body.referenceNumber !== undefined) {
      creditNote.referenceNumber = String(body.referenceNumber).trim();
    }
    if (body.creditNoteDate) {
      creditNote.issueDate = new Date(body.creditNoteDate);
    }
    if (body.accountsReceivable) {
      creditNote.accountsReceivable = String(body.accountsReceivable).trim();
    }
    if (body.salesperson !== undefined) {
      creditNote.salesperson = String(body.salesperson).trim();
    }
    if (body.subject !== undefined) {
      creditNote.subject = String(body.subject).trim();
    }
    if (body.customerNotes !== undefined) {
      creditNote.customerNotes = String(body.customerNotes).trim();
    }
    if (body.termsAndConditions !== undefined) {
      creditNote.termsAndConditions = String(body.termsAndConditions).trim();
    }

    // If not applied to invoices, items and totals can be updated
    if (!hasApplications && Array.isArray(body.items) && body.items.length > 0) {
      let subTotal = 0;
      const computedItems = (body.items as Array<Record<string, unknown>>).map((it) => {
        const qty = Math.max(0.001, parseFloat(String(it.quantity)) || 1);
        const rate = Math.max(0, parseFloat(String(it.rate)) || 0);
        const lineAmt = Math.round(qty * rate * 100) / 100;
        subTotal += lineAmt;

        return {
          itemId: it.itemId && isValidObjectId(it.itemId as string) ? new Types.ObjectId(it.itemId as string) : undefined,
          name: String(it.name || "Custom Item").trim(),
          description: String(it.description || "").trim(),
          account: String(it.account || "Sales").trim(),
          quantity: qty,
          rate,
          amount: lineAmt,
        };
      });

      subTotal = Math.round(subTotal * 100) / 100;
      const discountVal = Math.max(0, parseFloat(body.discount) || 0);
      const discountType = body.discountType === "amount" ? "amount" : "percent";
      let discountAmount = 0;
      if (discountType === "percent") {
        discountAmount = Math.round(((subTotal * discountVal) / 100) * 100) / 100;
      } else {
        discountAmount = Math.min(subTotal, discountVal);
      }

      const taxableAmount = Math.max(0, subTotal - discountAmount);
      const tdsTcsType =
        body.tdsTcsType === "TCS" ? "TCS" : body.tdsTcsType === "TDS" ? "TDS" : "None";
      const tdsTcsRate = Math.max(0, parseFloat(body.tdsTcsRate) || 0);
      let tdsTcsAmount = 0;
      if (tdsTcsType !== "None" && tdsTcsRate > 0) {
        tdsTcsAmount = Math.round(((taxableAmount * tdsTcsRate) / 100) * 100) / 100;
      }

      const adjustment = parseFloat(body.adjustment) || 0;
      let total = taxableAmount + adjustment;
      if (tdsTcsType === "TCS") total += tdsTcsAmount;
      else if (tdsTcsType === "TDS") total -= tdsTcsAmount;
      total = Math.max(0, Math.round(total * 100) / 100);

      creditNote.items = computedItems;
      creditNote.subTotal = subTotal;
      creditNote.discount = discountVal;
      creditNote.discountType = discountType;
      creditNote.tdsTcsType = tdsTcsType;
      creditNote.tdsTcsRate = tdsTcsRate;
      creditNote.tdsTcsAmount = tdsTcsAmount;
      creditNote.adjustment = adjustment;

      const oldTotal = Number(creditNote.total || 0);
      creditNote.total = total;
      creditNote.balanceRemaining = Math.max(
        0,
        Math.round((total - Number(creditNote.creditedAmount || 0)) * 100) / 100,
      );

      // Adjust customer unusedCredits difference if status was Open
      if (creditNote.status === "Open") {
        const diff = total - oldTotal;
        if (diff !== 0) {
          await Customer.updateOne(
            { _id: creditNote.customerId },
            { $inc: { unusedCredits: diff } },
          ).catch(() => null);
        }
      }
    }

    // Status transition e.g. Draft -> Open
    if (body.action === "open" && creditNote.status === "Draft") {
      creditNote.status = "Open";
      creditNote.balanceRemaining = Number(creditNote.total || 0);
      await Customer.updateOne(
        { _id: creditNote.customerId },
        { $inc: { unusedCredits: Number(creditNote.total || 0) } },
      ).catch(() => null);
    }

    await creditNote.save();

    return NextResponse.json({
      success: true,
      creditNote: {
        id: String(creditNote._id),
        number: creditNote.number,
        total: creditNote.total,
        status: creditNote.status,
        balanceRemaining: creditNote.balanceRemaining,
      },
    });
  } catch (error) {
    console.error("PUT /api/sales/credit-notes/[id] error:", error);
    return respondError("Failed to update credit note.", 500);
  }
}

export async function DELETE(
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
    });

    if (!creditNote) {
      return respondError("Credit note not found.", 404);
    }

    if ((creditNote.invoicesApplied || []).length > 0) {
      return respondError(
        "Cannot delete credit note because it has already been applied to invoices. Unapply credits first.",
        400,
      );
    }

    // If status was Open, decrement customer unusedCredits
    if (creditNote.status === "Open" && Number(creditNote.total || 0) > 0) {
      await Customer.updateOne(
        { _id: creditNote.customerId },
        { $inc: { unusedCredits: -Number(creditNote.total || 0) } },
      ).catch(() => null);
    }

    await SalesDocument.deleteOne({ _id: cnObjId, organizationId: orgObjId });

    return NextResponse.json({ success: true, message: "Credit Note deleted successfully." });
  } catch (error) {
    console.error("DELETE /api/sales/credit-notes/[id] error:", error);
    return respondError("Failed to delete credit note.", 500);
  }
}

