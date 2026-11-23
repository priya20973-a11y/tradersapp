import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { salespersons } from "@/components/sales/sales-order/sales-order-types";
import {
  getStoredSalespersons,
  saveStoredSalesperson,
  mergeSalespersons,
  CUSTOM_SALESPERSONS_STORAGE_KEY,
} from "@/components/sales/sales-order/salesperson-storage";
import { salespersonInputSchema } from "@/app/api/salespersons/route";

describe("Sales Order - Salesperson Dynamic Management Feature", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) || null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] || null,
      get length() {
        return store.size;
      },
    };
    (globalThis as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;
  });

  describe("1. Removal of Hardcoded Salesperson Values", () => {
    it("has removed all hardcoded dropdown values (Alice Trader, John Doe, etc.) from sales-order-types", () => {
      expect(salespersons).toHaveLength(0);
      expect(salespersons).not.toContain("Alice Trader");
      expect(salespersons).not.toContain("John Doe");
      expect(salespersons).not.toContain("Sales Manager");
      expect(salespersons).not.toContain("Executive Staff");
    });
  });

  describe("2. Client-side Salesperson Storage & Persistence", () => {
    it("returns empty array when storage is empty", () => {
      const stored = getStoredSalespersons();
      expect(stored).toEqual([]);
    });

    it("saves and retrieves newly added salespersons across future sales orders", () => {
      saveStoredSalesperson("Rajesh Sharma");
      saveStoredSalesperson("Pooja Verma");

      const stored = getStoredSalespersons();
      expect(stored).toContain("Rajesh Sharma");
      expect(stored).toContain("Pooja Verma");
      expect(stored).toHaveLength(2);
    });

    it("prevents duplicate salespersons regardless of case", () => {
      saveStoredSalesperson("Amit Patel");
      saveStoredSalesperson("amit patel");
      saveStoredSalesperson("AMIT PATEL");

      const stored = getStoredSalespersons();
      expect(stored).toHaveLength(1);
      expect(stored[0]).toBe("Amit Patel");
    });

    it("merges server salespersons with stored salespersons deduplicating case-insensitively", () => {
      const serverList = ["Rajesh Kumar", "Sunita Rao"];
      const storedList = ["sunita rao", "Vikas Gupta"];

      const merged = mergeSalespersons(serverList, storedList);
      expect(merged).toContain("Rajesh Kumar");
      expect(merged).toContain("Sunita Rao");
      expect(merged).toContain("Vikas Gupta");
      expect(merged).toHaveLength(3);
    });
  });

  describe("3. Salesperson API Input Validation Schema", () => {
    it("validates valid salesperson payload", () => {
      const payload = {
        name: "Vikram Rathore",
        email: "vikram@traders.in",
        phone: "+91 98200 55443",
      };

      const result = salespersonInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Vikram Rathore");
        expect(result.data.email).toBe("vikram@traders.in");
        expect(result.data.phone).toBe("+91 98200 55443");
      }
    });

    it("requires salesperson name and rejects empty string", () => {
      const invalidPayload = { name: "   " };
      const result = salespersonInputSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("4. Header Fields & Modals UI Component Contracts", () => {
    const headerFieldsPath = path.resolve(
      process.cwd(),
      "components/sales/sales-order/sales-order-header-fields.tsx",
    );
    const modalsPath = path.resolve(
      process.cwd(),
      "components/sales/sales-order/sales-order-modals.tsx",
    );
    const headerContent = fs.readFileSync(headerFieldsPath, "utf-8");
    const modalsContent = fs.readFileSync(modalsPath, "utf-8");

    it("provides '+ Add New Sales Person' option directly in the dropdown", () => {
      expect(headerContent).toContain("+ Add New Sales Person");
      expect(headerContent).toContain('value="__ADD_NEW__"');
    });

    it("fetches actual salespersons dynamically from /api/salespersons and local storage", () => {
      expect(headerContent).toContain('fetch("/api/salespersons")');
      expect(headerContent).toContain("getStoredSalespersons");
      expect(headerContent).toContain("allSalespersons");
    });

    it("triggers QuickAddSalespersonModal when Add New Sales Person option or button is clicked", () => {
      expect(headerContent).toContain("QuickAddSalespersonModal");
      expect(headerContent).toContain("setIsAddSalespersonOpen(true)");
    });

    it("renders QuickAddSalespersonModal with required name input and save action", () => {
      expect(modalsContent).toContain("Add New Sales Person");
      expect(modalsContent).toContain("Sales Person Name");
      expect(modalsContent).toContain("saveStoredSalesperson");
      expect(modalsContent).toContain("Save Sales Person");
    });
  });
});
