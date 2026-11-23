import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Organization, SalesDocument, Salesperson } from "@/models";

export const salespersonInputSchema = z.object({
  name: z.string().trim().min(1, "Salesperson name is required").max(100),
  email: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId");
    let orgId = session?.user?.organizationId || (session?.user?.id === "admin" && requestedOrgId ? requestedOrgId : undefined);

    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) {
        orgId = String(defaultOrg._id);
      }
    }

    const orgQuery = orgId ? { organizationId: orgId } : {};
    const namesSet = new Set<string>();

    // 1. Fetch saved salespersons from Salesperson collection
    const dbSalespersons = await Salesperson.find(orgQuery)
      .sort({ name: 1 })
      .lean()
      .catch(() => []);

    for (const sp of dbSalespersons) {
      if (sp?.name && typeof sp.name === "string") {
        const trimmed = sp.name.trim();
        if (trimmed) namesSet.add(trimmed);
      }
    }

    // 2. Fetch distinct salespersons from existing sales documents
    const docSalespersons = await SalesDocument.distinct("salesperson", {
      ...orgQuery,
      salesperson: { $exists: true, $ne: "" },
    }).catch(() => []);

    for (const rawName of docSalespersons) {
      if (rawName && typeof rawName === "string") {
        const trimmed = rawName.trim();
        if (trimmed) namesSet.add(trimmed);
      }
    }

    // 3. Deduplicate case-insensitively while preserving original capitalisation
    const caseMap = new Map<string, string>();
    for (const name of namesSet) {
      const lower = name.toLowerCase();
      if (!caseMap.has(lower)) {
        caseMap.set(lower, name);
      }
    }

    const uniqueSalespersons = Array.from(caseMap.values()).sort((a, b) =>
      a.localeCompare(b),
    );

    return NextResponse.json({
      salespersons: uniqueSalespersons,
      data: dbSalespersons,
    });
  } catch (error) {
    console.error("GET /api/salespersons error:", error);
    return NextResponse.json({ salespersons: [] }, { status: 200 });
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

    const parseResult = salespersonInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { name, email, phone } = parseResult.data;
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) {
        orgId = String(defaultOrg._id);
      }
    }

    const escapedName = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const nameRegex = new RegExp(`^${escapedName}$`, "i");

    const existing = await Salesperson.findOne({
      ...(orgId ? { organizationId: orgId } : {}),
      name: { $regex: nameRegex },
    }).catch(() => null);

    if (existing) {
      return NextResponse.json(
        {
          message: "Salesperson already exists",
          salesperson: {
            id: String(existing._id),
            name: existing.name,
            email: existing.email || "",
            phone: existing.phone || "",
          },
        },
        { status: 200 },
      );
    }

    const newSalesperson = await Salesperson.create({
      organizationId: orgId,
      name,
      email: email || "",
      phone: phone || "",
      active: true,
      isCustom: true,
    }).catch(() => null);

    return NextResponse.json(
      {
        message: "Salesperson created successfully",
        salesperson: {
          id: newSalesperson ? String(newSalesperson._id) : undefined,
          name,
          email: email || "",
          phone: phone || "",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/salespersons error:", error);
    return NextResponse.json({ error: "Failed to create salesperson" }, { status: 500 });
  }
}
