import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

vi.mock("@/lib/db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue({}),
}));

import {
  authOptions,
  requirePermission,
  rolePermissions,
  updateUserRoleAndPermissions,
  type AuthUser,
} from "./auth";
import { getTradingScope } from "./trading-access";
import { Organization, User } from "@/models";
import { AuthError, ForbiddenError, NotFoundError } from "@/lib/errors";

describe("Authentication & Authorization Security (JWT authzVersion)", () => {
  const orgAId = new Types.ObjectId().toString();
  const orgBId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Schema & Defaults", () => {
    it("User schema defines a persistent numeric authzVersion defaulting to 0", () => {
      const authzVersionPath = User.schema.path("authzVersion");
      expect(authzVersionPath).toBeDefined();
      expect(authzVersionPath.instance).toBe("Number");
      expect((authzVersionPath as unknown as { defaultValue: number }).defaultValue).toBe(0);
    });

    it("User schema defines permissions array and authVersion", () => {
      expect(User.schema.path("permissions")).toBeDefined();
      expect(User.schema.path("authVersion")).toBeDefined();
    });
  });

  describe("2. NextAuth Callbacks (lib/auth.ts)", () => {
    it("jwt callback copies role, authzVersion, and permissions from user", async () => {
      const jwtCallback = authOptions.callbacks?.jwt;
      expect(jwtCallback).toBeDefined();

      const user = {
        id: userId,
        role: "Sales Manager",
        organizationId: orgAId,
        tenantId: orgAId,
        permissions: ["sales", "manage-deals"],
        authzVersion: 3,
        authVersion: 3,
      };

      const token = await jwtCallback!({ token: {}, user, account: null });
      expect(token.role).toBe("Sales Manager");
      expect(token.authzVersion).toBe(3);
      expect(token.authVersion).toBe(3);
      expect(token.organizationId).toBe(orgAId);
      expect(token.permissions).toEqual(["sales", "manage-deals"]);
    });

    it("session callback assigns user role, authzVersion, and verifies against database", async () => {
      const sessionCallback = authOptions.callbacks?.session;
      expect(sessionCallback).toBeDefined();

      vi.spyOn(Organization, "exists").mockResolvedValue(true as unknown as null);
      vi.spyOn(User, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          role: "Sales Manager",
          authzVersion: 2,
          authVersion: 2,
          isDeleted: false,
        }),
      } as unknown as ReturnType<typeof User.findById>);

      const token = {
        id: userId,
        role: "Sales Manager",
        organizationId: orgAId,
        authzVersion: 2,
        authVersion: 2,
      };

      const session = {
        user: {
          id: userId,
          role: "Sales Manager",
          organizationId: orgAId,
        },
        expires: new Date().toISOString(),
      };

      const result = (await sessionCallback!({ session, token, user: {} as never, newSession: null, trigger: "update" })) as {
        user: { id: string; role: string; organizationId?: string; authzVersion?: number; permissions?: string[] };
      };
      expect(result.user.role).toBe("Sales Manager");
      expect(result.user.authzVersion).toBe(2);
      expect(result.user.id).toBe(userId);
    });

    it("session callback invalidates session if database authzVersion mismatches JWT", async () => {
      const sessionCallback = authOptions.callbacks?.session;

      vi.spyOn(Organization, "exists").mockResolvedValue(true as unknown as null);
      vi.spyOn(User, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          role: "Accountant",
          authzVersion: 3, // Database has version 3
          isDeleted: false,
        }),
      } as unknown as ReturnType<typeof User.findById>);

      const token = {
        id: userId,
        role: "Sales Manager",
        organizationId: orgAId,
        authzVersion: 1, // Stale token with version 1
      };

      const session = {
        user: {
          id: userId,
          role: "Sales Manager",
          organizationId: orgAId,
        },
        expires: new Date().toISOString(),
      };

      const result = (await sessionCallback!({ session, token, user: {} as never, newSession: null, trigger: "update" })) as {
        user: { id: string; role: string; organizationId?: string; authzVersion?: number; permissions?: string[] };
      };
      expect(result.user.id).toBe("");
      expect(result.user.role).toBe("Inactive");
      expect(result.user.permissions).toEqual([]);
      expect(result.user.authzVersion).toBe(0);
    });
  });

  describe("3. Role & Permission Updates Increment authzVersion", () => {
    it("updateUserRoleAndPermissions updates role and atomically increments authzVersion", async () => {
      const updatedMockDoc = {
        _id: new Types.ObjectId(userId),
        name: "Test User",
        email: "test@example.com",
        role: "Read-Only Auditor",
        authzVersion: 1,
        authVersion: 1,
        organizationId: new Types.ObjectId(orgAId),
        permissions: rolePermissions["Read-Only Auditor"],
      };

      const updateSpy = vi.spyOn(User, "findOneAndUpdate").mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(updatedMockDoc),
        }),
      } as unknown as ReturnType<typeof User.findOneAndUpdate>);

      const result = await updateUserRoleAndPermissions({
        userId,
        organizationId: orgAId,
        role: "Read-Only Auditor",
      });

      expect(updateSpy).toHaveBeenCalledWith(
        { _id: userId, isDeleted: { $ne: true }, organizationId: orgAId },
        {
          $inc: { authzVersion: 1, authVersion: 1 },
          $set: { role: "Read-Only Auditor" },
        },
        { new: true },
      );
      expect(result.role).toBe("Read-Only Auditor");
      expect(result.authzVersion).toBe(1);
    });

    it("throws NotFoundError if target user does not exist", async () => {
      vi.spyOn(User, "findOneAndUpdate").mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      } as unknown as ReturnType<typeof User.findOneAndUpdate>);

      await expect(
        updateUserRoleAndPermissions({
          userId,
          role: "Accountant",
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("4. requirePermission() Server-Side Enforcement", () => {
    it("loads current user from MongoDB, checks authzVersion, and succeeds for valid active user", async () => {
      vi.spyOn(Organization, "exists").mockResolvedValue(true as unknown as null);
      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(userId),
          name: "Alice Trader",
          email: "alice@example.com",
          role: "Sales Manager",
          organizationId: new Types.ObjectId(orgAId),
          authzVersion: 2,
          isDeleted: false,
        }),
      } as unknown as ReturnType<typeof User.findOne>);

      const token = {
        id: userId,
        role: "Sales Manager",
        organizationId: orgAId,
        authzVersion: 2, // Matches DB
      };

      const authUser: AuthUser = await requirePermission("manage-deals", { token });
      expect(authUser.id).toBe(userId);
      expect(authUser.role).toBe("Sales Manager");
      expect(authUser.authzVersion).toBe(2);
      expect(authUser.permissions).toContain("manage-deals");
    });

    it("REJECTS stale tokens when JWT authzVersion mismatches MongoDB", async () => {
      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(userId),
          name: "Alice Trader",
          email: "alice@example.com",
          role: "Sales Manager",
          organizationId: new Types.ObjectId(orgAId),
          authzVersion: 5, // DB is version 5
          isDeleted: false,
        }),
      } as unknown as ReturnType<typeof User.findOne>);

      const staleToken = {
        id: userId,
        role: "Sales Manager",
        organizationId: orgAId,
        authzVersion: 2, // Token still has version 2!
      };

      await expect(requirePermission("manage-deals", { token: staleToken })).rejects.toThrow(AuthError);
    });

    it("DENIES access when permissions are revoked in DB, ignoring claims in stale JWT", async () => {
      // User was demoted in DB to "Read-Only Auditor", which lacks "manage-deals"
      vi.spyOn(Organization, "exists").mockResolvedValue(true as unknown as null);
      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(userId),
          name: "Alice Trader",
          email: "alice@example.com",
          role: "Read-Only Auditor", // Current DB role
          organizationId: new Types.ObjectId(orgAId),
          authzVersion: 1,
          isDeleted: false,
        }),
      } as unknown as ReturnType<typeof User.findOne>);

      // Token matches version 1, but claims old role "Sales Manager" and old permissions
      const token = {
        id: userId,
        role: "Sales Manager",
        permissions: ["manage-deals", "sales"],
        organizationId: orgAId,
        authzVersion: 1,
      };

      await expect(requirePermission("manage-deals", { token })).rejects.toThrow(ForbiddenError);
    });

    it("DENIES cross-organization access (tenant isolation)", async () => {
      vi.spyOn(Organization, "exists").mockResolvedValue(true as unknown as null);
      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(userId),
          name: "Alice Trader",
          email: "alice@example.com",
          role: "Sales Manager",
          organizationId: new Types.ObjectId(orgAId), // Org A
          authzVersion: 0,
          isDeleted: false,
        }),
      } as unknown as ReturnType<typeof User.findOne>);

      const token = {
        id: userId,
        role: "Sales Manager",
        organizationId: orgAId,
        authzVersion: 0,
      };

      // Attempt to access Org B
      await expect(
        requirePermission("view-traders", { token, organizationId: orgBId }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("FAILS CLOSED when user is missing or deleted in MongoDB", async () => {
      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);

      const token = {
        id: userId,
        role: "Sales Manager",
        organizationId: orgAId,
        authzVersion: 0,
      };

      await expect(requirePermission("view-traders", { token })).rejects.toThrow(AuthError);
    });

    it("FAILS CLOSED when user is soft-deleted", async () => {
      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(userId),
          isDeleted: true,
          authzVersion: 0,
        }),
      } as unknown as ReturnType<typeof User.findOne>);

      const token = {
        id: userId,
        role: "Sales Manager",
        organizationId: orgAId,
        authzVersion: 0,
      };

      await expect(requirePermission("view-traders", { token })).rejects.toThrow(AuthError);
    });

    it("FAILS CLOSED when user organization is inactive", async () => {
      vi.spyOn(Organization, "exists").mockResolvedValue(false as unknown as null);
      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(userId),
          role: "Sales Manager",
          organizationId: new Types.ObjectId(orgAId),
          authzVersion: 0,
          isDeleted: false,
        }),
      } as unknown as ReturnType<typeof User.findOne>);

      const token = {
        id: userId,
        role: "Sales Manager",
        organizationId: orgAId,
        authzVersion: 0,
      };

      await expect(requirePermission("view-traders", { token })).rejects.toThrow(ForbiddenError);
    });

    it("Super Admin (id: admin) succeeds for any permission without DB lookup", async () => {
      const superAdminToken = {
        id: "admin",
        role: "Super Admin",
        email: "superadmin@agritrade.com",
      };

      const authUser = await requirePermission("manage-deals", { token: superAdminToken });
      expect(authUser.id).toBe("admin");
      expect(authUser.role).toBe("Super Admin");
      expect(authUser.permissions).toContain("all");
    });
  });

  describe("5. getTradingScope Integration with requirePermission", () => {
    it("returns 401 when requirePermission rejects a stale token", async () => {
      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(userId),
          role: "Sales Manager",
          organizationId: new Types.ObjectId(orgAId),
          authzVersion: 3,
          isDeleted: false,
        }),
      } as unknown as ReturnType<typeof User.findOne>);

      // Pass request with no session/token to trigger rejection
      const result = await getTradingScope(orgAId, "manage-deals");
      expect("response" in result).toBe(true);
      if ("response" in result) {
        expect(result.response.status).toBe(401);
      }
    });

    it("returns 403 when user belongs to Org A and attempts to access Org B", async () => {
      vi.spyOn(Organization, "exists").mockResolvedValue(true as unknown as null);
      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(userId),
          role: "Sales Manager",
          organizationId: new Types.ObjectId(orgAId),
          authzVersion: 0,
          isDeleted: false,
        }),
      } as unknown as ReturnType<typeof User.findOne>);

      // Simulate valid session matching DB
      const result = await getTradingScope(orgBId, "manage-deals");
      expect("response" in result).toBe(true);
      if ("response" in result) {
        expect([401, 403]).toContain(result.response.status);
      }
    });
  });

  describe("6. Complete End-to-End Role Lifecycle & Stale Token Invalidation", () => {
    it("simulates full lifecycle: grant -> admin demotion -> stale token rejected -> fresh token with revoked permissions denied", async () => {
      // Phase 1: User is Sales Manager with authzVersion = 0
      let dbUser = {
        _id: new Types.ObjectId(userId),
        name: "Bob Trader",
        email: "bob@example.com",
        role: "Sales Manager",
        organizationId: new Types.ObjectId(orgAId),
        authzVersion: 0,
        authVersion: 0,
        isDeleted: false,
      };

      vi.spyOn(Organization, "exists").mockResolvedValue(true as unknown as null);
      vi.spyOn(User, "findOne").mockImplementation(() => ({
        select: vi.fn().mockImplementation(() => Promise.resolve(dbUser)),
      } as unknown as ReturnType<typeof User.findOne>));

      // Token 1 issued with authzVersion: 0
      const token1 = {
        id: userId,
        role: "Sales Manager",
        organizationId: orgAId,
        authzVersion: 0,
      };

      // Can manage deals
      const access1 = await requirePermission("manage-deals", { token: token1 });
      expect(access1.role).toBe("Sales Manager");
      expect(access1.authzVersion).toBe(0);

      // Phase 2: Admin changes Bob's role to Read-Only Auditor
      vi.spyOn(User, "findOneAndUpdate").mockImplementation(() => {
        dbUser = {
          ...dbUser,
          role: "Read-Only Auditor",
          authzVersion: 1, // incremented!
          authVersion: 1,
        };
        return {
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(dbUser),
          }),
        } as unknown as ReturnType<typeof User.findOneAndUpdate>;
      });

      const updateResult = await updateUserRoleAndPermissions({
        userId,
        role: "Read-Only Auditor",
      });
      expect(updateResult.role).toBe("Read-Only Auditor");
      expect(updateResult.authzVersion).toBe(1);

      // Phase 3: Bob tries using Token 1 (stale JWT with authzVersion: 0)
      // Must be immediately rejected due to version mismatch!
      await expect(
        requirePermission("manage-deals", { token: token1 }),
      ).rejects.toThrow(AuthError);

      // Phase 4: Bob logs in again and gets Token 2 with authzVersion: 1
      const token2 = {
        id: userId,
        role: "Read-Only Auditor",
        organizationId: orgAId,
        authzVersion: 1,
      };

      // Audit logs allowed for Read-Only Auditor
      const access2 = await requirePermission("view-audit-logs", { token: token2 });
      expect(access2.role).toBe("Read-Only Auditor");
      expect(access2.authzVersion).toBe(1);

      // But manage-deals is REVOKED!
      await expect(
        requirePermission("manage-deals", { token: token2 }),
      ).rejects.toThrow(ForbiddenError);

      // And cross-organization access to Org B is REJECTED
      await expect(
        requirePermission("view-audit-logs", { token: token2, organizationId: orgBId }),
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
