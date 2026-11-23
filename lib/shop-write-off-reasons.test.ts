import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SHOP_WRITE_OFF_REASONS,
  SHOP_WRITE_OFF_REASONS_STORAGE_KEY,
  clearStoredShopWriteOffReasons,
  getAllShopWriteOffReasons,
  getShopWriteOffReasons,
  getStoredShopWriteOffReasons,
  saveStoredShopWriteOffReason,
} from "./shop-write-off-storage";

describe("Shop Write-off Dynamic Reasons Storage", () => {
  const store = new Map<string, string>();

  const mockStorage: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };

  beforeEach(() => {
    store.clear();
    (globalThis as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;
  });

  it("returns default reasons when no custom reasons exist", () => {
    expect(DEFAULT_SHOP_WRITE_OFF_REASONS).toContain("Damaged in retail display");
    expect(DEFAULT_SHOP_WRITE_OFF_REASONS).toContain("Customer trial breakage");
    expect(DEFAULT_SHOP_WRITE_OFF_REASONS).toContain("Handling damage");
    expect(DEFAULT_SHOP_WRITE_OFF_REASONS).toContain("Perished / Expired");
    expect(DEFAULT_SHOP_WRITE_OFF_REASONS).toContain("Packaging seal compromised");

    const reasons = getShopWriteOffReasons();
    expect(reasons).toEqual(DEFAULT_SHOP_WRITE_OFF_REASONS);
    expect(getStoredShopWriteOffReasons()).toEqual([]);
  });

  it("saves a custom reason and retrieves it alongside defaults", () => {
    const custom = "Water damage from roof leak";
    const savedList = saveStoredShopWriteOffReason(custom);

    expect(savedList).toContain(custom);
    expect(getStoredShopWriteOffReasons()).toEqual([custom]);

    const allReasons = getShopWriteOffReasons();
    expect(allReasons).toContain(custom);
    expect(allReasons.length).toBe(DEFAULT_SHOP_WRITE_OFF_REASONS.length + 1);
    // Custom reason is present after the defaults
    expect(allReasons[allReasons.length - 1]).toBe(custom);
  });

  it("persists multiple custom reasons for future write-offs", () => {
    saveStoredShopWriteOffReason("Sunlight discoloration");
    saveStoredShopWriteOffReason("Transit impact");

    const stored = getStoredShopWriteOffReasons();
    expect(stored).toEqual(["Sunlight discoloration", "Transit impact"]);

    const allReasons = getShopWriteOffReasons();
    expect(allReasons).toContain("Sunlight discoloration");
    expect(allReasons).toContain("Transit impact");
    expect(allReasons.length).toBe(DEFAULT_SHOP_WRITE_OFF_REASONS.length + 2);
  });

  it("does not duplicate reasons if reason already exists (case-insensitive)", () => {
    saveStoredShopWriteOffReason("Customer trial breakage"); // Already in defaults
    expect(getStoredShopWriteOffReasons()).toEqual([]);

    saveStoredShopWriteOffReason("Pest contamination");
    saveStoredShopWriteOffReason("pest contamination"); // Duplicate of custom
    saveStoredShopWriteOffReason("  PEST CONTAMINATION  ");

    const stored = getStoredShopWriteOffReasons();
    expect(stored).toEqual(["Pest contamination"]);
  });

  it("ignores empty or whitespace-only custom reasons", () => {
    saveStoredShopWriteOffReason("");
    saveStoredShopWriteOffReason("   ");
    expect(getStoredShopWriteOffReasons()).toEqual([]);
  });

  it("handles corrupted storage data gracefully", () => {
    store.set(SHOP_WRITE_OFF_REASONS_STORAGE_KEY, "invalid-json{{");
    expect(getStoredShopWriteOffReasons()).toEqual([]);
    expect(getShopWriteOffReasons()).toEqual(DEFAULT_SHOP_WRITE_OFF_REASONS);
  });

  it("clears stored custom reasons", () => {
    saveStoredShopWriteOffReason("Test custom reason");
    expect(getStoredShopWriteOffReasons().length).toBe(1);

    clearStoredShopWriteOffReasons();
    expect(getStoredShopWriteOffReasons()).toEqual([]);
    expect(getShopWriteOffReasons()).toEqual(DEFAULT_SHOP_WRITE_OFF_REASONS);
  });

  it("getAllShopWriteOffReasons merges custom reasons with defaults safely", () => {
    const merged = getAllShopWriteOffReasons(["Display shelf collapse", "handling damage"]);
    expect(merged).toContain("Display shelf collapse");
    // "handling damage" should not duplicate "Handling damage"
    expect(merged.filter((r) => r.toLowerCase() === "handling damage").length).toBe(1);
    expect(merged.length).toBe(DEFAULT_SHOP_WRITE_OFF_REASONS.length + 1);
  });
});
