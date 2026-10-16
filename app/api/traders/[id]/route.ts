import { isValidObjectId, startSession, Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptBankAccountNumber, maskBankAccountNumber } from "@/lib/secure-bank";
import { getTradingScope, recordTradingAudit, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { Customer, TraderProfile, Vendor } from "@/models";

const profileUpdateSchema = z.object({
  legalBusinessName: z.string().trim().min(2).max(160).optional(),
  tradeName: z.string().trim().max(160).optional(),
  businessType: z.enum(["Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited", "FPO", "Cooperative", "Other"]).optional(),
  mainCommodities: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  primaryMarket: z.string().trim().max(120).optional(),
  operatingMarkets: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  preferredLanguage: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(3000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  gstRegistrationType: z.string().trim().max(50).optional(),
  gstin: z.union([
    z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/),
    z.literal(""),
  ]).optional(),
  pan: z.union([z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/), z.literal("")]).optional(),
  contacts: z.array(z.object({
    name: z.string().trim().min(2).max(100),
    designation: z.string().trim().max(100).optional(),
    mobile: z.string().trim().max(30).optional(),
    whatsapp: z.string().trim().max(30).optional(),
    email: z.union([z.email(), z.literal("")]).optional(),
  })).max(20).optional(),
  billingAddress: z.object({
    line1: z.string().trim().max(250).optional(),
    city: z.string().trim().max(100).optional(),
    district: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    stateCode: z.string().trim().max(4).optional(),
    country: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
  }).optional(),
  shippingAddress: z.object({
    line1: z.string().trim().max(250).optional(),
    city: z.string().trim().max(100).optional(),
    district: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    stateCode: z.string().trim().max(4).optional(),
    country: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
  }).optional(),
  branches: z.array(z.object({
    name: z.string().trim().min(2).max(100),
    address: z.string().trim().max(250).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
  })).max(50).optional(),
  preferredPaymentMethods: z.array(z.enum(["Cash", "Bank", "UPI", "Cheque", "RTGS", "NEFT"])).max(6).optional(),
  riskCategory: z.enum(["Low", "Medium", "High"]).optional(),
});
const bankAccountSchema = z.object({
  accountHolderName: z.string().trim().min(2).max(120),
  bankName: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().min(6).max(34).regex(/^[a-zA-Z0-9 -]+$/),
  ifscCode: z.string().trim().toUpperCase().max(20).optional(),
  branch: z.string().trim().max(120).optional(),
  upiId: z.string().trim().max(100).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: "Trader not found." }, { status: 404 });
    const url = new URL(request.url);
    const scopeResult = await getTradingScope(url.searchParams.get("organizationId") ?? undefined, "view-traders");
    if ("response" in scopeResult) return scopeResult.response;

    const trader = await TraderProfile.findOne({ _id: id, organizationId: scopeResult.scope.organizationId })
      .select("+bankAccounts.accountNumberLast4")
      .lean();
    if (!trader) return NextResponse.json({ error: "Trader not found." }, { status: 404 });
    const { bankAccounts = [], ...safeTrader } = trader;
    return NextResponse.json({
      trader: {
        ...safeTrader,
        id: String(trader._id),
        bankAccounts: bankAccounts.map((account) => ({
          id: String(account._id),
          accountHolderName: account.accountHolderName,
          bankName: account.bankName,
          maskedAccountNumber: maskBankAccountNumber(account.accountNumberLast4.padStart(8, "•")),
          ifscCode: account.ifscCode ?? "",
          branch: account.branch ?? "",
          verificationStatus: account.verificationStatus,
          upiId: account.upiId ?? "",
        })),
      },
    });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: "Trader not found." }, { status: 404 });
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Submit valid JSON data." }, { status: 400 });
    }
    if (typeof payload !== "object" || payload === null || !("action" in payload)) {
      return NextResponse.json({ error: "Choose a valid trader update action." }, { status: 400 });
    }
    const body = payload as Record<string, unknown>;
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : undefined;
    const action = body.action;
    let permission: "manage-traders" | "approve-kyc" | "approve-credit-limits" | "manage-bank-details";
    if (action === "set-status") permission = "manage-traders";
    else if (action === "review-kyc") permission = "approve-kyc";
    else if (action === "approve-credit") permission = "approve-credit-limits";
    else if (action === "add-bank-account" || action === "remove-bank-account") permission = "manage-bank-details";
    else if (action === "update-profile") permission = "manage-traders";
    else return NextResponse.json({ error: "Choose a valid trader update action." }, { status: 400 });

    const scopeResult = await getTradingScope(organizationId, permission);
    if ("response" in scopeResult) return scopeResult.response;
    const { organizationId: scopedOrganizationId, actorId } = scopeResult.scope;
    const filter = { _id: id, organizationId: scopedOrganizationId };
    const trader = await TraderProfile.findOne(filter);
    if (!trader) return NextResponse.json({ error: "Trader not found." }, { status: 404 });

    let auditAction = "";
    let changes: Record<string, unknown> = {};
    if (action === "update-profile") {
      const parsed = profileUpdateSchema.safeParse(body.data);
      if (!parsed.success) {
        return NextResponse.json({ error: "Check the trader details and try again.", issues: parsed.error.issues }, { status: 400 });
      }
      Object.assign(trader, parsed.data);
      auditAction = "trader.updated";
      changes = { fields: Object.keys(parsed.data) };
    } else if (action === "set-status") {
      const parsed = z.object({ status: z.enum(["Active", "Inactive", "Blocked"]), reason: z.string().trim().max(500).optional() }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Choose a valid trading status." }, { status: 400 });
      trader.tradingStatus = parsed.data.status;
      auditAction = `trader.status.${parsed.data.status.toLowerCase()}`;
      changes = { status: parsed.data.status, reason: parsed.data.reason ?? "" };
    } else if (action === "review-kyc") {
      const parsed = z.object({
        status: z.enum(["Not Started", "Pending", "Approved", "Rejected", "Expired"]),
        reason: z.string().trim().max(500).optional(),
      }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Choose a valid KYC review status." }, { status: 400 });
      trader.kycStatus = parsed.data.status;
      trader.kycReviewDate = new Date();
      trader.kycReviewedBy = isValidObjectId(actorId) ? new Types.ObjectId(actorId) : undefined;
      auditAction = "trader.kyc.reviewed";
      changes = { status: parsed.data.status, reason: parsed.data.reason ?? "" };
    } else if (action === "approve-credit") {
      const parsed = z.object({
        status: z.enum(["Approved", "Rejected", "On Hold"]),
        creditLimit: z.coerce.number().min(0).max(1_000_000_000),
        reason: z.string().trim().max(500).optional(),
      }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Check the credit approval details and try again." }, { status: 400 });
      trader.creditApprovalStatus = parsed.data.status;
      trader.creditLimit = parsed.data.creditLimit;
      trader.approvedBy = isValidObjectId(actorId) ? new Types.ObjectId(actorId) : undefined;
      trader.creditHoldReason = parsed.data.reason;
      auditAction = "trader.credit.reviewed";
      changes = { status: parsed.data.status, creditLimit: parsed.data.creditLimit, reason: parsed.data.reason ?? "" };
    } else if (action === "add-bank-account") {
      const parsed = bankAccountSchema.safeParse(body.data);
      if (!parsed.success) {
        return NextResponse.json({ error: "Check the bank details and try again.", issues: parsed.error.issues }, { status: 400 });
      }
      try {
        trader.bankAccounts.push({
          _id: new Types.ObjectId(),
          accountHolderName: parsed.data.accountHolderName,
          bankName: parsed.data.bankName,
          encryptedAccountNumber: encryptBankAccountNumber(parsed.data.accountNumber.replace(/[\s-]/g, "")),
          accountNumberLast4: parsed.data.accountNumber.replace(/[\s-]/g, "").slice(-4),
          ifscCode: parsed.data.ifscCode,
          branch: parsed.data.branch,
          upiId: parsed.data.upiId,
          verificationStatus: "Unverified",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bank account encryption is not configured.";
        return NextResponse.json({ error: message }, { status: 503 });
      }
      auditAction = "trader.bank-account.added";
      changes = { bankName: parsed.data.bankName, accountNumber: "****" + parsed.data.accountNumber.slice(-4) };
    } else {
      const parsed = z.object({ accountId: z.string().refine(isValidObjectId, "Invalid bank account.") }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Choose a valid bank account." }, { status: 400 });
      const accountIndex = trader.bankAccounts.findIndex((account) => String(account._id) === parsed.data.accountId);
      if (accountIndex < 0) return NextResponse.json({ error: "Bank account not found." }, { status: 404 });
      trader.bankAccounts.splice(accountIndex, 1);
      auditAction = "trader.bank-account.removed";
      changes = { accountId: parsed.data.accountId };
    }

    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        await trader.save({ session });
        const mirrorFields: Record<string, unknown> = {};
        if (action === "update-profile") {
          mirrorFields.name = trader.tradeName || trader.legalBusinessName;
          mirrorFields.email = trader.contacts.find((contact) => contact.email)?.email;
          mirrorFields.phone = trader.contacts.find((contact) => contact.mobile)?.mobile;
          mirrorFields.gstin = trader.gstin;
          mirrorFields.state = trader.billingAddress?.state;
          mirrorFields.creditLimit = trader.creditLimit;
        }
        if (action === "set-status") {
          mirrorFields.status = trader.tradingStatus === "Blocked"
            ? "Review"
            : trader.tradingStatus === "Inactive"
              ? "Inactive"
              : "Active";
        }
        if (action === "approve-credit") mirrorFields.creditLimit = trader.creditLimit;
        if (trader.customerId && Object.keys(mirrorFields).length > 0) {
          const result = await Customer.updateOne(
            { _id: trader.customerId, organizationId: scopedOrganizationId },
            { $set: mirrorFields },
            { session },
          );
          if (result.matchedCount !== 1) throw new Error("Linked customer record is missing; trader update was not applied.");
        }
        if (trader.vendorId && Object.keys(mirrorFields).length > 0) {
          const vendorFields = { ...mirrorFields };
          delete vendorFields.creditLimit;
          if (action === "set-status" && trader.tradingStatus === "Blocked") vendorFields.status = "Pending";
          if (Object.keys(vendorFields).length > 0) {
            const result = await Vendor.updateOne(
              { _id: trader.vendorId, organizationId: scopedOrganizationId },
              { $set: vendorFields },
              { session },
            );
            if (result.matchedCount !== 1) throw new Error("Linked vendor record is missing; trader update was not applied.");
          }
        }
        await recordTradingAudit({
          organizationId: scopedOrganizationId,
          actorId,
          action: auditAction,
          entityType: "TraderProfile",
          entityId: id,
          changes,
          session,
        });
      });
    } catch (error) {
      if (error instanceof Error && /Transaction numbers are only allowed|transactions are not supported|replica set/i.test(error.message)) {
        return NextResponse.json({ error: "Trader updates require MongoDB transactions to keep linked customer/vendor records synchronized. Configure MongoDB as a replica set or Atlas cluster." }, { status: 503 });
      }
      throw error;
    } finally {
      await session.endSession();
    }
    return NextResponse.json({ ok: true, message: "Trader record updated." });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}
