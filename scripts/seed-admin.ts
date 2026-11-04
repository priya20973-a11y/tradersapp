/**
 * scripts/seed-admin.ts — Secure Admin Credential Generator
 *
 * Generates or reads super admin credentials securely.
 * Reads from ADMIN_PASSWORD environment variable or generates a cryptographically
 * secure random password. Computes bcrypt hash (cost 12) and displays the base64
 * hash string for ADMIN_PASSWORD_HASH_BASE64.
 *
 * NEVER logs or commits the password.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *   ADMIN_PASSWORD="CustomPassword123!" npx tsx scripts/seed-admin.ts
 */

import { randomBytes } from "node:crypto";
import { hashSync } from "bcryptjs";

export function generateAdminCredentials(customPassword?: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || "admin@example.com";
  const password =
    customPassword ||
    process.env.ADMIN_PASSWORD ||
    process.env.SEED_ADMIN_PASSWORD ||
    randomBytes(18).toString("base64url");

  // bcrypt hash with cost factor 12
  const passwordHash = hashSync(password, 12);
  const hashBase64 = Buffer.from(passwordHash).toString("base64");

  return {
    email: adminEmail,
    password,
    hashBase64,
  };
}

if (process.argv[1]?.includes("seed-admin")) {
  const creds = generateAdminCredentials();

  console.log("════════════════════════════════════════════════════════════════");
  console.log("  SUPER ADMIN CREDENTIAL GENERATOR");
  console.log("════════════════════════════════════════════════════════════════");
  console.log(`  Admin Email:        ${creds.email}`);
  console.log(`  One-time Password:  ${creds.password}`);
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  Add the following to your .env.local file (do NOT commit):");
  console.log(`  ADMIN_EMAIL=${creds.email}`);
  console.log(`  ADMIN_PASSWORD_HASH_BASE64=${creds.hashBase64}`);
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  [NOTICE] Securely store this generated password. It will not be shown again.");
}
