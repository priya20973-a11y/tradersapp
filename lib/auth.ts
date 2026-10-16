import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { Organization, User } from "@/models";

export const rolePermissions: Record<string, string[]> = {
  "Super Admin": ["all"],
  "Organization Owner": ["all"],
  Administrator: ["all"],
  Accountant: ["accounting", "reports", "banking", "invoices", "payments", "view-traders", "trader-ledger", "financial-export"],
  "Sales Manager": ["sales", "customers", "estimates", "invoices", "reports", "view-traders", "manage-traders", "approve-kyc", "approve-credit-limits", "manage-deals", "record-trading-payments", "approve-settlements", "trader-ledger"],
  "Sales Executive": ["customers", "invoices", "view-traders", "manage-traders", "manage-deals"],
  "Purchase Manager": ["purchases", "vendors", "bills", "expenses", "view-traders", "manage-traders", "manage-deals", "record-trading-payments", "approve-settlements"],
  "Inventory Manager": ["items", "inventory", "warehouses", "stock", "view-traders", "manage-commodities", "manage-stock-lots", "approve-stock-adjustments"],
  "Read-Only Auditor": ["reports", "audit", "view-traders", "trader-ledger", "view-audit-logs"],
};

export type RoleName = keyof typeof rolePermissions;

export function canAccessRole(role: RoleName | string, permission: string) {
  const permissions = rolePermissions[role] ?? [];
  return permissions.includes("all") || permissions.includes(permission);
}

export const authOptions: NextAuthOptions = {
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
            return {
              id: "admin",
              name: "Admin",
              email,
              role: "Super Admin",
            };
          }
          return null;
        }

        await connectToDatabase();
        const user = await User.findOne({ email }).select("name email passwordHash role organizationId authVersion");
        if (!user || typeof user.passwordHash !== "string" || !(await compare(password, user.passwordHash))) {
          return null;
        }
        const organization = await Organization.findOne({ _id: user.organizationId, status: "active" }).select("_id");
        if (!organization) return null;

        return {
          id: String(user._id),
          name: typeof user.name === "string" ? user.name : email,
          email,
          role: typeof user.role === "string" ? user.role : "Administrator",
          organizationId: user.organizationId ? String(user.organizationId) : undefined,
          authVersion: Number(user.authVersion ?? 0),
        };
      },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.authVersion = user.authVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "Administrator";
        session.user.organizationId = token.organizationId;
        if (session.user.id !== "admin" && token.organizationId) {
          await connectToDatabase();
          const [activeOrganization, currentUser] = await Promise.all([
            Organization.exists({ _id: token.organizationId, status: "active" }),
            User.findById(token.id).select("authVersion"),
          ]);
          if (!activeOrganization || !currentUser || Number(currentUser.authVersion ?? 0) !== Number(token.authVersion ?? 0)) {
            session.user.id = "";
            session.user.role = "Inactive";
            session.user.organizationId = undefined;
          }
        }
      }
      return session;
    },
  },
};
