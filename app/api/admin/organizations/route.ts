import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { isValidObjectId, startSession, Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { connectToDatabase } from "@/lib/db";
import {
  AuditEvent,
  BankAccount,
  ChartOfAccount,
  Customer,
  DocumentSequence,
  Invoice,
  Item,
  JournalEntry,
  Organization,
  Payment,
  SalesDocument,
  StockLot,
  StockMovement,
  TaxRate,
  TradeDeal,
  TraderPayment,
  TraderProfile,
  User,
  Vendor,
  Warehouse,
} from "@/models";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    organizationId: z.string().refine(isValidObjectId),
  }),
  z.object({
    action: z.literal("set-status"),
    organizationId: z.string().refine(isValidObjectId),
    status: z.enum(["active", "inactive"]),
  }),
  z.object({
    action: z.literal("reset-password"),
    organizationId: z.string().refine(isValidObjectId),
    userId: z.string().refine(isValidObjectId),
    requirePasswordChange: z.boolean().optional().default(true),
  }),
  z.object({
    action: z.literal("update-role"),
    organizationId: z.string().refine(isValidObjectId),
    userId: z.string().refine(isValidObjectId),
    role: z.enum([
      "Super Admin",
      "Organization Owner",
      "Administrator",
      "Accountant",
      "Sales Manager",
      "Sales Executive",
      "Purchase Manager",
      "Inventory Manager",
      "Read-Only Auditor",
    ]),
  }),
]);

async function requireAdmin(request?: Request) {
  try {
    const authUser = await requirePermission("all", request ? { req: request } : undefined);
    if (authUser.id !== "admin" && authUser.role !== "Super Admin") {
      return NextResponse.json({ error: "Only the administrator can manage organizations." }, { status: 403 });
    }
    return null;
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Only the administrator can manage organizations." }, { status: 403 });
  }
}

