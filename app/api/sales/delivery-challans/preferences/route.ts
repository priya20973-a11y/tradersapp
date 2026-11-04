import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { DeliveryChallanSettings, Organization } from "@/models";
import {
  formatDeliveryChallanNumber,
  getFiscalYear,
  parseNextNumberInput,
} from "@/lib/delivery-challan-numbering";

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
    let settings = await DeliveryChallanSettings.findOne({ organizationId: orgObjId }).lean();
    const currentFY = getFiscalYear();

    if (!settings) {
      const created = await DeliveryChallanSettings.create({
        organizationId: orgObjId,
        prefix: "DC-",
        nextNumber: 2,
        numberZeroPadding: 5,
        autoGenerateNumbering: true,
        restartNumberingEachFiscalYear: false,
        lastFiscalYear: currentFY,
      });
      settings = created.toObject();
    }

    let currentNext = settings.nextNumber || 2;
    let lastFY = settings.lastFiscalYear || "";

    if (settings.restartNumberingEachFiscalYear && lastFY && lastFY !== currentFY) {
      currentNext = 1;
      lastFY = currentFY;
      await DeliveryChallanSettings.updateOne(
        { _id: settings._id },
        { $set: { nextNumber: 1, lastFiscalYear: currentFY } },
      );
    }

    const prefix = settings.prefix || "DC-";
    const padding = settings.numberZeroPadding || 5;
    const formattedNextNumber = formatDeliveryChallanNumber(prefix, currentNext, padding);

    return NextResponse.json({
      settings: {
        autoGenerateNumbering: settings.autoGenerateNumbering !== false,
        prefix,
        nextNumber: currentNext,
        numberZeroPadding: padding,
        restartNumberingEachFiscalYear: Boolean(settings.restartNumberingEachFiscalYear),
        lastFiscalYear: lastFY || currentFY,
      },
      formattedNextNumber,
    });
  } catch (error: unknown) {
    console.error("GET /api/sales/delivery-challans/preferences error:", error);
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
    let prefix = (body.prefix || "DC-").trim();
    if (!prefix.endsWith("-") && !prefix.endsWith("/")) {
      prefix = `${prefix}-`;
    }

    let parsedNextNumber = 2;
    let padding = 5;

    if (body.nextNumber !== undefined) {
      const parsed = parseNextNumberInput(body.nextNumber);
      parsedNextNumber = Math.max(1, parsed.nextNumber);
      padding = body.numberZeroPadding
        ? Math.max(1, Number(body.numberZeroPadding) || 5)
        : Math.max(parsed.padding, 5);
    } else if (body.numberZeroPadding) {
      padding = Math.max(1, Number(body.numberZeroPadding) || 5);
    }

    const restartNumberingEachFiscalYear = Boolean(body.restartNumberingEachFiscalYear);
    const currentFY = getFiscalYear();

    const updated = await DeliveryChallanSettings.findOneAndUpdate(
      { organizationId: orgObjId },
      {
        $set: {
          autoGenerateNumbering,
          prefix,
          nextNumber: parsedNextNumber,
          numberZeroPadding: padding,
          restartNumberingEachFiscalYear,
          lastFiscalYear: currentFY,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    const formattedNextNumber = formatDeliveryChallanNumber(
      updated.prefix || prefix,
      updated.nextNumber || parsedNextNumber,
      updated.numberZeroPadding || padding,
    );

    return NextResponse.json({
      message: "Delivery challan settings updated successfully",
      settings: {
        autoGenerateNumbering: updated.autoGenerateNumbering !== false,
        prefix: updated.prefix,
        nextNumber: updated.nextNumber,
        numberZeroPadding: updated.numberZeroPadding,
        restartNumberingEachFiscalYear: Boolean(updated.restartNumberingEachFiscalYear),
        lastFiscalYear: updated.lastFiscalYear || currentFY,
      },
      formattedNextNumber,
    });
  } catch (error: unknown) {
    console.error("PUT /api/sales/delivery-challans/preferences error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

