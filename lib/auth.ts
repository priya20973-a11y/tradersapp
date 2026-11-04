import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { getToken, type JWT } from "next-auth/jwt";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Organization, User } from "@/models";
import { logger } from "@/lib/logger";
import { AuthError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { authOptions } from "./auth-options";
import { rolePermissions, type RoleName, canAccessRole } from "./auth-roles";

export { authOptions };
export { rolePermissions, type RoleName, canAccessRole };

export interface AuthUser {
  id: string;
  name?: string;
  email?: string;
  role: string;
  organizationId?: string;
  tenantId?: string;
  permissions: string[];
  authzVersion: number;
  authVersion?: number;
}

export interface RequirePermissionOptions {
  req?: Request | { headers?: Headers | Record<string, string | string[] | undefined>; cookies?: Record<string, string> };
  token?: JWT | null;
  session?: Session | null;
  organizationId?: string;
}

/**
 * Server-side fine-grained permission enforcement.
 *
 * 1. Loads current user and organization from MongoDB (never trusts stale JWT claims).
 * 2. Compares the JWT's `authzVersion` with the database value; rejects stale tokens immediately.
 * 3. Resolves current permissions from MongoDB role & permission assignments.
 * 4. Enforces organization tenant isolation.
 * 5. Fails closed on any error, missing user, inactive org, or permission failure.
 */
export async function requirePermission(
  permission: string,
  options?: RequirePermissionOptions | Request,
): Promise<AuthUser>;
export async function requirePermission(
  req: Request,
  permission: string,
  options?: RequirePermissionOptions,
): Promise<AuthUser>;
export async function requirePermission(
  arg1: string | Request,
  arg2?: string | RequirePermissionOptions | Request,
  arg3?: RequirePermissionOptions,
): Promise<AuthUser> {
  let permission: string;
  let options: RequirePermissionOptions = {};

  if (typeof arg1 === "string") {
    permission = arg1;
    if (arg2 && typeof arg2 === "object") {
      if ("url" in arg2 || "headers" in arg2) {
        options = { req: arg2 as Request };
      } else {
        options = arg2 as RequirePermissionOptions;
      }
    }
  } else {
    options = { req: arg1, ...(arg3 ?? {}) };
    permission = typeof arg2 === "string" ? arg2 : "all";
  }

  // 1. Resolve JWT token
  let token: JWT | null = options.token ?? null;

  if (!token && options.req) {
    try {
      token = await getToken({
        req: options.req as Parameters<typeof getToken>[0]["req"],
        secret: process.env.NEXTAUTH_SECRET,
      });
    } catch {
      token = null;
    }
  }

  if (!token && !options.req) {
    try {
      const { cookies, headers } = await import("next/headers");
      const cookieStore = await cookies();
      const headerList = await headers();
      const cookieHeader = cookieStore.toString() || headerList.get("cookie") || "";
      const authHeader = headerList.get("authorization") || undefined;
      token = await getToken({
        req: {
          headers: {
            cookie: cookieHeader,
            authorization: authHeader,
          },
        } as Parameters<typeof getToken>[0]["req"],
        secret: process.env.NEXTAUTH_SECRET,
      });
    } catch {
      // Not running inside a Next.js request context
    }
  }

  if (!token) {
    const session = options.session ?? (await getServerSession(authOptions).catch(() => null));
    if (session?.user) {
      token = {
        id: session.user.id,
        role: session.user.role,
        organizationId: session.user.organizationId,
        tenantId: session.user.tenantId,
        permissions: session.user.permissions,
        authzVersion: session.user.authzVersion,
        authVersion: session.user.authVersion,
        email: session.user.email ?? undefined,
      };
    }
  }

  // Fail closed if unauthenticated
  if (!token || !token.id || token.id === "" || token.role === "Inactive") {
    throw new AuthError("Authentication required. Please sign in.");
  }

  // 2. Super Admin handling
  if (token.id === "admin") {
    if (token.role !== "Super Admin") {
      throw new ForbiddenError("Administrator access required.");
    }
    const adminPermissions = rolePermissions["Super Admin"] ?? ["all"];
    if (!adminPermissions.includes("all") && !adminPermissions.includes(permission)) {
      throw new ForbiddenError("You do not have permission to perform this action.");
    }
    return {
      id: "admin",
      name: "Admin",
      email: token.email ?? process.env.ADMIN_EMAIL ?? "admin",
      role: "Super Admin",
      permissions: adminPermissions,
      authzVersion: 0,
      authVersion: 0,
    };
  }

  // 3. Database user verification
  if (!isValidObjectId(token.id)) {
    throw new AuthError("Invalid user session identifier.");
  }

  await connectToDatabase();

  const currentUser = await User.findOne({
    _id: token.id,
    isDeleted: { $ne: true },
  }).select("name email role permissions organizationId authzVersion authVersion isDeleted");

  // Fail closed if user is missing or deleted
  if (!currentUser || currentUser.isDeleted) {
    logger.warn({ userId: token.id }, "Authentication rejected: user account missing or deactivated");
    throw new AuthError("User account not found or deactivated.");
  }

  // Compare JWT's authzVersion with DB value — reject stale tokens
  const tokenAuthzVersion = Number(token.authzVersion ?? token.authVersion ?? 0);
  const dbAuthzVersion = Number(currentUser.authzVersion ?? currentUser.authVersion ?? 0);

  if (tokenAuthzVersion !== dbAuthzVersion) {
    logger.warn(
      {
        userId: currentUser._id,
        tokenAuthzVersion,
        dbAuthzVersion,
      },
      "Stale JWT authorization rejected: authzVersion mismatch",
    );
    throw new AuthError("Session expired or token is stale. Please sign in again.");
  }

  // Validate organization status
  if (currentUser.organizationId) {
    const activeOrganization = await Organization.exists({
      _id: currentUser.organizationId,
      status: "active",
    });
    if (!activeOrganization) {
      logger.warn({ organizationId: currentUser.organizationId }, "Access denied: organization inactive or not found");
      throw new ForbiddenError("Your organization is inactive or not found.");
    }
  }

  // Tenant isolation check
  if (options.organizationId && currentUser.organizationId) {
    if (String(currentUser.organizationId) !== String(options.organizationId)) {
      logger.warn(
        {
          userOrg: currentUser.organizationId,
          requestedOrg: options.organizationId,
          userId: currentUser._id,
        },
        "Cross-organization access rejected",
      );
      throw new ForbiddenError("You can only access records in your own organization.");
    }
  }

  // 4. Resolve permissions from current MongoDB data (NOT stale JWT claims)
  const currentRole = typeof currentUser.role === "string" ? currentUser.role : "Administrator";
  const roleAllowed = rolePermissions[currentRole] ?? [];
  const userCustomPermissions = Array.isArray(currentUser.permissions) ? (currentUser.permissions as string[]) : [];
  const currentPermissions = Array.from(new Set([...roleAllowed, ...userCustomPermissions]));

  const hasPermission =
    permission === "authenticated" ||
    currentPermissions.includes("all") ||
    currentPermissions.includes(permission);

  if (!hasPermission) {
    logger.warn(
      {
        userId: currentUser._id,
        role: currentRole,
        requiredPermission: permission,
      },
      "Permission denied for current database role",
    );
    throw new ForbiddenError("You do not have permission to perform this action.");
  }

  return {
    id: String(currentUser._id),
    name: typeof currentUser.name === "string" ? currentUser.name : (typeof currentUser.email === "string" ? currentUser.email : undefined),
    email: typeof currentUser.email === "string" ? currentUser.email : undefined,
    role: currentRole,
    organizationId: currentUser.organizationId ? String(currentUser.organizationId) : undefined,
    tenantId: currentUser.organizationId ? String(currentUser.organizationId) : undefined,
    permissions: currentPermissions,
    authzVersion: dbAuthzVersion,
    authVersion: dbAuthzVersion,
  };
}

/**
 * Update a user's role and/or custom permissions and atomically increment their authzVersion.
 * This guarantees that all previously issued JWTs for this user will be rejected as stale.
 */
export async function updateUserRoleAndPermissions({
  userId,
  organizationId,
  role,
  permissions,
}: {
  userId: string;
  organizationId?: string;
  role?: string;
  permissions?: string[];
}) {
  await connectToDatabase();
  const filter: Record<string, unknown> = {
    _id: userId,
    isDeleted: { $ne: true },
  };
  if (organizationId) {
    filter.organizationId = organizationId;
  }

  const update: Record<string, unknown> = {
    $inc: { authzVersion: 1, authVersion: 1 },
  };

  const setFields: Record<string, unknown> = {};
  if (role) {
    setFields.role = role;
  }
  if (permissions) {
    setFields.permissions = permissions;
  }
  if (Object.keys(setFields).length > 0) {
    update.$set = setFields;
  }

  const updatedUser = await User.findOneAndUpdate(filter, update, { new: true })
    .select("_id name email role permissions organizationId authzVersion authVersion")
    .lean();

  if (!updatedUser) {
    throw new NotFoundError("User not found or has been deactivated.");
  }

  logger.info(
    {
      userId: updatedUser._id,
      newRole: updatedUser.role,
      newAuthzVersion: updatedUser.authzVersion,
    },
    "Updated user role/permissions and incremented authzVersion",
  );

  return {
    id: String(updatedUser._id),
    name: typeof updatedUser.name === "string" ? updatedUser.name : undefined,
    email: typeof updatedUser.email === "string" ? updatedUser.email : undefined,
    role: String(updatedUser.role),
    permissions: (updatedUser.permissions as string[]) ?? rolePermissions[String(updatedUser.role)] ?? [],
    authzVersion: Number(updatedUser.authzVersion ?? 0),
    authVersion: Number(updatedUser.authVersion ?? 0),
    organizationId: updatedUser.organizationId ? String(updatedUser.organizationId) : undefined,
  };
}
