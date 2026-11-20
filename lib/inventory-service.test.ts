import { describe, expect, it } from "vitest";
import { aggregateInventoryItems } from "@/lib/inventory-service";

describe("aggregateInventoryItems", () => {
  it("combines repeated bill lines for the same commodity without losing quantity or value", () => {
    const result = aggregateInventoryItems([
      { commodityId: "000000000000000000000001", quantity: 3, rate: 10, unit: "Bag", name: "Rice" },
      { commodityId: "000000000000000000000001", quantity: 2, rate: 15, unit: "Bag", name: "Rice" },
      { commodityId: "000000000000000000000002", quantity: 1, rate: 20, unit: "Bag", name: "Wheat" },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      commodityId: "000000000000000000000001",
      quantity: 5,
      rate: 12,
      unit: "Bag",
      name: "Rice",
    });
    expect(result[1]).toMatchObject({
      commodityId: "000000000000000000000002",
      quantity: 1,
      rate: 20,
    });
  });

  it("ignores lines that cannot produce an inventory movement", () => {
    expect(
      aggregateInventoryItems([
        { commodityId: "", quantity: 3, rate: 10 },
        { commodityId: "not-an-id", quantity: 2, rate: 15 },
        { commodityId: "000000000000000000000001", quantity: 0, rate: 20 },
      ]),
    ).toEqual([]);
  });
});
