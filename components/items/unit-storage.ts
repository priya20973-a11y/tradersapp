import { standardUnits } from "./item-constants";

export interface UnitOption {
  value: string;
  label: string;
}

export const CUSTOM_UNITS_STORAGE_KEY = "traders_custom_units";

export function getStoredCustomUnits(): UnitOption[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_UNITS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (u): u is UnitOption =>
          Boolean(u) &&
          typeof u.value === "string" &&
          u.value.trim().length > 0 &&
          typeof u.label === "string" &&
          u.label.trim().length > 0,
      );
    }
  } catch {
    // Ignore storage parse error
  }
  return [];
}

export function saveStoredCustomUnit(unit: UnitOption): UnitOption[] {
  if (typeof window === "undefined") return [unit];
  try {
    const current = getStoredCustomUnits();
    const exists = current.some((u) => u.value.toLowerCase() === unit.value.toLowerCase());
    const updated = exists ? current : [...current, unit];
    localStorage.setItem(CUSTOM_UNITS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("custom_units_updated"));
    return updated;
  } catch {
    return [unit];
  }
}

export function getAllUnitsList(customUnits: UnitOption[] = []): UnitOption[] {
  const map = new Map<string, UnitOption>();
  for (const u of standardUnits) {
    map.set(u.value.toLowerCase(), u);
  }
  for (const u of customUnits) {
    if (u && u.value && u.label) {
      map.set(u.value.toLowerCase(), u);
    }
  }
  return Array.from(map.values());
}
