import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey() {
  const encodedKey = process.env.BANK_DETAILS_ENCRYPTION_KEY;
  if (!encodedKey) {
    throw new Error("Bank details are disabled until BANK_DETAILS_ENCRYPTION_KEY is configured.");
  }
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) {
    throw new Error("BANK_DETAILS_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export function encryptBankAccountNumber(accountNumber: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(accountNumber, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptBankAccountNumber(encryptedValue: string) {
  const [iv, authTag, encrypted] = encryptedValue.split(".").map((part) => Buffer.from(part, "base64"));
  if (!iv || !authTag || !encrypted || iv.length !== 12 || authTag.length !== 16) {
    throw new Error("Stored bank account data is invalid.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function maskBankAccountNumber(accountNumber: string) {
  const visible = accountNumber.slice(-4);
  return `${"•".repeat(Math.max(0, accountNumber.length - 4))}${visible}`;
}
