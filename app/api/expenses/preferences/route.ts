import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { MileagePreference, Organization } from "@/models";

const mileagePreferenceSchema = z.object({
  category: z.string().trim().default("Standard Business Travel"),
  unit: z.enum(["KM", "Mile"]).default("KM"),
  startDate: z.string().default("2026-04-01"),
  rate: z.coerce.number().min(0.1, "Rate must be positive").default(12.0),
});

const defaultPreferences = {
  category: "Standard Business Travel",
  unit: "KM" as const,
  startDate: "2026-04-01",
  rate: 12.0,
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    const query = orgId ? { organizationId: orgId } : {};
    const pref = await MileagePreference.findOne(query).lean().catch(() => null);

    if (!pref) {
      return NextResponse.json({ preferences: defaultPreferences });
    }

    return NextResponse.json({
      preferences: {
        category: pref.category || defaultPreferences.category,
        unit: pref.unit || defaultPreferences.unit,
        startDate: pref.startDate || defaultPreferences.startDate,
        rate: Number(pref.rate || defaultPreferences.rate),
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/expenses/preferences error:", err);
    return NextResponse.json({ preferences: defaultPreferences });
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parseResult = mileagePreferenceSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parseResult.data;
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase();

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean();
      if (!defaultOrg) {
        return NextResponse.json({ error: "No organization found" }, { status: 400 });
      }
      orgId = String(defaultOrg._id);
    }

    const updated = await MileagePreference.findOneAndUpdate(
      { organizationId: orgId },
      {
        organizationId: orgId,
        category: data.category,
        unit: data.unit,
        startDate: data.startDate,
        rate: data.rate,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return NextResponse.json({
      message: "Mileage preferences updated successfully",
      preferences: {
        category: updated.category,
        unit: updated.unit,
        startDate: updated.startDate,
        rate: updated.rate,
      },
    });
  } catch (err: unknown) {
    console.error("POST /api/expenses/preferences error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
