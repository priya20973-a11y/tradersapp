import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { Organization, User } from "@/models";
import { logger } from "@/lib/logger";
import { rolePermissions } from "./auth-roles";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const isProduction = process.env.NODE_ENV === "production";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) {
          return null;
        }

        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        if (adminEmail && email === adminEmail) {
          const encodedAdminPasswordHash = process.env.ADMIN_PASSWORD_HASH_BASE64;
          if (!encodedAdminPasswordHash) {
            throw new Error("Admin login is not configured. Set ADMIN_PASSWORD_HASH_BASE64.");
          }
          const adminPasswordHash = Buffer.from(encodedAdminPasswordHash, "base64").toString("utf8");

          if (await compare(password, adminPasswordHash)) {
            logger.info({ email }, "Super admin authenticated successfully");
            return {
              id: "admin",
              name: "Admin",
              email,
              role: "Super Admin",
              permissions: rolePermissions["Super Admin"],
              authzVersion: 0,
              authVersion: 0,
            };
          }
          logger.warn({ email }, "Super admin authentication failed: invalid password");
          return null;
        }

        await connectToDatabase();
        const user = await User.findOne({ email, isDeleted: { $ne: true } }).select(
          "name email passwordHash role permissions organizationId authzVersion authVersion failedLoginCount lockedUntil lastLogin mustChangePassword",
        );

        if (!user) {
          logger.warn({ email }, "Login attempt for non-existent or deleted user");
          return null;
        }

        const now = new Date();

        // Account lockout check: fail closed with generic error if currently locked
        const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil as Date | string) : null;
        const isLocked = lockedUntil !== null && lockedUntil.getTime() > now.getTime();

        if (isLocked) {
          logger.warn({ email, lockedUntil }, "Attempted login on locked account");
          return null;
        }

        const isValidPassword = typeof user.passwordHash === "string" && (await compare(password, user.passwordHash));

        if (!isValidPassword) {
          const updatedUser = await User.findOneAndUpdate(
            {
              _id: user._id,
              $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
            },
            {
              $inc: { failedLoginCount: 1 },
            },
            {
              new: true,
              select: "failedLoginCount",
            },
          );

          const failedAttempts = Number(updatedUser?.failedLoginCount ?? 1);
          if (failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
            const lockExpiry = new Date(now.getTime() + LOCKOUT_DURATION_MS);
            await User.updateOne(
              {
                _id: user._id,
                $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
              },
              {
                $set: { lockedUntil: lockExpiry },
              },
            );
            logger.warn(
              { email, attempts: failedAttempts, lockedUntil: lockExpiry },
              "Account locked due to consecutive failed login attempts",
            );
          } else {
            logger.warn(
              { email, attempts: failedAttempts },
              "Failed login attempt",
            );
          }

          return null;
        }

        const resetResult = await User.findOneAndUpdate(
          {
            _id: user._id,
            $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
          },
          {
            $set: {
              failedLoginCount: 0,
              lockedUntil: null,
              lastLogin: now,
            },
          },
          { new: true },
        );

        if (!resetResult) {
          logger.warn({ email }, "Login rejected: account was locked concurrently during password verification");
          return null;
        }

        const organization = await Organization.findOne({ _id: user.organizationId, status: "active" }).select("_id");
        if (!organization) {
          logger.warn({ email, organizationId: user.organizationId }, "Login denied: organization inactive or not found");
          return null;
        }

        logger.info({ email, role: user.role, organizationId: user.organizationId }, "User authenticated successfully");

        const role = typeof user.role === "string" ? user.role : "Administrator";
        const orgIdStr = user.organizationId ? String(user.organizationId) : undefined;
        const customPermissions = Array.isArray(user.permissions) ? (user.permissions as string[]) : [];
        const permissions = customPermissions.length > 0 ? customPermissions : (rolePermissions[role] ?? []);
        const authzVersion = Number(user.authzVersion ?? user.authVersion ?? 0);
        const mustChangePassword = Boolean((user as unknown as { mustChangePassword?: boolean }).mustChangePassword);

        return {
          id: String(user._id),
          name: typeof user.name === "string" ? user.name : email,
          email,
          role,
          organizationId: orgIdStr,
          tenantId: orgIdStr,
          permissions,
          authzVersion,
          authVersion: authzVersion,
          mustChangePassword,
        };
      },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 60 * 60, // 1 hour
  },
  useSecureCookies: isProduction,
  cookies: {
    sessionToken: {
      name: isProduction ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.tenantId = user.tenantId ?? user.organizationId;
        token.permissions = user.permissions ?? rolePermissions[user.role] ?? [];
        token.authzVersion = typeof user.authzVersion === "number" ? user.authzVersion : (user.authVersion ?? 0);
        token.authVersion = token.authzVersion;
        token.mustChangePassword = user.mustChangePassword ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "Administrator";
        session.user.organizationId = token.organizationId;
        session.user.tenantId = token.tenantId ?? token.organizationId;
        session.user.permissions = token.permissions ?? rolePermissions[session.user.role] ?? [];
        session.user.authzVersion = typeof token.authzVersion === "number" ? token.authzVersion : (token.authVersion ?? 0);
        session.user.authVersion = session.user.authzVersion;
        session.user.mustChangePassword = token.mustChangePassword ?? false;

        if (session.user.id !== "admin" && token.organizationId) {
          await connectToDatabase();
          const [activeOrganization, currentUser] = await Promise.all([
            Organization.exists({ _id: token.organizationId, status: "active" }),
            User.findById(token.id).select("role permissions authzVersion authVersion isDeleted mustChangePassword"),
          ]);
          if (currentUser) {
            session.user.mustChangePassword = Boolean((currentUser as unknown as { mustChangePassword?: boolean })?.mustChangePassword);
          }
          const dbAuthzVersion = Number(currentUser?.authzVersion ?? currentUser?.authVersion ?? 0);
          const tokenAuthzVersion = Number(token.authzVersion ?? token.authVersion ?? 0);

          if (
            !activeOrganization ||
            !currentUser ||
            currentUser.isDeleted ||
            dbAuthzVersion !== tokenAuthzVersion
          ) {
            session.user.id = "";
            session.user.role = "Inactive";
            session.user.organizationId = undefined;
            session.user.tenantId = undefined;
            session.user.permissions = [];
            session.user.authzVersion = 0;
            session.user.authVersion = 0;
          } else {
            const dbRole = typeof currentUser.role === "string" ? currentUser.role : session.user.role;
            session.user.role = dbRole;
            const customPerms = Array.isArray(currentUser.permissions) ? (currentUser.permissions as string[]) : [];
            session.user.permissions = customPerms.length > 0 ? customPerms : (rolePermissions[dbRole] ?? []);
            session.user.authzVersion = dbAuthzVersion;
            session.user.authVersion = dbAuthzVersion;
          }
        }
      }
      return session;
    },
  },
};
