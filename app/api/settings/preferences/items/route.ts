import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ItemPreference, Organization } from "@/models";

export const itemPreferenceSchema = z.object({
  inventoryEnabled: z.boolean(),
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

    const query = orgId ? { organizationId: orgId } : {};
    const pref = await ItemPreference.findOne(query).lean().catch(() => null);

    return NextResponse.json({
      inventoryEnabled: Boolean(pref?.inventoryEnabled),
    });
  } catch (err) {
    console.error("GET /api/settings/preferences/items error:", err);
    return NextResponse.json({ inventoryEnabled: false }, { status: 200 });
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

    const parseResult = itemPreferenceSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { inventoryEnabled } = parseResult.data;
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase();

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) {
        orgId = String(defaultOrg._id);
      }
    }

    const query = orgId ? { organizationId: orgId } : {};
    const updated = await ItemPreference.findOneAndUpdate(
      query,
      { $set: { inventoryEnabled, ...(orgId ? { organizationId: orgId } : {}) } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return NextResponse.json({
      ok: true,
      inventoryEnabled: Boolean(updated?.inventoryEnabled),
      message: "Inventory preferences updated successfully",
    });
  } catch (err: unknown) {
    console.error("POST /api/settings/preferences/items error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
