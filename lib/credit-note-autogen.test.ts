import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

const { testOrgId } = vi.hoisted(() => ({
  testOrgId: "000000000000000000000001",
}));

// Mock database connection
vi.mock("@/lib/db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(true),
}));

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { organizationId: testOrgId },
  }),
}));

// Mock models
vi.mock("@/models", () => {
  return {
    CreditNoteSettings: {
      findOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      updateOne: vi.fn(),
      create: vi.fn(),
    },
    SalesDocument: vi.fn(),
    Customer: {
      findOne: vi.fn(),
      updateOne: vi.fn().mockReturnValue(Promise.resolve()),
    },
    Organization: {
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ _id: testOrgId }),
        }),
      }),
    },
  };
});

import { CreditNoteSettings, Customer, SalesDocument } from "@/models";
import {
  allocateNextCreditNoteNumber,
  peekNextCreditNoteNumber,
} from "./credit-note-service";
import {
  findNextAvailableCreditNoteNumber,
} from "./credit-note-numbering";

interface MockQueryChain<T> {
  lean: () => Promise<T>;
  then?: (resolve: (val: T) => unknown) => Promise<unknown>;
  select?: () => { lean: () => Promise<T> };
}

function createMockQuery<T>(result: T): MockQueryChain<T> {
  return {
    lean: vi.fn().mockResolvedValue(result),
    then: (resolve) => Promise.resolve(result).then(resolve),
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(result),
    }),
  };
}

interface MockSalesDocModel {
  findOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  mockImplementation: (fn: (this: Record<string, unknown>, data?: Record<string, unknown>) => Record<string, unknown>) => void;
  prototype: {
    save: ReturnType<typeof vi.fn>;
  };
}

const MockSalesDoc = SalesDocument as unknown as MockSalesDocModel;

// Attach static and prototype methods to mocked SalesDocument function
MockSalesDoc.findOne = vi.fn();
MockSalesDoc.find = vi.fn();
MockSalesDoc.prototype.save = vi.fn().mockResolvedValue({});

