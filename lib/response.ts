/**
 * lib/response.ts — Consistent API response envelope helpers.
 *
 * All API route handlers must use these helpers instead of calling
 * NextResponse.json() directly. This enforces:
 *  - Consistent response shape: { ok, data?, error?, code?, issues? }
 *  - No stack trace leakage to clients
 *  - Structured error logging via the application logger
 */

import { NextResponse } from "next/server";
import {
  isDuplicateKeyError,
  isAppError,
  isTransientTransactionError,
  type ValidationError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";

// ─── Response shapes ──────────────────────────────────────────────────────────

export type ApiOkResponse<T = unknown> = {
  ok: true;
  data: T;
};

export type ApiErrorResponse = {
  ok: false;
  error: string;
  code?: string;
  /** Field-level validation errors, keyed by field name. */
  issues?: Record<string, string[]>;
};

export type PaginatedMeta = {
  total?: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextCursor?: string;
};

export type ApiPaginatedResponse<T = unknown> = ApiOkResponse<T[]> & {
  meta: PaginatedMeta;
};

// ─── Builders ─────────────────────────────────────────────────────────────────

/** 200 OK with data payload. */
export function okResponse<T>(data: T, status = 200): NextResponse<ApiOkResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

/** 201 Created with data payload. */
export function createdResponse<T>(data: T): NextResponse<ApiOkResponse<T>> {
  return okResponse(data, 201);
}

/** Paginated list response. */
export function paginatedResponse<T>(
  items: T[],
  meta: PaginatedMeta,
): NextResponse<ApiPaginatedResponse<T>> {
  return NextResponse.json({ ok: true, data: items, meta });
}

/**
 * Error response — safe for client consumption (no stack traces).
 * Use `handleRouteError` to automatically map thrown errors.
 */
export function errorResponse(
  message: string,
  status: number,
  code?: string,
  issues?: Record<string, string[]>,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ ok: false, error: message, code, issues }, { status });
}

// ─── Error handler ────────────────────────────────────────────────────────────

/**
 * Catches any thrown error and returns the appropriate API response.
 * Call this in every route handler's catch block:
 *
 *   } catch (error) {
 *     return handleRouteError(error, requestId);
 *   }
 */
export function handleRouteError(
  error: unknown,
  requestId?: string,
): NextResponse<ApiErrorResponse> {
  const ctx = requestId ? { requestId } : {};

  // ── Known application errors (operational) ──
  if (isAppError(error)) {
    if (error.isOperational) {
      logger.warn({ ...ctx, code: error.code, status: error.statusCode }, error.message);
    } else {
      logger.error({ ...ctx, err: error }, "Non-operational AppError");
    }

    const validationError = error as ValidationError;
    return errorResponse(
      error.message,
      error.statusCode,
      error.code,
      validationError.fieldErrors,
    );
  }

  // ── Mongoose schema validation ──
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ValidationError" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const validationErrors =
      "errors" in error && typeof error.errors === "object" && error.errors !== null
        ? Object.values(error.errors)
        : [];
    const firstFieldError = validationErrors.find(
      (fieldError): fieldError is { message: string } =>
        typeof fieldError === "object" &&
        fieldError !== null &&
        "message" in fieldError &&
        typeof fieldError.message === "string",
    );
    const message = firstFieldError?.message || error.message;
    logger.warn({ ...ctx }, "Mongoose schema validation failed");
    return errorResponse(message, 400, "VALIDATION_ERROR");
  }

  // ── MongoDB duplicate key ──
  if (isDuplicateKeyError(error)) {
    logger.warn({ ...ctx, keyValue: error.keyValue }, "Duplicate key conflict");
    return errorResponse("A record with those details already exists.", 409, "CONFLICT");
  }

  // ── Transient transaction errors — tell client to retry ──
  if (isTransientTransactionError(error)) {
    logger.warn({ ...ctx }, "Transient transaction error — client should retry");
    return errorResponse(
      "A temporary conflict occurred. Please retry the request.",
      409,
      "TRANSIENT_CONFLICT",
    );
  }

  // ── MongoDB replica-set / connection errors ──
  if (error instanceof Error) {
    if (/Transaction numbers are only allowed|transactions are not supported|standalone servers do not support transactions|replica set/i.test(error.message)) {
      logger.error({ ...ctx, err: error }, "Replica-set required for transactions");
      return errorResponse(
        "This operation requires MongoDB transactions. Configure MongoDB as a replica set or Atlas cluster.",
        503,
        "REPLICA_SET_REQUIRED",
      );
    }

    const errorName = "name" in error ? String(error.name) : "";
    if (
      /Mongo(Server|oseServer)SelectionError/.test(errorName) ||
      /MongooseServerSelectionError|server selection timed out|buffering timed out|querySrv|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(error.message)
    ) {
      logger.error({ ...ctx, err: error }, "Database connection error");
      return errorResponse(
        "The database is temporarily unavailable. Please try again.",
        503,
        "DB_UNAVAILABLE",
      );
    }
  }

  // ── Unknown / programming error — log fully, return generic message ──
  logger.error({ ...ctx, err: error }, "Unhandled route error");
  return errorResponse(
    "An unexpected error occurred. Our team has been notified.",
    500,
    "INTERNAL_ERROR",
  );
}

/**
 * Wraps a Zod parse result into a 400 error response.
 * Usage:
 *   const parsed = schema.safeParse(body);
 *   if (!parsed.success) return zodError(parsed.error);
 */
export function zodError(error: { issues: { path: (string | number)[]; message: string }[] }): NextResponse<ApiErrorResponse> {
  const issues: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (issues[key] ??= []).push(issue.message);
  }
  return errorResponse(
    "Validation failed. Check the highlighted fields and try again.",
    400,
    "VALIDATION_ERROR",
    issues,
  );
}

/** Utility to extract request-ID from headers (injected by middleware). */
export function getRequestId(request: Request): string {
  return (request as { headers: Headers }).headers.get("x-request-id") ?? "unknown";
}
