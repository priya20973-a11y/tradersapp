import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

import { GET } from "@/app/api/inventory/reports/route";
import * as models from "@/models";
import * as db from "@/lib/db";
import { Types } from "mongoose";

describe("Consolidated Inventory Reports API & Engine", () => {
  const orgId = new Types.ObjectId().toString();
  const otherOrgId = new Types.ObjectId().toString();

  const wh1Id = new Types.ObjectId().toString();
  const wh2Id = new Types.ObjectId().toString();
  const shop1Id = new Types.ObjectId().toString();

  const comm1Id = new Types.ObjectId().toString();
  const comm2Id = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(db, "connectToDatabase").mockResolvedValue({} as never);
  });

  describe("1. Authentication & Tenant Boundaries", () => {
    it("returns 401 when user is not signed in", async () => {
      mockGetServerSession.mockResolvedValueOnce(null);
      const req = new Request("http://localhost:3000/api/inventory/reports");
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/sign in/i);
    });

    it("returns 403 when a non-admin requests another organization's data", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-123", organizationId: orgId, role: "Staff" },
      });
      const req = new Request(
        `http://localhost:3000/api/inventory/reports?organizationId=${otherOrgId}`
      );
      const res = await GET(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/own organization/i);
    });

    it("allows admin to view a specific requested organization", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "admin", role: "Super Admin" },
      });

      vi.spyOn(models.Warehouse, "find").mockReturnValue({
        sort: () => ({ lean: async () => [] }),
      } as never);
      vi.spyOn(models.StockLocation, "find").mockReturnValue({
        sort: () => ({ lean: async () => [] }),
      } as never);
      vi.spyOn(models.StockLocation, "create").mockResolvedValue({
        toObject: () => ({ _id: shop1Id, name: "Main Shop", code: "SHOP-MAIN" }),
      } as never);
      vi.spyOn(models.Item, "find").mockReturnValue({
        select: () => ({ sort: () => ({ lean: async () => [] }) }),
      } as never);
      vi.spyOn(models.StockLevel, "find").mockReturnValue({
        lean: async () => [],
      } as never);
      vi.spyOn(models.StockLot, "find").mockReturnValue({
        lean: async () => [],
      } as never);
      vi.spyOn(models.StockMovement, "find").mockReturnValue({
        lean: async () => [],
      } as never);
      vi.spyOn(models.StockReservation, "find").mockReturnValue({
        lean: async () => [],
      } as never);

      const req = new Request(
        `http://localhost:3000/api/inventory/reports?organizationId=${otherOrgId}`
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.rows).toEqual([]);
      expect(json.summary.totalCommodities).toBe(0);
    });
  });

  describe("2. Multi-Location Stock Aggregation & Calculations", () => {
    it("aggregates independent warehouse and shop balances, reservations, and valuation accurately", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-123", organizationId: orgId, role: "Owner" },
      });

      const mockWarehouses = [
        { _id: new Types.ObjectId(wh1Id), name: "Central Warehouse", code: "WH-01" },
        { _id: new Types.ObjectId(wh2Id), name: "South Yard", code: "WH-02" },
      ];

      const mockShops = [
        { _id: new Types.ObjectId(shop1Id), name: "APMC Shop", code: "SHOP-01", isDefault: true },
      ];

      const mockItems = [
        {
          _id: new Types.ObjectId(comm1Id),
          name: "Organic Basmati Rice",
          sku: "RICE-01",
          unit: "kg",
          purchasePrice: 100,
          salesPrice: 150,
        },
        {
          _id: new Types.ObjectId(comm2Id),
          name: "Sona Masoori Rice",
          sku: "RICE-02",
          unit: "kg",
          purchasePrice: 60,
          salesPrice: 90,
        },
      ];

      const mockStockLevels = [
        // comm1 at wh1: 100 onHand, 20 reserved, 80 available, 5 damaged, val = 10000
        {
          locationType: "Warehouse",
          locationId: new Types.ObjectId(wh1Id),
          commodityId: new Types.ObjectId(comm1Id),
          onHandQuantity: 100,
          reservedQuantity: 20,
          availableQuantity: 80,
          damagedQuantity: 5,
          stockValue: 10000,
          averageCost: 100,
        },
        // comm1 at shop1: 50 onHand, 0 reserved, 50 available, 0 damaged, val = 5000
        {
          locationType: "Shop",
          locationId: new Types.ObjectId(shop1Id),
          commodityId: new Types.ObjectId(comm1Id),
          onHandQuantity: 50,
          reservedQuantity: 0,
          availableQuantity: 50,
          damagedQuantity: 0,
          stockValue: 5000,
          averageCost: 100,
        },
        // comm2 at wh2: 200 onHand, 50 reserved, 150 available, 0 damaged, val = 12000
        {
          locationType: "Warehouse",
          locationId: new Types.ObjectId(wh2Id),
          commodityId: new Types.ObjectId(comm2Id),
          onHandQuantity: 200,
          reservedQuantity: 50,
          availableQuantity: 150,
          damagedQuantity: 0,
          stockValue: 12000,
          averageCost: 60,
        },
      ];

      vi.spyOn(models.Warehouse, "find").mockReturnValue({
        sort: () => ({ lean: async () => mockWarehouses }),
      } as never);
      vi.spyOn(models.StockLocation, "find").mockImplementation(((query: { locationType?: string }) => {
        if (query?.locationType === "Warehouse") {
          return { sort: () => ({ lean: async () => [] }) } as never;
        }
        return { sort: () => ({ lean: async () => mockShops }) } as never;
      }) as never);
      vi.spyOn(models.Item, "find").mockReturnValue({
        select: () => ({ sort: () => ({ lean: async () => mockItems }) }),
      } as never);
      vi.spyOn(models.StockLevel, "find").mockReturnValue({
        lean: async () => mockStockLevels,
      } as never);
      vi.spyOn(models.StockLot, "find").mockReturnValue({
        lean: async () => [],
      } as never);
      vi.spyOn(models.StockMovement, "find").mockReturnValue({
        lean: async () => [],
      } as never);
      vi.spyOn(models.StockReservation, "find").mockReturnValue({
        lean: async () => [],
      } as never);

      const req = new Request("http://localhost:3000/api/inventory/reports");
      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.rows).toHaveLength(2);
      expect(json.warehouses).toHaveLength(2);
      expect(json.shops).toHaveLength(1);

      // Verify Commodity 1 (Basmati)
      const basmati = json.rows.find((r: { commodityId: string }) => r.commodityId === comm1Id);
      expect(basmati).toBeDefined();
      expect(basmati.commodityName).toBe("Organic Basmati Rice");
      expect(basmati.sku).toBe("RICE-01");
      expect(basmati.totalOnHand).toBe(150); // 100 + 50
      expect(basmati.totalReserved).toBe(20);
      expect(basmati.totalAvailable).toBe(130); // 150 - 20
      expect(basmati.totalDamaged).toBe(5);
      expect(basmati.totalStockValue).toBe(15000); // 10000 + 5000

      // Warehouse-wise checks
      expect(basmati.warehouses[wh1Id].onHandStock).toBe(100);
      expect(basmati.warehouses[wh1Id].availableStock).toBe(80);
      expect(basmati.warehouses[wh2Id].onHandStock).toBe(0);
      expect(basmati.shops[shop1Id].onHandStock).toBe(50);
      expect(basmati.shops[shop1Id].availableStock).toBe(50);

      // Verify Commodity 2 (Sona Masoori)
      const sona = json.rows.find((r: { commodityId: string }) => r.commodityId === comm2Id);
      expect(sona).toBeDefined();
      expect(sona.totalOnHand).toBe(200);
      expect(sona.totalReserved).toBe(50);
      expect(sona.totalAvailable).toBe(150);
      expect(sona.totalStockValue).toBe(12000);

      // Verify Overall Summary
      expect(json.summary.totalCommodities).toBe(2);
      expect(json.summary.totalOnHand).toBe(350); // 150 + 200
      expect(json.summary.totalReserved).toBe(70); // 20 + 50
      expect(json.summary.totalAvailable).toBe(280); // 130 + 150
      expect(json.summary.totalDamaged).toBe(5);
      expect(json.summary.totalStockValue).toBe(27000); // 15000 + 12000
    });
  });

  describe("3. Search Filtering", () => {
    it("filters rows by commodity name and sku properly", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-123", organizationId: orgId, role: "Owner" },
      });

      const mockWarehouses = [
        { _id: new Types.ObjectId(wh1Id), name: "Central Warehouse", code: "WH-01" },
      ];
      const mockShops = [
        { _id: new Types.ObjectId(shop1Id), name: "Main Shop", code: "SHOP-01", isDefault: true },
      ];
      const mockItems = [
        { _id: new Types.ObjectId(comm1Id), name: "Organic Basmati Rice", sku: "RICE-01" },
        { _id: new Types.ObjectId(comm2Id), name: "Mazafati Dates", sku: "DRF-01" },
      ];

      vi.spyOn(models.Warehouse, "find").mockReturnValue({
        sort: () => ({ lean: async () => mockWarehouses }),
      } as never);
      vi.spyOn(models.StockLocation, "find").mockImplementation(((query: { locationType?: string }) => {
        if (query?.locationType === "Warehouse") {
          return { sort: () => ({ lean: async () => [] }) } as never;
        }
        return { sort: () => ({ lean: async () => mockShops }) } as never;
      }) as never);
      vi.spyOn(models.Item, "find").mockReturnValue({
        select: () => ({ sort: () => ({ lean: async () => mockItems }) }),
      } as never);
      vi.spyOn(models.StockLevel, "find").mockReturnValue({ lean: async () => [] } as never);
      vi.spyOn(models.StockLot, "find").mockReturnValue({ lean: async () => [] } as never);
      vi.spyOn(models.StockMovement, "find").mockReturnValue({ lean: async () => [] } as never);
      vi.spyOn(models.StockReservation, "find").mockReturnValue({ lean: async () => [] } as never);

      // Search query: "dates"
      const req = new Request("http://localhost:3000/api/inventory/reports?search=dates");
      const res = await GET(req);
      const json = await res.json();

      expect(json.rows).toHaveLength(1);
      expect(json.rows[0].commodityName).toBe("Mazafati Dates");
      expect(json.summary.totalCommodities).toBe(1);
    });
  });

  describe("4. Fallbacks & Reconciliations", () => {
    it("falls back to StockMovements when StockLevels are missing", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-123", organizationId: orgId, role: "Owner" },
      });

      const mockWarehouses = [
        { _id: new Types.ObjectId(wh1Id), name: "Central Warehouse", code: "WH-01" },
      ];
      const mockShops = [
        { _id: new Types.ObjectId(shop1Id), name: "APMC Shop", code: "SHOP-01", isDefault: true },
      ];
      const mockItems = [
        {
          _id: new Types.ObjectId(comm1Id),
          name: "Organic Basmati Rice",
          sku: "RICE-01",
          unit: "kg",
          purchasePrice: 100,
        },
      ];

      // Movements: Inward 50, then Outward 10 = 40 onHand
      const mockMovements = [
        {
          locationType: "Warehouse",
          locationId: new Types.ObjectId(wh1Id),
          commodityId: new Types.ObjectId(comm1Id),
          onHandDelta: 50,
          reservedDelta: 0,
          damagedDelta: 0,
        },
        {
          locationType: "Warehouse",
          locationId: new Types.ObjectId(wh1Id),
          commodityId: new Types.ObjectId(comm1Id),
          onHandDelta: -10,
          reservedDelta: 0,
          damagedDelta: 0,
        },
      ];

      vi.spyOn(models.Warehouse, "find").mockReturnValue({
        sort: () => ({ lean: async () => mockWarehouses }),
      } as never);
      vi.spyOn(models.StockLocation, "find").mockImplementation(((query: { locationType?: string }) => {
        if (query?.locationType === "Warehouse") return { sort: () => ({ lean: async () => [] }) } as never;
        return { sort: () => ({ lean: async () => mockShops }) } as never;
      }) as never);
      vi.spyOn(models.Item, "find").mockReturnValue({
        select: () => ({ sort: () => ({ lean: async () => mockItems }) }),
      } as never);
      vi.spyOn(models.StockLevel, "find").mockReturnValue({ lean: async () => [] } as never);
      vi.spyOn(models.StockLot, "find").mockReturnValue({ lean: async () => [] } as never);
      vi.spyOn(models.StockMovement, "find").mockReturnValue({ lean: async () => mockMovements } as never);
      vi.spyOn(models.StockReservation, "find").mockReturnValue({ lean: async () => [] } as never);

      const req = new Request("http://localhost:3000/api/inventory/reports");
      const res = await GET(req);
      const json = await res.json();

      expect(json.rows).toHaveLength(1);
      expect(json.rows[0].totalOnHand).toBe(40);
      expect(json.rows[0].totalAvailable).toBe(40);
      expect(json.rows[0].totalStockValue).toBe(4000); // 40 * 100
      expect(json.rows[0].warehouses[wh1Id].onHandStock).toBe(40);
    });

    it("ingests StockLot records from trading module for lot-tracked inventory", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-123", organizationId: orgId, role: "Owner" },
      });

      const mockWarehouses = [
        { _id: new Types.ObjectId(wh1Id), name: "Central Warehouse", code: "WH-01" },
      ];
      const mockShops = [
        { _id: new Types.ObjectId(shop1Id), name: "APMC Shop", code: "SHOP-01", isDefault: true },
      ];
      const mockItems = [
        {
          _id: new Types.ObjectId(comm1Id),
          name: "Organic Basmati Rice",
          sku: "RICE-01",
          unit: "kg",
          purchasePrice: 100,
        },
      ];

      const mockLots = [
        {
          warehouseId: new Types.ObjectId(wh1Id),
          commodityItemId: new Types.ObjectId(comm1Id),
          physicalQuantity: 75,
          reservedQuantity: 15,
          damagedQuantity: 2,
          purchaseCost: 95,
        },
      ];

      vi.spyOn(models.Warehouse, "find").mockReturnValue({
        sort: () => ({ lean: async () => mockWarehouses }),
      } as never);
      vi.spyOn(models.StockLocation, "find").mockImplementation(((query: { locationType?: string }) => {
        if (query?.locationType === "Warehouse") return { sort: () => ({ lean: async () => [] }) } as never;
        return { sort: () => ({ lean: async () => mockShops }) } as never;
      }) as never);
      vi.spyOn(models.Item, "find").mockReturnValue({
        select: () => ({ sort: () => ({ lean: async () => mockItems }) }),
      } as never);
      vi.spyOn(models.StockLevel, "find").mockReturnValue({ lean: async () => [] } as never);
      vi.spyOn(models.StockLot, "find").mockReturnValue({ lean: async () => mockLots } as never);
      vi.spyOn(models.StockMovement, "find").mockReturnValue({ lean: async () => [] } as never);
      vi.spyOn(models.StockReservation, "find").mockReturnValue({ lean: async () => [] } as never);

      const req = new Request("http://localhost:3000/api/inventory/reports");
      const res = await GET(req);
      const json = await res.json();

      expect(json.rows).toHaveLength(1);
      expect(json.rows[0].totalOnHand).toBe(75);
      expect(json.rows[0].totalReserved).toBe(15);
      expect(json.rows[0].totalAvailable).toBe(60);
      expect(json.rows[0].totalDamaged).toBe(2);
      expect(json.rows[0].totalStockValue).toBe(7125); // 75 * 95
    });

    it("reconciles unfulfilled active sales order reservations accurately", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-123", organizationId: orgId, role: "Owner" },
      });

      const mockWarehouses = [
        { _id: new Types.ObjectId(wh1Id), name: "Central Warehouse", code: "WH-01" },
      ];
      const mockShops = [
        { _id: new Types.ObjectId(shop1Id), name: "APMC Shop", code: "SHOP-01", isDefault: true },
      ];
      const mockItems = [
        {
          _id: new Types.ObjectId(comm1Id),
          name: "Organic Basmati Rice",
          sku: "RICE-01",
          unit: "kg",
          purchasePrice: 100,
        },
      ];

      // Stock level with 100 onHand, but reservation in StockLevel was 0
      const mockStockLevels = [
        {
          locationType: "Warehouse",
          locationId: new Types.ObjectId(wh1Id),
          commodityId: new Types.ObjectId(comm1Id),
          onHandQuantity: 100,
          reservedQuantity: 0,
          availableQuantity: 100,
          damagedQuantity: 0,
          stockValue: 10000,
          averageCost: 100,
        },
      ];

      // Active reservation of 30 units (10 invoiced, so 20 unfulfilled)
      const mockReservations = [
        {
          locationType: "Warehouse",
          locationId: new Types.ObjectId(wh1Id),
          commodityId: new Types.ObjectId(comm1Id),
          reservedQuantity: 30,
          invoicedQuantity: 10,
          releasedQuantity: 0,
          status: "Active",
        },
      ];

      vi.spyOn(models.Warehouse, "find").mockReturnValue({
        sort: () => ({ lean: async () => mockWarehouses }),
      } as never);
      vi.spyOn(models.StockLocation, "find").mockImplementation(((query: { locationType?: string }) => {
        if (query?.locationType === "Warehouse") return { sort: () => ({ lean: async () => [] }) } as never;
        return { sort: () => ({ lean: async () => mockShops }) } as never;
      }) as never);
      vi.spyOn(models.Item, "find").mockReturnValue({
        select: () => ({ sort: () => ({ lean: async () => mockItems }) }),
      } as never);
      vi.spyOn(models.StockLevel, "find").mockReturnValue({ lean: async () => mockStockLevels } as never);
      vi.spyOn(models.StockLot, "find").mockReturnValue({ lean: async () => [] } as never);
      vi.spyOn(models.StockMovement, "find").mockReturnValue({ lean: async () => [] } as never);
      vi.spyOn(models.StockReservation, "find").mockReturnValue({ lean: async () => mockReservations } as never);

      const req = new Request("http://localhost:3000/api/inventory/reports");
      const res = await GET(req);
      const json = await res.json();

      expect(json.rows).toHaveLength(1);
      expect(json.rows[0].totalOnHand).toBe(100);
      expect(json.rows[0].totalReserved).toBe(20);
      expect(json.rows[0].totalAvailable).toBe(80); // 100 - 20
    });
  });

  describe("5. Empty States", () => {
    it("returns clean empty states with 0 stock and ₹0 valuation when no records exist", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-123", organizationId: orgId, role: "Owner" },
      });

      vi.spyOn(models.Warehouse, "find").mockReturnValue({
        sort: () => ({ lean: async () => [] }),
      } as never);
      vi.spyOn(models.StockLocation, "find").mockReturnValue({
        sort: () => ({ lean: async () => [] }),
      } as never);
      vi.spyOn(models.StockLocation, "create").mockResolvedValue({
        toObject: () => ({ _id: shop1Id, name: "Main Shop", code: "SHOP-MAIN" }),
      } as never);
      vi.spyOn(models.Item, "find").mockReturnValue({
        select: () => ({ sort: () => ({ lean: async () => [] }) }),
      } as never);
      vi.spyOn(models.StockLevel, "find").mockReturnValue({ lean: async () => [] } as never);
      vi.spyOn(models.StockLot, "find").mockReturnValue({ lean: async () => [] } as never);
      vi.spyOn(models.StockMovement, "find").mockReturnValue({ lean: async () => [] } as never);
      vi.spyOn(models.StockReservation, "find").mockReturnValue({ lean: async () => [] } as never);

      const req = new Request("http://localhost:3000/api/inventory/reports");
      const res = await GET(req);
      const json = await res.json();

      expect(json.rows).toEqual([]);
      expect(json.summary).toEqual({
        totalCommodities: 0,
        totalOnHand: 0,
        totalReserved: 0,
        totalAvailable: 0,
        totalDamaged: 0,
        totalStockValue: 0,
      });
    });
  });
});
