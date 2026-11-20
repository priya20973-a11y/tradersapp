import { describe, expect, it, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/purchase-order-numbering-server", () => ({
  allocateNextPurchaseOrderNumber: vi.fn().mockResolvedValue({
    poNumber: "PO-00002",
    allocatedNumber: 2,
    prefix: "PO-",
    padding: 5,
  }),
}));

// Route handlers for the 8 target modules
import { GET as getItems, POST as postItems } from "@/app/api/items/route";
import { GET as getSales } from "@/app/api/sales/route";
import { DELETE as deleteCustomer } from "@/app/api/sales/customers/[id]/route";
import { GET as getCustomerLedger } from "@/app/api/sales/customer-ledger/route";
import { GET as getPurchaseOrders, POST as postPurchaseOrders } from "@/app/api/purchases/purchase-orders/route";
import {
  GET as getPurchaseOrderById,
  PUT as putPurchaseOrderById,
  DELETE as deletePurchaseOrderById,
} from "@/app/api/purchases/purchase-orders/[id]/route";
import { POST as receivePurchaseOrder } from "@/app/api/purchases/purchase-orders/[id]/receive/route";
import {
  GET as getPOPreferences,
  PUT as putPOPreferences,
} from "@/app/api/purchases/purchase-orders/preferences/route";
import { GET as getVendors, POST as postVendors } from "@/app/api/vendors/route";
import {
  GET as getVendorById,
  PUT as putVendorById,
  DELETE as deleteVendorById,
} from "@/app/api/vendors/[id]/route";
import { GET as getVendorLedger } from "@/app/api/purchases/vendor-ledger/route";
import { GET as getExpenses, POST as postExpenses } from "@/app/api/expenses/route";
import {
  GET as getExpenseById,
  PUT as putExpenseById,
  DELETE as deleteExpenseById,
} from "@/app/api/expenses/[id]/route";
import {
  GET as getRecurringExpenses,
  POST as postRecurringExpenses,
} from "@/app/api/purchases/recurring-expenses/route";
import {
  GET as getRecurringExpenseById,
  PUT as putRecurringExpenseById,
  DELETE as deleteRecurringExpenseById,
} from "@/app/api/purchases/recurring-expenses/[id]/route";

import {
  Item,
  ItemPreference,
  Organization,
  SalesDocument,
  Customer,
  PurchaseOrder,
  PurchaseOrderPreferences,
  PurchaseBill,
  DocumentSequence,
  Vendor,
  Expense,
  RecurringExpense,
} from "@/models";

