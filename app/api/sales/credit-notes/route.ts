import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  CreditNoteSettings,
  Customer,
  Organization,
  SalesDocument,
} from "@/models";
import {
  extractNumberPart,
} from "@/lib/credit-note-numbering";
import { allocateNextCreditNoteNumber } from "@/lib/credit-note-service";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const orgObjId = new Types.ObjectId(orgId);
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim().toLowerCase();
    const statusParam = url.searchParams.get("status")?.trim();
    const customerId = url.searchParams.get("customerId")?.trim();

    const query: Record<string, unknown> = {
      organizationId: orgObjId,
      type: "Credit Note",
    };

    if (customerId && isValidObjectId(customerId)) {
      query.customerId = new Types.ObjectId(customerId);
    }

    if (statusParam && statusParam.toUpperCase() !== "ALL") {
      const statusMap: Record<string, string> = {
        draft: "Draft",
        open: "Open",
        partially_applied: "Partially Applied",
        "partially applied": "Partially Applied",
        closed: "Closed",
        void: "Void",
      };
      const mapped = statusMap[statusParam.toLowerCase()] || statusParam;
      query.status = mapped;
    }

    const [notesDocs, customersDocs] = await Promise.all([
      SalesDocument.find(query).sort({ issueDate: -1, createdAt: -1 }).lean(),
      Customer.find({ organizationId: orgObjId })
        .select("_id name companyName")
        .sort({ name: 1 })
        .lean(),
    ]);

    let notes = notesDocs.map((doc) => {
      const total = Number(doc.total || 0);
      const credited = Number(doc.creditedAmount || 0);
      const balance =
        doc.balanceRemaining !== undefined
          ? Number(doc.balanceRemaining)
          : Math.max(0, Math.round((total - credited) * 100) / 100);

      return {
        id: String(doc._id),
        creditNoteNumber: doc.number || "",
        customerId: String(doc.customerId),
        customerName:
          doc.customerSnapshot?.companyName ||
          doc.customerSnapshot?.name ||
          "Unknown Customer",
        referenceNumber: doc.referenceNumber || "",
        creditNoteDate: doc.issueDate ? new Date(doc.issueDate).toISOString() : "",
        status: doc.status || "Draft",
        total,
        appliedAmount: credited,
        balanceRemaining: balance,
        subject: doc.subject || "",
        salesperson: doc.salesperson || "",
        accountsReceivable: doc.accountsReceivable || "Accounts Receivable",
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
      };
    });

    if (search) {
      notes = notes.filter((n) => {
        return (
          n.creditNoteNumber.toLowerCase().includes(search) ||
          n.customerName.toLowerCase().includes(search) ||
          n.referenceNumber.toLowerCase().includes(search) ||
          n.subject.toLowerCase().includes(search)
        );
      });
    }

    // Calculate metrics across all credit notes in this organization
    const allNotes = await SalesDocument.find({
      organizationId: orgObjId,
      type: "Credit Note",
    })
      .select("status total creditedAmount balanceRemaining")
      .lean();

    let totalCreditAmount = 0;
    let totalApplied = 0;
    let totalAvailable = 0;
    const statusCounts = {
      total: allNotes.length,
      draft: 0,
      open: 0,
      partiallyApplied: 0,
      closed: 0,
      void: 0,
    };

    for (const n of allNotes) {
      const tot = Number(n.total || 0);
      const applied = Number(n.creditedAmount || 0);
      const bal =
        n.balanceRemaining !== undefined
          ? Number(n.balanceRemaining)
          : Math.max(0, Math.round((tot - applied) * 100) / 100);

      if (n.status !== "Void") {
        totalCreditAmount += tot;
        totalApplied += applied;
        if (n.status === "Open" || n.status === "Partially Applied") {
          totalAvailable += bal;
        }
      }

      if (n.status === "Draft") statusCounts.draft++;
      else if (n.status === "Open") statusCounts.open++;
      else if (n.status === "Partially Applied") statusCounts.partiallyApplied++;
      else if (n.status === "Closed") statusCounts.closed++;
      else if (n.status === "Void") statusCounts.void++;
    }

    return NextResponse.json({
      creditNotes: notes,
      customers: customersDocs.map((c) => ({
        id: String(c._id),
        name: c.companyName ? `${c.companyName} (${c.name})` : String(c.name || ""),
      })),
      metrics: {
        totalCreditNotes: allNotes.length,
        totalCreditAmount: Math.round(totalCreditAmount * 100) / 100,
        totalApplied: Math.round(totalApplied * 100) / 100,
        totalAvailable: Math.round(totalAvailable * 100) / 100,
        statusCounts,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/sales/credit-notes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const orgObjId = new Types.ObjectId(orgId);
    const body = await request.json().catch(() => ({}));

    if (!body.customerId || !isValidObjectId(body.customerId)) {
      return NextResponse.json({ error: "Please select a valid customer." }, { status: 400 });
    }

    const customer = await Customer.findOne({
      _id: new Types.ObjectId(body.customerId),
      organizationId: orgObjId,
    }).lean();

    if (!customer) {
      return NextResponse.json({ error: "Customer not found in this organization." }, { status: 404 });
    }

    // Numbering resolution
    const settings = await CreditNoteSettings.findOne({ organizationId: orgObjId }).lean();
    const isAuto =
      body.autoGenerateNumbering !== undefined
        ? Boolean(body.autoGenerateNumbering)
        : settings ? settings.autoGenerateNumbering !== false : true;

    let creditNoteNumber = String(body.creditNoteNumber || body.number || "").trim();

    if (!isAuto) {
      // Manual entry mode
      if (!creditNoteNumber) {
        return NextResponse.json(
          { error: "Credit Note Number is required when manual numbering is enabled." },
          { status: 400 },
        );
      }

      const existing = await SalesDocument.findOne({
        organizationId: orgObjId,
        type: "Credit Note",
        number: creditNoteNumber,
      }).lean();

      if (existing) {
        return NextResponse.json(
          { error: `Credit Note Number '${creditNoteNumber}' already exists.` },
          { status: 409 },
        );
      }
    } else {
      // Auto-generate mode
      const prefix = settings?.creditNotePrefix || "CN-";

      // Check whether creditNoteNumber is empty, already taken in DB, or matches the auto-prefix pattern
      let isAlreadyTaken = false;
      if (creditNoteNumber) {
        const existingDoc = await SalesDocument.findOne({
          organizationId: orgObjId,
          type: "Credit Note",
          number: creditNoteNumber,
        })
          .select("_id")
          .lean();
        isAlreadyTaken = Boolean(existingDoc);
      }

      const isPrefixMatch = creditNoteNumber ? creditNoteNumber.startsWith(prefix) : false;

      // In auto-generate mode:
      // If no number was provided, OR the number is already taken (e.g. CN-00002), OR it matches the sequential prefix:
      // Automatically allocate the next available unique sequential number!
      if (!creditNoteNumber || isAlreadyTaken || isPrefixMatch) {
        try {
          const allocated = await allocateNextCreditNoteNumber(orgObjId);
          creditNoteNumber = allocated.creditNoteNumber;
        } catch {
          creditNoteNumber = `CN-${Math.floor(10000 + Math.random() * 90000)}`;
        }
      } else {
        // User provided custom manual number with different prefix while in auto mode
        const existing = await SalesDocument.findOne({
          organizationId: orgObjId,
          type: "Credit Note",
          number: creditNoteNumber,
        }).lean();

        if (existing) {
          return NextResponse.json(
            { error: `Credit Note Number '${creditNoteNumber}' already exists.` },
            { status: 409 },
          );
        }

        const numPart = extractNumberPart(creditNoteNumber, prefix);
        if (numPart) {
          await CreditNoteSettings.updateOne(
            { organizationId: orgObjId, nextNumber: { $lte: numPart } },
            { $set: { nextNumber: numPart + 1 } },
          ).catch(() => null);
        }
      }
    }

    // Items line calculation
    const rawItems: Array<Record<string, unknown>> = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required in the Credit Note." },
        { status: 400 },
      );
    }

    let subTotal = 0;
    const computedItems = rawItems.map((it) => {
      const qty = Math.max(0.001, parseFloat(String(it.quantity || "1")) || 1);
      const rate = Math.max(0, parseFloat(String(it.rate || "0")) || 0);
      const lineAmt = Math.round(qty * rate * 100) / 100;
      subTotal += lineAmt;

      return {
        itemId: it.itemId && typeof it.itemId === "string" && isValidObjectId(it.itemId) ? new Types.ObjectId(it.itemId) : undefined,
        name: String(it.name || "Custom Item").trim(),
        description: String(it.description || "").trim(),
        account: String(it.account || "Sales").trim(),
        quantity: qty,
        rate,
        amount: lineAmt,
      };
    });

    subTotal = Math.round(subTotal * 100) / 100;

    // Discount
    const discountVal = Math.max(0, parseFloat(body.discount) || 0);
    const discountType = body.discountType === "amount" ? "amount" : "percent";
    let discountAmount = 0;
    if (discountType === "percent") {
      discountAmount = Math.round(((subTotal * discountVal) / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(subTotal, discountVal);
    }

    const taxableAmount = Math.max(0, subTotal - discountAmount);

    // Tax / TDS / TCS
    const tdsTcsType =
      body.tdsTcsType === "TCS" ? "TCS" : body.tdsTcsType === "TDS" ? "TDS" : "None";
    const tdsTcsRate = Math.max(0, parseFloat(body.tdsTcsRate) || 0);
    let tdsTcsAmount = 0;
    if (tdsTcsType !== "None" && tdsTcsRate > 0) {
      tdsTcsAmount = Math.round(((taxableAmount * tdsTcsRate) / 100) * 100) / 100;
    }

    // Adjustment
    const adjustment = parseFloat(body.adjustment) || 0;

    // Grand Total
    let total = taxableAmount + adjustment;
    if (tdsTcsType === "TCS") {
      total += tdsTcsAmount;
    } else if (tdsTcsType === "TDS") {
      total -= tdsTcsAmount;
    }
    total = Math.max(0, Math.round(total * 100) / 100);

    const targetStatus =
      body.status === "Draft" || body.action === "draft" ? "Draft" : "Open";
    const balanceRemaining = targetStatus === "Draft" ? 0 : total;

    const creditNote = new SalesDocument({
      organizationId: orgObjId,
      type: "Credit Note",
      number: creditNoteNumber,
      customerId: customer._id,
      customerSnapshot: {
        name: customer.name,
        companyName: customer.companyName,
        gstin: customer.gstin,
        pan: customer.pan,
        email: customer.email,
        phone: customer.phone,
        billingAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress,
      },
      referenceNumber: String(body.referenceNumber || "").trim(),
      issueDate: body.creditNoteDate ? new Date(body.creditNoteDate) : new Date(),
      status: targetStatus,
      accountsReceivable: String(body.accountsReceivable || "Accounts Receivable").trim(),
      salesperson: String(body.salesperson || "").trim(),
      subject: String(body.subject || "").trim(),
      items: computedItems,
      subTotal,
      discount: discountVal,
      discountType,
      tdsTcsType,
      tdsTcsRate,
      tdsTcsAmount,
      adjustment,
      total,
      creditedAmount: 0,
      balanceRemaining,
      customerNotes: String(body.customerNotes || "").trim(),
      termsAndConditions: String(body.termsAndConditions || "").trim(),
      invoicesApplied: [],
      creditsApplied: [],
    });

    // Save with automatic collision retry on duplicate key (E11000) for concurrency safety
    const maxRetries = 5;
    let saved = false;
    let lastSaveError: unknown = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        creditNote.number = creditNoteNumber;
        await creditNote.save();
        saved = true;
        break;
      } catch (saveErr: unknown) {
        lastSaveError = saveErr;
        const errObj = saveErr as { code?: number; message?: string } | undefined;
        const isDuplicateKey =
          errObj?.code === 11000 ||
          errObj?.message?.includes("E11000") ||
          errObj?.message?.includes("duplicate key");

        if (isDuplicateKey && isAuto) {
          try {
            const reallocated = await allocateNextCreditNoteNumber(orgObjId);
            creditNoteNumber = reallocated.creditNoteNumber;
            continue;
          } catch {
            // fall through to throw
          }
        }
        throw saveErr;
      }
    }

    if (!saved) {
      throw lastSaveError || new Error("Failed to allocate a unique credit note number.");
    }

    // If opened immediately, update customer unused credits
    if (targetStatus === "Open" && total > 0) {
      await Customer.updateOne(
        { _id: customer._id },
        { $inc: { unusedCredits: total } },
      ).catch(() => null);
    }

    return NextResponse.json(
      {
        success: true,
        creditNote: {
          id: String(creditNote._id),
          number: creditNote.number,
          total: creditNote.total,
          status: creditNote.status,
          balanceRemaining: creditNote.balanceRemaining,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("POST /api/sales/credit-notes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
