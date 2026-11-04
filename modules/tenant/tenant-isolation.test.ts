/**
 * modules/tenant/tenant-isolation.test.ts
 *
 * Unit tests verifying cross-tenant isolation guarantees,
 * parameter tampering protection, and atomic document numbering.
 */

import { describe, it, expect, vi } from "vitest";
import { Types, type Model } from "mongoose";
import { TenantScopedRepository } from "./repository";
import { TenantService } from "./service";
import { Tenant } from "./model";
import { ForbiddenError, ValidationError } from "@/lib/errors";

describe("Tenant Isolation & Multi-Tenancy Security", () => {
  const tenantAId = new Types.ObjectId();
  const tenantBId = new Types.ObjectId();

  describe("TenantScopedRepository Isolation", () => {
    it("throws ForbiddenError if tenantId is missing or falsy", () => {
      const mockModel = {} as unknown as Model<Record<string, unknown>>;
      expect(() => new TenantScopedRepository(mockModel, "")).toThrow(ForbiddenError);
      expect(() => new TenantScopedRepository(mockModel, null as unknown as string)).toThrow(ForbiddenError);
      expect(() => new TenantScopedRepository(mockModel, undefined as unknown as string)).toThrow(ForbiddenError);
    });

    it("throws ValidationError if tenantId is not a valid ObjectId string", () => {
      const mockModel = {} as unknown as Model<Record<string, unknown>>;
      expect(() => new TenantScopedRepository(mockModel, "invalid-hex-id")).toThrow(ValidationError);
    });

    it("enforces tenantId in find() queries and prevents cross-tenant query injection", async () => {
      const captured: { filter?: Record<string, unknown> } = {};

      const mockModel = {
        find: vi.fn().mockImplementation((filter: Record<string, unknown>) => {
          captured.filter = filter;
          return {
            lean: () => ({
              exec: async () => [],
            }),
          };
        }),
      } as unknown as Model<Record<string, unknown>>;

      const repo = new TenantScopedRepository(mockModel, tenantAId);

      // Attempt to maliciously query Tenant B's data
      await repo.find({ organizationId: tenantBId });

      expect(mockModel.find).toHaveBeenCalled();
      // Verify that organizationId was overridden to Tenant A's ID
      expect(captured.filter?.organizationId).toEqual(tenantAId);
      expect(captured.filter?.isDeleted).toEqual({ $ne: true });
    });

    it("automatically stamps organizationId on created documents", async () => {
      const captured: { payload?: Record<string, unknown> } = {};

      const mockModel = {
        create: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          captured.payload = payload;
          return Promise.resolve({ _id: new Types.ObjectId(), ...payload });
        }),
      } as unknown as Model<Record<string, unknown>>;

      const repo = new TenantScopedRepository(mockModel, tenantAId);

      // Attempt to create a record with Tenant B's ID in payload
      await repo.create({ organizationId: tenantBId, name: "Contraband Grain" });

      expect(mockModel.create).toHaveBeenCalled();
      expect(captured.payload?.organizationId).toEqual(tenantAId);
      expect(captured.payload?.isDeleted).toBe(false);
    });

    it("prepends tenant match filter to aggregation pipelines", async () => {
      const captured: { pipeline?: unknown[] } = {};

      const mockModel = {
        aggregate: vi.fn().mockImplementation((pipeline: unknown[]) => {
          captured.pipeline = pipeline;
          return {
            exec: async () => [{ total: 100 }],
          };
        }),
      } as unknown as Model<Record<string, unknown>>;

      const repo = new TenantScopedRepository(mockModel, tenantAId);

      await repo.aggregate([
        { $group: { _id: "$commodity", totalQty: { $sum: "$quantity" } } },
      ]);

      expect(mockModel.aggregate).toHaveBeenCalled();
      // First stage MUST be the tenant scoping filter
      const stages = captured.pipeline as unknown as Record<string, unknown>[];
      expect(stages[0]).toEqual({
        $match: {
          organizationId: tenantAId,
          isDeleted: { $ne: true },
        },
      });
    });

    it("scopes softDelete to the tenant boundary", async () => {
      const captured: { filter?: Record<string, unknown> } = {};

      const mockModel = {
        findOneAndUpdate: vi.fn().mockImplementation((filter: Record<string, unknown>) => {
          captured.filter = filter;
          return {
            lean: () => ({
              exec: async () => ({ _id: new Types.ObjectId(), isDeleted: true }),
            }),
          };
        }),
      } as unknown as Model<Record<string, unknown>>;

      const repo = new TenantScopedRepository(mockModel, tenantAId);
      const targetDocId = new Types.ObjectId();

      await repo.softDelete(targetDocId);

      expect(mockModel.findOneAndUpdate).toHaveBeenCalled();
      expect(captured.filter?._id).toEqual(targetDocId);
      expect(captured.filter?.organizationId).toEqual(tenantAId);
    });
  });

  describe("Tenant Document Sequence Numbering", () => {
    it("generates atomic sequential numbers with correct prefix", async () => {
      const mockTenantDoc = {
        _id: tenantAId,
        status: "active",
        numberSeries: {
          deal: { prefix: "DL", nextNumber: 1042 },
        },
      };

      vi.spyOn(Tenant, "findOneAndUpdate").mockResolvedValue(mockTenantDoc as unknown as InstanceType<typeof Tenant>);

      const docNumber = await TenantService.getAtomicDocumentNumber(tenantAId, "deal");

      expect(Tenant.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: tenantAId, isDeleted: { $ne: true } },
        { $inc: { "numberSeries.deal.nextNumber": 1 } },
        expect.objectContaining({ new: false }),
      );

      expect(docNumber).toBe("DL-1042");
      vi.restoreAllMocks();
    });

    it("refuses sequence generation if tenant is inactive or suspended", async () => {
      const suspendedTenant = {
        _id: tenantAId,
        status: "suspended",
        numberSeries: {
          invoice: { prefix: "INV", nextNumber: 200 },
        },
      };

      vi.spyOn(Tenant, "findOneAndUpdate").mockResolvedValue(suspendedTenant as unknown as InstanceType<typeof Tenant>);

      await expect(TenantService.getAtomicDocumentNumber(tenantAId, "invoice")).rejects.toThrow(
        ForbiddenError,
      );

      vi.restoreAllMocks();
    });
  });
});
