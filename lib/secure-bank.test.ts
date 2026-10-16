import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptBankAccountNumber, encryptBankAccountNumber, maskBankAccountNumber } from "./secure-bank";

describe("bank account protection", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("encrypts and decrypts account numbers with the configured key", () => {
    vi.stubEnv("BANK_DETAILS_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const encrypted = encryptBankAccountNumber("123456789012");
    expect(encrypted).not.toContain("123456789012");
    expect(decryptBankAccountNumber(encrypted)).toBe("123456789012");
    expect(maskBankAccountNumber("123456789012")).toBe("••••••••9012");
  });

  it("rejects tampered encrypted values", () => {
    vi.stubEnv("BANK_DETAILS_ENCRYPTION_KEY", Buffer.alloc(32, 8).toString("base64"));
    const encrypted = encryptBankAccountNumber("123456789012");
    expect(() => decryptBankAccountNumber(`${encrypted.slice(0, -1)}A`)).toThrow();
  });

  it("refuses to store bank details without a valid encryption key", () => {
    vi.stubEnv("BANK_DETAILS_ENCRYPTION_KEY", "");
    expect(() => encryptBankAccountNumber("123456789012")).toThrow(/configured/);
    vi.stubEnv("BANK_DETAILS_ENCRYPTION_KEY", Buffer.alloc(8).toString("base64"));
    expect(() => encryptBankAccountNumber("123456789012")).toThrow(/32-byte key/);
  });
});
