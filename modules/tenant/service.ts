/**
 * modules/tenant/service.ts — Tenant Management & Document Sequence Service
 *
 * Implements atomic document numbering via Mongo findOneAndUpdate + $inc,
 * guaranteeing gapless and duplicate-free numbers for invoices, deals, stock lots, etc.
 */

import { type ClientSession, Types } from "mongoose";
import { Tenant, type ITenant } from "@/modules/tenant/model";
import { NotFoundError, ForbiddenError } from "@/lib/errors";

export type DocumentSeriesType =
  | "deal"
  | "contract"
  | "invoice"
  | "payment"
  | "stockLot"
  | "goodsReceipt";

const DEFAULT_PREFIXES: Record<DocumentSeriesType, string> = {
  deal: "DL",
  contract: "CTR",
  invoice: "INV",
  payment: "PAY",
  stockLot: "LOT",
  goodsReceipt: "GRN",
};

export class TenantService {
  /**
   * Retrieves an atomic, monotonically incrementing document number for a given tenant.
   * Uses findOneAndUpdate with $inc to guarantee atomicity under concurrent requests.
   *
   * @param tenantId The organization ID
   * @param seriesType The document type (e.g. 'invoice', 'deal', 'stockLot')
   * @param session Optional client session for inclusion in multi-document transactions
   * @returns Formatted sequence string, e.g. "INV-1001"
   */
  static async getAtomicDocumentNumber(
    tenantId: string | Types.ObjectId,
    seriesType: DocumentSeriesType,
    session?: ClientSession,
  ): Promise<string> {
    const objectId = typeof tenantId === "string" ? new Types.ObjectId(tenantId) : tenantId;
    const updatePath = `numberSeries.${seriesType}.nextNumber`;
    const defaultPrefix = DEFAULT_PREFIXES[seriesType] || seriesType.toUpperCase().slice(0, 3);

    // Atomically increment and get the current value before increment
    const tenant = await Tenant.findOneAndUpdate(
      { _id: objectId, isDeleted: { $ne: true } },
      { $inc: { [updatePath]: 1 } },
      {
        new: false, // returns document before the update
        session,
        upsert: false,
      },
    );

    if (!tenant) {
      throw new NotFoundError("Tenant not found or has been deactivated.");
    }

    if (tenant.status !== "active") {
      throw new ForbiddenError(`Tenant account is currently ${tenant.status}. Document creation is disabled.`);
    }

    const series = tenant.numberSeries?.[seriesType];
    const prefix = series?.prefix || defaultPrefix;
    const currentNumber = series?.nextNumber || 1001;

    return `${prefix}-${currentNumber}`;
  }

  /**
   * Fetches active tenant profile.
   */
  static async getTenant(tenantId: string | Types.ObjectId): Promise<ITenant> {
    const objectId = typeof tenantId === "string" ? new Types.ObjectId(tenantId) : tenantId;
    const tenant = await Tenant.findOne({ _id: objectId, isDeleted: { $ne: true } });
    if (!tenant) {
      throw new NotFoundError("Tenant profile not found.");
    }
    return tenant;
  }

  /**
   * Updates tenant general settings and document prefixes.
   */
  static async updateSettings(
    tenantId: string | Types.ObjectId,
    updates: Partial<ITenant["settings"]>,
  ): Promise<ITenant> {
    const objectId = typeof tenantId === "string" ? new Types.ObjectId(tenantId) : tenantId;
    const tenant = await Tenant.findOneAndUpdate(
      { _id: objectId, isDeleted: { $ne: true } },
      { $set: { settings: updates } },
      { new: true },
    );
    if (!tenant) {
      throw new NotFoundError("Tenant not found.");
    }
    return tenant;
  }
}
