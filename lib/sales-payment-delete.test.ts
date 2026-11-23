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

import { DELETE as deletePaymentById, GET as getPaymentById } from "@/app/api/sales/payments/[id]/route";
import { DELETE as deletePaymentFromList } from "@/app/api/sales/payments/route";
import { AuditEvent, SalesDocument } from "@/models";

describe("Sales Payments - Delete Payment Option", () => {
  describe("1. UI Component Validation in customer-payments-directory.tsx", () => {
    const filePath = path.join(process.cwd(), "components/sales/customer-payments-directory.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    it("includes Delete action in the payments table list", () => {
      expect(content).toContain("handleDeletePayment(p)");
      expect(content).toContain('title="Delete Payment"');
      expect(content).toContain("<Trash2");
    });

    it("includes Delete action in the payment details modal", () => {
      expect(content).toContain("handleDeletePayment(selectedPayment)");
      expect(content).toContain("<span>Delete Payment</span>");
    });

    it("displays a confirmation popup before deletion with impact warning", () => {
      expect(content).toContain("paymentToDelete");
      expect(content).toContain("Delete Customer Payment");
      expect(content).toContain("Permanently delete this payment receipt record");
      expect(content).toContain("Restore the outstanding balance on linked invoice");
      expect(content).toContain("Recompute and update the related customer ledger");
      expect(content).toContain("Confirm Delete");
      expect(content).toContain("confirmDeletePayment");
    });

    it("calls DELETE API, invalidates cache, and refreshes directory on confirmation", () => {
      expect(content).toContain('method: "DELETE"');
      expect(content).toContain("invalidateSalesCache();");
      expect(content).toContain("handleRefresh();");
    });
  });

  describe("2. Security & Authorization Checks", () => {
    const orgId = new Types.ObjectId().toString();
    const foreignOrgId = new Types.ObjectId().toString();
    const paymentId = new Types.ObjectId().toString();

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("rejects unauthenticated requests with 401", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const req = new Request(`http://localhost:3000/api/sales/payments/${paymentId}`, {
        method: "DELETE",
      });
      const res = (await deletePaymentById(req, { params: Promise.resolve({ id: paymentId }) }))!;
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toContain("Sign in");
    });

    it("rejects unauthorized read-only/viewer users with 403", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "viewer-1",
          role: "Viewer",
          organizationId: orgId,
        },
      });

      const req = new Request(`http://localhost:3000/api/sales/payments/${paymentId}`, {
        method: "DELETE",
      });
      const res = (await deletePaymentById(req, { params: Promise.resolve({ id: paymentId }) }))!;
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain("permission to delete payments");
    });

    it("enforces tenant isolation preventing cross-organization payment deletion", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "user-tenant-a",
          role: "Member",
          organizationId: orgId,
        },
      });

      // User tries to delete targeting a different organizationId
      const req = new Request(`http://localhost:3000/api/sales/payments/${paymentId}?organizationId=${foreignOrgId}`, {
        method: "DELETE",
      });
      const res = (await deletePaymentById(req, { params: Promise.resolve({ id: paymentId }) }))!;
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain("You can only access your own organization");
    });
  });

  describe("3. Payment Deletion, Ledger & Invoice Balance Reconciliation", () => {
    const orgId = new Types.ObjectId().toString();
    const paymentId = new Types.ObjectId().toString();
    const invoiceId = new Types.ObjectId().toString();

    const mockAdminSession = {
      user: {
        id: "admin-1",
        role: "Admin",
        organizationId: orgId,
      },
    };

    beforeEach(() => {
      vi.restoreAllMocks();
      mockGetServerSession.mockResolvedValue(mockAdminSession);
    });

    it("returns 404 when payment record does not exist", async () => {
      vi.spyOn(SalesDocument, "findOne").mockResolvedValue(null as never);

      const req = new Request(`http://localhost:3000/api/sales/payments/${paymentId}?organizationId=${orgId}`, {
        method: "DELETE",
      });
      const res = (await deletePaymentById(req, { params: Promise.resolve({ id: paymentId }) }))!;
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("Payment not found.");
    });

    it("permanently deletes payment and reverts invoice amountPaid from Paid back to Sent/Overdue", async () => {
      const mockPaymentDoc = {
        _id: new Types.ObjectId(paymentId),
        number: "PAY-0005",
        total: 50000,
        type: "Payment Received",
        relatedDocumentId: new Types.ObjectId(invoiceId),
      };

      const mockInvoiceDoc = {
        _id: new Types.ObjectId(invoiceId),
        number: "INV-1001",
        type: "Invoice",
        total: 50000,
        amountPaid: 50000,
        creditedAmount: 0,
        status: "Paid",
        dueDate: new Date(Date.now() + 86400000), // future due date -> "Sent"
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(SalesDocument, "findOne")
        .mockResolvedValueOnce(mockPaymentDoc as never) // finds payment
        .mockResolvedValueOnce(mockInvoiceDoc as never); // finds linked invoice

      const deleteSpy = vi.spyOn(SalesDocument, "findOneAndDelete").mockResolvedValue(mockPaymentDoc as never);
      const auditSpy = vi.spyOn(AuditEvent, "create").mockResolvedValue({} as never);

      const req = new Request(`http://localhost:3000/api/sales/payments/${paymentId}?organizationId=${orgId}`, {
        method: "DELETE",
      });
      const res = (await deletePaymentById(req, { params: Promise.resolve({ id: paymentId }) }))!;
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.message).toBe("Payment deleted successfully.");

      // Check invoice reversion
      expect(mockInvoiceDoc.amountPaid).toBe(0);
      expect(mockInvoiceDoc.status).toBe("Sent");
      expect(mockInvoiceDoc.save).toHaveBeenCalled();

      // Check payment permanently deleted
      expect(deleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "Payment Received",
        }),
      );

      // Check audit event
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "DELETE_PAYMENT",
          entityType: "Payment",
        }),
      );
    });

    it("correctly reverts partial payment from Paid to Partly paid", async () => {
      const mockPaymentDoc = {
        _id: new Types.ObjectId(paymentId),
        number: "PAY-0006",
        total: 20000,
        type: "Payment Received",
        relatedDocumentId: new Types.ObjectId(invoiceId),
      };

      const mockInvoiceDoc = {
        _id: new Types.ObjectId(invoiceId),
        number: "INV-1002",
        type: "Invoice",
        total: 50000,
        amountPaid: 50000, // was fully paid across 2 payments
        creditedAmount: 0,
        status: "Paid",
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(SalesDocument, "findOne")
        .mockResolvedValueOnce(mockPaymentDoc as never)
        .mockResolvedValueOnce(mockInvoiceDoc as never);

      vi.spyOn(SalesDocument, "findOneAndDelete").mockResolvedValue(mockPaymentDoc as never);
      vi.spyOn(AuditEvent, "create").mockResolvedValue({} as never);

      const req = new Request(`http://localhost:3000/api/sales/payments/${paymentId}?organizationId=${orgId}`, {
        method: "DELETE",
      });
      const res = (await deletePaymentById(req, { params: Promise.resolve({ id: paymentId }) }))!;
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(mockInvoiceDoc.amountPaid).toBe(30000);
      expect(mockInvoiceDoc.status).toBe("Partly paid");
      expect(mockInvoiceDoc.save).toHaveBeenCalled();
    });

    it("works via DELETE /api/sales/payments?id=...", async () => {
      const mockPaymentDoc = {
        _id: new Types.ObjectId(paymentId),
        number: "PAY-0007",
        total: 15000,
        type: "Payment Received",
        relatedDocumentId: null, // On Account
      };

      vi.spyOn(SalesDocument, "findOne").mockResolvedValue(mockPaymentDoc as never);
      const deleteSpy = vi.spyOn(SalesDocument, "findOneAndDelete").mockResolvedValue(mockPaymentDoc as never);
      vi.spyOn(AuditEvent, "create").mockResolvedValue({} as never);

      const req = new Request(`http://localhost:3000/api/sales/payments?id=${paymentId}&organizationId=${orgId}`, {
        method: "DELETE",
      });
      const res = (await deletePaymentFromList(req))!;
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(deleteSpy).toHaveBeenCalled();
    });

    it("handles demo payment deletion cleanly", async () => {
      const demoId = "demo-pay-1";
      const req = new Request(`http://localhost:3000/api/sales/payments/${demoId}?organizationId=${orgId}`, {
        method: "DELETE",
      });
      const res = (await deletePaymentById(req, { params: Promise.resolve({ id: demoId }) }))!;
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.deletedPaymentId).toBe(demoId);
    });
  });
});
