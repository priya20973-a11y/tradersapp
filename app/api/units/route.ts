import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Item, Organization, Unit } from "@/models";
import { standardUnits } from "@/components/items/item-constants";

export const unitInputSchema = z.object({
  name: z.string().trim().min(1, "Unit name is required").max(60),
  code: z.string().trim().max(30).optional(),
  value: z.string().trim().max(30).optional(),
  label: z.string().trim().max(80).optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) {
        orgId = String(defaultOrg._id);
      }
    }

    const unitsMap = new Map<string, { value: string; label: string }>();

    // 1. Add standard units
    for (const unit of standardUnits) {
      unitsMap.set(unit.value.toLowerCase(), { value: unit.value, label: unit.label });
    }

    // 2. Fetch custom units from DB
    const query = orgId ? { $or: [{ organizationId: orgId }, { organizationId: { $exists: false } }] } : {};
    const dbUnits = await Unit.find(query).sort({ createdAt: 1 }).lean().catch(() => []);

    for (const dbUnit of dbUnits) {
      if (dbUnit.value && dbUnit.label) {
        unitsMap.set(dbUnit.value.toLowerCase(), {
          value: dbUnit.value,
          label: dbUnit.label,
        });
      }
    }

    // 3. Collect any existing custom units from items
    const itemUnits = await Item.distinct("unit", orgId ? { organizationId: orgId } : {}).catch(() => []);
    for (const rawUnit of itemUnits) {
      if (rawUnit && typeof rawUnit === "string") {
        const trimmed = rawUnit.trim();
        const key = trimmed.toLowerCase();
        if (!unitsMap.has(key)) {
          unitsMap.set(key, { value: trimmed, label: trimmed });
        }
      }
    }

    return NextResponse.json({
      units: Array.from(unitsMap.values()),
    });
  } catch (error) {
    console.error("GET /api/units error:", error);
    return NextResponse.json({ units: standardUnits }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const parseResult = unitInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { name, code, value: rawValue, label: rawLabel } = parseResult.data;
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) {
        orgId = String(defaultOrg._id);
      }
    }

    // Generate value / symbol
    const finalValue = (
      rawValue ||
      code ||
      name
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");

    // Generate user-friendly label
    const trimmedCode = code?.trim();
    const finalLabel =
      rawLabel?.trim() ||
      (trimmedCode && trimmedCode.toLowerCase() !== name.toLowerCase()
        ? `${trimmedCode} (${name})`
        : name);

    // Check if it already exists in standard units
    const existingStandard = standardUnits.find(
      (u) =>
        u.value.toLowerCase() === finalValue.toLowerCase() ||
        u.label.toLowerCase() === finalLabel.toLowerCase(),
    );
    if (existingStandard) {
      return NextResponse.json(
        {
          message: "Unit already exists",
          unit: existingStandard,
        },
        { status: 200 },
      );
    }

    // Check if it already exists in DB
    const existingDbUnit = await Unit.findOne({
      ...(orgId ? { organizationId: orgId } : {}),
      $or: [
        { value: { $regex: new RegExp(`^${finalValue}$`, "i") } },
        { name: { $regex: new RegExp(`^${name}$`, "i") } },
        { label: { $regex: new RegExp(`^${finalLabel}$`, "i") } },
      ],
    }).lean().catch(() => null);

    if (existingDbUnit) {
      return NextResponse.json(
        {
          message: "Unit already exists",
          unit: {
            value: existingDbUnit.value,
            label: existingDbUnit.label,
          },
        },
        { status: 200 },
      );
    }

    const newUnit = await Unit.create({
      organizationId: orgId || undefined,
      name,
      value: finalValue,
      label: finalLabel,
      isCustom: true,
    });

    return NextResponse.json(
      {
        message: "Unit created successfully",
        unit: {
          value: newUnit.value,
          label: newUnit.label,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("POST /api/units error:", error);
    const message = error instanceof Error ? error.message : "Failed to create unit";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
