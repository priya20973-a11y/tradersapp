import { describe, expect, it } from "vitest";
import { Types } from "mongoose";

type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableObject
  | SerializableValue[];
type SerializableObject = { [key: string]: SerializableValue };

describe("Purchase Order Plain Object Serialization for Client Components", () => {
  it("converts BSON ObjectId and Date instances to plain serializable values with no toJSON methods", () => {
    const mockMongooseLeanDoc = {
      _id: new Types.ObjectId("672c841123456789abcdef01"),
      organizationId: new Types.ObjectId("672c841123456789abcdef02"),
      purchaseOrderNumber: "PO-2026-0001",
      referenceNumber: "REF-101",
      vendorId: new Types.ObjectId("672c841123456789abcdef03"),
      vendorName: "Mohan Traders",
      vendorDetails: {
        companyName: "Mohan Traders Pvt Ltd",
        email: "mohan@traders.in",
        phone: "+91 98201 44521",
      },
      orderDate: new Date("2026-10-22T00:00:00.000Z"),
      deliveryDate: new Date("2026-10-29T00:00:00.000Z"),
      paymentTerms: "Net 30",
      items: [
        {
          _id: new Types.ObjectId("672c841123456789abcdef04"),
          itemId: new Types.ObjectId("672c841123456789abcdef05"),
          name: "Milling Wheat",
          quantity: 100,
          rate: 2500,
          amount: 250000,
        },
      ],
      total: 250000,
      createdAt: new Date("2026-10-22T10:00:00.000Z"),
      updatedAt: new Date("2026-10-22T10:00:00.000Z"),
    };

    // Before conversion, organizationId is a BSON ObjectId with toJSON method
    expect(typeof mockMongooseLeanDoc.organizationId.toJSON).toBe("function");

    // Perform plain object serialization
    const plainDoc = JSON.parse(JSON.stringify(mockMongooseLeanDoc)) as SerializableObject;
    const poData: SerializableObject = {
      ...plainDoc,
      id: String(plainDoc._id || plainDoc.purchaseOrderNumber),
      _id: String(plainDoc._id || plainDoc.purchaseOrderNumber),
      organizationId: plainDoc.organizationId ? String(plainDoc.organizationId) : "",
    };

    // After conversion, all properties are plain primitives / objects
    expect(typeof poData.organizationId).toBe("string");
    expect(poData.organizationId).toBe("672c841123456789abcdef02");

    expect(typeof poData.vendorId).toBe("string");
    expect(poData.vendorId).toBe("672c841123456789abcdef03");

    expect(typeof poData.orderDate).toBe("string");
    expect(poData.orderDate).toBe("2026-10-22T00:00:00.000Z");

    const items = poData.items;
    if (!Array.isArray(items) || !items[0] || typeof items[0] !== "object") {
      throw new Error("Serialized purchase order has no items.");
    }
    const firstItem = items[0] as SerializableObject;
    expect(typeof firstItem._id).toBe("string");
    expect(typeof firstItem.itemId).toBe("string");

    // Verify object passes React Server Component serialization criteria
    const hasToJSONMethod = (obj: unknown): boolean => {
      if (!obj || typeof obj !== "object") return false;
      if (typeof (obj as { toJSON?: unknown }).toJSON === "function") return true;
      return Object.values(obj).some(hasToJSONMethod);
    };

    expect(hasToJSONMethod(poData)).toBe(false);
  });
});
