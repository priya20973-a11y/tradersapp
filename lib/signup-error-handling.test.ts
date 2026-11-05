import { describe, it, expect } from "vitest";
import { handleRouteError } from "@/lib/response";
import { ConflictError, isAppError, isDuplicateKeyError } from "@/lib/errors";

describe("Signup Error Handling & Response Mapping in Production", () => {
  it("correctly identifies AppError via structural type-guard even across module boundaries", () => {
    const error = new ConflictError("An account with this email already exists.");
    expect(isAppError(error)).toBe(true);

    // Simulating cross-bundle or transpiled error where prototype identity may be lost
    const detachedError = {
      name: "ConflictError",
      message: "An account with this email already exists.",
      statusCode: 409,
      code: "CONFLICT",
      isOperational: true,
    };
    expect(isAppError(detachedError)).toBe(true);

    const res = handleRouteError(detachedError, "test-signup");
    expect(res.status).toBe(409);
  });

  it("maps duplicate key error to 409 CONFLICT with user-friendly message", async () => {
    // Top-level code 11000
    const mongoDuplicateError = {
      code: 11000,
      keyValue: { email: "user@example.com" },
      message: "E11000 duplicate key error collection: traders.users index: email_1 dup key: { email: 'user@example.com' }",
    };
    expect(isDuplicateKeyError(mongoDuplicateError)).toBe(true);

    const res = handleRouteError(mongoDuplicateError, "test-signup");
    expect(res.status).toBe(409);
    const body = (await res.json()) as { ok: boolean; error: string; code: string };
    expect(body.ok).toBe(false);
    expect(body.code).toBe("CONFLICT");
    expect(body.error).toBe("A record with those details already exists.");
  });

  it("maps MongoServerSelectionError and connection timeouts to 503 DB_UNAVAILABLE instead of generic 500", async () => {
    const serverSelectionError = new Error("Server selection timed out after 5000 ms");
    serverSelectionError.name = "MongoServerSelectionError";

    const res = handleRouteError(serverSelectionError, "test-signup");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; error: string; code: string };
    expect(body.ok).toBe(false);
    expect(body.code).toBe("DB_UNAVAILABLE");
    expect(body.error).toBe("The database is temporarily unavailable. Please try again.");
  });

  it("maps Atlas cluster connection error to 503 DB_UNAVAILABLE", async () => {
    const atlasError = new Error("Could not connect to any servers in your MongoDB Atlas cluster.");
    atlasError.name = "MongoServerSelectionError";

    const res = handleRouteError(atlasError, "test-signup");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; error: string; code: string };
    expect(body.code).toBe("DB_UNAVAILABLE");
  });

  it("maps Standalone servers transaction error to 503 REPLICA_SET_REQUIRED", async () => {
    const standaloneError = new Error("Standalone servers do not support transactions");
    const res = handleRouteError(standaloneError, "test-signup");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; error: string; code: string };
    expect(body.code).toBe("REPLICA_SET_REQUIRED");
  });

  it("maps Mongoose schema ValidationError to 400 with specific validation message", async () => {
    const mongooseValidationErr = {
      name: "ValidationError",
      message: "User validation failed: email: Path `email` is required.",
      errors: {
        email: { message: "Path `email` is required." },
      },
    };

    const res = handleRouteError(mongooseValidationErr, "test-signup");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string; code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toBe("Path `email` is required.");
  });
});