async function parseBody(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: NextResponse.json({ error: "Submit valid JSON data." }, { status: 400 }) };
  }
  return { body };
}

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    await connectToDatabase();
    const organizations = await Organization.find({})
      .select("_id name tradeName gstin status createdAt")
      .sort({ status: 1, name: 1 })
      .lean();
    const organizationIds = organizations.map((organization) => organization._id);
    const owners = await User.find({
      organizationId: { $in: organizationIds },
      role: "Organization Owner",
    }).select("_id organizationId name email createdAt").sort({ createdAt: 1 }).lean();
    const ownersByOrganization = new Map<string, { id: string; name: string; email: string }[]>();
    for (const owner of owners) {
      const key = String(owner.organizationId);
      const records = ownersByOrganization.get(key) ?? [];
      records.push({ id: String(owner._id), name: String(owner.name), email: String(owner.email) });
      ownersByOrganization.set(key, records);
    }

    return NextResponse.json({
      organizations: organizations.map((organization) => ({
        id: String(organization._id),
        name: String(organization.name),
        tradeName: String(organization.tradeName ?? ""),
        gstin: String(organization.gstin ?? ""),
        status: String(organization.status ?? "pending"),
        createdAt: organization.createdAt ? new Date(String(organization.createdAt)).toISOString() : "",
        owners: ownersByOrganization.get(String(organization._id)) ?? [],
      })),
    });
  } catch (error) {
    console.error("Admin organizations could not be loaded.", error);
    return NextResponse.json({ error: "Organizations are temporarily unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const parsedBody = await parseBody(request);
  if ("error" in parsedBody) return parsedBody.error;
  const parsed = actionSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the organization action and try again." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const input = parsed.data;
    if (input.action === "approve") {
      const organization = await Organization.findOneAndUpdate(
        { _id: input.organizationId, status: "pending" },
        { $set: { status: "active" } },
        { new: true },
      ).select("_id name status");
      if (!organization) {
        return NextResponse.json({ error: "This organization is not pending approval." }, { status: 409 });
      }
      return NextResponse.json({ ok: true, message: `${organization.name} is now active.` });
    }

    if (input.action === "set-status") {
      const organization = await Organization.findByIdAndUpdate(
        input.organizationId,
        { $set: { status: input.status } },
        { new: true },
      ).select("_id name status");
      if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });
      return NextResponse.json({
        ok: true,
        message: `${organization.name} is now ${organization.status}.`,
      });
    }

    if (input.action === "update-role") {
      const organization = await Organization.findOne({ _id: input.organizationId }).select("_id");
      if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

      const updatedUser = await User.findOneAndUpdate(
        { _id: input.userId, organizationId: input.organizationId, isDeleted: { $ne: true } },
        {
          $set: { role: input.role },
          $inc: { authzVersion: 1, authVersion: 1 },
        },
        { new: true },
      ).select("_id name email role authzVersion authVersion");

      if (!updatedUser) {
        return NextResponse.json({ error: "User not found in this organization." }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        message: `User role updated to ${input.role}.`,
        user: {
          id: String(updatedUser._id),
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          authzVersion: updatedUser.authzVersion,
        },
      });
    }

    const organization = await Organization.findOne({ _id: input.organizationId }).select("_id name");
    if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    const targetUser = await User.findOne({
      _id: input.userId,
      organizationId: input.organizationId,
      isDeleted: { $ne: true },
    });
    if (!targetUser) return NextResponse.json({ error: "User account not found in this organization." }, { status: 404 });

    const temporaryPassword = randomBytes(18).toString("base64url");
    targetUser.passwordHash = await bcrypt.hash(temporaryPassword, 12);
    targetUser.authzVersion = Number(targetUser.authzVersion ?? targetUser.authVersion ?? 0) + 1;
    targetUser.authVersion = targetUser.authzVersion;
    targetUser.mustChangePassword = input.requirePasswordChange ?? true;
    targetUser.failedLoginCount = 0;
    targetUser.lockedUntil = null;
    await targetUser.save();

    await AuditEvent.create({
      organizationId: organization._id,
      actorId: "admin",
      action: "auth.admin_reset_password",
      entityType: "User",
      entityId: String(targetUser._id),
      changes: {
        userEmail: targetUser.email,
        requirePasswordChange: input.requirePasswordChange ?? true,
        resetAt: new Date().toISOString(),
      },
      occurredAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      temporaryPassword,
      requirePasswordChange: targetUser.mustChangePassword,
      user: { id: String(targetUser._id), name: targetUser.name, email: targetUser.email },
    });
  } catch (error) {
    console.error("Admin organization update failed.", error);
    return NextResponse.json({ error: "Unable to update this organization right now." }, { status: 503 });
  }
}

const deleteSchema = z.object({
  organizationId: z.string().refine(isValidObjectId),
  confirmDelete: z.literal(true),
  confirmationName: z.string().trim().min(2).max(120),
});

const organizationModels = [
  AuditEvent,
  BankAccount,
  ChartOfAccount,
  Customer,
  DocumentSequence,
  Invoice,
  Item,
  JournalEntry,
  Payment,
  SalesDocument,
  StockLot,
  StockMovement,
  TaxRate,
  TradeDeal,
  TraderPayment,
  TraderProfile,
  Vendor,
  Warehouse,
];

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const parsedBody = await parseBody(request);
  if ("error" in parsedBody) return parsedBody.error;
  const parsed = deleteSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirm both deletion prompts before deleting an organization." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const organization = await Organization.findById(parsed.data.organizationId).select("_id name");
    if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    if (organization.name !== parsed.data.confirmationName) {
      return NextResponse.json({ error: "The organization name did not match. Nothing was deleted." }, { status: 400 });
    }

    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        const organizationId = new Types.ObjectId(parsed.data.organizationId);
        for (const model of organizationModels) {
          await model.collection.deleteMany({ organizationId }, { session });
        }
        await User.deleteMany({ organizationId }).session(session);
        const result = await Organization.deleteOne({ _id: organizationId }).session(session);
        if (result.deletedCount !== 1) throw new Error("Organization changed while deletion was in progress.");
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json({ ok: true, message: `${organization.name} and its organization data were deleted.` });
  } catch (error) {
    console.error("Admin organization deletion failed.", error);
    return NextResponse.json({ error: "Unable to delete this organization. No partial deletion was committed." }, { status: 503 });
  }
}
