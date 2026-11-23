import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Types } from "mongoose";

// Mock next-auth
const mockSession = {
  user: {
    id: "user-123",
    email: "test@org.in",
    organizationId: new Types.ObjectId().toString(),
  },
};

vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockImplementation(() => Promise.resolve(mockSession)),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/inventory-service", () => ({
  recordPurchaseInward: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/purchase-order-numbering-server", () => ({
  allocateNextPurchaseOrderNumber: vi.fn().mockResolvedValue({
    poNumber: "PO-2026-9001",
    allocatedNumber: 9001,
    prefix: "PO-2026-",
    padding: 4,
  }),
}));

import { POST as postPurchaseOrder } from "@/app/api/purchases/purchase-orders/route";
import { POST as postPurchaseBill } from "@/app/api/purchases/bills/route";
import { PurchaseOrder, PurchaseBill, DocumentSequence, Vendor, Item, Warehouse, PurchaseOrderPreferences } from "@/models";

function createMockQuery<T>(result: T) {
  const p = Promise.resolve(result);
  (p as unknown as { lean: () => Promise<T>; select: () => unknown; catch: () => unknown }).lean = () => Promise.resolve(result);
  (p as unknown as { lean: () => Promise<T>; select: () => unknown; catch: () => unknown }).select = () => ({
    lean: () => Promise.resolve(result),
  });
  (p as unknown as { lean: () => Promise<T>; select: () => unknown; catch: () => unknown }).catch = () => Promise.resolve(result);
  return p as never;
}