describe("Credit Note Number Auto-Generation Bug & Collision Avoidance", () => {
  const orgId = testOrgId;

  beforeEach(() => {
    vi.clearAllMocks();
    MockSalesDoc.mockImplementation(function (this: Record<string, unknown>, data?: Record<string, unknown>) {
      if (data) {
        Object.assign(this, data);
      }
      return this;
    });
  });

  describe("1. Next Available Unique Credit Note Number Resolution", () => {
    it("skips existing CN-00002 and returns CN-00003", () => {
      const existing = new Set(["CN-00001", "CN-00002"]);
      const res = findNextAvailableCreditNoteNumber("CN-", 2, 5, existing);
      expect(res.allocatedNumber).toBe(3);
      expect(res.creditNoteNumber).toBe("CN-00003");
    });

    it("skips existing CN-00002 and CN-00003 to return CN-00004", () => {
      const existing = new Set(["CN-00002", "CN-00003"]);
      const res = findNextAvailableCreditNoteNumber("CN-", 2, 5, existing);
      expect(res.allocatedNumber).toBe(4);
      expect(res.creditNoteNumber).toBe("CN-00004");
    });
  });

  describe("2. peekNextCreditNoteNumber Previews True Available Number", () => {
    it("automatically detects existing CN-00002, previews CN-00003, and synchronizes settings nextNumber", async () => {
      const mockSettings = {
        _id: new Types.ObjectId(),
        organizationId: orgId,
        autoGenerateNumbering: true,
        creditNotePrefix: "CN-",
        nextNumber: 2, // Settings still points to 2
        numberZeroPadding: 5,
        restartNumberingEachFiscalYear: false,
        lastFiscalYear: "2026-27",
      };

      // In the database, CN-00002 already exists!
      const existingDocs = [{ number: "CN-00002" }];

      vi.mocked(CreditNoteSettings.findOne).mockReturnValue(createMockQuery(mockSettings) as never);
      vi.mocked(SalesDocument.find).mockReturnValue(createMockQuery(existingDocs) as never);

      const peek = await peekNextCreditNoteNumber(orgId);

      // Must return CN-00003 without collision
      expect(peek.creditNoteNumber).toBe("CN-00003");
      expect(peek.nextNumber).toBe(3);

      // Syncs settings forward to 3 so future checks don't restart at taken number
      expect(CreditNoteSettings.updateOne).toHaveBeenCalledWith(
        { _id: mockSettings._id },
        { $set: { nextNumber: 3 } },
      );
    });
  });

  describe("3. allocateNextCreditNoteNumber Allocates and Advances Settings", () => {
    it("allocates CN-00003 when CN-00002 exists, and increments nextNumber to 4", async () => {
      const mockSettings = {
        _id: new Types.ObjectId(),
        organizationId: orgId,
        autoGenerateNumbering: true,
        creditNotePrefix: "CN-",
        nextNumber: 2,
        numberZeroPadding: 5,
        restartNumberingEachFiscalYear: false,
        lastFiscalYear: "2026-27",
      };

      const existingDocs = [{ number: "CN-00002" }];

      vi.mocked(CreditNoteSettings.findOne).mockReturnValue(createMockQuery(mockSettings) as never);
      vi.mocked(SalesDocument.find).mockReturnValue(createMockQuery(existingDocs) as never);

      const allocated = await allocateNextCreditNoteNumber(orgId);

      expect(allocated.creditNoteNumber).toBe("CN-00003");
      expect(allocated.allocatedNumber).toBe(3);

      // Settings updated to 4 for the following credit note
      expect(CreditNoteSettings.updateOne).toHaveBeenCalledWith(
        { _id: mockSettings._id },
        { $set: { nextNumber: 4 } },
      );
    });
  });

  describe("4. Preferences API Behavior (GET & PUT)", () => {
    it("returns formattedNextNumber as CN-00003 and both settings and preferences payloads", async () => {
      const { GET } = await import("@/app/api/sales/credit-notes/preferences/route");
      const mockSettings = {
        _id: new Types.ObjectId(),
        organizationId: orgId,
        autoGenerateNumbering: true,
        creditNotePrefix: "CN-",
        nextNumber: 2,
        numberZeroPadding: 5,
        restartNumberingEachFiscalYear: false,
        lastFiscalYear: "2026-27",
      };

      vi.mocked(CreditNoteSettings.findOne).mockReturnValue(createMockQuery(mockSettings) as never);
      vi.mocked(SalesDocument.find).mockReturnValue(createMockQuery([{ number: "CN-00002" }]) as never);

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.formattedNextNumber).toBe("CN-00003");
      expect(data.settings.nextNumber).toBe(3);
      expect(data.preferences.nextNumber).toBe(3);
      expect(data.settings.autoGenerateNumbering).toBe(true);
      expect(data.preferences.autoGenerateNumbering).toBe(true);
    });

    it("PUT /preferences automatically advances nextNumber if entered number collides with existing record", async () => {
      const { PUT } = await import("@/app/api/sales/credit-notes/preferences/route");
      const mockUpdatedSettings = {
        _id: new Types.ObjectId(),
        organizationId: orgId,
        autoGenerateNumbering: true,
        creditNotePrefix: "CN-",
        nextNumber: 3,
        numberZeroPadding: 5,
        restartNumberingEachFiscalYear: false,
        lastFiscalYear: "2026-27",
      };

      // When checking existing notes with prefix CN-
      vi.mocked(SalesDocument.find).mockReturnValue(createMockQuery([{ number: "CN-00002" }]) as never);

      vi.mocked(CreditNoteSettings.findOneAndUpdate).mockReturnValue(createMockQuery(mockUpdatedSettings) as never);

      // User selects "Continue auto-generating credit note numbers" with nextNumber: 2
      const req = new Request("http://localhost/api/sales/credit-notes/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoGenerateNumbering: true,
          prefix: "CN-",
          nextNumber: 2,
          numberZeroPadding: 5,
        }),
      });

      const res = await PUT(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      // Automatically skips CN-00002 and sets 3
      expect(data.formattedNextNumber).toBe("CN-00003");
      expect(data.settings.nextNumber).toBe(3);
      expect(data.preferences.nextNumber).toBe(3);
    });
  });

  describe("5. POST /api/sales/credit-notes Safe Saving & Collision Retry", () => {
    it("automatically allocates next available CN number when submitted number already exists", async () => {
      const { POST } = await import("@/app/api/sales/credit-notes/route");

      const mockSettings = {
        organizationId: orgId,
        autoGenerateNumbering: true,
        creditNotePrefix: "CN-",
        nextNumber: 2,
        numberZeroPadding: 5,
      };

      vi.mocked(CreditNoteSettings.findOne).mockReturnValue(createMockQuery(mockSettings) as never);

      // Customer found
      vi.mocked(Customer.findOne).mockReturnValue(createMockQuery({
        _id: new Types.ObjectId(),
        name: "Test Customer",
      }) as never);

      // Document check: CN-00002 exists!
      vi.mocked(SalesDocument.findOne).mockReturnValue(createMockQuery({ _id: new Types.ObjectId() }) as never);

      // allocateNextCreditNoteNumber queries existing notes
      vi.mocked(SalesDocument.find).mockReturnValue(createMockQuery([{ number: "CN-00002" }]) as never);

      // Mock save prototype
      const saveSpy = vi.spyOn(SalesDocument.prototype, "save").mockResolvedValue({} as never);

      const req = new Request("http://localhost/api/sales/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: new Types.ObjectId().toString(),
          creditNoteNumber: "CN-00002", // Stale or existing number submitted
          autoGenerateNumbering: true,
          items: [{ name: "Item A", quantity: 1, rate: 100 }],
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      // Auto-generated CN-00003 instead of throwing 409 error!
      expect(data.creditNote.number).toBe("CN-00003");
      expect(saveSpy).toHaveBeenCalled();
    });

    it("retries allocation on duplicate-key (E11000) race conditions and saves successfully", async () => {
      const { POST } = await import("@/app/api/sales/credit-notes/route");

      const mockSettings = {
        organizationId: orgId,
        autoGenerateNumbering: true,
        creditNotePrefix: "CN-",
        nextNumber: 3,
        numberZeroPadding: 5,
      };

      vi.mocked(CreditNoteSettings.findOne).mockReturnValue(createMockQuery(mockSettings) as never);

      vi.mocked(Customer.findOne).mockReturnValue(createMockQuery({
        _id: new Types.ObjectId(),
        name: "Test Customer",
      }) as never);

      // Initially, CN-00003 doesn't exist on preliminary check
      vi.mocked(SalesDocument.findOne).mockReturnValue(createMockQuery(null) as never);

      // First query for existing notes has CN-00002
      let findCallCount = 0;
      vi.mocked(SalesDocument.find).mockImplementation(() => {
        findCallCount++;
        return createMockQuery(
          findCallCount === 1
            ? [{ number: "CN-00002" }]
            : [{ number: "CN-00002" }, { number: "CN-00003" }],
        ) as never;
      });

      // First save attempt throws E11000 duplicate key error, second attempt succeeds
      let saveAttempt = 0;
      vi.spyOn(SalesDocument.prototype, "save").mockImplementation(async function (this: Record<string, unknown>) {
        saveAttempt++;
        if (saveAttempt === 1) {
          const err = new Error("E11000 duplicate key error collection") as Error & { code?: number };
          err.code = 11000;
          throw err;
        }
        return this as never;
      });

      const req = new Request("http://localhost/api/sales/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: new Types.ObjectId().toString(),
          creditNoteNumber: "CN-00003",
          autoGenerateNumbering: true,
          items: [{ name: "Item A", quantity: 1, rate: 100 }],
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      // Retried and allocated CN-00004!
      expect(data.creditNote.number).toBe("CN-00004");
    });
  });
});
