/**
 * scripts/seed-tenant.ts — Seed Default Tenant, Owner User, and Chart of Accounts
 *
 * Idempotent seeder: safe to run multiple times.
 * Usage:
 *   npx tsx scripts/seed-tenant.ts
 */

import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { connectToDatabase } from "../lib/db";
import { Organization, User, ChartOfAccount } from "../models";
import { logger } from "../lib/logger";

interface DefaultAccount {
  code: string;
  name: string;
  accountType: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  normalBalance: "debit" | "credit";
}

const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccount[] = [
  // Assets (debit normal)
  { code: "1010", name: "Cash on Hand", accountType: "Asset", normalBalance: "debit" },
  { code: "1020", name: "Operating Bank Account", accountType: "Asset", normalBalance: "debit" },
  { code: "1030", name: "Trade Accounts Receivable (Sundry Debtors)", accountType: "Asset", normalBalance: "debit" },
  { code: "1040", name: "Commodity Stock / Inventory", accountType: "Asset", normalBalance: "debit" },
  { code: "1050", name: "Advance to Suppliers", accountType: "Asset", normalBalance: "debit" },
  { code: "1060", name: "GST Input Tax Credit (ITC)", accountType: "Asset", normalBalance: "debit" },

  // Liabilities (credit normal)
  { code: "2010", name: "Trade Accounts Payable (Sundry Creditors)", accountType: "Liability", normalBalance: "credit" },
  { code: "2020", name: "Advance from Customers", accountType: "Liability", normalBalance: "credit" },
  { code: "2030", name: "GST Output Tax Payable", accountType: "Liability", normalBalance: "credit" },
  { code: "2040", name: "TDS / TCS Payable", accountType: "Liability", normalBalance: "credit" },

  // Equity (credit normal)
  { code: "3010", name: "Owner's Capital", accountType: "Equity", normalBalance: "credit" },
  { code: "3020", name: "Retained Earnings", accountType: "Equity", normalBalance: "credit" },

  // Revenue (credit normal)
  { code: "4010", name: "Commodity Sales Revenue", accountType: "Revenue", normalBalance: "credit" },
  { code: "4020", name: "Trading Commission Income", accountType: "Revenue", normalBalance: "credit" },
  { code: "4030", name: "Storage & Handling Income", accountType: "Revenue", normalBalance: "credit" },

  // Expenses (debit normal)
  { code: "5010", name: "Cost of Goods Sold (Commodity Purchases)", accountType: "Expense", normalBalance: "debit" },
  { code: "5020", name: "Warehouse Rental & Cold Storage Fees", accountType: "Expense", normalBalance: "debit" },
  { code: "5030", name: "Freight, Logistics & Hamali Charges", accountType: "Expense", normalBalance: "debit" },
  { code: "5040", name: "Quality Testing & Grading Fees", accountType: "Expense", normalBalance: "debit" },
  { code: "5050", name: "Bank Charges & Interest", accountType: "Expense", normalBalance: "debit" },
];

async function seedTenant() {
  await connectToDatabase();
  logger.info("Connected to database for tenant seeding.");

  const tenantOrgId = "agritrade";
  const tenantEmail = "admin@agritrade.com";
  const ownerEmail = "owner@agritrade.com";

  // 1. Create or update tenant organization
  let tenant = await Organization.findOne({ orgId: tenantOrgId });
  if (!tenant) {
    tenant = await Organization.create({
      name: "AgriTrade Global Corp",
      orgId: tenantOrgId,
      email: tenantEmail,
      phone: "+91-9876543210",
      address: "APMC Market Yard, Phase II",
      city: "Navi Mumbai",
      state: "Maharashtra",
      pincode: "400703",
      country: "India",
      currency: "INR",
      financialYear: "2026-2027",
      status: "active",
      plan: "enterprise",
      numberSeries: {
        deal: { prefix: "DL", nextNumber: 1001 },
        contract: { prefix: "CTR", nextNumber: 1001 },
        invoice: { prefix: "INV", nextNumber: 1001 },
        payment: { prefix: "PAY", nextNumber: 1001 },
        stockLot: { prefix: "LOT", nextNumber: 1001 },
        goodsReceipt: { prefix: "GRN", nextNumber: 1001 },
      },
    });
    logger.info({ orgId: tenant.orgId }, "Created tenant organization");
  } else {
    logger.info({ orgId: tenant.orgId }, "Tenant organization already exists");
  }

  // 2. Create or update organization owner user
  let owner = await User.findOne({ email: ownerEmail });
  let oneTimePassword: string | null = null;
  if (!owner) {
    const ownerPassword =
      process.env.SEED_OWNER_PASSWORD ||
      process.env.OWNER_PASSWORD ||
      randomBytes(18).toString("base64url");
    oneTimePassword = ownerPassword;
    const passwordHash = await hash(ownerPassword, 12);
    owner = await User.create({
      name: "Rajesh Sharma",
      email: ownerEmail,
      passwordHash,
      role: "Organization Owner",
      organizationId: tenant._id,
      failedLoginCount: 0,
      lockedUntil: null,
      authzVersion: 0,
      authVersion: 0,
    });
    logger.info({ email: ownerEmail }, "Created Organization Owner user");
  } else {
    logger.info({ email: ownerEmail }, "Organization Owner user already exists");
  }

  // 3. Seed Chart of Accounts
  let createdCount = 0;
  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    const exists = await ChartOfAccount.findOne({
      organizationId: tenant._id,
      code: acc.code,
    });

    if (!exists) {
      await ChartOfAccount.create({
        organizationId: tenant._id,
        code: acc.code,
        name: acc.name,
        accountType: acc.accountType,
        normalBalance: acc.normalBalance,
      });
      createdCount++;
    }
  }

  logger.info({ tenantId: tenant._id, createdAccounts: createdCount }, "Chart of Accounts seeding complete");
  console.log("Tenant seeding complete:");
  console.log(`  Tenant: ${tenant.name} (${tenant.orgId})`);
  if (oneTimePassword) {
    console.log(`  Owner:  ${owner.email}`);
    console.log(`  One-time password: ${oneTimePassword}`);
    console.log("  [NOTICE] Securely store this generated password. It will not be shown again.");
  } else {
    console.log(`  Owner:  ${owner.email} (existing user; password unchanged)`);
  }
  console.log(`  Accounts: ${DEFAULT_CHART_OF_ACCOUNTS.length} standard accounts verified`);
}

seedTenant()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
