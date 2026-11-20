import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const { recordPurchaseInwardMock, getServerSessionMock } = vi.hoisted(() => ({
  recordPurchaseInwardMock: vi.fn(),
  getServerSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn().mockResolvedValue({}) }));
vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/inventory-service", () => ({ recordPurchaseInward: recordPurchaseInwardMock }));
vi.mock("@/lib/bill-numbering-server", () => ({
  peekNextBillNumber: vi.fn(),
  allocateNextBillNumber: vi.fn(),
}));
vi.mock("@/models", () => ({
  Customer: {},
  DocumentSequence: { updateOne: vi.fn() },
  Item: { countDocuments: vi.fn() },
  Organization: { findOne: vi.fn() },
  PurchaseBill: { findOne: vi.fn(), create: vi.fn() },
  StockLocation: { findOne: vi.fn() },
  Vendor: { findOne: vi.fn() },
  Warehouse: { findOne: vi.fn() },
}));

import { Item, PurchaseBill, Vendor, Warehouse } from "@/models";
import { POST } from "@/app/api/purchases/bills/route";

describe("Vendor bill warehouse stock integration", () => {
  const organizationId = new Types.ObjectId();
  const warehouseId = new Types.ObjectId();
  const commodityId = new Types.ObjectId();
  const billId = new Types.ObjectId();
  const vendorId = new Types.ObjectId();
  const billDate = new Date("2026-11-18T00:00:00.000Z");
  const existingBill = {
    _id: billId,
    vendorId,
    billNumber: "BILL-0001",
    billDate,
    orderNumber: "",
    stockLocationType: "Warehouse",
    stockLocationId: warehouseId,
    items: [{
      itemId: commodityId.toString(),
      name: "Rice",
      description: "",
      account: "Cost of Goods Sold",
      quantity: 5,
      rate: 100,
      taxRate: 0,
      customerName: "",
    }],
    total: 500,
    status: "Pending",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue({
      user: { id: "buyer-1", organizationId: organizationId.toString() },
    });
    recordPurchaseInwardMock.mockResolvedValue({ success: true });
    vi.mocked(PurchaseBill.findOne).mockResolvedValue(existingBill as never);
    vi.mocked(Vendor.findOne).mockReturnValue({
      select: () => ({ lean: async () => ({ name: "Test Vendor" }) }),
    } as never);
    vi.mocked(Warehouse.findOne).mockReturnValue({
      select: () => ({ lean: async () => ({ name: "Main Warehouse" }) }),
    } as never);
    vi.mocked(Item.countDocuments).mockResolvedValue(1 as never);
  });

  it("reuses the bill and selected warehouse on a repeated identical request", async () => {
    const requestBody = {
      vendorId: vendorId.toString(),
      billNumber: "BILL-0001",
      orderNumber: "",
      stockLocationType: "Warehouse",
      stockLocationId: warehouseId.toString(),
      stockLocationName: "Main Warehouse",
      billDate: billDate.toISOString(),
      paymentTerms: "Due on Receipt",
      items: [{
        itemId: commodityId.toString(),
        name: "Rice",
        description: "",
        account: "Cost of Goods Sold",
        quantity: 5,
        rate: 100,
        taxRate: 0,
        customerName: "",
      }],
      discount: 0,
      discountType: "percent",
      taxType: "None",
      taxRate: 0,
      adjustment: 0,
      status: "Pending",
    };

    const createRequest = () =>
      new Request("http://localhost/api/purchases/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

    const firstResponse = await POST(createRequest());
    const retryResponse = await POST(createRequest());

    expect(firstResponse.status).toBe(200);
    expect(retryResponse.status).toBe(200);
    expect(PurchaseBill.create).not.toHaveBeenCalled();
    expect(recordPurchaseInwardMock).toHaveBeenCalledTimes(2);
    expect(recordPurchaseInwardMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        organizationId,
        billId,
        locationType: "Warehouse",
        locationId: warehouseId,
        items: [expect.objectContaining({ commodityId: commodityId.toString(), quantity: 5 })],
      }),
    );
    expect(recordPurchaseInwardMock.mock.calls[0][0].billId).toBe(recordPurchaseInwardMock.mock.calls[1][0].billId);
  });
});
