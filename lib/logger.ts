/**
 * lib/logger.ts — Structured application logger (Pino).
 *
 * Features:
 *  - JSON output in production, pretty-printed in development.
 *  - Automatic redaction of sensitive fields (passwords, keys, tokens).
 *  - Singleton: safe to import anywhere in server-side code.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info({ userId, action }, "User signed in");
 *   logger.error({ err: error, requestId }, "Payment failed");
 *
 * NEVER import in client-side code.
 */

import pino from "pino";

/** Fields that must NEVER appear in log output. */
const REDACTED_PATHS = [
  "password",
  "passwordHash",
  "currentPassword",
  "newPassword",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "NEXTAUTH_SECRET",
  "encryptedAccountNumber",
  "accountNumber",
  "encryptionKey",
  "BANK_DETAILS_ENCRYPTION_KEY",
  "ADMIN_PASSWORD_HASH_BASE64",
  "apiKey",
  "authorization",
  "*.password",
  "*.passwordHash",
  "*.encryptedAccountNumber",
  "*.accountNumber",
  "*.secret",
  "*.token",
];

const isDevelopment = process.env.NODE_ENV !== "production";
const isTest = process.env.NODE_ENV === "test";

export const logger = pino({
  // In test environment silence logs unless LOG_LEVEL explicitly set
  level: process.env.LOG_LEVEL ?? (isTest ? "silent" : isDevelopment ? "debug" : "info"),

  redact: {
    paths: REDACTED_PATHS,
    censor: "[REDACTED]",
  },

  // Format timestamps as ISO strings
  timestamp: pino.stdTimeFunctions.isoTime,

  // Pretty-print in development
  ...(isDevelopment && !isTest
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),

  // Base fields attached to every log line
  base: {
    env: process.env.NODE_ENV ?? "development",
    service: "traders-erp",
  },

  // Serialize Error objects properly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

/**
 * Creates a child logger with a fixed context.
 * Use in service modules to avoid repeating context fields:
 *
 *   const log = childLogger({ module: "stock-service" });
 *   log.info({ lotId }, "Stock movement applied");
 */
export function childLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
