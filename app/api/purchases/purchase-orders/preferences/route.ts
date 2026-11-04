import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Organization, PurchaseOrderPreferences } from "@/models";
import {
  formatPurchaseOrderNumber,
  getFiscalYear,
  parseNextNumberInput,
} from "@/lib/purchase-order-numbering";

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
    let prefs = await PurchaseOrderPreferences.findOne({ organizationId: orgObjId }).lean();
    const currentFY = getFiscalYear();

    if (!prefs) {
      const created = await PurchaseOrderPreferences.create({
        organizationId: orgObjId,
        autoGenerateNumbering: true,
        prefix: "PO-",
        nextNumber: 2,
        numberZeroPadding: 5,
        restartNumberingEachFiscalYear: false,
        lastFiscalYear: currentFY,
      });
      prefs = created.toObject();
    }

    let currentNext = prefs.nextNumber || 2;
    let lastFY = prefs.lastFiscalYear || "";

    if (prefs.restartNumberingEachFiscalYear && lastFY && lastFY !== currentFY) {
      currentNext = 1;
      lastFY = currentFY;
      await PurchaseOrderPreferences.updateOne(
        { _id: prefs._id },
        { $set: { nextNumber: 1, lastFiscalYear: currentFY } },
      );
    }

    const prefix = prefs.prefix || "PO-";
    const padding = prefs.numberZeroPadding || 5;
    const formattedNextNumber = formatPurchaseOrderNumber(prefix, currentNext, padding);

    return NextResponse.json({
      preferences: {
        autoGenerateNumbering: prefs.autoGenerateNumbering !== false,
        prefix,
        nextNumber: currentNext,
        numberZeroPadding: padding,
        restartNumberingEachFiscalYear: Boolean(prefs.restartNumberingEachFiscalYear),
        lastFiscalYear: lastFY || currentFY,
      },
      formattedNextNumber,
    });
  } catch (error: unknown) {
    console.error("GET /api/purchases/purchase-orders/preferences error:", error);
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

    const rawPrefix = String(body.prefix ?? "PO-").trim();
    const prefix = isAuto ? rawPrefix || "PO-" : rawPrefix;

    const parsedNum = parseNextNumberInput(body.nextNumber ?? "00002");
    const nextNumber = Math.max(1, body.nextNumber ? parsedNum.nextNumber : 2);
    const numberZeroPadding = Math.max(1, body.numberZeroPadding ? Number(body.numberZeroPadding) : parsedNum.padding);
    const restartNumberingEachFiscalYear = isAuto ? Boolean(body.restartNumberingEachFiscalYear) : false;
    const currentFY = getFiscalYear();

    const updated = await PurchaseOrderPreferences.findOneAndUpdate(
      { organizationId: orgObjId },
      {
        $set: {
          autoGenerateNumbering,
          prefix,
          nextNumber,
          numberZeroPadding,
          restartNumberingEachFiscalYear,
          lastFiscalYear: currentFY,
        },
      },
      { new: true, upsert: true },
    ).lean();

    const formattedNextNumber = formatPurchaseOrderNumber(prefix, nextNumber, numberZeroPadding);

    return NextResponse.json({
      success: true,
      preferences: {
        autoGenerateNumbering: updated.autoGenerateNumbering !== false,
        prefix: updated.prefix || "PO-",
        nextNumber: updated.nextNumber || 2,
        numberZeroPadding: updated.numberZeroPadding || 5,
        restartNumberingEachFiscalYear: Boolean(updated.restartNumberingEachFiscalYear),
        lastFiscalYear: updated.lastFiscalYear || currentFY,
      },
      formattedNextNumber,
    });
  } catch (error: unknown) {
    console.error("PUT /api/purchases/purchase-orders/preferences error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

