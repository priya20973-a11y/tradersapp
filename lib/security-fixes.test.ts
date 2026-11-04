import { describe, it, expect, vi, beforeEach } from "vitest";
import { compare } from "bcryptjs";
import { checkRateLimit, RateLimit } from "@/lib/rate-limit";
import { authOptions } from "@/lib/auth";
import { User } from "@/models";
import { generateAdminCredentials } from "@/scripts/seed-admin";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";
import { ServiceUnavailableError } from "@/lib/errors";

vi.mock("@/lib/db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue({}),
  withTransaction: vi.fn().mockImplementation((fn: (s: unknown) => unknown) => fn({})),
}));

describe("Security Audits & Hardening Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.DISABLE_PUBLIC_SIGNUP;
  });

  describe("1. Public Signup Rate Limiting & Reliable Shared Store", () => {
    it("allows requests under the rate limit and tracks remaining quota", async () => {
      vi.spyOn(RateLimit, "findOneAndUpdate").mockResolvedValue({
        count: 2,
      } as never);

      const result = await checkRateLimit({
        key: "signup:ip:192.168.1.100",
        limit: 5,
        windowSeconds: 60,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
    });

    it("blocks requests that exceed the rate limit (prevents rate-limit bypass)", async () => {
      vi.spyOn(RateLimit, "findOneAndUpdate").mockResolvedValue({
        count: 6, // 6 attempts > limit of 5
      } as never);

      const result = await checkRateLimit({
        key: "signup:ip:192.168.1.100",
        limit: 5,
        windowSeconds: 60,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("disables signup when DISABLE_PUBLIC_SIGNUP is configured", async () => {
      process.env.DISABLE_PUBLIC_SIGNUP = "true";

      const result = await checkRateLimit({
        key: "signup:ip:10.0.0.1",
        limit: 5,
        windowSeconds: 60,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("fails closed in production if shared rate limit store is unavailable", async () => {
      const prevEnv = process.env.NODE_ENV;
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      vi.spyOn(RateLimit, "findOneAndUpdate").mockRejectedValue(new Error("MongoDB connection failed"));

      try {
        await expect(
          checkRateLimit({
            key: "signup:ip:127.0.0.1",
            limit: 5,
            windowSeconds: 60,
          }),
        ).rejects.toThrow(ServiceUnavailableError);
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
      }
    });
  });

  describe("2. Login Lockout: Atomic Counters, Generic Errors & Concurrency", () => {
    const credentialsProvider = authOptions.providers[0] as unknown as {
      options?: {
        authorize: (credentials: Record<string, string> | undefined, req: unknown) => Promise<unknown>;
      };
      authorize: (credentials: Record<string, string> | undefined, req: unknown) => Promise<unknown>;
    };
    const authorize = credentialsProvider?.options?.authorize ?? credentialsProvider?.authorize;
    expect(authorize).toBeDefined();

    it("returns null for unknown email without revealing account existence", async () => {
      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as never);

      const result = await authorize!({ email: "unknown@example.com", password: "SomePassword123!" }, {} as never);
      expect(result).toBeNull();
    });

    it("returns identical null response for incorrect password and atomically increments failedLoginCount", async () => {
      const userDoc = {
        _id: "user123",
        email: "existing@example.com",
        passwordHash: "$2a$12$e80yq9g6G70.tK1y/b7Z7.vLhN0G4gY6H7K8L9M0N1O2P3Q4R5S6T",
        failedLoginCount: 1,
        lockedUntil: null,
      };

      const selectMock = vi.fn().mockResolvedValue(userDoc);
      const findOneSpy = vi.spyOn(User, "findOne").mockReturnValue({
        select: selectMock,
      } as never);

      const findOneAndUpdateSpy = vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({
        failedLoginCount: 2,
      } as never);

      const result = await authorize!({ email: "existing@example.com", password: "WrongPassword!" }, {} as never);
      expect(result).toBeNull();
      expect(findOneSpy).toHaveBeenCalled();
      expect(selectMock).toHaveBeenCalled();

      // Verify atomic $inc was called with conditional update
      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        {
          _id: "user123",
          $or: [{ lockedUntil: null }, { lockedUntil: { $lte: expect.any(Date) } }],
        },
        {
          $inc: { failedLoginCount: 1 },
        },
        expect.objectContaining({ new: true }),
      );
    });

    it("returns identical null response for locked accounts without leaking lockout or remaining minutes", async () => {
      const futureLock = new Date(Date.now() + 10 * 60 * 1000); // locked for 10 more minutes
      const userDoc = {
        _id: "locked123",
        email: "locked@example.com",
        passwordHash: "$2a$12$e80yq9g6G70.tK1y/b7Z7.vLhN0G4gY6H7K8L9M0N1O2P3Q4R5S6T",
        failedLoginCount: 5,
        lockedUntil: futureLock,
      };

      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue(userDoc),
      } as never);

      // Must NOT throw "Account temporarily locked" — must return the same generic null
      const result = await authorize!({ email: "locked@example.com", password: "AnyPassword123!" }, {} as never);
      expect(result).toBeNull();
    });

    it("atomically locks account when failedLoginCount reaches 5", async () => {
      const userDoc = {
        _id: "user123",
        email: "target@example.com",
        passwordHash: "$2a$12$e80yq9g6G70.tK1y/b7Z7.vLhN0G4gY6H7K8L9M0N1O2P3Q4R5S6T",
        failedLoginCount: 4,
        lockedUntil: null,
      };

      vi.spyOn(User, "findOne").mockReturnValue({
        select: vi.fn().mockResolvedValue(userDoc),
      } as never);

      // 5th failed attempt returned by atomic increment
      vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({
        failedLoginCount: 5,
      } as never);

      const updateOneSpy = vi.spyOn(User, "updateOne").mockResolvedValue({} as never);

      const result = await authorize!({ email: "target@example.com", password: "WrongPassword!" }, {} as never);
      expect(result).toBeNull();

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: "user123", $or: [{ lockedUntil: null }, { lockedUntil: { $lte: expect.any(Date) } }] },
        { $set: { lockedUntil: expect.any(Date) } },
      );
    });
  });

  describe("3. Content Security Policy & Nonce Generation", () => {
    it("generates a cryptographic nonce and sets CSP header on proxy responses", async () => {
      process.env.NEXTAUTH_SECRET = "test_secret_that_is_at_least_32_characters_long_123456";
      const request = new NextRequest("http://localhost:3000/api/health");

      const response = await proxy(request);
      const csp = response.headers.get("Content-Security-Policy");
      const nonce = response.headers.get("x-nonce");

      expect(csp).toBeDefined();
      expect(nonce).toBeDefined();
      expect(nonce!.length).toBeGreaterThanOrEqual(16);

      // Nonce must be included in script-src
      expect(csp).toContain(`script-src 'self' 'nonce-${nonce}'`);
      expect(csp).toContain("'strict-dynamic'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0, must-revalidate");
      expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
      expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    });

    it("generates different nonces for consecutive requests", async () => {
      process.env.NEXTAUTH_SECRET = "test_secret_that_is_at_least_32_characters_long_123456";
      const req1 = new NextRequest("http://localhost:3000/api/health");
      const req2 = new NextRequest("http://localhost:3000/api/health");

      const res1 = await proxy(req1);
      const res2 = await proxy(req2);

      const nonce1 = res1.headers.get("x-nonce");
      const nonce2 = res2.headers.get("x-nonce");

      expect(nonce1).not.toEqual(nonce2);
    });
  });

  describe("4. Admin Seed Script & Secret Handling", () => {
    it("generates cryptographically random password when no password env var is provided", () => {
      delete process.env.ADMIN_PASSWORD;
      delete process.env.SEED_ADMIN_PASSWORD;

      const creds1 = generateAdminCredentials();
      const creds2 = generateAdminCredentials();

      expect(creds1.password).toBeDefined();
      expect(creds1.password.length).toBeGreaterThanOrEqual(18);
      // Successive invocations must generate unique random passwords
      expect(creds1.password).not.toEqual(creds2.password);
    });

    it("reads ADMIN_PASSWORD from environment when explicitly supplied", () => {
      process.env.ADMIN_PASSWORD = "SuppliedSecretPassword123!";

      const creds = generateAdminCredentials();
      expect(creds.password).toBe("SuppliedSecretPassword123!");
      delete process.env.ADMIN_PASSWORD;
    });

    it("produces valid base64-encoded bcrypt hash matching the generated password", async () => {
      const creds = generateAdminCredentials("VerifyBcryptHash123!");
      const rawHash = Buffer.from(creds.hashBase64, "base64").toString("utf8");

      expect(rawHash.startsWith("$2a$12$") || rawHash.startsWith("$2b$12$")).toBe(true);
      const isMatch = await compare("VerifyBcryptHash123!", rawHash);
      expect(isMatch).toBe(true);
    });
  });
});
