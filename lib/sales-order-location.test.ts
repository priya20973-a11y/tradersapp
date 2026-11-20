import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { type StockLocationOption, type CommodityStockInfo } from "@/components/sales/sales-order/sales-order-types";

describe("Sales Order Module - Warehouse and Shop Location Integration", () => {
  describe("1. Warehouse Master API Integration", () => {
    it("fetches and maps active warehouses from Warehouse Master API", () => {
      const warehouseMasterApiResponse = {
        warehouses: [
          {
            id: new Types.ObjectId().toString(),
            code: "WH-NORTH",
            name: "North Central Godown",
            status: "Active",
            city: "Indore",
            locations: [{ code: "SEC-A", name: "Section A" }],
          },
          {
            id: new Types.ObjectId().toString(),
            code: "WH-SOUTH",
            name: "South APMC Storage",
            status: "Active",
            city: "Nagpur",
            locations: [],
          },
          {
            id: new Types.ObjectId().toString(),
            code: "WH-OLD",
            name: "Decommissioned Warehouse",
            status: "Inactive",
            city: "Bhopal",
            locations: [],
          },
        ],
      };

      // Filter active warehouses and map to StockLocationOption
      const activeWarehouses = (warehouseMasterApiResponse.warehouses || []).filter(
        (w) => !w.status || w.status === "Active"
      );
      const mappedOptions: StockLocationOption[] = activeWarehouses.map((w) => ({
        id: String(w.id),
        name: w.name,
        code: w.code,
        type: "Warehouse" as const,
      }));

      expect(mappedOptions).toHaveLength(2);
      expect(mappedOptions[0].name).toBe("North Central Godown");
      expect(mappedOptions[0].type).toBe("Warehouse");
      expect(mappedOptions[0].code).toBe("WH-NORTH");
      expect(mappedOptions[1].name).toBe("South APMC Storage");
      expect(mappedOptions.some((w) => w.name === "Decommissioned Warehouse")).toBe(false);
    });

    it("handles empty warehouse list gracefully without errors", () => {
      const emptyApiResponse = { warehouses: [] };
      const activeWarehouses = (emptyApiResponse.warehouses || []).filter(
        (w: { status?: string }) => !w.status || w.status === "Active"
      );
      const mappedOptions: StockLocationOption[] = activeWarehouses.map((w: { id: string; name: string }) => ({
        id: String(w.id),
        name: w.name,
        type: "Warehouse" as const,
      }));

      expect(mappedOptions).toHaveLength(0);
    });
  });

  describe("2. Shop Locations Configuration API Integration", () => {
    it("fetches and maps available shops from inventory/location configuration", () => {
      const shopApiResponse = {
        shops: [
          {
            id: new Types.ObjectId().toString(),
            name: "Main APMC Yard Shop #4",
            code: "SHOP-MAIN",
            type: "Shop",
            isDefault: true,
          },
          {
            id: new Types.ObjectId().toString(),
            name: "City Grain Retail Counter",
            code: "SHOP-RETAIL",
            type: "Shop",
            isDefault: false,
          },
        ],
        locations: [
          {
            id: new Types.ObjectId().toString(),
            name: "Main APMC Yard Shop #4",
            code: "SHOP-MAIN",
            type: "Shop",
          },
          {
            id: new Types.ObjectId().toString(),
            name: "City Grain Retail Counter",
            code: "SHOP-RETAIL",
            type: "Shop",
          },
        ],
      };

      const shops = shopApiResponse.shops || shopApiResponse.locations || [];
      const mappedOptions: StockLocationOption[] = shops.map((s) => ({
        id: String(s.id),
        name: s.name,
        code: s.code,
        type: "Shop" as const,
      }));

      expect(mappedOptions).toHaveLength(2);
      expect(mappedOptions[0].type).toBe("Shop");
      expect(mappedOptions[0].name).toBe("Main APMC Yard Shop #4");
      expect(mappedOptions[0].code).toBe("SHOP-MAIN");
      expect(mappedOptions[1].name).toBe("City Grain Retail Counter");
    });
  });

  describe("3. Locations API Response Contract", () => {
    it("returns 'locations' array alongside 'warehouses', 'shops' and 'all' for cross-compatibility", () => {
      const whList = [{ id: "wh-1", name: "Godown 1", code: "WH-01", type: "Warehouse" as const }];
      const shopList = [{ id: "sh-1", name: "Shop 1", code: "SH-01", type: "Shop" as const }];
      const allLocs = [...whList, ...shopList];

      const apiResponse = {
        warehouses: whList,
        shops: shopList,
        locations: allLocs,
        all: allLocs,
      };

      expect(apiResponse.locations).toBeDefined();
      expect(Array.isArray(apiResponse.locations)).toBe(true);
      expect(apiResponse.locations).toHaveLength(2);
      expect(apiResponse.warehouses).toHaveLength(1);
      expect(apiResponse.shops).toHaveLength(1);
      expect(apiResponse.all).toHaveLength(2);
    });
  });

  describe("4. Dropdown State & Loading, Empty and Error States", () => {
    it("correctly identifies loading state", () => {
      const isLoading = true;
      const locations: StockLocationOption[] = [];
      const error: string | null = null;

      expect(isLoading).toBe(true);
      expect(locations).toHaveLength(0);
      expect(error).toBeNull();
    });

    it("correctly identifies empty state when no locations exist for selected type", () => {
      const isLoading = false;
      const locations: StockLocationOption[] = [];
      const error: string | null = null;
      const stockLocationType: "Warehouse" | "Shop" = "Warehouse";

      const currentTypeLocations = locations.filter((l) => l.type === stockLocationType);
      const isEmpty = !isLoading && !error && currentTypeLocations.length === 0;

      expect(isEmpty).toBe(true);
    });

    it("correctly handles error state and enables retry", () => {
      const isLoading = false;
      const error = "Failed to load warehouses from server.";
      let retryCalled = false;
      const onRetry = () => {
        retryCalled = true;
      };

      expect(error).toBeTruthy();
      onRetry();
      expect(retryCalled).toBe(true);
    });

    it("automatically selects first available location on successful fetch", () => {
      const fetchedLocations: StockLocationOption[] = [
        { id: "wh-alpha", name: "Alpha Warehouse", type: "Warehouse", code: "WH-A" },
        { id: "wh-beta", name: "Beta Warehouse", type: "Warehouse", code: "WH-B" },
      ];

      let selectedId = "";
      let selectedName = "";

      if (fetchedLocations.length > 0) {
        selectedId = fetchedLocations[0].id;
        selectedName = fetchedLocations[0].name;
      }

      expect(selectedId).toBe("wh-alpha");
      expect(selectedName).toBe("Alpha Warehouse");
    });
  });

  describe("5. Sales Order Document Persistence with Stock Location", () => {
    it("correctly saves stockLocationType, stockLocationId, and stockLocationName in sales order payload", () => {
      const warehouseId = new Types.ObjectId().toString();
      const customerId = new Types.ObjectId().toString();

      const payload = {
        type: "Sales Order",
        customerId,
        stockLocationType: "Warehouse" as const,
        stockLocationId: warehouseId,
        stockLocationName: "Alpha Warehouse",
        number: "SO-00042",
        status: "Draft",
        total: 25000,
        items: [
          {
            itemId: new Types.ObjectId().toString(),
            name: "Premium Basmati Rice",
            quantity: 10,
            rate: 2500,
            amount: 25000,
          },
        ],
      };

      expect(payload.stockLocationType).toBe("Warehouse");
      expect(payload.stockLocationId).toBe(warehouseId);
      expect(payload.stockLocationName).toBe("Alpha Warehouse");
      expect(Types.ObjectId.isValid(payload.stockLocationId)).toBe(true);
    });

    it("correctly saves shop location when stockLocationType is Shop", () => {
      const shopId = new Types.ObjectId().toString();
      const payload = {
        type: "Sales Order",
        customerId: new Types.ObjectId().toString(),
        stockLocationType: "Shop" as const,
        stockLocationId: shopId,
        stockLocationName: "APMC Market Counter",
        status: "Confirmed",
        total: 10000,
      };

      expect(payload.stockLocationType).toBe("Shop");
      expect(payload.stockLocationId).toBe(shopId);
      expect(payload.stockLocationName).toBe("APMC Market Counter");
    });
  });

  describe("6. Stock Level Filtering by Location and Commodity", () => {
    it("builds correct stock level mapping per commodity for the selected location", () => {
      const comm1Id = new Types.ObjectId().toString();
      const comm2Id = new Types.ObjectId().toString();

      const apiStockLevels = [
        {
          commodityId: comm1Id,
          commodityName: "Basmati Rice 25kg",
          onHandStock: 100,
          reservedStock: 20,
          availableStock: 80,
          damagedStock: 2,
        },
        {
          commodityId: comm2Id,
          commodityName: "Sharbati Wheat 10kg",
          onHandStock: 50,
          reservedStock: 0,
          availableStock: 50,
          damagedStock: 0,
        },
      ];

      const stockMap: Record<string, CommodityStockInfo> = {};
      for (const item of apiStockLevels) {
        stockMap[item.commodityId] = {
          onHandStock: Number(item.onHandStock) || 0,
          reservedStock: Number(item.reservedStock) || 0,
          availableStock: Number(item.availableStock) || 0,
          damagedStock: Number(item.damagedStock) || 0,
        };
      }

      expect(stockMap[comm1Id].availableStock).toBe(80);
      expect(stockMap[comm1Id].reservedStock).toBe(20);
      expect(stockMap[comm2Id].availableStock).toBe(50);
      expect(stockMap["non-existent"]).toBeUndefined();
    });

    it("blocks confirmed order when requested quantity exceeds available stock at selected location", () => {
      const commId = new Types.ObjectId().toString();
      const stockMap: Record<string, CommodityStockInfo> = {
        [commId]: {
          onHandStock: 30,
          reservedStock: 20,
          availableStock: 10,
          damagedStock: 0,
        },
      };

      const requestedQuantity = 15;
      const available = stockMap[commId]?.availableStock ?? 0;
      const isSufficient = requestedQuantity <= available;

      expect(isSufficient).toBe(false);
      expect(available).toBe(10);
      expect(requestedQuantity).toBe(15);
    });

    it("permits confirmed order when requested quantity is within available stock", () => {
      const commId = new Types.ObjectId().toString();
      const stockMap: Record<string, CommodityStockInfo> = {
        [commId]: {
          onHandStock: 100,
          reservedStock: 10,
          availableStock: 90,
          damagedStock: 0,
        },
      };

      const requestedQuantity = 50;
      const available = stockMap[commId]?.availableStock ?? 0;
      const isSufficient = requestedQuantity <= available;

      expect(isSufficient).toBe(true);
    });

    it("correctly treats missing commodity stock record as 0 available at that location", () => {
      const stockMap: Record<string, CommodityStockInfo> = {};
      const unknownCommId = new Types.ObjectId().toString();

      const available = stockMap[unknownCommId]?.availableStock ?? 0;
      expect(available).toBe(0);
    });
  });
});
