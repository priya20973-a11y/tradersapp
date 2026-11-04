import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      organizationId?: string;
      tenantId?: string;
      permissions?: string[];
      authzVersion?: number;
      authVersion?: number;
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    organizationId?: string;
    tenantId?: string;
    permissions?: string[];
    authzVersion?: number;
    authVersion?: number;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    organizationId?: string;
    tenantId?: string;
    permissions?: string[];
    authzVersion?: number;
    authVersion?: number;
    mustChangePassword?: boolean;
  }
  
}