describe("Purchase Order Manual Bill Generation & Duplicate Prevention", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Stop Auto-Generating Bill on PO Creation", () => {
    it("creates a Purchase Order without auto-generating a PurchaseBill or incrementing Bill sequence", async () => {
      const billCreateSpy = vi.spyOn(PurchaseBill, "create");
      const sequenceSpy = vi.spyOn(DocumentSequence, "findOneAndUpdate").mockReturnValue({
        catch: () => Promise.resolve({ nextNumber: 1 }),
      } as never);

      vi.spyOn(PurchaseOrder.prototype, "save").mockImplementation(async function (
        this: InstanceType<typeof PurchaseOrder>,
      ) {
        return this;
      });
      vi.spyOn(PurchaseOrderPreferences, "findOne").mockReturnValue({
        lean: async () => ({ nextNumber: 2, prefix: "PO-", autoGenerateNumbering: true }),
      } as never);
      vi.spyOn(PurchaseOrderPreferences, "findOneAndUpdate").mockReturnValue({
        lean: async () => ({ nextNumber: 3, prefix: "PO-", numberZeroPadding: 5 }),
      } as never);
      vi.spyOn(PurchaseOrder, "findOne").mockReturnValue({
        lean: () => ({ catch: () => Promise.resolve(null) }),
      } as never);
      vi.spyOn(Vendor, "findOne").mockReturnValue({
        catch: () => Promise.resolve(null),
        lean: () => ({ catch: () => Promise.resolve(null) }),
      } as never);
      vi.spyOn(Vendor, "create").mockResolvedValue({ _id: new Types.ObjectId() } as never);
      vi.spyOn(PurchaseBill, "findOne").mockReturnValue({
        catch: () => Promise.resolve(null),
      } as never);

      const payload = {
        purchaseOrderNumber: "PO-2026-9001",
        vendorName: "Kisan Agro Supplies",
        deliveryAddressType: "organization",
        orderDate: "2026-11-21",
        deliveryDate: "2026-11-28",
        paymentTerms: "Net 30",
        shipmentPreference: "Surface Express Freight",
        items: [
          {
            name: "Organic Mustard Seeds",
            sku: "MST-01",
            account: "Cost of Goods Sold",
            quantity: 50,
            unit: "Bag",
            rate: 4500,
            discount: 0,
            discountType: "percent",
            taxRate: 5,
            taxAmount: 11250,
            amount: 236250,
          },
        ],
        subtotal: 225000,
        discount: 0,
        discountType: "percent",
        taxType: "None",
        taxRate: 0,
        adjustment: 0,
        status: "Draft",
        notes: "Test manual bill PO",
      };

      const req = new Request("http://localhost:3000/api/purchases/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const response = await postPurchaseOrder(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      // PurchaseBill.create should NOT have been called
      expect(billCreateSpy).not.toHaveBeenCalled();
      // DocumentSequence for 'Purchase Bill' should NOT have been incremented
      const billSequenceCall = sequenceSpy.mock.calls.find(
        (call: unknown[]) => ((call?.[0] as unknown) as Record<string, unknown>)?.modelName === "Purchase Bill",
      );
      expect(billSequenceCall).toBeUndefined();
      // Response bill should be undefined
      expect(data.bill).toBeUndefined();
      expect(data.purchaseOrder.purchaseOrderNumber).toBe("PO-2026-9001");
    });
  });

  describe("2. Duplicate Bill Prevention for Purchase Orders", () => {
    it("returns 409 Conflict if a bill already exists for the given orderNumber", async () => {
      const existingPOBill = {
        _id: new Types.ObjectId(),
        billNumber: "BILL-0042",
        orderNumber: "PO-2026-9001",
        organizationId: mockSession.user.organizationId,
      };

      vi.spyOn(Vendor, "findOne").mockReturnValue(
        createMockQuery({
          _id: new Types.ObjectId(),
          name: "Kisan Agro Supplies",
          displayName: "Kisan Agro Supplies",
        }),
      );

      vi.spyOn(PurchaseBill, "findOne").mockImplementation(((query: Record<string, unknown>) => {
        if (query.orderNumber) {
          return createMockQuery(existingPOBill);
        }
        return createMockQuery(null);
      }) as never);

      const billPayload = {
        vendorId: new Types.ObjectId().toString(),
        billNumber: "BILL-0088",
        orderNumber: "PO-2026-9001",
        billDate: "2026-11-21",
        paymentTerms: "Due on Receipt",
        items: [
          {
            name: "Organic Mustard Seeds",
            quantity: 50,
            rate: 4500,
            taxRate: 5,
          },
        ],
      };

      const req = new Request("http://localhost:3000/api/purchases/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(billPayload),
      });

      const response = await postPurchaseBill(req);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("A bill (BILL-0042) has already been generated for Purchase Order PO-2026-9001.");
    });

    it("allows creating a new bill if no bill exists for the orderNumber", async () => {
      vi.spyOn(Vendor, "findOne").mockReturnValue(
        createMockQuery({
          _id: new Types.ObjectId(),
          name: "Kisan Agro Supplies",
          displayName: "Kisan Agro Supplies",
        }),
      );

      vi.spyOn(PurchaseBill, "findOne").mockReturnValue(createMockQuery(null));
      vi.spyOn(Item, "countDocuments").mockResolvedValue(0 as never);
      vi.spyOn(Warehouse, "findOne").mockReturnValue(
        createMockQuery({ _id: new Types.ObjectId(), name: "Main Warehouse" }),
      );

      const createdBillMock = {
        _id: new Types.ObjectId(),
        billNumber: "BILL-0099",
        orderNumber: "PO-2026-9999",
        total: 1000,
        status: "Pending",
      };
      vi.spyOn(PurchaseBill, "create").mockResolvedValue(createdBillMock as never);

      const billPayload = {
        vendorId: new Types.ObjectId().toString(),
        billNumber: "BILL-0099",
        orderNumber: "PO-2026-9999",
        billDate: "2026-11-21",
        paymentTerms: "Due on Receipt",
        items: [
          {
            name: "Wheat Grain",
            quantity: 10,
            rate: 100,
            taxRate: 0,
          },
        ],
      };

      const req = new Request("http://localhost:3000/api/purchases/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(billPayload),
      });

      const response = await postPurchaseBill(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.bill.billNumber).toBe("BILL-0099");
    });
  });

  describe("3. UI Integration & Manual '+ New Bill' Contract", () => {
    const poFormPath = path.resolve(process.cwd(), "components/purchases/purchase-order-form.tsx");
    const poDirPath = path.resolve(process.cwd(), "components/purchases/purchase-orders-directory.tsx");
    const billFormPath = path.resolve(process.cwd(), "components/purchases/bill-form.tsx");

    const poFormContent = fs.readFileSync(poFormPath, "utf-8");
    const poDirContent = fs.readFileSync(poDirPath, "utf-8");
    const billFormContent = fs.readFileSync(billFormPath, "utf-8");

    it("verifies PurchaseOrderForm provides + New Bill action linking to bill creation page", () => {
      expect(poFormContent).toContain("+ New Bill");
      expect(poFormContent).toContain("/purchases/bills/new?purchaseOrderId=");
      expect(poFormContent).toContain("View Bill");
      expect(poFormContent).toContain("Purchase Bill");
      expect(poFormContent).toContain("Not Billed");
    });

    it("verifies PurchaseOrdersDirectory provides + New Bill action linking to bill creation page", () => {
      expect(poDirContent).toContain("+ New Bill");
      expect(poDirContent).toContain("/purchases/bills/new?purchaseOrderId=");
    });

    it("verifies BillForm pre-fills orderNumber, vendor, and items from purchaseOrderId and checks for existing bill", () => {
      expect(billFormContent).toContain("useSearchParams");
      expect(billFormContent).toContain("purchaseOrderIdParam");
      expect(billFormContent).toContain("/api/purchases/purchase-orders/");
      expect(billFormContent).toContain("already been generated for Purchase Order");
      expect(billFormContent).toContain("Pre-filled with details from Purchase Order");
      expect(billFormContent).toContain("setOrderNumber(po.purchaseOrderNumber");
    });
  });
});