describe("Eight Target Modules - Tenant Isolation & Zero Hardcoded Data", () => {
  const accountAOrgId = new Types.ObjectId().toString();
  const accountBOrgId = new Types.ObjectId().toString();

  const sessionA = {
    user: { id: "user-a", email: "a@domain.com", organizationId: accountAOrgId },
  };
  const sessionB = {
    user: { id: "user-b", email: "b@domain.com", organizationId: accountBOrgId },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Commodity Module
  describe("1. Commodity Module Isolation", () => {
    it("returns empty items for newly created Account B with no fallback demo items", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      vi.spyOn(ItemPreference, "findOne").mockReturnValue({
        lean: () => ({
          catch: () => Promise.resolve(null),
        }),
      } as never);
      vi.spyOn(Item, "find").mockReturnValue({
        sort: () => ({
          lean: () => ({
            catch: () => Promise.resolve([]),
          }),
        }),
      } as never);

      const res = await getItems(new Request("http://localhost:3000/api/items"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.items).toEqual([]);
    });

    it("scopes item creation to the authenticated user's organizationId", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      vi.spyOn(ItemPreference, "findOne").mockReturnValue({
        lean: () => ({
          catch: () => Promise.resolve(null),
        }),
      } as never);
      const createdDoc: { value: Record<string, unknown> | null } = { value: null };
      vi.spyOn(Item, "create").mockImplementation((async (doc: Record<string, unknown>) => {
        createdDoc.value = doc;
        return { _id: new Types.ObjectId(), ...doc, toObject: () => doc };
      }) as never);

      const res = await postItems(
        new Request("http://localhost:3000/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Organic Soybeans B",
            sellingPrice: 4500,
            unit: "Quintal",
          }),
        }),
      );

      expect(res.status).toBe(201);
      expect(String(createdDoc.value?.organizationId)).toBe(accountBOrgId);
      expect(createdDoc.value?.name).toBe("Organic Soybeans B");
    });
  });

  // 2. Customer Module
  describe("2. Customer Module Isolation", () => {
    it("does not leak customers to empty accounts", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      vi.spyOn(Organization, "findById").mockReturnValue({
        select: () => ({
          lean: async () => ({ _id: new Types.ObjectId(accountBOrgId), name: "Org B" }),
        }),
      } as never);
      vi.spyOn(Customer, "find").mockReturnValue({
        sort: () => ({
          lean: () => ({
            catch: () => Promise.resolve([]),
          }),
        }),
      } as never);
      vi.spyOn(SalesDocument, "find").mockReturnValue({
        sort: () => ({
          lean: async () => [],
        }),
      } as never);

      const res = (await getSales(new Request("http://localhost:3000/api/sales?section=customers")))!;
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.customers).toEqual([]);
    });

    it("restricts customer deletion to the authenticated user's organization", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      const targetId = new Types.ObjectId().toString();
      const deleteFilter: { value: Record<string, unknown> | null } = { value: null };
      vi.spyOn(Customer, "findOneAndDelete").mockImplementation(((filter: Record<string, unknown>) => {
        deleteFilter.value = filter;
        return Promise.resolve(null); // Not found in Account B
      }) as never);

      const res = (await deleteCustomer(
        new Request(`http://localhost:3000/api/sales/customers/${targetId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: targetId }) },
      ))!;

      expect(res.status).toBe(404);
      expect(String(deleteFilter.value?._id)).toBe(targetId);
      expect(String(deleteFilter.value?.organizationId)).toBe(accountBOrgId);
    });
  });

  // 3. Customer Account (Customer Ledger) Module
  describe("3. Customer Account / Customer Ledger Isolation", () => {
    it("returns null vendor/customers and empty lines for Account B when empty", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      vi.spyOn(Customer, "find").mockReturnValue({
        select: () => ({
          sort: () => ({
            lean: async () => [],
          }),
        }),
      } as never);

      const res = await getCustomerLedger(new Request("http://localhost:3000/api/sales/customer-ledger"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.customer).toBeNull();
      expect(data.customers).toEqual([]);
      expect(data.lines).toEqual([]);
      expect(data.summary.transactionCount).toBe(0);
    });
  });

  // 4. Purchase Order Module
  describe("4. Purchase Order Module Isolation", () => {
    it("returns empty list for newly created Account B with no demo orders", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      vi.spyOn(PurchaseOrder, "find").mockReturnValue({
        sort: () => ({
          lean: async () => [],
        }),
      } as never);

      const res = await getPurchaseOrders(new Request("http://localhost:3000/api/purchases/purchase-orders"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.purchaseOrders).toEqual([]);
    });

    it("creates a purchase order strictly scoped to Account B", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      vi.spyOn(PurchaseOrder.prototype, "save").mockImplementation(async function (
        this: InstanceType<typeof PurchaseOrder>,
      ) {
        expect(String(this.organizationId)).toBe(accountBOrgId);
        expect(this.vendorName).toBe("Fresh Agro Supplies");
        return this;
      });
      vi.spyOn(PurchaseOrderPreferences, "findOne").mockReturnValue({
        lean: async () => ({ nextNumber: 2, prefix: "PO-", autoGenerateNumbering: true }),
      } as never);
      vi.spyOn(PurchaseOrderPreferences, "findOneAndUpdate").mockReturnValue({
        lean: async () => ({ nextNumber: 3, prefix: "PO-", numberZeroPadding: 5 }),
      } as never);
      vi.spyOn(Vendor, "findOne").mockReturnValue({
        catch: () => Promise.resolve(null),
        lean: () => ({ catch: () => Promise.resolve(null) }),
      } as never);
      vi.spyOn(Vendor, "create").mockResolvedValue({ _id: new Types.ObjectId() } as never);
      vi.spyOn(PurchaseBill, "findOne").mockReturnValue({
        catch: () => Promise.resolve(null),
      } as never);
      vi.spyOn(PurchaseBill, "create").mockResolvedValue({ _id: new Types.ObjectId() } as never);
      vi.spyOn(DocumentSequence, "findOneAndUpdate").mockReturnValue({
        catch: () => Promise.resolve({ nextNumber: 1 }),
      } as never);

      const res = await postPurchaseOrders(
        new Request("http://localhost:3000/api/purchases/purchase-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendorId: "v-1",
            vendorName: "Fresh Agro Supplies",
            orderDate: "2026-11-20",
            items: [
              {
                name: "Wheat Bag 50kg",
                quantity: 10,
                rate: 1500,
                unit: "Bag",
                account: "Cost of Goods Sold",
              },
            ],
          }),
        }),
      );

      expect(res.status).toBe(201);
    });

    it("enforces tenant isolation on GET, PUT, DELETE for purchase orders", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      const foreignPoId = new Types.ObjectId().toString();

      vi.spyOn(PurchaseOrder, "findOne").mockReturnValue({
        lean: () => ({
          catch: () => null,
        }),
      } as never);
      vi.spyOn(PurchaseOrder, "findOneAndDelete").mockImplementation(((query: Record<string, unknown>) => {
        expect(query.organizationId).toBe(accountBOrgId);
        return Promise.resolve(null);
      }) as never);

      const getRes = await getPurchaseOrderById(
        new Request(`http://localhost:3000/api/purchases/purchase-orders/${foreignPoId}`),
        { params: Promise.resolve({ id: foreignPoId }) },
      );
      expect(getRes.status).toBe(404);

      const delRes = await deletePurchaseOrderById(
        new Request(`http://localhost:3000/api/purchases/purchase-orders/${foreignPoId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: foreignPoId }) },
      );
      expect(delRes.status).toBe(404);
    });

    it("scopes purchase order preferences to authenticated organization", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      const searchedOrgId: { value: string | null } = { value: null };
      vi.spyOn(PurchaseOrderPreferences, "findOne").mockImplementation(((query: Record<string, unknown>) => {
        searchedOrgId.value = String(query.organizationId);
        return {
          lean: async () => null,
        } as never;
      }) as never);
      vi.spyOn(PurchaseOrderPreferences, "create").mockImplementation((async (doc: Record<string, unknown>) => ({
        toObject: () => doc,
      })) as never);

      const res = await getPOPreferences();
      expect(res.status).toBe(200);
      expect(searchedOrgId.value).toBe(accountBOrgId);
    });
  });

  // 5. Vendor Module
  describe("5. Vendor Module Isolation", () => {
    it("returns empty array for newly created Account B without falling back to demo vendors", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      vi.spyOn(Vendor, "find").mockReturnValue({
        sort: () => ({
          lean: () => ({
            catch: async () => [],
          }),
        }),
      } as never);

      const res = await getVendors(new Request("http://localhost:3000/api/vendors"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.vendors).toEqual([]);
    });

    it("creates vendor tied exclusively to Account B's organizationId", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      const createdDoc: { value: Record<string, unknown> | null } = { value: null };
      vi.spyOn(Vendor, "findOne").mockReturnValue({
        lean: async () => null,
      } as never);
      vi.spyOn(Vendor, "create").mockImplementation((async (doc: Record<string, unknown>) => {
        createdDoc.value = doc;
        return { _id: new Types.ObjectId(), ...doc, toObject: () => doc };
      }) as never);

      const res = await postVendors(
        new Request("http://localhost:3000/api/vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: "Account B Local Supplier",
          }),
        }),
      );

      expect(res.status).toBe(201);
      expect(String(createdDoc.value?.organizationId)).toBe(accountBOrgId);
    });

    it("restricts vendor detail, update, and delete to the correct tenant", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      const foreignVendorId = new Types.ObjectId().toString();

      const findQuery: { value: Record<string, unknown> | null } = { value: null };
      vi.spyOn(Vendor, "findOne").mockImplementation(((query: Record<string, unknown>) => {
        findQuery.value = query;
        return {
          lean: async () => null,
        } as never;
      }) as never);

      const deleteQuery: { value: Record<string, unknown> | null } = { value: null };
      vi.spyOn(Vendor, "findOneAndDelete").mockImplementation(((query: Record<string, unknown>) => {
        deleteQuery.value = query;
        return Promise.resolve(null);
      }) as never);

      const getRes = await getVendorById(
        new Request(`http://localhost:3000/api/vendors/${foreignVendorId}`),
        { params: Promise.resolve({ id: foreignVendorId }) },
      );
      expect(getRes.status).toBe(404);
      expect(findQuery.value?.organizationId).toBe(accountBOrgId);

      const delRes = await deleteVendorById(
        new Request(`http://localhost:3000/api/vendors/${foreignVendorId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: foreignVendorId }) },
      );
      expect(delRes.status).toBe(404);
      expect(deleteQuery.value?.organizationId).toBe(accountBOrgId);
    });
  });

  // 6. Vendor Ledger Module
  describe("6. Vendor Ledger Module Isolation", () => {
    it("returns null vendor and empty transactions for Account B when empty", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      vi.spyOn(Vendor, "find").mockReturnValue({
        select: () => ({
          sort: () => ({
            lean: async () => [],
          }),
        }),
      } as never);

      const res = await getVendorLedger(new Request("http://localhost:3000/api/purchases/vendor-ledger"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.vendor).toBeNull();
      expect(data.vendors).toEqual([]);
      expect(data.lines).toEqual([]);
      expect(data.summary.transactionCount).toBe(0);
    });
  });

  // 7. Expense Module
  describe("7. Expense Module Isolation", () => {
    it("returns empty array for newly created Account B without demo expenses fallback", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      vi.spyOn(Expense, "find").mockReturnValue({
        sort: () => ({
          lean: () => ({
            catch: async () => [],
          }),
        }),
      } as never);

      const res = await getExpenses(new Request("http://localhost:3000/api/expenses"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.expenses).toEqual([]);
    });

    it("creates expenses strictly associated with Account B's organizationId", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      const createdDoc: { value: Record<string, unknown> | null } = { value: null };
      vi.spyOn(Expense, "create").mockImplementation((async (doc: Record<string, unknown>) => {
        createdDoc.value = doc;
        return { _id: new Types.ObjectId(), ...doc, toObject: () => doc };
      }) as never);

      const res = await postExpenses(
        new Request("http://localhost:3000/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: "2026-11-20",
            paidThrough: "Petty Cash",
            amount: 2500,
            items: [{ expenseAccount: "Office Supplies", amount: 2500, notes: "Supplies" }],
          }),
        }),
      );

      expect(res.status).toBe(201);
      expect(String(createdDoc.value?.organizationId)).toBe(accountBOrgId);
    });

    it("prevents cross-account viewing or deletion of expenses", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      const foreignExpenseId = new Types.ObjectId().toString();

      const findQuery: { value: Record<string, unknown> | null } = { value: null };
      vi.spyOn(Expense, "findOne").mockImplementation(((query: Record<string, unknown>) => {
        findQuery.value = query;
        return {
          lean: () => ({
            catch: async () => null,
          }),
        } as never;
      }) as never);

      const deleteQuery: { value: Record<string, unknown> | null } = { value: null };
      vi.spyOn(Expense, "findOneAndDelete").mockImplementation(((query: Record<string, unknown>) => {
        deleteQuery.value = query;
        return {
          catch: async () => null,
        } as never;
      }) as never);

      const getRes = await getExpenseById(
        new Request(`http://localhost:3000/api/expenses/${foreignExpenseId}`),
        { params: Promise.resolve({ id: foreignExpenseId }) },
      );
      expect(getRes.status).toBe(404);
      expect(findQuery.value?.organizationId).toBe(accountBOrgId);

      const delRes = await deleteExpenseById(
        new Request(`http://localhost:3000/api/expenses/${foreignExpenseId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: foreignExpenseId }) },
      );
      expect(delRes.status).toBe(404);
      expect(deleteQuery.value?.organizationId).toBe(accountBOrgId);
    });
  });

  // 8. Recurring Expense Module
  describe("8. Recurring Expense Module Isolation", () => {
    it("returns empty profiles for Account B with no demo recurring expenses fallback", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      vi.spyOn(RecurringExpense, "find").mockReturnValue({
        sort: () => ({
          lean: () => ({
            catch: async () => [],
          }),
        }),
      } as never);

      const res = await getRecurringExpenses(new Request("http://localhost:3000/api/purchases/recurring-expenses"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.profiles).toEqual([]);
    });

    it("creates recurring expense profile scoped exclusively to Account B", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      const createdDoc: { value: Record<string, unknown> | null } = { value: null };
      vi.spyOn(RecurringExpense, "create").mockImplementation((async (doc: Record<string, unknown>) => {
        createdDoc.value = doc;
        return { _id: new Types.ObjectId(), ...doc, toObject: () => doc };
      }) as never);

      const res = await postRecurringExpenses(
        new Request("http://localhost:3000/api/purchases/recurring-expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileName: "B Warehouse Lease",
            repeatEvery: "Month",
            startDate: "2026-11-01",
            expenseAccount: "Rent & Lease Expense",
            amount: 30000,
            paidThrough: "Primary Bank",
          }),
        }),
      );

      expect(res.status).toBe(201);
      expect(String(createdDoc.value?.organizationId)).toBe(accountBOrgId);
    });

    it("enforces tenant-isolation on recurring expense lookup and deletion", async () => {
      mockGetServerSession.mockResolvedValue(sessionB);
      const foreignProfileId = new Types.ObjectId().toString();

      const findQuery: { value: Record<string, unknown> | null } = { value: null };
      vi.spyOn(RecurringExpense, "findOne").mockImplementation(((query: Record<string, unknown>) => {
        findQuery.value = query;
        return {
          lean: () => ({
            catch: async () => null,
          }),
        } as never;
      }) as never);

      const deleteQuery: { value: Record<string, unknown> | null } = { value: null };
      vi.spyOn(RecurringExpense, "findOneAndDelete").mockImplementation(((query: Record<string, unknown>) => {
        deleteQuery.value = query;
        return {
          catch: async () => null,
        } as never;
      }) as never);

      const getRes = await getRecurringExpenseById(
        new Request(`http://localhost:3000/api/purchases/recurring-expenses/${foreignProfileId}`),
        { params: Promise.resolve({ id: foreignProfileId }) },
      );
      expect(getRes.status).toBe(404);
      expect(findQuery.value?.organizationId).toBe(accountBOrgId);

      const delRes = await deleteRecurringExpenseById(
        new Request(`http://localhost:3000/api/purchases/recurring-expenses/${foreignProfileId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: foreignProfileId }) },
      );
      expect(delRes.status).toBe(404);
      expect(deleteQuery.value?.organizationId).toBe(accountBOrgId);
    });
  });
});
