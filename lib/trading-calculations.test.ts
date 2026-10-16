import { describe, expect, it } from "vitest";
import {
  availableStock,
  calculateCommission,
  invoiceOutstanding,
  paymentAllocationTotal,
  stockLotStatus,
} from "./trading-calculations";

describe("trading calculations", () => {
  it("calculates commission to currency precision", () => {
    expect(calculateCommission(1250, 2.5)).toBe(31.25);
    expect(calculateCommission(100, 0)).toBe(0);
  });

  it("keeps reserved and damaged stock out of available quantity", () => {
    expect(availableStock(100, 25)).toBe(75);
    expect(stockLotStatus(100, 25, 0)).toBe("Partially Reserved");
    expect(stockLotStatus(0, 0, 10)).toBe("Damaged");
    expect(stockLotStatus(0, 0, 0)).toBe("Exhausted");
    expect(() => availableStock(10, 11)).toThrow(RangeError);
  });

  it("prevents negative invoice balances after receipts and credits", () => {
    expect(invoiceOutstanding(1000, 300, 150)).toBe(550);
    expect(invoiceOutstanding(1000, 900, 200)).toBe(0);
  });

  it("allows unapplied payment advances but rejects allocations above receipt", () => {
    expect(paymentAllocationTotal(1000, [250, 300])).toBe(550);
    expect(() => paymentAllocationTotal(500, [250, 300])).toThrow(RangeError);
  });

  it("rejects invalid financial and stock quantities", () => {
    expect(() => calculateCommission(-1, 1)).toThrow(RangeError);
    expect(() => availableStock(10, -1)).toThrow(RangeError);
    expect(() => invoiceOutstanding(10, Number.NaN, 0)).toThrow(RangeError);
  });
});
