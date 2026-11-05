import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase, withTransaction } from "@/lib/db";
import { Organization, User } from "@/models";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
import { createdResponse, handleRouteError } from "@/lib/response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  PAN_REGEX,
  AADHAAR_REGEX,
  GSTIN_REGEX,
  IFSC_REGEX,
  sanitizeAadhaar,
} from "@/lib/indian-states";

const bankDetailsSchema = z
  .object({
    accountHolderName: z.string().trim().max(100).optional().default(""),
    accountNumber: z.string().trim().max(35).optional().default(""),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .refine((val) => !val || IFSC_REGEX.test(val), {
        message: "Invalid IFSC Code format (e.g., HDFC0001234)",
      })
      .optional()
      .default(""),
    bankName: z.string().trim().max(100).optional().default(""),
    branch: z.string().trim().max(100).optional().default(""),
  })
  .optional();

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().pipe(z.string().email("Invalid email address")),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  organizationName: z.string().trim().min(2, "Organization name must be at least 2 characters").max(120),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .refine((val) => !val || PAN_REGEX.test(val), {
      message: "Invalid PAN format. Must be 10 characters (e.g., ABCDE1234F)",
    })
    .optional()
    .default(""),
  aadhaar: z
    .string()
    .trim()
    .refine((val) => !val || AADHAAR_REGEX.test(val), {
      message: "Invalid Aadhaar format. Must be 12 digits (e.g., 1234 5678 9012)",
    })
    .optional()
    .default(""),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((val) => !val || GSTIN_REGEX.test(val), {
      message: "Invalid GSTIN format. Must be 15 characters (e.g., 27ABCDE1234F1Z5)",
    })
    .optional()
    .default(""),
  logo: z.string().optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  state: z.string().trim().max(100).optional().default(""),
  bankDetails: bankDetailsSchema,
});

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  let signupStage = "request-start";

  try {
    // 1. Explicit kill-switch: check if public signup is disabled
    signupStage = "signup-disabled-check";
    if (process.env.DISABLE_PUBLIC_SIGNUP === "true") {
      throw new ForbiddenError("Public signup is currently disabled. Contact your administrator.");
    }

    // 2. IP-based rate limiting via reliable shared store
    signupStage = "ip-rate-limit";
    const clientIp = getClientIp(request);
    const ipRateLimit = await checkRateLimit({
      key: `signup:ip:${clientIp}`,
      limit: 5,
      windowSeconds: 15 * 60, // 5 requests per 15 minutes per IP
    });

    if (!ipRateLimit.allowed) {
      logger.warn({ ip: clientIp }, "Public signup rate limit exceeded for IP");
      return NextResponse.json(
        {
          ok: false,
          error: "Too many registration attempts from your network. Please try again later.",
          code: "RATE_LIMIT_EXCEEDED",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil((ipRateLimit.resetAt.getTime() - Date.now()) / 1000))),
          },
        },
      );
    }

    // 3. Payload parsing & validation
    signupStage = "payload-parse";
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new ValidationError("Please submit valid JSON form data.");
    }

    const validation = signupSchema.safeParse(payload);
    if (!validation.success) {
      const issue = validation.error.issues[0]?.message || "Invalid registration data.";
      throw new ValidationError(issue);
    }

    const {
      name,
      email,
      password,
      organizationName,
      pan,
      aadhaar,
      gstin,
      logo,
      address,
      state,
      bankDetails,
    } = validation.data;

    // 4. Email-based rate limiting (prevents targeted flooding on a single address)
    signupStage = "email-rate-limit";
    const emailRateLimit = await checkRateLimit({
      key: `signup:email:${email}`,
      limit: 3,
      windowSeconds: 15 * 60, // 3 attempts per 15 minutes per email
    });

    if (!emailRateLimit.allowed) {
      logger.warn({ email }, "Public signup rate limit exceeded for email address");
      return NextResponse.json(
        {
          ok: false,
          error: "Too many registration attempts for this email address. Please try again later.",
          code: "RATE_LIMIT_EXCEEDED",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil((emailRateLimit.resetAt.getTime() - Date.now()) / 1000))),
          },
        },
      );
    }

    // Reject reserved admin email
    if (email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
      throw new ConflictError("That email address cannot be registered as an organization user.");
    }

    signupStage = "database-connect";
    await connectToDatabase();

    // 5. Pre-check outside transaction
    signupStage = "existing-user-check";
    const existingUser = await User.exists({ email });
    if (existingUser) {
      throw new ConflictError("An account with this email already exists.");
    }

    signupStage = "password-hash";
    const passwordHash = await bcrypt.hash(password, 12);

    const cleanAadhaar = aadhaar ? sanitizeAadhaar(aadhaar) : "";
    const cleanBank =
      bankDetails &&
      (bankDetails.accountNumber ||
        bankDetails.accountHolderName ||
        bankDetails.ifsc ||
        bankDetails.bankName ||
        bankDetails.branch)
        ? {
            accountHolderName: bankDetails.accountHolderName || undefined,
            accountNumber: bankDetails.accountNumber || undefined,
            ifsc: bankDetails.ifsc || undefined,
            bankName: bankDetails.bankName || undefined,
            branch: bankDetails.branch || undefined,
          }
        : undefined;

    // 6. Atomic multi-document transaction: prevents duplicate organization/user creation & guarantees tenant isolation
    signupStage = "registration-transaction";
    await withTransaction(async (session) => {
      // MongoDB sessions do not support parallel operations within a transaction.
      const existingUserInTx = await User.findOne({ email }).session(session);
      const existingOrgInTx = await Organization.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(organizationName)}$`, "i") },
      }).session(session);

      if (existingUserInTx) {
        throw new ConflictError("An account with this email already exists.");
      }
      if (existingOrgInTx) {
        throw new ConflictError("An organization with that name already exists. Please choose a different name.");
      }

      const [organization] = await Organization.create(
        [
          {
            name: organizationName,
            orgId: randomUUID(),
            status: "pending",
            pan: pan || undefined,
            aadhaar: cleanAadhaar || undefined,
            gstin: gstin || undefined,
            logo: logo || undefined,
            address: address || undefined,
            state: state || undefined,
            bankDetails: cleanBank,
          },
        ],
        { session },
      );

      await User.create(
        [
          {
            name,
            email,
            passwordHash,
            role: "Organization Owner",
            organizationId: organization._id,
            pan: pan || undefined,
            aadhaar: cleanAadhaar || undefined,
            gstin: gstin || undefined,
            logo: logo || undefined,
            address: address || undefined,
            state: state || undefined,
            bankDetails: cleanBank,
            authzVersion: 0,
            authVersion: 0,
            failedLoginCount: 0,
            lockedUntil: null,
          },
        ],
        { session },
      );
    });

    signupStage = "signup-complete";
    logger.info({ requestId }, "Public signup created pending organization and owner user");
    return createdResponse({ pendingApproval: true });
  } catch (error) {
    const response = handleRouteError(error, requestId);
    if (response.status >= 500) {
      logger.error({ requestId, signupStage }, "Public signup failed at stage");
    }
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
