import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { requirePermission, type AuthUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { AuditEvent, Organization } from "@/models";
import { AppError } from "@/lib/errors";
import type { ClientSession } from "mongoose";

export type TradingPermission =
  | "view-traders"
  | "manage-traders"
  | "approve-kyc"
  | "manage-bank-details"
  | "approve-credit-limits"
  | "manage-commodities"
  | "manage-deals"
  | "manage-stock-lots"
  | "approve-stock-adjustments"
  | "record-trading-payments"
  | "approve-settlements"
  | "trader-ledger"
  | "financial-export"
  | "reports"
  | "view-audit-logs";

export type TradingScope = {
  organizationId: string;
  actorId: string;
  role: string;
  isAdmin: boolean;
};

export type ScopeResult =
  | { scope: TradingScope }
  | { response: NextResponse };

function errorResponse(message: string, status: number) {
  return { response: NextResponse.json({ error: message }, { status }) } as const;
}

export async function getTradingScope(
  requestedOrganizationId: string | undefined,
  permission: TradingPermission,
  options?: { req?: Request },
): Promise<ScopeResult> {
  let user: AuthUser;
  try {
    user = await requirePermission(permission, options);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse("Authentication failed.", 401);
  }

  await connectToDatabase();
  if (user.id !== "admin") {
    if (!user.organizationId || !isValidObjectId(user.organizationId)) {
      return errorResponse("Your account is not linked to an organization.", 403);
    }
    if (requestedOrganizationId && requestedOrganizationId !== user.organizationId) {
      return errorResponse("You can only access records in your own organization.", 403);
    }
    return {
      scope: {
        organizationId: user.organizationId,
        actorId: user.id,
        role: user.role,
        isAdmin: false,
      },
    };
  }

  if (!requestedOrganizationId || !isValidObjectId(requestedOrganizationId)) {
    return errorResponse("Select an organization to manage its trading data.", 400);
  }
  const organization = await Organization.findOne({ _id: requestedOrganizationId, status: "active" }).select("_id");
  if (!organization) return errorResponse("The selected organization was not found.", 404);
  return {
    scope: {
      organizationId: String(organization._id),
      actorId: user.id,
      role: user.role,
      isAdmin: true,
    },
  };
}

export async function recordTradingAudit({
  organizationId,
  actorId,
  action,
  entityType,
  entityId,
  changes = {},
  session,
}: {
  organizationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  session?: ClientSession;
}) {
  await AuditEvent.create([{ organizationId, actorId, action, entityType, entityId, changes }], session ? { session } : {});
}

export function tradingDatabaseUnavailable(error: unknown) {
  if (
    error instanceof Error &&
    /Transaction numbers are only allowed|transactions are not supported|replica set/i.test(error.message)
  ) {
    console.error("Trading transaction support is unavailable.", error);
    return NextResponse.json(
      { error: "This operation requires MongoDB transactions. Configure MongoDB as a replica set or Atlas cluster." },
      { status: 503 },
    );
  }
  if (
    error instanceof Error &&
    /MongooseServerSelectionError|buffering timed out|querySrv|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/.test(error.message)
  ) {
    console.error("Trading API database connection failed.", error);
    return NextResponse.json(
      { error: "Trading data is temporarily unavailable. Check the MongoDB connection and try again." },
      { status: 503 },
    );
  }
  throw error;
}
