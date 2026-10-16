import { startSession, Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getTradingScope, recordTradingAudit, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { Customer, Organization, SalesDocument, TraderProfile, Vendor } from "@/models";

const traderRoles = ["Buyer", "Seller", "Broker", "Commission Agent", "Consignment Owner"] as const;
const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  designation: z.string().trim().max(100).optional(),
  mobile: z.string().trim().max(30).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
});
const addressSchema = z.object({
  line1: z.string().trim().max(250).optional(),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  stateCode: z.string().trim().max(4).optional(),
  country: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
});
export const traderCreateSchema = z.object({
  traderCode: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  legalBusinessName: z.string().trim().min(2).max(160),
  tradeName: z.string().trim().max(160).optional(),
  businessType: z.enum(["Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited", "FPO", "Cooperative", "Other"]),
  roles: z.array(z.enum(traderRoles)).min(1),
  mainCommodities: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  primaryMarket: z.string().trim().max(120).optional(),
  operatingMarkets: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  preferredLanguage: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(3000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  gstRegistrationType: z.string().trim().max(50).optional(),
  gstin: z.union([z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/), z.literal("")]).optional(),
  pan: z.union([z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/), z.literal("")]).optional(),
  contacts: z.array(contactSchema).max(20).default([]),
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  branches: z.array(z.object({
    name: z.string().trim().min(2).max(100),
    address: z.string().trim().max(250).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
  })).max(50).default([]),
  creditLimit: z.coerce.number().min(0).max(1_000_000_000).default(0),
  creditPeriodDays: z.coerce.number().int().min(0).max(3650).default(0),
  paymentTerms: z.string().trim().max(200).optional(),
  openingReceivable: z.coerce.number().min(0).max(1_000_000_000).default(0),
  openingPayable: z.coerce.number().min(0).max(1_000_000_000).default(0),
  securityDeposit: z.coerce.number().min(0).max(1_000_000_000).default(0),
  preferredPaymentMethods: z.array(z.enum(["Cash", "Bank", "UPI", "Cheque", "RTGS", "NEFT"])).max(6).default([]),
  riskCategory: z.enum(["Low", "Medium", "High"]).default("Low"),
});

function toDirectoryRow(trader: Record<string, unknown>, receivable: number, payable: number) {
  const contacts = Array.isArray(trader.contacts) ? trader.contacts : [];
  const contact = contacts[0] && typeof contacts[0] === "object" ? contacts[0] as Record<string, unknown> : {};
  const address = trader.billingAddress && typeof trader.billingAddress === "object"
    ? trader.billingAddress as Record<string, unknown>
    : {};
  const creditLimit = Number(trader.creditLimit ?? 0);
  return {
    id: String(trader._id),
    traderCode: trader.traderCode,
    legalBusinessName: trader.legalBusinessName,
    tradeName: trader.tradeName ?? "",
    businessType: trader.businessType,
    tradingStatus: trader.tradingStatus,
    roles: trader.roles,
    mainCommodities: trader.mainCommodities ?? [],
    primaryContact: contact.name ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    gstin: trader.gstin ?? "",
    kycStatus: trader.kycStatus,
    creditLimit,
    receivable,
    payable,
    creditUtilization: creditLimit > 0 ? Math.min(100, (receivable / creditLimit) * 100) : 0,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrganizationId = url.searchParams.get("organizationId") ?? undefined;
    const scopeResult = await getTradingScope(requestedOrganizationId, "view-traders");
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId } = scopeResult.scope;

    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25) || 25));
    const search = (url.searchParams.get("search") ?? "").trim().slice(0, 120);
    const status = url.searchParams.get("status");
    const filter: Record<string, unknown> = { organizationId };
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { traderCode: { $regex: escapedSearch, $options: "i" } },
        { legalBusinessName: { $regex: escapedSearch, $options: "i" } },
        { tradeName: { $regex: escapedSearch, $options: "i" } },
        { gstin: { $regex: escapedSearch, $options: "i" } },
      ];
    }
    if (status && ["Active", "Inactive", "Blocked"].includes(status)) filter.tradingStatus = status;

    const [profiles, total, organizations] = await Promise.all([
      TraderProfile.find(filter).sort({ legalBusinessName: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      TraderProfile.countDocuments(filter),
      scopeResult.scope.isAdmin
        ? Organization.find({ status: "active" }).select("_id name").sort({ name: 1 }).lean()
        : Promise.resolve([]),
    ]);

    const customerIds = profiles.map((profile) => profile.customerId).filter(Boolean);
    const vendorIds = profiles.map((profile) => profile.vendorId).filter(Boolean);
    const customerDocs = await SalesDocument.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), type: "Invoice" } },
      { $group: { _id: "$customerId", total: { $sum: "$total" }, paid: { $sum: "$amountPaid" }, credited: { $sum: "$creditedAmount" } } },
    ]);
    const customerBalances = new Map(
      customerDocs.map((row: { _id: { toString(): string }; total: number; paid: number; credited: number }) => [
        row._id.toString(),
        Number(row.total ?? 0) - Number(row.paid ?? 0) - Number(row.credited ?? 0),
      ]),
    );
    const rows = profiles.map((profile) => {
      const profileRecord = profile as unknown as Record<string, unknown>;
      const receivable = Number(profile.openingReceivable ?? 0) +
        (profile.customerId ? customerBalances.get(String(profile.customerId)) ?? 0 : 0);
      return toDirectoryRow(profileRecord, receivable, Number(profile.openingPayable ?? 0));
    });

    return NextResponse.json({
      rows,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      organizations: organizations.map((organization) => ({ id: String(organization._id), name: organization.name })),
      isAdmin: scopeResult.scope.isAdmin,
      customerCount: customerIds.length,
      vendorCount: vendorIds.length,
    });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}

