import mongoose, { Schema, type Model } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ServiceUnavailableError } from "@/lib/errors";

export interface IRateLimitRecord {
  key: string;
  count: number;
  expiresAt: Date;
}

const RateLimitSchema = new Schema<IRateLimitRecord>(
  {
    key: { type: String, required: true, index: true },
    count: { type: Number, required: true, default: 1 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "rate_limits" },
);

// TTL index: documents are automatically purged when expiresAt passes
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit: Model<IRateLimitRecord> =
  (mongoose.models.RateLimit as Model<IRateLimitRecord>) ||
  mongoose.model<IRateLimitRecord>("RateLimit", RateLimitSchema, "rate_limits");

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}

// In-memory fallback map for non-production environments when MongoDB is unavailable (e.g. unit tests)
const memoryBuckets = new Map<string, { count: number; expiresAt: number }>();

function fallbackMemoryRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const bucket = memoryBuckets.get(key);

  if (!bucket || bucket.expiresAt <= now) {
    memoryBuckets.set(key, { count: 1, expiresAt: now + windowMs });
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt: new Date(now + windowMs),
    };
  }

  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: new Date(bucket.expiresAt),
  };
}

/**
 * Distributed rate limiter backed by MongoDB shared store.
 * Suitable for multi-instance production environments.
 *
 * Uses atomic bucketed increments to avoid race conditions.
 *
 * @param key Unique key to rate limit (e.g. "signup:ip:127.0.0.1")
 * @param limit Max allowed requests within window
 * @param windowSeconds Window length in seconds
 */
export async function checkRateLimit({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const isProduction = process.env.NODE_ENV === "production";
  const disablePublicSignup = process.env.DISABLE_PUBLIC_SIGNUP === "true";

  if (disablePublicSignup && key.startsWith("signup:")) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
    };
  }

  try {
    await connectToDatabase();
    const windowMs = windowSeconds * 1000;
    const windowBucket = Math.floor(Date.now() / windowMs);
    const bucketKey = `${key}:${windowBucket}`;
    const expiresAt = new Date((windowBucket + 2) * windowMs);
    const resetAt = new Date((windowBucket + 1) * windowMs);

    const record = await RateLimit.findOneAndUpdate(
      { key: bucketKey },
      {
        $inc: { count: 1 },
        $setOnInsert: { key: bucketKey, expiresAt },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    const currentCount = Number(record?.count ?? 1);
    const allowed = currentCount <= limit;
    const remaining = Math.max(0, limit - currentCount);

    return {
      allowed,
      limit,
      remaining,
      resetAt,
    };
  } catch (error) {
    logger.error({ err: error, key }, "Rate limiter shared store error");

    // In production, if the shared store is unavailable, fail closed!
    if (isProduction) {
      throw new ServiceUnavailableError(
        "Rate limiting shared store is temporarily unavailable. Public signup is disabled until service is restored.",
      );
    }

    // In test or development environments, fallback to in-memory store
    return fallbackMemoryRateLimit(key, limit, windowSeconds);
  }
}

/**
 * Extracts client IP address from standard proxy headers.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  return "127.0.0.1";
}
