export const DEFAULT_SHOP_WRITE_OFF_REASONS: string[] = [
  "Damaged in retail display",
  "Customer trial breakage",
  "Handling damage",
  "Perished / Expired",
  "Packaging seal compromised",
];

export const SHOP_WRITE_OFF_REASONS_STORAGE_KEY = "traders_shop_write_off_reasons";

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  return null;
}

export function getStoredShopWriteOffReasons(): string[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(SHOP_WRITE_OFF_REASONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (r): r is string => typeof r === "string" && r.trim().length > 0,
      );
    }
  } catch {
    // Ignore storage parse error
  }
  return [];
}

export function saveStoredShopWriteOffReason(reason: string): string[] {
  const trimmed = reason.trim();
  if (!trimmed) return getStoredShopWriteOffReasons();
  const storage = getStorage();
  if (!storage) return [trimmed];
  try {
    const current = getStoredShopWriteOffReasons();
    const existsInCustom = current.some((r) => r.toLowerCase() === trimmed.toLowerCase());
    const existsInDefault = DEFAULT_SHOP_WRITE_OFF_REASONS.some((r) => r.toLowerCase() === trimmed.toLowerCase());
    const updated = (existsInCustom || existsInDefault) ? current : [...current, trimmed];
    storage.setItem(SHOP_WRITE_OFF_REASONS_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new Event("shop_write_off_reasons_updated"));
    }
    return updated;
  } catch {
    return [trimmed];
  }
}

export function getAllShopWriteOffReasons(customReasons: string[] = []): string[] {
  const caseMap = new Map<string, string>();
  for (const r of [...DEFAULT_SHOP_WRITE_OFF_REASONS, ...customReasons]) {
    if (r && typeof r === "string" && r.trim()) {
      const trimmed = r.trim();
      const lower = trimmed.toLowerCase();
      if (!caseMap.has(lower)) {
        caseMap.set(lower, trimmed);
      }
    }
  }
  return Array.from(caseMap.values());
}

export function getShopWriteOffReasons(): string[] {
  return getAllShopWriteOffReasons(getStoredShopWriteOffReasons());
}

export function clearStoredShopWriteOffReasons(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(SHOP_WRITE_OFF_REASONS_STORAGE_KEY);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new Event("shop_write_off_reasons_updated"));
    }
  } catch {
    // Ignore storage error
  }
}