export async function POST(request: Request) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Submit valid JSON data." }, { status: 400 });
    }
    const parsed = traderCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Check the trader details and try again.", issues: parsed.error.issues }, { status: 400 });
    }
    const requestedOrganizationId =
      typeof payload === "object" && payload !== null && "organizationId" in payload
        ? String(payload.organizationId)
        : undefined;
    const scopeResult = await getTradingScope(requestedOrganizationId, "manage-traders");
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId, actorId } = scopeResult.scope;
    const traderCode = parsed.data.traderCode.toUpperCase();
    if (await TraderProfile.exists({ organizationId, traderCode })) {
      return NextResponse.json({ error: "That trader code is already in use in this organization." }, { status: 409 });
    }

    const session = await startSession();
    try {
      let traderId = "";
      await session.withTransaction(async () => {
        let customerId: Types.ObjectId | undefined;
        let vendorId: Types.ObjectId | undefined;
        if (parsed.data.roles.includes("Buyer")) {
          const [customer] = await Customer.create([{
            organizationId,
            name: parsed.data.tradeName || parsed.data.legalBusinessName,
            email: parsed.data.contacts.find((contact) => contact.email)?.email,
            phone: parsed.data.contacts.find((contact) => contact.mobile)?.mobile,
            gstin: parsed.data.gstin || undefined,
            state: parsed.data.billingAddress?.state,
            creditLimit: parsed.data.creditLimit,
            openingBalance: parsed.data.openingReceivable,
          }], { session });
          customerId = new Types.ObjectId(String(customer._id));
        }
        if (parsed.data.roles.includes("Seller")) {
          const [vendor] = await Vendor.create([{
            organizationId,
            name: parsed.data.tradeName || parsed.data.legalBusinessName,
            email: parsed.data.contacts.find((contact) => contact.email)?.email,
            phone: parsed.data.contacts.find((contact) => contact.mobile)?.mobile,
            gstin: parsed.data.gstin || undefined,
            state: parsed.data.billingAddress?.state,
            openingBalance: parsed.data.openingPayable,
          }], { session });
          vendorId = new Types.ObjectId(String(vendor._id));
        }
        const [trader] = await TraderProfile.create([{
          ...parsed.data,
          traderCode,
          organizationId,
          customerId,
          vendorId,
        }], { session });
        traderId = String(trader._id);
        await recordTradingAudit({
          organizationId,
          actorId,
          action: "trader.created",
          entityType: "TraderProfile",
          entityId: traderId,
          changes: { traderCode, roles: parsed.data.roles },
          session,
        });
      });
      return NextResponse.json({ ok: true, id: traderId, traderCode }, { status: 201 });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        return NextResponse.json({ error: "That trader code is already in use in this organization." }, { status: 409 });
      }
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}
