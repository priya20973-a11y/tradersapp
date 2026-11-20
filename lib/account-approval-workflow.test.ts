import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

vi.mock("@/lib/db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue({}),
}));

import { Organization, User } from "@/models";
import { authOptions } from "@/lib/auth-options";
import { requirePermission } from "@/lib/auth";
import { ForbiddenError } from "@/lib/errors";

describe("Account Approval Workflow: Pending Creation, Login Blocking & Admin Approval", () => {
  const credentialsProvider = authOptions.providers[0] as unknown as {
    options?: {
      authorize: (credentials: Record<string, string> | undefined, req: unknown) => Promise<unknown>;
    };
    authorize: (credentials: Record<string, string> | undefined, req: unknown) => Promise<unknown>;
  };
  const authorize = credentialsProvider?.options?.authorize ?? credentialsProvider?.authorize;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Schema & Default Status Verification", () => {
    it("Organization schema sets default status to 'pending' and includes 'pending', 'active', 'inactive', 'rejected'", () => {
      const statusPath = Organization.schema.path("status");
      expect(statusPath).toBeDefined();
      expect((statusPath as unknown as { defaultValue: string }).defaultValue).toBe("pending");

      const enumValues = (statusPath as unknown as { enumValues: string[] }).enumValues;
      expect(enumValues).toContain("pending");
      expect(enumValues).toContain("active");
      expect(enumValues).toContain("inactive");
      expect(enumValues).toContain("rejected");
    });

    it("Signup route file explicitly creates organization with status 'pending' and returns pendingApproval: true", () => {
      const signupRoutePath = path.resolve(__dirname, "../app/api/signup/route.ts");
      const signupRouteContent = fs.readFileSync(signupRoutePath, "utf-8");

      // Verify that Organization.create specifies status: "pending"
      expect(signupRouteContent).toMatch(/status:\s*["']pending["']/);
      expect(signupRouteContent).not.toMatch(/status:\s*["']active["']/);

      // Verify it returns pendingApproval flag
      expect(signupRouteContent).toContain("pendingApproval: true");
    });
  });

  describe("2. Login Blocking for Pending, Inactive, and Rejected Accounts", () => {
    const testPassword = "SecurePassword123!";
    let testPasswordHash: string;

    beforeEach(async () => {
      testPasswordHash = await bcrypt.hash(testPassword, 10);
    });

    it("blocks login when organization is in 'pending' status", async () => {
      const orgId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();

      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: userId,
          email: "pending@example.com",
          passwordHash: testPasswordHash,
          role: "Organization Owner",
          organizationId: orgId,
          failedLoginCount: 0,
          lockedUntil: null,
        }),
      } as never);

      vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({} as never);

      // Organization exists with status 'pending'
      vi.spyOn(Organization, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: orgId,
          status: "pending",
        }),
      } as never);

      const result = await authorize!({ email: "pending@example.com", password: testPassword }, {} as never);
      expect(result).toBeNull();
    });

    it("blocks login when organization is in 'rejected' status", async () => {
      const orgId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();

      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: userId,
          email: "rejected@example.com",
          passwordHash: testPasswordHash,
          role: "Organization Owner",
          organizationId: orgId,
          failedLoginCount: 0,
          lockedUntil: null,
        }),
      } as never);

      vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({} as never);

      // Organization exists with status 'rejected'
      vi.spyOn(Organization, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: orgId,
          status: "rejected",
        }),
      } as never);

      const result = await authorize!({ email: "rejected@example.com", password: testPassword }, {} as never);
      expect(result).toBeNull();
    });

    it("blocks login when organization is in 'inactive' status", async () => {
      const orgId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();

      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: userId,
          email: "inactive@example.com",
          passwordHash: testPasswordHash,
          role: "Organization Owner",
          organizationId: orgId,
          failedLoginCount: 0,
          lockedUntil: null,
        }),
      } as never);

      vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({} as never);

      // Organization exists with status 'inactive'
      vi.spyOn(Organization, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: orgId,
          status: "inactive",
        }),
      } as never);

      const result = await authorize!({ email: "inactive@example.com", password: testPassword }, {} as never);
      expect(result).toBeNull();
    });

    it("allows login only after Admin approves account (status becomes 'active')", async () => {
      const orgId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();

      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: userId,
          name: "Approved User",
          email: "approved@example.com",
          passwordHash: testPasswordHash,
          role: "Organization Owner",
          organizationId: orgId,
          permissions: [],
          authzVersion: 1,
          failedLoginCount: 0,
          lockedUntil: null,
        }),
      } as never);

      vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({} as never);

      // Organization has been approved: status is 'active'
      vi.spyOn(Organization, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: orgId,
          status: "active",
        }),
      } as never);

      const result = (await authorize!({ email: "approved@example.com", password: testPassword }, {} as never)) as {
        id: string;
        email: string;
        role: string;
        organizationId: string;
      };

      expect(result).not.toBeNull();
      expect(result.id).toBe(userId);
      expect(result.email).toBe("approved@example.com");
      expect(result.role).toBe("Organization Owner");
      expect(result.organizationId).toBe(orgId);
    });
  });

  describe("3. Session Callback and Protected API Access Verification", () => {
    const orgId = new Types.ObjectId().toString();
    const userId = new Types.ObjectId().toString();

    it("session callback strips organizationId and sets role to Inactive if organization is pending or not active", async () => {
      const sessionCallback = authOptions.callbacks?.session;
      expect(sessionCallback).toBeDefined();

      // Organization.exists only matches status: "active"; for pending/inactive it returns null/false
      vi.spyOn(Organization, "exists").mockResolvedValue(null as never);
      vi.spyOn(User, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          role: "Organization Owner",
          authzVersion: 1,
          isDeleted: false,
        }),
      } as never);

      const token = {
        id: userId,
        role: "Organization Owner",
        organizationId: orgId,
        authzVersion: 1,
      };

      const session = {
        user: {
          id: userId,
          role: "Organization Owner",
          organizationId: orgId,
        },
        expires: new Date().toISOString(),
      };

      const result = (await sessionCallback!({ session, token, user: {} as never, newSession: null, trigger: "update" })) as {
        user: { id: string; role: string; organizationId?: string; permissions?: string[] };
      };

      expect(result.user.id).toBe("");
      expect(result.user.role).toBe("Inactive");
      expect(result.user.organizationId).toBeUndefined();
      expect(result.user.permissions).toEqual([]);
    });

    it("session callback preserves active organization and roles for approved accounts", async () => {
      const sessionCallback = authOptions.callbacks?.session;

      // Organization.exists returns true for status: "active"
      vi.spyOn(Organization, "exists").mockResolvedValue({ _id: orgId } as never);
      vi.spyOn(User, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          role: "Organization Owner",
          authzVersion: 1,
          isDeleted: false,
        }),
      } as never);

      const token = {
        id: userId,
        role: "Organization Owner",
        organizationId: orgId,
        authzVersion: 1,
      };

      const session = {
        user: {
          id: userId,
          role: "Organization Owner",
          organizationId: orgId,
        },
        expires: new Date().toISOString(),
      };

      const result = (await sessionCallback!({ session, token, user: {} as never, newSession: null, trigger: "update" })) as {
        user: { id: string; role: string; organizationId?: string };
      };

      expect(result.user.id).toBe(userId);
      expect(result.user.role).toBe("Organization Owner");
      expect(result.user.organizationId).toBe(orgId);
    });

    it("requirePermission throws ForbiddenError when organization is not active", async () => {
      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: userId,
          role: "Organization Owner",
          organizationId: orgId,
          authzVersion: 0,
          authVersion: 0,
          isDeleted: false,
          permissions: [],
        }),
      } as never);

      // Organization.exists checks status: "active", returns null for pending/rejected
      vi.spyOn(Organization, "exists").mockResolvedValue(null as never);

      const fakeReq = {
        headers: {
          get: () => null,
        },
      } as unknown as Request;

      const fakeSession = {
        user: {
          id: userId,
          role: "Organization Owner",
          organizationId: orgId,
          authzVersion: 0,
          permissions: [],
        },
        expires: new Date().toISOString(),
      };

      await expect(
        requirePermission("dashboard:view", { req: fakeReq, session: fakeSession }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("4. Admin Approval Action API (/api/admin/organizations)", () => {
    it("admin route PATCH handles 'approve' transitioning status: 'pending' -> 'active'", () => {
      const adminRoutePath = path.resolve(__dirname, "../app/api/admin/organizations/route.ts");
      const adminRouteContent = fs.readFileSync(adminRoutePath, "utf-8");

      expect(adminRouteContent).toContain('input.action === "approve"');
      expect(adminRouteContent).toContain('{ _id: input.organizationId, status: "pending" }');
      expect(adminRouteContent).toContain('{ $set: { status: "active" } }');
    });

    it("admin route actionSchema validates status including 'active', 'inactive', and 'rejected'", () => {
      const adminRoutePath = path.resolve(__dirname, "../app/api/admin/organizations/route.ts");
      const adminRouteContent = fs.readFileSync(adminRoutePath, "utf-8");

      expect(adminRouteContent).toContain('z.enum(["active", "inactive", "rejected"])');
    });
  });
});
