import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Customer, Organization, PaymentTerm } from "@/models";
import {
  STANDARD_PAYMENT_TERMS,
  type PaymentTermItem,
} from "@/lib/payment-terms";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const createPaymentTermSchema = z.object({
  name: z.string().trim().min(1, "Payment term name is required").max(60, "Term name is too long"),
  days: z.coerce.number().int().min(0, "Due days must be at least 0").max(365, "Due days cannot exceed 365"),
  organizationId: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId");

    let orgId = session?.user?.organizationId;
    if (session?.user?.id === "admin" && requestedOrgId && isValidObjectId(requestedOrgId)) {
      orgId = requestedOrgId;
    }

    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) {
        orgId = String(defaultOrg._id);
      }
    }

    const termsMap = new Map<string, PaymentTermItem>();

    // 1. Add standard terms
    for (const term of STANDARD_PAYMENT_TERMS) {
      termsMap.set(term.name.toLowerCase(), {
        id: term.id,
        name: term.name,
        days: term.days,
        isCustom: false,
      });
    }

    // 2. Fetch custom payment terms from database
    const query = orgId
      ? { $or: [{ organizationId: orgId }, { organizationId: { $exists: false } }] }
      : {};

    const dbTerms = await PaymentTerm.find(query).sort({ days: 1, name: 1 }).lean().catch(() => []);

    for (const item of dbTerms) {
      if (item.name) {
        const key = item.name.trim().toLowerCase();
        termsMap.set(key, {
          id: String(item._id),
          name: item.name.trim(),
          days: Number(item.days ?? 0),
          isCustom: true,
        });
      }
    }

    // 3. Collect any existing custom terms currently used on Customer records
    const custQuery = orgId ? { organizationId: orgId } : {};
    const customerTerms = await Customer.distinct("paymentTerms", custQuery).catch(() => []);

    for (const rawTerm of customerTerms) {
      if (rawTerm && typeof rawTerm === "string") {
        const trimmed = rawTerm.trim();
        const key = trimmed.toLowerCase();
        if (!termsMap.has(key)) {
          // Infer days from regex if possible
          const match = trimmed.match(/Net\s*(\d+)/i) || trimmed.match(/(\d+)\s*days?/i) || trimmed.match(/\b(\d+)\b/);
          const days = match ? parseInt(match[1], 10) : 0;
          termsMap.set(key, {
            id: `cust-${key}`,
            name: trimmed,
            days: isNaN(days) ? 0 : days,
            isCustom: true,
          });
        }
      }
    }

    return NextResponse.json({
      terms: Array.from(termsMap.values()),
    });
  } catch (error) {
    console.error("GET /api/payment-terms error:", error);
    return NextResponse.json(
      { terms: [...STANDARD_PAYMENT_TERMS] },
      { status: 200 }
    );
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

    const parseResult = createPaymentTermSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = Object.values(parseResult.error.flatten().fieldErrors)[0]?.[0];
      return NextResponse.json(
        { error: firstError || "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name: rawName, days, organizationId: requestedOrgId } = parseResult.data;
    const name = rawName.trim();

    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    let orgId = session?.user?.organizationId;
    if (session?.user?.id === "admin" && requestedOrgId && isValidObjectId(requestedOrgId)) {
      orgId = requestedOrgId;
    }

    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) {
        orgId = String(defaultOrg._id);
      }
    }

    // 1. Check duplicate against standard payment terms (case-insensitive)
    const duplicateStandard = STANDARD_PAYMENT_TERMS.find(
      (t) => t.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicateStandard) {
      return NextResponse.json(
        {
          error: `Payment term "${name}" already exists as a standard term.`,
          term: duplicateStandard,
        },
        { status: 400 }
      );
    }

    // 2. Check duplicate against database for this organization (case-insensitive)
    const existingDbTerm = await PaymentTerm.findOne({
      ...(orgId ? { organizationId: orgId } : {}),
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") },
    }).lean().catch(() => null);

    if (existingDbTerm) {
      return NextResponse.json(
        {
          error: `Payment term "${name}" already exists.`,
          term: {
            id: String(existingDbTerm._id),
            name: existingDbTerm.name,
            days: existingDbTerm.days,
            isCustom: true,
          },
        },
        { status: 400 }
      );
    }

    // 3. Save new custom payment term in database
    const createdTerm = await PaymentTerm.create({
      organizationId: orgId || undefined,
      name,
      days,
      isCustom: true,
    });

    return NextResponse.json(
      {
        message: "Payment term created successfully",
        term: {
          id: String(createdTerm._id),
          name: createdTerm.name,
          days: createdTerm.days,
          isCustom: true,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/payment-terms error:", error);
    const message = error instanceof Error ? error.message : "Failed to create payment term";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
