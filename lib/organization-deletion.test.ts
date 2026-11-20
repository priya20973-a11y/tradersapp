import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import fs from "fs";
import path from "path";

// Mock DB connection
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    connectToDatabase: vi.fn().mockResolvedValue({}),
    withTransaction: vi.fn(async (fn: (session?: unknown) => Promise<unknown>) => {
      // Simulate withTransaction executing callback with mock session
      return await fn({ id: "mock-session" });
    }),
  };
});

import { DELETE } from "@/app/api/admin/organizations/route";
import { withTransaction } from "@/lib/db";
import * as models from "@/models";
import {
  Customer,
  Expense,
  Invoice,
  Item,
  Organization,
  PurchaseBill,
  PurchaseOrder,
  User,
  Vendor,
} from "@/models";
import * as authModule from "@/lib/auth";

describe("Organization Deletion: Full Dependent Cleanup, Safety & Isolation", () => {
  const targetOrgId = new Types.ObjectId().toString();
  const otherOrgId = new Types.ObjectId().toString();
  const adminId = "admin";

  beforeEach(() => {
    vi.restoreAllMocks();
    for (const model of Object.values(models)) {
      if (typeof model === "function" && "deleteMany" in model) {
        vi.spyOn(model as Pick<typeof Organization, "deleteMany">, "deleteMany").mockResolvedValue({
          deletedCount: 0,
        } as never);
      }
    }
  });

  describe("1. Static Inspection & Model Coverage", () => {
    it("uses withTransaction from lib/db instead of raw startSession()", () => {
      const routePath = path.resolve(__dirname, "../app/api/admin/organizations/route.ts");
      const routeContent = fs.readFileSync(routePath, "utf-8");

      expect(routeContent).toContain('import { connectToDatabase, withTransaction } from "@/lib/db";');
      expect(routeContent).not.toMatch(/await startSession\(\)/);
      expect(routeContent).toContain("await withTransaction(async (session) => {");
    });

    it("includes comprehensive set of organization-specific models in deletion array", () => {
      const routePath = path.resolve(__dirname, "../app/api/admin/organizations/route.ts");
      const routeContent = fs.readFileSync(routePath, "utf-8");

      // Verify newer and core models are all included
      const expectedModels = [
        "PurchaseOrder",
        "PurchaseBill",
        "Expense",
        "RecurringExpense",
        "VendorCredit",
        "VendorPayment",
        "StockLot",
        "StockLocation",
        "ItemPreference",
        "PaymentTerm",
        "Unit",
        "CustomReport",
        "BuyerProfile",
        "BuyingRequest",
      ];

      for (const model of expectedModels) {
        expect(routeContent).toContain(model);
      }
    });
  });

  describe("2. Pre-condition Validations & Restrictions", () => {
    it("rejects deletion if confirmation name does not match", async () => {
      vi.spyOn(authModule, "requirePermission").mockResolvedValue({
        id: adminId,
        role: "Super Admin",
        permissions: ["all"],
        authzVersion: 0,
      });

      vi.spyOn(Organization, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(targetOrgId),
          name: "Correct Org Name",
        }),
      } as never);

      const request = new Request("http://localhost:3000/api/admin/organizations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: targetOrgId,
          confirmDelete: true,
          confirmationName: "Wrong Name",
        }),
      });

      const response = (await DELETE(request))!;
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("The organization name did not match. Nothing was deleted.");
    });

    it("returns 404 if the organization does not exist", async () => {
      vi.spyOn(authModule, "requirePermission").mockResolvedValue({
        id: adminId,
        role: "Super Admin",
        permissions: ["all"],
        authzVersion: 0,
      });

      vi.spyOn(Organization, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as never);

      const request = new Request("http://localhost:3000/api/admin/organizations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: targetOrgId,
          confirmDelete: true,
          confirmationName: "Nonexistent Org",
        }),
      });

      const response = (await DELETE(request))!;
      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Organization not found.");
    });

    it("blocks deleting the organization the administrator is currently signed into", async () => {
      // Super admin who is currently signed into targetOrgId
      vi.spyOn(authModule, "requirePermission").mockResolvedValue({
        id: "super-user-123",
        role: "Super Admin",
        organizationId: targetOrgId,
        permissions: ["all"],
        authzVersion: 0,
      });

      vi.spyOn(Organization, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(targetOrgId),
          name: "My Active Org",
        }),
      } as never);

      const request = new Request("http://localhost:3000/api/admin/organizations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: targetOrgId,
          confirmDelete: true,
          confirmationName: "My Active Org",
        }),
      });

      const response = (await DELETE(request))!;
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("Cannot delete the organization you are currently signed into");
    });
  });

  describe("3. Execution & Data Isolation", () => {
    it("successfully deletes organization and all its dependent records via withTransaction", async () => {
      vi.spyOn(authModule, "requirePermission").mockResolvedValue({
        id: adminId,
        role: "Super Admin",
        permissions: ["all"],
        authzVersion: 0,
      });

      vi.spyOn(Organization, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(targetOrgId),
          name: "Acme Corp",
        }),
      } as never);

      const deleteManyCustomerSpy = vi.spyOn(Customer, "deleteMany").mockResolvedValue({ deletedCount: 5 } as never);
      const deleteManyItemSpy = vi.spyOn(Item, "deleteMany").mockResolvedValue({ deletedCount: 10 } as never);
      const deleteManyInvoiceSpy = vi.spyOn(Invoice, "deleteMany").mockResolvedValue({ deletedCount: 3 } as never);
      const deleteManyExpenseSpy = vi.spyOn(Expense, "deleteMany").mockResolvedValue({ deletedCount: 2 } as never);
      const deleteManyPOSpy = vi.spyOn(PurchaseOrder, "deleteMany").mockResolvedValue({ deletedCount: 1 } as never);
      const deleteManyBillSpy = vi.spyOn(PurchaseBill, "deleteMany").mockResolvedValue({ deletedCount: 1 } as never);
      const deleteManyUserSpy = vi.spyOn(User, "deleteMany").mockResolvedValue({ deletedCount: 2 } as never);
      const deleteOneOrgSpy = vi.spyOn(Organization, "deleteOne").mockResolvedValue({ deletedCount: 1 } as never);

      const request = new Request("http://localhost:3000/api/admin/organizations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: targetOrgId,
          confirmDelete: true,
          confirmationName: "Acme Corp",
        }),
      });

      const response = (await DELETE(request))!;
      expect(response.status).toBe(200);
      const data = (await response.json()) as { ok: boolean; message: string };
      expect(data.ok).toBe(true);
      expect(data.message).toContain("Acme Corp and its organization data were deleted.");

      // Verify withTransaction was called
      expect(withTransaction).toHaveBeenCalled();

      // Verify queries are strictly isolated to targetOrgId
      expect(deleteManyCustomerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { organizationId: new Types.ObjectId(targetOrgId) },
            { organizationId: targetOrgId },
          ]),
        }),
        expect.any(Object),
      );

      expect(deleteManyItemSpy).toHaveBeenCalled();
      expect(deleteManyInvoiceSpy).toHaveBeenCalled();
      expect(deleteManyExpenseSpy).toHaveBeenCalled();
      expect(deleteManyPOSpy).toHaveBeenCalled();
      expect(deleteManyBillSpy).toHaveBeenCalled();
      expect(deleteManyUserSpy).toHaveBeenCalled();
      expect(deleteOneOrgSpy).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(targetOrgId) },
        expect.any(Object),
      );
    });

    it("gracefully succeeds on standalone MongoDB where withTransaction passes session=undefined", async () => {
      // Standalone MongoDB simulation: withTransaction executes callback with undefined session
      vi.mocked(withTransaction).mockImplementationOnce(async (fn) => {
        return await fn(undefined);
      });

      vi.spyOn(authModule, "requirePermission").mockResolvedValue({
        id: adminId,
        role: "Super Admin",
        permissions: ["all"],
        authzVersion: 0,
      });

      vi.spyOn(Organization, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(targetOrgId),
          name: "Standalone Org",
        }),
      } as never);

      const deleteManyCustomerSpy = vi.spyOn(Customer, "deleteMany").mockResolvedValue({ deletedCount: 1 } as never);
      const deleteManyVendorSpy = vi.spyOn(Vendor, "deleteMany").mockResolvedValue({ deletedCount: 1 } as never);
      const deleteManyUserSpy = vi.spyOn(User, "deleteMany").mockResolvedValue({ deletedCount: 1 } as never);
      const deleteOneOrgSpy = vi.spyOn(Organization, "deleteOne").mockResolvedValue({ deletedCount: 1 } as never);

      const request = new Request("http://localhost:3000/api/admin/organizations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: targetOrgId,
          confirmDelete: true,
          confirmationName: "Standalone Org",
        }),
      });

      const response = (await DELETE(request))!;
      expect(response.status).toBe(200);
      const data = (await response.json()) as { ok: boolean; message: string };
      expect(data.ok).toBe(true);
      expect(data.message).toBe("Standalone Org and its organization data were deleted.");

      // Verify that options passed was empty object {} (not { session: undefined })
      expect(deleteManyCustomerSpy).toHaveBeenCalledWith(expect.anything(), {});
      expect(deleteManyVendorSpy).toHaveBeenCalledWith(expect.anything(), {});
      expect(deleteManyUserSpy).toHaveBeenCalledWith(expect.anything(), {});
      expect(deleteOneOrgSpy).toHaveBeenCalledWith(expect.anything(), {});
    });
  });
});
