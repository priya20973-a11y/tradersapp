import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { CreditNoteSettings, Organization, SalesDocument } from "@/models";
import {
  findNextAvailableCreditNoteNumber,
  formatCreditNoteNumber,
  getFiscalYear,
  parseNextNumberInput,
} from "@/lib/credit-note-numbering";
import { peekNextCreditNoteNumber } from "@/lib/credit-note-service";

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export async function GET() {
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
    const peek = await peekNextCreditNoteNumber(orgObjId);

    const settingsPayload = {
      autoGenerateNumbering: peek.autoGenerateNumbering,
      creditNotePrefix: peek.prefix,
      prefix: peek.prefix,
      nextNumber: peek.nextNumber,
      numberZeroPadding: peek.padding,
      restartNumberingEachFiscalYear: peek.restartNumberingEachFiscalYear,
      lastFiscalYear: peek.lastFiscalYear,
    };

    return NextResponse.json({
      settings: settingsPayload,
      preferences: settingsPayload,
      formattedNextNumber: peek.creditNoteNumber,
    });
  } catch (error: unknown) {
    console.error("GET /api/sales/credit-notes/preferences error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
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

    const autoGenerateNumbering = body.autoGenerateNumbering !== false;
    const isAuto = autoGenerateNumbering;

    const rawPrefix = String(body.creditNotePrefix ?? body.prefix ?? "CN-").trim();
    const prefix = isAuto ? rawPrefix || "CN-" : rawPrefix;

    const parsedNum = parseNextNumberInput(body.nextNumber ?? "00002");
    let nextNumber = Math.max(1, body.nextNumber ? parsedNum.nextNumber : 2);
    const numberZeroPadding = Math.max(
      1,
      body.numberZeroPadding ? Number(body.numberZeroPadding) : parsedNum.padding,
    );
    const restartNumberingEachFiscalYear = isAuto
      ? Boolean(body.restartNumberingEachFiscalYear)
      : false;
    const currentFY = getFiscalYear();

    // If auto-generate is enabled, ensure nextNumber does not collide with existing credit notes
    if (isAuto) {
      const existingNotes = await SalesDocument.find({
        organizationId: orgObjId,
        type: "Credit Note",
        number: { $regex: `^${escapeRegex(prefix)}` },
      })
        .select("number")
        .lean();

      const existingSet = new Set(existingNotes.map((n) => n.number));
      const nextAvailable = findNextAvailableCreditNoteNumber(
        prefix,
        nextNumber,
        numberZeroPadding,
        existingSet,
      );
      nextNumber = nextAvailable.allocatedNumber;
    }

    const updated = await CreditNoteSettings.findOneAndUpdate(
      { organizationId: orgObjId },
      {
        $set: {
          autoGenerateNumbering,
          creditNotePrefix: prefix,
          nextNumber,
          numberZeroPadding,
          restartNumberingEachFiscalYear,
          lastFiscalYear: currentFY,
        },
      },
      { new: true, upsert: true },
    ).lean();

    const formattedNextNumber = formatCreditNoteNumber(prefix, nextNumber, numberZeroPadding);

    const settingsPayload = {
      autoGenerateNumbering: updated.autoGenerateNumbering !== false,
      creditNotePrefix: updated.creditNotePrefix || "CN-",
      prefix: updated.creditNotePrefix || "CN-",
      nextNumber: updated.nextNumber || nextNumber,
      numberZeroPadding: updated.numberZeroPadding || numberZeroPadding,
      restartNumberingEachFiscalYear: Boolean(updated.restartNumberingEachFiscalYear),
      lastFiscalYear: updated.lastFiscalYear || currentFY,
    };

    return NextResponse.json({
      success: true,
      settings: settingsPayload,
      preferences: settingsPayload,
      formattedNextNumber,
    });
  } catch (error: unknown) {
    console.error("PUT /api/sales/credit-notes/preferences error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

