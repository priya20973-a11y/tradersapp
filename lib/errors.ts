/**
 * lib/errors.ts — Typed application error classes.
 *
 * All service layer errors extend AppError. Routes catch these and
 * translate them to the appropriate HTTP status code without leaking
 * stack traces or internal details to clients.
 */

/** Base class for all application errors. */
export class AppError extends Error {
  /** HTTP status code to return. */
  public readonly statusCode: number;
  /** Machine-readable error code for client handling. */
  public readonly code: string;
  /** Whether this error should be logged as a warning (vs error). */
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    // Restore prototype chain (required for instanceof checks after transpilation)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 400 — Input failed Zod/business-rule validation.
 * Include a human-readable `message` and optionally `fieldErrors`.
 */
export class ValidationError extends AppError {
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message, 400, "VALIDATION_ERROR");
    this.fieldErrors = fieldErrors;
  }
}

/** 401 — Caller is not authenticated. */
export class AuthError extends AppError {
  constructor(message = "Authentication required. Please sign in.") {
    super(message, 401, "AUTH_REQUIRED");
  }
}

/** 403 — Caller is authenticated but lacks permission. */
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, 403, "FORBIDDEN");
  }
}

/** 404 — Resource not found (or intentionally hidden from caller). */
export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found.`, 404, "NOT_FOUND");
  }
}

/** 409 — Conflict: duplicate key, state machine violation, etc. */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

/**
 * 422 — Stock operation would push quantity below zero.
 * Thrown by applyStockMovement() when the atomic conditional update fails.
 */
export class InsufficientStockError extends AppError {
  public readonly lotId: string;
  public readonly requested: number;
  public readonly available: number;

  constructor(lotId: string, requested: number, available: number) {
    super(
      `Insufficient stock in lot ${lotId}. Requested: ${requested}, Available: ${available}.`,
      422,
      "INSUFFICIENT_STOCK",
    );
    this.lotId = lotId;
    this.requested = requested;
    this.available = available;
  }
}

/**
 * 422 — Credit check failed: outstanding + this deal value > credit limit.
 * Thrown by the contract service before creating a sales deal.
 */
export class CreditLimitExceededError extends AppError {
  public readonly traderId: string;
  public readonly creditLimit: number;
  public readonly currentExposure: number;
  public readonly requestedAmount: number;

  constructor(traderId: string, creditLimit: number, currentExposure: number, requestedAmount: number) {
    super(
      `Credit limit exceeded for trader ${traderId}. ` +
      `Limit: ₹${(creditLimit / 100).toFixed(2)}, ` +
      `Current exposure: ₹${(currentExposure / 100).toFixed(2)}, ` +
      `This deal: ₹${(requestedAmount / 100).toFixed(2)}.`,
      422,
      "CREDIT_LIMIT_EXCEEDED",
    );
    this.traderId = traderId;
    this.creditLimit = creditLimit;
    this.currentExposure = currentExposure;
    this.requestedAmount = requestedAmount;
  }
}

/**
 * 422 — Contract state machine transition is not allowed.
 */
export class InvalidContractTransitionError extends AppError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Cannot transition contract from "${fromStatus}" to "${toStatus}".`,
      422,
      "INVALID_CONTRACT_TRANSITION",
    );
  }
}

/**
 * 422 — Journal entry does not balance (debits ≠ credits).
 */
export class UnbalancedJournalError extends AppError {
  constructor(debits: number, credits: number) {
    super(
      `Journal entry does not balance. Debits: ${debits} paise, Credits: ${credits} paise.`,
      422,
      "UNBALANCED_JOURNAL",
    );
  }
}

/**
 * 503 — External dependency (DB, etc.) is unavailable.
 * Callers should not retry immediately.
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = "The service is temporarily unavailable. Please try again later.") {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}

/** Type guard: is this an AppError we know how to handle? */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Type guard: is this a MongoDB duplicate-key error (code 11000)? */
export function isDuplicateKeyError(error: unknown): error is { code: 11000; keyValue: Record<string, unknown> } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}

/** Type guard: is this a MongoDB transaction-related transient error worth retrying? */
export function isTransientTransactionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /TransientTransactionError|WriteConflict/.test(error.message) ||
    ("errorLabels" in error && Array.isArray((error as { errorLabels: string[] }).errorLabels) &&
      (error as { errorLabels: string[] }).errorLabels.includes("TransientTransactionError"));
}
