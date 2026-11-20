import { describe, expect, it, vi } from "vitest";
import { isReplicaSetNotSupportedError } from "@/lib/errors";

describe("MongoDB Standalone & Replica-Set Transaction Handling", () => {
  it("detects IllegalOperation code 20 error", () => {
    const errorWithCode = {
      code: 20,
      codeName: "IllegalOperation",
      message: "Transaction numbers are only allowed on a replica set member or mongos",
    };
    expect(isReplicaSetNotSupportedError(errorWithCode)).toBe(true);
  });

  it("detects error with nested errorResponse matching the reported console error", () => {
    const reportedError = {
      errorLabelSet: {},
      errorResponse: {
        ok: 0,
        errmsg: "Transaction numbers are only allowed on a replica set member or mongos",
        code: 20,
        codeName: "IllegalOperation",
      },
      ok: 0,
      code: 20,
      codeName: "IllegalOperation",
    };
    expect(isReplicaSetNotSupportedError(reportedError)).toBe(true);
  });

  it("detects standalone server transaction messages in standard Error instances", () => {
    expect(
      isReplicaSetNotSupportedError(
        new Error("Transaction numbers are only allowed on a replica set member or mongos")
      )
    ).toBe(true);
    expect(
      isReplicaSetNotSupportedError(
        new Error("standalone servers do not support transactions")
      )
    ).toBe(true);
    expect(
      isReplicaSetNotSupportedError(
        new Error("transactions are not supported on this deployment")
      )
    ).toBe(true);
  });

  it("returns false for regular application errors and validation errors", () => {
    expect(isReplicaSetNotSupportedError(new Error("Path `email` is required."))).toBe(false);
    expect(isReplicaSetNotSupportedError({ code: 11000, message: "duplicate key error" })).toBe(false);
    expect(isReplicaSetNotSupportedError(null)).toBe(false);
    expect(isReplicaSetNotSupportedError(undefined)).toBe(false);
  });
});
