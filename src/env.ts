/**
 * src/env.ts — Boot-time environment variable validation.
 *
 * This module is imported at the top of lib/db.ts and lib/auth.ts.
 * It validates all required env vars using Zod and throws a clear
 * error message on startup if anything is misconfigured.
 *
 * NEVER import this in client-side code. Server-only.
 */

import { z } from "zod";

const envSchema = z.object({
  // ─── Auth ─────────────────────────────────────────────────────────────────
  NEXTAUTH_SECRET: z
    .string({ message: "NEXTAUTH_SECRET is required. Generate with: openssl rand -hex 32" })
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters"),

  NEXTAUTH_URL: z
    .string({ message: "NEXTAUTH_URL is required (e.g. http://localhost:3000)" })
    .url("NEXTAUTH_URL must be a valid URL"),

  // ─── Database ─────────────────────────────────────────────────────────────
  MONGODB_URI: z
    .string({ message: "MONGODB_URI is required. Provide a MongoDB connection string." })
    .min(10, "MONGODB_URI appears to be too short"),

  // ─── Encryption ───────────────────────────────────────────────────────────
  BANK_DETAILS_ENCRYPTION_KEY: z
    .string({
      message:
        "BANK_DETAILS_ENCRYPTION_KEY is required. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    })
    .refine(
      (val) => {
        try {
          return Buffer.from(val, "base64").length === 32;
        } catch {
          return false;
        }
      },
      { message: "BANK_DETAILS_ENCRYPTION_KEY must be a base64-encoded 32-byte (256-bit) key" },
    ),

  ENCRYPTION_KEY_ID: z
    .string({ message: "ENCRYPTION_KEY_ID is required to identify the current encryption key version (e.g. 'v1')" })
    .min(1)
    .max(40),

  // ─── Admin ────────────────────────────────────────────────────────────────
  ADMIN_EMAIL: z
    .string({ message: "ADMIN_EMAIL is required. Set the super-admin email address." })
    .email("ADMIN_EMAIL must be a valid email address"),

  ADMIN_PASSWORD_HASH_BASE64: z
    .string({
      message:
        "ADMIN_PASSWORD_HASH_BASE64 is required. Generate with the seed-admin script.",
    })
    .min(20, "ADMIN_PASSWORD_HASH_BASE64 appears invalid"),

  // ─── Runtime ──────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),

  // ─── Optional: Encryption key rotation ───────────────────────────────────
  /** Comma-separated list of previous key IDs and base64 keys: "v0:base64key0,v-1:base64key-1" */
  ENCRYPTION_KEYS_PREVIOUS: z.string().optional(),

  // ─── Optional: Rate limiting ─────────────────────────────────────────────
  /** Max auth attempts per minute per IP (default 5) */
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(5),
  /** Max read requests per minute per session (default 100) */
  RATE_LIMIT_READ_MAX: z.coerce.number().int().positive().default(100),
  /** Max write requests per minute per session (default 30) */
  RATE_LIMIT_WRITE_MAX: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ✗ ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    const message = [
      "",
      "════════════════════════════════════════════════════════",
      "  CONFIGURATION ERROR — Server cannot start",
      "════════════════════════════════════════════════════════",
      "  The following environment variables are missing or invalid:",
      "",
      issues,
      "",
      "  See .env.example for the full list of required variables.",
      "════════════════════════════════════════════════════════",
      "",
    ].join("\n");

    throw new Error(message);
  }

  return result.data;
}

/**
 * Validated environment variables.
 * Throws a clear error at import time if any required variable is missing.
 * Import only in server-side code (lib/, app/api/, modules/).
 */
export const env = validateEnv();
