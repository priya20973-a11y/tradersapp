import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requirePermission, updateUserRoleAndPermissions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models";
import { AppError, ValidationError } from "@/lib/errors";

const roleUpdateSchema = z.object({
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
  ]).optional(),
  permissions: z.array(z.string().trim().min(1)).optional(),
  organizationId: z.string().refine(isValidObjectId).optional(),
}).refine((data) => data.role !== undefined || data.permissions !== undefined, {
  message: "Provide a role or permissions to update.",
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await requirePermission("all", request);
    if (authUser.id !== "admin" && authUser.role !== "Super Admin") {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid user identifier format." }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findOne({ _id: id, isDeleted: { $ne: true } })
      .select("_id name email role permissions organizationId authzVersion authVersion createdAt")
      .lean();

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions ?? [],
        organizationId: user.organizationId ? String(user.organizationId) : undefined,
        authzVersion: Number(user.authzVersion ?? 0),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Unable to retrieve user details." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await requirePermission("all", request);
    if (authUser.id !== "admin" && authUser.role !== "Super Admin") {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid user identifier format." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON payload.");
    }

    const parsed = roleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update payload." }, { status: 400 });
    }

    const result = await updateUserRoleAndPermissions({
      userId: id,
      organizationId: parsed.data.organizationId,
      role: parsed.data.role,
      permissions: parsed.data.permissions,
    });

    return NextResponse.json({
      ok: true,
      message: "User authorization updated successfully.",
      user: result,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Unable to update user authorization." }, { status: 500 });
  }
}
