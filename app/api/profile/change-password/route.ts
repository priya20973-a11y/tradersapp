import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { requirePermission } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { AuditEvent, User } from "@/models";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "New password must be at least 8 characters long.").max(128, "Password must not exceed 128 characters."),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password cannot be the same as your current password.",
    path: ["newPassword"],
  });

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const authUser = await requirePermission("authenticated", request);

    // 2. Rate limit password change attempts
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rateLimit = await checkRateLimit({
      key: `change-password:${authUser.id}:${ip}`,
      limit: 5,
      windowSeconds: 900, // 15 minutes
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many password change attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000))),
          },
        },
      );
    }

    // 3. Parse and validate payload
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request payload." }, { status: 400 });
    }

    const validation = changePasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid password data." },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // 4. Handle Super Admin password change
    if (authUser.id === "admin") {
      const encodedAdminPasswordHash = process.env.ADMIN_PASSWORD_HASH_BASE64;
      if (!encodedAdminPasswordHash) {
        return NextResponse.json({ error: "Admin login is not configured on the server." }, { status: 500 });
      }

      const adminPasswordHash = Buffer.from(encodedAdminPasswordHash, "base64").toString("utf8");
      const isCurrentValid = await bcrypt.compare(currentPassword, adminPasswordHash);
      if (!isCurrentValid) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
      }

      const isSameAsCurrent = await bcrypt.compare(newPassword, adminPasswordHash);
      if (isSameAsCurrent) {
        return NextResponse.json({ error: "New password cannot be the same as your current password." }, { status: 400 });
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      const newHashBase64 = Buffer.from(newHash).toString("base64");
      process.env.ADMIN_PASSWORD_HASH_BASE64 = newHashBase64;

      try {
        const envPath = path.resolve(process.cwd(), ".env.local");
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, "utf-8");
          if (envContent.includes("ADMIN_PASSWORD_HASH_BASE64=")) {
            envContent = envContent.replace(
              /ADMIN_PASSWORD_HASH_BASE64=.*/g,
              `ADMIN_PASSWORD_HASH_BASE64=${newHashBase64}`,
            );
            fs.writeFileSync(envPath, envContent, "utf-8");
          }
        }
      } catch (err) {
        logger.warn({ err }, "Could not update .env.local for super admin password change");
      }

      await connectToDatabase();
      await AuditEvent.create({
        actorId: "admin",
        action: "auth.admin_change_password",
        entityType: "User",
        entityId: "admin",
        changes: {
          adminEmail: authUser.email,
          changedAt: new Date().toISOString(),
        },
        occurredAt: new Date(),
      });

      return NextResponse.json({
        ok: true,
        message: "Admin password changed successfully. Please log in again with your new password.",
        requireReauth: true,
      });
    }

    // 5. Handle Database user password change
    await connectToDatabase();
    const user = await User.findOne({ _id: authUser.id, isDeleted: { $ne: true } }).select(
      "+passwordHash passwordHash authzVersion authVersion email organizationId failedLoginCount lockedUntil mustChangePassword",
    );

    if (!user) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    const now = new Date();
    if (user.lockedUntil && new Date(user.lockedUntil as Date).getTime() > now.getTime()) {
      return NextResponse.json(
        { error: "Account is temporarily locked due to too many failed attempts. Please try again later." },
        { status: 403 },
      );
    }

    const isCurrentValid = typeof user.passwordHash === "string" && (await bcrypt.compare(currentPassword, user.passwordHash));
    if (!isCurrentValid) {
      const nextFailCount = Number(user.failedLoginCount ?? 0) + 1;
      const updates: Record<string, unknown> = { failedLoginCount: nextFailCount };
      if (nextFailCount >= 5) {
        updates.lockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
      }
      await User.updateOne({ _id: user._id }, { $set: updates });
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    const isSameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash as string);
    if (isSameAsCurrent) {
      return NextResponse.json({ error: "New password cannot be the same as your current password." }, { status: 400 });
    }

    // Hash new password using bcrypt cost factor 12
    const newHash = await bcrypt.hash(newPassword, 12);
    const newAuthzVersion = Number(user.authzVersion ?? user.authVersion ?? 0) + 1;

    user.passwordHash = newHash;
    user.authzVersion = newAuthzVersion;
    user.authVersion = newAuthzVersion;
    user.mustChangePassword = false;
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    await user.save();

    // Record audit event without logging plaintext passwords or hashes
    await AuditEvent.create({
      organizationId: user.organizationId,
      actorId: String(user._id),
      action: "auth.password_changed",
      entityType: "User",
      entityId: String(user._id),
      changes: {
        userEmail: user.email,
        authzVersion: newAuthzVersion,
        changedAt: new Date().toISOString(),
      },
      occurredAt: new Date(),
    });

    logger.info({ userId: user._id, email: user.email }, "User password changed successfully; sessions invalidated");

    return NextResponse.json({
      ok: true,
      message: "Password changed successfully. Please log in again with your new password.",
      requireReauth: true,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error({ error }, "Password change error");
    return NextResponse.json({ error: "Unable to change password right now. Please try again." }, { status: 500 });
  }
}

