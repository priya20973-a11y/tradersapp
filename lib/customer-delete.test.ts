import { describe, expect, it, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
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

import { DELETE } from "@/app/api/sales/customers/[id]/route";
import { Customer, SalesDocument, TraderProfile } from "@/models";

describe("Client Delete Functionality", () => {
  describe("UI Component Implementation", () => {
    it("has Delete action with Trash2 icon in customer-table-view.tsx", () => {
      const filePath = path.join(process.cwd(), "components/sales/customer/customer-table-view.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("onDeleteCustomer?: (customer: Customer) => void;");
      expect(content).toContain("Trash2");
      expect(content).toContain("onDeleteCustomer?.(customer)");
      expect(content).toContain("Delete");
    });

    it("has Delete action with Trash2 icon in customer-grid-view.tsx", () => {
      const filePath = path.join(process.cwd(), "components/sales/customer/customer-grid-view.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("onDeleteCustomer?: (customer: Customer) => void;");
      expect(content).toContain("Trash2");
      expect(content).toContain("onDeleteCustomer?.(customer)");
      expect(content).toContain("Delete");
    });

    it("has Delete Client action in customer-detail-view.tsx More menu", () => {
      const filePath = path.join(process.cwd(), "components/sales/customer/customer-detail-view.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("onDeleteCustomer?: (customer: Customer) => void;");
      expect(content).toContain("Trash2");
      expect(content).toContain("onDeleteCustomer?.(selectedCustomer)");
      expect(content).toContain("Delete Client");
    });

    it("handles single confirmation dialog and list refresh in customer-directory.tsx", () => {
      const filePath = path.join(process.cwd(), "components/sales/customer-directory.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("handleDeleteCustomer");
      expect(content).toContain("window.confirm");
      expect(content).toContain("method: \"DELETE\"");
      expect(content).toContain("invalidateSalesCache();");
      expect(content).toContain("loadOrganization(organizationId, true)");
      expect(content).toContain("onDeleteCustomer={handleDeleteCustomer}");
    });
  });

  describe("API Safety & Deletion Validation (DELETE /api/sales/customers/[id])", () => {
    const orgId = new Types.ObjectId().toString();
    const customerId = new Types.ObjectId().toString();
    const mockSession = {
      user: {
        id: "user-123",
        role: "admin",
        organizationId: orgId,
      },
    };

    beforeEach(() => {
      vi.restoreAllMocks();
      mockGetServerSession.mockResolvedValue(mockSession);
    });

    it("prevents deletion when related SalesDocuments exist", async () => {
      vi.spyOn(SalesDocument, "countDocuments").mockResolvedValue(3 as never);
      vi.spyOn(TraderProfile, "countDocuments").mockResolvedValue(0 as never);
      const findAndDeleteSpy = vi.spyOn(Customer, "findOneAndDelete");

      const req = new Request(`http://localhost:3000/api/sales/customers/${customerId}?organizationId=${orgId}`, {
        method: "DELETE",
      });
      const res = (await DELETE(req, { params: Promise.resolve({ id: customerId }) }))!;
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Cannot delete client with 3 existing transaction records");
      expect(findAndDeleteSpy).not.toHaveBeenCalled();
    });

    it("prevents deletion when related TraderProfile exists", async () => {
      vi.spyOn(SalesDocument, "countDocuments").mockResolvedValue(0 as never);
      vi.spyOn(TraderProfile, "countDocuments").mockResolvedValue(1 as never);
      const findAndDeleteSpy = vi.spyOn(Customer, "findOneAndDelete");

      const req = new Request(`http://localhost:3000/api/sales/customers/${customerId}?organizationId=${orgId}`, {
        method: "DELETE",
      });
      const res = (await DELETE(req, { params: Promise.resolve({ id: customerId }) }))!;
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Cannot delete client linked to an existing Trader Profile");
      expect(findAndDeleteSpy).not.toHaveBeenCalled();
    });

    it("successfully deletes client when no related records exist", async () => {
      vi.spyOn(SalesDocument, "countDocuments").mockResolvedValue(0 as never);
      vi.spyOn(TraderProfile, "countDocuments").mockResolvedValue(0 as never);
      vi.spyOn(Customer, "findOneAndDelete").mockResolvedValue({
        _id: new Types.ObjectId(customerId),
        name: "Acme Corp",
      } as never);

      const req = new Request(`http://localhost:3000/api/sales/customers/${customerId}?organizationId=${orgId}`, {
        method: "DELETE",
      });
      const res = (await DELETE(req, { params: Promise.resolve({ id: customerId }) }))!;
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.message).toBe("Client deleted successfully.");
    });

    it("returns 404 if client not found", async () => {
      vi.spyOn(SalesDocument, "countDocuments").mockResolvedValue(0 as never);
      vi.spyOn(TraderProfile, "countDocuments").mockResolvedValue(0 as never);
      vi.spyOn(Customer, "findOneAndDelete").mockResolvedValue(null as never);

      const req = new Request(`http://localhost:3000/api/sales/customers/${customerId}?organizationId=${orgId}`, {
        method: "DELETE",
      });
      const res = (await DELETE(req, { params: Promise.resolve({ id: customerId }) }))!;
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("Customer not found.");
    });
  });
});
