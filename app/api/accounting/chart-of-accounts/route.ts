import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ChartOfAccount, Organization } from "@/models";
import { standardAccounts } from "@/lib/expense-constants";

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const chartOfAccountInputSchema = z.object({
  name: z.string().trim().min(1, "Account name is required").max(120),
  accountType: z
    .enum(["Asset", "Liability", "Equity", "Revenue", "Expense"])
    .default("Expense"),
  normalBalance: z.enum(["debit", "credit"]).default("debit"),
  code: z.string().trim().max(50).optional(),
  organizationId: z.string().trim().optional(),
});

async function resolveOrganizationId(
  candidateId?: string | null,
  isAdmin = false
): Promise<Types.ObjectId | null> {
  // If candidateId is a valid ObjectId hex string
  if (candidateId && Types.ObjectId.isValid(candidateId)) {
    return new Types.ObjectId(candidateId);
  }

  // If candidateId is an orgId UUID or other string identifier, look up organization
  if (candidateId) {
    const org = await Organization.findOne({
      $or: [{ orgId: candidateId }, { _id: candidateId }],
    })
      .select("_id")
      .lean()
      .catch(() => null);
    if (org?._id) {
      return new Types.ObjectId(String(org._id));
    }
  }

  // Fallback to active organization or first organization in database
  const defaultOrg =
    (await Organization.findOne({ status: "active" })
      .select("_id")
      .lean()
      .catch(() => null)) ||
    (await Organization.findOne()
      .select("_id")
      .lean()
      .catch(() => null));

  if (defaultOrg?._id) {
    return new Types.ObjectId(String(defaultOrg._id));
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get("organizationId");
    const rawOrgId =
      session?.user?.id === "admin" && requestedOrgId
        ? requestedOrgId
        : session?.user?.organizationId || requestedOrgId;

    const orgObjectId = await resolveOrganizationId(
      rawOrgId,
      session?.user?.id === "admin"
    );

    if (!orgObjectId) {
      return NextResponse.json({ accounts: [] });
    }

    const accountType = searchParams.get("accountType");
    const query: Record<string, unknown> = {
      $or: [{ organizationId: orgObjectId }, { organizationId: String(orgObjectId) }],
    };
    if (accountType) {
      query.accountType = accountType;
    }

    const dbAccounts = await ChartOfAccount.find(query)
      .sort({ name: 1 })
      .lean()
      .catch(() => []);

    return NextResponse.json({
      accounts: dbAccounts.map((acc: Record<string, unknown>) => ({
        id: String(acc._id),
        _id: String(acc._id),
        name: acc.name,
        accountType: acc.accountType,
        normalBalance: acc.normalBalance,
        code: acc.code || "",
      })),
    });
  } catch (err: unknown) {
    console.error("GET /api/accounting/chart-of-accounts error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Chart of Accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get("organizationId");

    const body = await request.json().catch(() => null);
    const parsed = chartOfAccountInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid account payload" },
        { status: 400 }
      );
    }

    const rawOrgId =
      (session?.user?.id === "admin" && requestedOrgId) ||
      parsed.data.organizationId ||
      session?.user?.organizationId ||
      requestedOrgId;

    const orgObjectId = await resolveOrganizationId(
      rawOrgId,
      session?.user?.id === "admin"
    );

    if (!orgObjectId) {
      return NextResponse.json(
        { error: "Unauthorized: Active organization context required" },
        { status: 401 }
      );
    }

    const trimmedName = parsed.data.name;

    // Check against standard accounts for Expense type
    if (parsed.data.accountType === "Expense" && Array.isArray(standardAccounts)) {
      const existsInStandard = standardAccounts.some(
        (acc) => acc.toLowerCase() === trimmedName.toLowerCase()
      );
      if (existsInStandard) {
        return NextResponse.json(
          { error: `Account "${trimmedName}" already exists in Standard Expense Accounts.` },
          { status: 409 }
        );
      }
    }

    // Check duplicate in ChartOfAccount DB for this organization
    const existingAccount = await ChartOfAccount.findOne({
      $or: [{ organizationId: orgObjectId }, { organizationId: String(orgObjectId) }],
      name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
    })
      .lean()
      .catch(() => null);

    if (existingAccount) {
      return NextResponse.json(
        { error: `Account "${trimmedName}" already exists in Chart of Accounts.` },
        { status: 409 }
      );
    }

    const createdAccount = await ChartOfAccount.create({
      organizationId: orgObjectId,
      name: trimmedName,
      accountType: parsed.data.accountType,
      normalBalance: parsed.data.normalBalance,
      code: parsed.data.code || "",
    });

    return NextResponse.json(
      {
        account: {
          id: String(createdAccount._id),
          _id: String(createdAccount._id),
          name: createdAccount.name,
          accountType: createdAccount.accountType,
          normalBalance: createdAccount.normalBalance,
          code: createdAccount.code,
        },
        message: "Account created successfully in Chart of Accounts",
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("POST /api/accounting/chart-of-accounts error:", err);
    const message =
      err instanceof Error
        ? err.message
        : "Failed to create account in Chart of Accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
