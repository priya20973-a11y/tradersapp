/**
 * modules/tenant/repository.ts — Tenant-Scoped Base Repository
 *
 * Enforces strict multi-tenant data isolation at the repository layer.
 * All queries and mutations automatically inject the tenant ID (stored as organizationId)
 * and reject any attempt to access another tenant's records or omit the tenant ID.
 */

import {
  type Model,
  type ClientSession,
  type QueryFilter,
  type UpdateQuery,
  type ProjectionType,
  type QueryOptions,
  Types,
} from "mongoose";
import { ForbiddenError, ValidationError } from "@/lib/errors";

export class TenantScopedRepository<T extends Record<string, unknown> = Record<string, unknown>> {
  protected readonly model: Model<T>;
  protected readonly tenantId: Types.ObjectId;

  constructor(model: Model<T>, tenantId: string | Types.ObjectId) {
    if (!tenantId) {
      throw new ForbiddenError("Tenant context required: operations cannot execute without tenantId.");
    }

    try {
      this.tenantId = typeof tenantId === "string" ? new Types.ObjectId(tenantId) : tenantId;
    } catch {
      throw new ValidationError("Invalid tenantId identifier format.");
    }

    this.model = model;
  }

  /**
   * Internal helper: Merges the tenant ID into a query filter,
   * guaranteeing that organizationId cannot be spoofed or omitted.
   */
  private scopeFilter(filter: QueryFilter<T> = {}, includeDeleted = false): QueryFilter<T> {
    const scoped: Record<string, unknown> = {
      ...(filter as Record<string, unknown>),
      organizationId: this.tenantId,
    };

    if (!includeDeleted) {
      scoped.isDeleted = { $ne: true };
    }

    return scoped as unknown as QueryFilter<T>;
  }

  /**
   * Find multiple records strictly belonging to the current tenant.
   */
  async find(
    filter: QueryFilter<T> = {},
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ): Promise<T[]> {
    return this.model
      .find(this.scopeFilter(filter), projection, options)
      .lean()
      .exec() as unknown as Promise<T[]>;
  }

  /**
   * Find one record strictly belonging to the current tenant.
   */
  async findOne(
    filter: QueryFilter<T> = {},
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    return this.model
      .findOne(this.scopeFilter(filter), projection, options)
      .lean()
      .exec() as unknown as Promise<T | null>;
  }

  /**
   * Find record by ID strictly within the current tenant's scope.
   */
  async findById(
    id: string | Types.ObjectId,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    const docId = typeof id === "string" ? new Types.ObjectId(id) : id;
    return this.model
      .findOne(this.scopeFilter({ _id: docId } as unknown as QueryFilter<T>), projection, options)
      .lean()
      .exec() as unknown as Promise<T | null>;
  }

  /**
   * Create a new record automatically stamped with the current tenant's organizationId.
   */
  async create(data: Partial<T>, options?: { session?: ClientSession }): Promise<T> {
    const payload = {
      ...data,
      organizationId: this.tenantId,
      isDeleted: false,
    };

    if (options?.session) {
      const created = await this.model.create([payload as unknown as Parameters<Model<T>["create"]>[0]], { session: options.session });
      return (created as unknown as T[])[0];
    }

    const doc = await this.model.create(payload as unknown as Parameters<Model<T>["create"]>[0]);
    return doc as unknown as T;
  }

  /**
   * Update one record strictly within tenant boundaries.
   */
  async updateOne(
    filter: QueryFilter<T>,
    update: UpdateQuery<T>,
    options?: Parameters<Model<T>["updateOne"]>[2],
  ) {
    return this.model.updateOne(this.scopeFilter(filter), update, options).exec();
  }

  /**
   * Find and update a record atomically within tenant scope.
   */
  async findOneAndUpdate(
    filter: QueryFilter<T>,
    update: UpdateQuery<T>,
    options: QueryOptions<T> = { new: true },
  ): Promise<T | null> {
    return this.model
      .findOneAndUpdate(this.scopeFilter(filter), update, options)
      .lean()
      .exec() as unknown as Promise<T | null>;
  }

  /**
   * Count documents matching filter within tenant scope.
   */
  async countDocuments(filter: QueryFilter<T> = {}, includeDeleted = false): Promise<number> {
    return this.model.countDocuments(this.scopeFilter(filter, includeDeleted)).exec();
  }

  /**
   * Soft-delete a record within tenant scope.
   */
  async softDelete(id: string | Types.ObjectId, deletedBy?: string | Types.ObjectId): Promise<T | null> {
    const docId = typeof id === "string" ? new Types.ObjectId(id) : id;
    const update = {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        ...(deletedBy ? { updatedBy: deletedBy } : {}),
      },
    } as unknown as UpdateQuery<T>;

    return this.model
      .findOneAndUpdate(this.scopeFilter({ _id: docId } as unknown as QueryFilter<T>), update, { new: true })
      .lean()
      .exec() as unknown as Promise<T | null>;
  }

  /**
   * Aggregate pipeline with mandatory tenant $match stage prepended at the root.
   */
  async aggregate<R = unknown>(pipeline: unknown[], session?: ClientSession): Promise<R[]> {
    const scopedPipeline = [
      {
        $match: {
          organizationId: this.tenantId,
          isDeleted: { $ne: true },
        },
      },
      ...pipeline,
    ];

    const agg = this.model.aggregate(scopedPipeline as Parameters<Model<T>["aggregate"]>[0]);
    if (session) {
      return agg.session(session).exec() as Promise<R[]>;
    }

    return agg.exec() as Promise<R[]>;
  }
}
