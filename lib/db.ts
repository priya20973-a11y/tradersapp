/**
 * lib/db.ts — MongoDB connection singleton with:
 *  - HMR-safe caching (reuses connection across Next.js hot reloads in dev)
 *  - Pool configuration
 *  - withTransaction() helper with TransientTransactionError retry
 *  - Slow-query logging
 *  - Clear error messages for common failure modes
 */

import mongoose, { type ClientSession } from "mongoose";
import { logger } from "@/lib/logger";
import { isTransientTransactionError, ServiceUnavailableError } from "@/lib/errors";

// ─── HMR-safe global cache ────────────────────────────────────────────────────

declare global {
  var __mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

if (!global.__mongooseCache) {
  global.__mongooseCache = { conn: null, promise: null };
}

const cache = global.__mongooseCache;

// ─── Connection ────────────────────────────────────────────────────────────────

export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI ?? process.env.MONGODB_URL;
  if (!uri) {
    throw new ServiceUnavailableError(
      "Missing MONGODB_URI. Add the MongoDB connection string to your environment.",
    );
  }
  return uri;
}

/**
 * Returns a cached Mongoose connection.
 * Safe to call on every request — only opens the connection once.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn;
  }

  if (!cache.promise) {
    const uri = getMongoUri();
    const options: mongoose.ConnectOptions = {
      // Connection pool
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5_000,
      socketTimeoutMS: 45_000,
      connectTimeoutMS: 10_000,
      // Heartbeat
      heartbeatFrequencyMS: 10_000,
    };

    logger.info({ uri: uri.replace(/\/\/[^@]+@/, "//<credentials>@") }, "Connecting to MongoDB");

    cache.promise = mongoose.connect(uri, options).then((conn) => {
      logger.info("MongoDB connected");
      return conn;
    });

    // Attach slow-query logging once
    mongoose.set("debug", (collectionName: string, method: string, query: unknown, doc: unknown, options: unknown) => {
      logger.trace({ collection: collectionName, method, query, doc, options }, "Mongoose query");
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    logger.error({ err: error }, "MongoDB connection failed");
    throw new ServiceUnavailableError(
      "Database connection failed. Check MONGODB_URI and ensure MongoDB is running.",
    );
  }

  return cache.conn;
}

// ─── withTransaction helper ───────────────────────────────────────────────────

const MAX_RETRY_ATTEMPTS = 3;

/**
 * Runs `fn` inside a MongoDB session transaction with automatic retry on
 * TransientTransactionError (write conflicts, network hiccups).
 *
 * Usage:
 *   const result = await withTransaction(async (session) => {
 *     await StockLot.updateOne({ ... }, { ... }, { session });
 *     await StockMovement.create([{ ... }], { session });
 *     return { success: true };
 *   });
 *
 * Throws if the transaction fails after all retries, or if the error
 * is not transient.
 */
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
  attempts = MAX_RETRY_ATTEMPTS,
): Promise<T> {
  await connectToDatabase();

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const session = await mongoose.startSession();
    try {
      let result: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result!;
    } catch (error) {
      const isTransient = isTransientTransactionError(error);
      if (isTransient && attempt < attempts) {
        const delay = attempt * 100; // 100ms, 200ms, 300ms
        logger.warn(
          { attempt, maxAttempts: attempts, delay },
          "Transient transaction error — retrying",
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  throw new Error("withTransaction: exhausted all retry attempts");
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== "test") {
  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received — closing MongoDB connection");
    await mongoose.disconnect();
  });
}
