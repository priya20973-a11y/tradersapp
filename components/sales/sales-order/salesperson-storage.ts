export const CUSTOM_SALESPERSONS_STORAGE_KEY = "traders_custom_salespersons";

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  return null;
}

export function getStoredSalespersons(): string[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(CUSTOM_SALESPERSONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0,
      );
    }
  } catch {
    // Ignore storage parse error
  }
  return [];
}

export function saveStoredSalesperson(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return getStoredSalespersons();
  const storage = getStorage();
  if (!storage) return [trimmed];
  try {
    const current = getStoredSalespersons();
    const exists = current.some((s) => s.toLowerCase() === trimmed.toLowerCase());
    const updated = exists ? current : [...current, trimmed];
    storage.setItem(CUSTOM_SALESPERSONS_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new Event("custom_salespersons_updated"));
    }
    return updated;
  } catch {
    return [trimmed];
  }
}

export function mergeSalespersons(serverList: string[], storedList: string[]): string[] {
  const caseMap = new Map<string, string>();
  for (const s of [...serverList, ...storedList]) {
    if (s && typeof s === "string" && s.trim()) {
      const trimmed = s.trim();
      const lower = trimmed.toLowerCase();
      if (!caseMap.has(lower)) {
        caseMap.set(lower, trimmed);
      }
    }
  }
  return Array.from(caseMap.values()).sort((a, b) => a.localeCompare(b));
}
