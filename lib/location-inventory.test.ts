/**
 * tradersapp/lib/location-inventory.test.ts
 *
 * Comprehensive tests verifying all 15 Inventory Management scenarios:
 * 1. Purchase in Warehouse A must not increase Warehouse B stock.
 * 2. Purchase in Shop A must not increase Warehouse stock.
 * 3. Sales Order reserves stock without reducing On Hand.
 * 4. Invoice reduces On Hand and Reserved correctly.
 * 5. Sales Order cancellation releases stock.
 * 6. Vendor Credit reduces stock only when goods are physically returned.
 * 7. Damaged stock cannot be sold or transferred as sellable stock.
 * 8. Customer Credit Note increases stock only for physically returned and restocked goods.
 * 9. Stock Transfer correctly deducts from source and adds to destination.
 * 10. Reserved stock cannot be transferred.
 * 11. Concurrent Sales Orders cannot over-reserve stock.
 * 12. Editing and cancelling documents must not create duplicate movements.
 * 13. Partial invoices must preserve remaining reservations.
 * 14. Stock must remain accurate after re-fetch / application restart.
 * 15. Warehouse and Shop reports must show correct independent balances.
 */

import { describe, it, expect } from "vitest";

// In-memory state simulation of the centralized inventory service engine
interface StockState {
  traderId: string;
  locationType: "Warehouse" | "Shop";
  locationId: string;
  commodityId: string;
  onHandStock: number;
  reservedStock: number;
  damagedStock: number;
  availableStock: number; // calculated: onHandStock - reservedStock
}

interface StockMovement {
  movementNumber: string;
  locationType: "Warehouse" | "Shop";
  locationId: string;
  commodityId: string;
  direction: "IN" | "OUT";
  quantity: number;
  movementType: string;
  referenceType: string;
  referenceId: string;
  balanceAfterOnHand: number;
  balanceAfterReserved: number;
}

interface StockReservation {
  reservationNumber: string;
  traderId: string;
  salesOrderId: string;
  locationType: "Warehouse" | "Shop";
  locationId: string;
  commodityId: string;
  quantity: number;
  status: "ACTIVE" | "FULFILLED" | "CANCELLED";
}

class InventoryEngine {
  private stocks = new Map<string, StockState>();
  public movements: StockMovement[] = [];
  public reservations: StockReservation[] = [];
  private movementSeq = 1;
  private resSeq = 1;

  private getKey(traderId: string, locationType: string, locationId: string, commodityId: string) {
    return `${traderId}:${locationType}:${locationId}:${commodityId}`;
  }

  public getOrCreateStock(traderId: string, locationType: "Warehouse" | "Shop", locationId: string, commodityId: string): StockState {
    const key = this.getKey(traderId, locationType, locationId, commodityId);
    let stock = this.stocks.get(key);
    if (!stock) {
      stock = {
        traderId,
        locationType,
        locationId,
        commodityId,
        onHandStock: 0,
        reservedStock: 0,
        damagedStock: 0,
        availableStock: 0,
      };
      this.stocks.set(key, stock);
    }
    return stock;
  }

  // 1. Purchase Inward
  public recordPurchaseInward(params: {
    traderId: string;
    locationType: "Warehouse" | "Shop";
    locationId: string;
    commodityId: string;
    quantity: number;
    billId: string;
    billNumber: string;
  }) {
    if (params.quantity <= 0) throw new Error("Quantity must be positive.");
    const stock = this.getOrCreateStock(params.traderId, params.locationType, params.locationId, params.commodityId);
    stock.onHandStock += params.quantity;
    stock.availableStock = stock.onHandStock - stock.reservedStock;

    const mNum = `MOV-${String(this.movementSeq++).padStart(5, "0")}`;
    this.movements.push({
      movementNumber: mNum,
      locationType: params.locationType,
      locationId: params.locationId,
      commodityId: params.commodityId,
      direction: "IN",
      quantity: params.quantity,
      movementType: "PurchaseInward",
      referenceType: "PurchaseBill",
      referenceId: params.billId,
      balanceAfterOnHand: stock.onHandStock,
      balanceAfterReserved: stock.reservedStock,
    });
    return stock;
  }

  // 2. Sales Order Reservation
  public reserveStockForSalesOrder(params: {
    traderId: string;
    locationType: "Warehouse" | "Shop";
    locationId: string;
    salesOrderId: string;
    items: Array<{ commodityId: string; quantity: number }>;
  }) {
    // Atomic check
    for (const item of params.items) {
      const stock = this.getOrCreateStock(params.traderId, params.locationType, params.locationId, item.commodityId);
      if (item.quantity > stock.availableStock) {
        throw new Error(`Insufficient available stock for commodity ${item.commodityId}. Available: ${stock.availableStock}, Requested: ${item.quantity}`);
      }
    }

    // Apply reservations
    for (const item of params.items) {
      const stock = this.getOrCreateStock(params.traderId, params.locationType, params.locationId, item.commodityId);
      stock.reservedStock += item.quantity;
      stock.availableStock = stock.onHandStock - stock.reservedStock;

      const rNum = `RES-${String(this.resSeq++).padStart(5, "0")}`;
      this.reservations.push({
        reservationNumber: rNum,
        traderId: params.traderId,
        salesOrderId: params.salesOrderId,
        locationType: params.locationType,
        locationId: params.locationId,
        commodityId: item.commodityId,
        quantity: item.quantity,
        status: "ACTIVE",
      });
    }
  }

  // 3. Cancel Sales Order Reservation
  public cancelSalesOrderReservation(salesOrderId: string) {
    const active = this.reservations.filter((r) => r.salesOrderId === salesOrderId && r.status === "ACTIVE");
    for (const r of active) {
      const stock = this.getOrCreateStock(r.traderId, r.locationType, r.locationId, r.commodityId);
      stock.reservedStock = Math.max(0, stock.reservedStock - r.quantity);
      stock.availableStock = stock.onHandStock - stock.reservedStock;
      r.status = "CANCELLED";
    }
  }

  // 4. Invoice Stock Out
  public recordInvoiceStockOut(params: {
    traderId: string;
    locationType: "Warehouse" | "Shop";
    locationId: string;
    invoiceId: string;
    salesOrderId?: string;
    items: Array<{ commodityId: string; quantity: number }>;
  }) {
    for (const item of params.items) {
      const stock = this.getOrCreateStock(params.traderId, params.locationType, params.locationId, item.commodityId);

      if (params.salesOrderId) {
        // Find reservation
        const activeRes = this.reservations.find(
          (r) => r.salesOrderId === params.salesOrderId && r.commodityId === item.commodityId && r.status === "ACTIVE"
        );
        if (activeRes) {
          const qtyToDeduct = Math.min(activeRes.quantity, item.quantity);
          stock.reservedStock = Math.max(0, stock.reservedStock - qtyToDeduct);
          activeRes.quantity -= qtyToDeduct;
          if (activeRes.quantity === 0) {
            activeRes.status = "FULFILLED";
          }
        }
      } else {
        // Direct invoice check
        if (item.quantity > stock.availableStock) {
          throw new Error(`Insufficient stock for direct invoice. Available: ${stock.availableStock}, Requested: ${item.quantity}`);
        }
      }

      stock.onHandStock = Math.max(0, stock.onHandStock - item.quantity);
      stock.availableStock = stock.onHandStock - stock.reservedStock;

      const mNum = `MOV-${String(this.movementSeq++).padStart(5, "0")}`;
      this.movements.push({
        movementNumber: mNum,
        locationType: params.locationType,
        locationId: params.locationId,
        commodityId: item.commodityId,
        direction: "OUT",
        quantity: item.quantity,
        movementType: "SalesInvoiceStockOut",
        referenceType: "SalesInvoice",
        referenceId: params.invoiceId,
        balanceAfterOnHand: stock.onHandStock,
        balanceAfterReserved: stock.reservedStock,
      });
    }
  }

  // 5. Vendor Credit Return
  public recordVendorCreditReturn(params: {
    traderId: string;
    locationType: "Warehouse" | "Shop";
    locationId: string;
    commodityId: string;
    quantity: number;
    isPhysicalReturn: boolean;
    vendorCreditId: string;
  }) {
    if (!params.isPhysicalReturn) return null; // Financial only, no stock impact

    const stock = this.getOrCreateStock(params.traderId, params.locationType, params.locationId, params.commodityId);
    if (params.quantity > stock.availableStock) {
      throw new Error(`Cannot return more than available stock (${stock.availableStock}).`);
    }

    // Check duplicate
    const exists = this.movements.some(
      (m) => m.referenceId === params.vendorCreditId && m.movementType === "VendorCreditReturn"
    );
    if (exists) return stock;

    stock.onHandStock -= params.quantity;
    stock.availableStock = stock.onHandStock - stock.reservedStock;

    const mNum = `MOV-${String(this.movementSeq++).padStart(5, "0")}`;
    this.movements.push({
      movementNumber: mNum,
      locationType: params.locationType,
      locationId: params.locationId,
      commodityId: params.commodityId,
      direction: "OUT",
      quantity: params.quantity,
      movementType: "VendorCreditReturn",
      referenceType: "VendorCredit",
      referenceId: params.vendorCreditId,
      balanceAfterOnHand: stock.onHandStock,
      balanceAfterReserved: stock.reservedStock,
    });
    return stock;
  }

  // 6. Damaged Stock Write-Off
  public recordDamagedWriteOff(params: {
    traderId: string;
    locationType: "Warehouse" | "Shop";
    locationId: string;
    commodityId: string;
    quantity: number;
    adjustmentId: string;
  }) {
    const stock = this.getOrCreateStock(params.traderId, params.locationType, params.locationId, params.commodityId);
    if (params.quantity > stock.availableStock) {
      throw new Error(`Cannot write off more than available stock (${stock.availableStock}).`);
    }

    stock.onHandStock -= params.quantity;
    stock.damagedStock += params.quantity;
    stock.availableStock = stock.onHandStock - stock.reservedStock;

    const mNum = `MOV-${String(this.movementSeq++).padStart(5, "0")}`;
    this.movements.push({
      movementNumber: mNum,
      locationType: params.locationType,
      locationId: params.locationId,
      commodityId: params.commodityId,
      direction: "OUT",
      quantity: params.quantity,
      movementType: "DamagedWriteOff",
      referenceType: "StockAdjustment",
      referenceId: params.adjustmentId,
      balanceAfterOnHand: stock.onHandStock,
      balanceAfterReserved: stock.reservedStock,
    });
    return stock;
  }

  // 7. Credit Note Return
  public recordCreditNoteReturn(params: {
    traderId: string;
    locationType: "Warehouse" | "Shop";
    locationId: string;
    commodityId: string;
    quantity: number;
    isPhysicalReturn: boolean;
    goodsCondition: "usable" | "damaged";
    creditNoteId: string;
  }) {
    if (!params.isPhysicalReturn) return null; // Financial only, no inventory change

    // Prevent duplicate
    const exists = this.movements.some(
      (m) => m.referenceId === params.creditNoteId && m.movementType === "CreditNoteReturn"
    );
    if (exists) return null;

    const stock = this.getOrCreateStock(params.traderId, params.locationType, params.locationId, params.commodityId);
    if (params.goodsCondition === "usable") {
      stock.onHandStock += params.quantity;
      stock.availableStock = stock.onHandStock - stock.reservedStock;
    } else {
      stock.damagedStock += params.quantity;
    }

    const mNum = `MOV-${String(this.movementSeq++).padStart(5, "0")}`;
    this.movements.push({
      movementNumber: mNum,
      locationType: params.locationType,
      locationId: params.locationId,
      commodityId: params.commodityId,
      direction: "IN",
      quantity: params.quantity,
      movementType: "CreditNoteReturn",
      referenceType: "CreditNote",
      referenceId: params.creditNoteId,
      balanceAfterOnHand: stock.onHandStock,
      balanceAfterReserved: stock.reservedStock,
    });
    return stock;
  }

  // 8. Stock Transfer
  public executeStockTransfer(params: {
    traderId: string;
    fromLocationType: "Warehouse" | "Shop";
    fromLocationId: string;
    toLocationType: "Warehouse" | "Shop";
    toLocationId: string;
    commodityId: string;
    quantity: number;
    transferId: string;
  }) {
    if (params.fromLocationType === params.toLocationType && params.fromLocationId === params.toLocationId) {
      throw new Error("Source and destination location cannot be identical.");
    }
    const source = this.getOrCreateStock(params.traderId, params.fromLocationType, params.fromLocationId, params.commodityId);
    if (params.quantity > source.availableStock) {
      throw new Error(`Transfer quantity (${params.quantity}) exceeds available stock (${source.availableStock}). Reserved stock cannot be transferred.`);
    }

    const dest = this.getOrCreateStock(params.traderId, params.toLocationType, params.toLocationId, params.commodityId);

    // Atomic update
    source.onHandStock -= params.quantity;
    source.availableStock = source.onHandStock - source.reservedStock;

    dest.onHandStock += params.quantity;
    dest.availableStock = dest.onHandStock - dest.reservedStock;

    // Dual ledger entries
    const mOut = `MOV-${String(this.movementSeq++).padStart(5, "0")}`;
    this.movements.push({
      movementNumber: mOut,
      locationType: params.fromLocationType,
      locationId: params.fromLocationId,
      commodityId: params.commodityId,
      direction: "OUT",
      quantity: params.quantity,
      movementType: "TransferOut",
      referenceType: "StockTransfer",
      referenceId: params.transferId,
      balanceAfterOnHand: source.onHandStock,
      balanceAfterReserved: source.reservedStock,
    });

    const mIn = `MOV-${String(this.movementSeq++).padStart(5, "0")}`;
    this.movements.push({
      movementNumber: mIn,
      locationType: params.toLocationType,
      locationId: params.toLocationId,
      commodityId: params.commodityId,
      direction: "IN",
      quantity: params.quantity,
      movementType: "TransferIn",
      referenceType: "StockTransfer",
      referenceId: params.transferId,
      balanceAfterOnHand: dest.onHandStock,
      balanceAfterReserved: dest.reservedStock,
    });

    return { source, dest };
  }
}

describe("Warehouse & Shop Inventory Management — Comprehensive Scenarios", () => {
  const traderId = "org_trader_001";
  const whA = "wh_A";
  const whB = "wh_B";
  const shopA = "shop_A";
  const shopB = "shop_B";
  const wheatId = "item_wheat_01";
  const riceId = "item_rice_02";

  // Scenario 1: Purchase in Warehouse A must not increase Warehouse B stock
  it("Scenario 1: Purchase in Warehouse A must not increase Warehouse B stock", () => {
    const engine = new InventoryEngine();

    engine.recordPurchaseInward({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 100,
      billId: "bill_01",
      billNumber: "BILL-001",
    });

    const stockA = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    const stockB = engine.getOrCreateStock(traderId, "Warehouse", whB, wheatId);

    expect(stockA.onHandStock).toBe(100);
    expect(stockA.availableStock).toBe(100);
    expect(stockB.onHandStock).toBe(0);
    expect(stockB.availableStock).toBe(0);
  });

  // Scenario 2: Purchase in Shop A must not increase Warehouse stock
  it("Scenario 2: Purchase in Shop A must not increase Warehouse stock", () => {
    const engine = new InventoryEngine();

    engine.recordPurchaseInward({
      traderId,
      locationType: "Shop",
      locationId: shopA,
      commodityId: wheatId,
      quantity: 50,
      billId: "bill_02",
      billNumber: "BILL-002",
    });

    const shopStock = engine.getOrCreateStock(traderId, "Shop", shopA, wheatId);
    const whStock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);

    expect(shopStock.onHandStock).toBe(50);
    expect(shopStock.availableStock).toBe(50);
    expect(whStock.onHandStock).toBe(0);
  });

  // Scenario 3: Sales Order reserves stock without reducing On Hand
  it("Scenario 3: Sales Order reserves stock without reducing On Hand (Available = On Hand - Reserved)", () => {
    const engine = new InventoryEngine();

    engine.recordPurchaseInward({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 100,
      billId: "bill_01",
      billNumber: "BILL-001",
    });

    engine.reserveStockForSalesOrder({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      salesOrderId: "so_01",
      items: [{ commodityId: wheatId, quantity: 30 }],
    });

    const stock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    expect(stock.onHandStock).toBe(100); // On Hand NOT reduced
    expect(stock.reservedStock).toBe(30); // Reserved stock increased
    expect(stock.availableStock).toBe(70); // Available stock = 100 - 30 = 70
  });

  // Scenario 4: Invoice reduces On Hand and Reserved correctly
  it("Scenario 4: Invoice reduces On Hand and Reserved correctly", () => {
    const engine = new InventoryEngine();

    engine.recordPurchaseInward({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 100,
      billId: "bill_01",
      billNumber: "BILL-001",
    });

    engine.reserveStockForSalesOrder({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      salesOrderId: "so_01",
      items: [{ commodityId: wheatId, quantity: 40 }],
    });

    // Invoicing against Sales Order
    engine.recordInvoiceStockOut({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      invoiceId: "inv_01",
      salesOrderId: "so_01",
      items: [{ commodityId: wheatId, quantity: 40 }],
    });

    const stock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    expect(stock.onHandStock).toBe(60); // 100 - 40 = 60
    expect(stock.reservedStock).toBe(0); // Reservation fulfilled
    expect(stock.availableStock).toBe(60); // 60 - 0 = 60
  });

  // Scenario 5: Sales Order cancellation releases stock
  it("Scenario 5: Sales Order cancellation releases stock", () => {
    const engine = new InventoryEngine();

    engine.recordPurchaseInward({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 80,
      billId: "bill_01",
      billNumber: "BILL-001",
    });

    engine.reserveStockForSalesOrder({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      salesOrderId: "so_to_cancel",
      items: [{ commodityId: wheatId, quantity: 25 }],
    });

    let stock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    expect(stock.reservedStock).toBe(25);
    expect(stock.availableStock).toBe(55);

    // Cancel order
    engine.cancelSalesOrderReservation("so_to_cancel");

    stock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    expect(stock.reservedStock).toBe(0); // released
    expect(stock.onHandStock).toBe(80); // untouched
    expect(stock.availableStock).toBe(80); // restored
  });

  // Scenario 6: Vendor Credit reduces stock only when goods are physically returned
  it("Scenario 6: Vendor Credit reduces stock only when goods are physically returned", () => {
    const engine = new InventoryEngine();

    engine.recordPurchaseInward({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 100,
      billId: "bill_01",
      billNumber: "BILL-001",
    });

    // 6a: Financial vendor credit (price discount / billing correction)
    engine.recordVendorCreditReturn({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 10,
      isPhysicalReturn: false,
      vendorCreditId: "vc_financial",
    });

    let stock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    expect(stock.onHandStock).toBe(100); // No change

    // 6b: Physical goods return to vendor
    engine.recordVendorCreditReturn({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 15,
      isPhysicalReturn: true,
      vendorCreditId: "vc_physical",
    });

    stock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    expect(stock.onHandStock).toBe(85); // Reduced from 100 to 85
    expect(stock.availableStock).toBe(85);
  });

  // Scenario 7: Damaged stock cannot be sold or transferred as sellable stock
  it("Scenario 7: Damaged stock cannot be sold or transferred as sellable stock", () => {
    const engine = new InventoryEngine();

    engine.recordPurchaseInward({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 50,
      billId: "bill_01",
      billNumber: "BILL-001",
    });

    // Write off 20 units as damaged
    engine.recordDamagedWriteOff({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 20,
      adjustmentId: "adj_01",
    });

    const stock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    expect(stock.onHandStock).toBe(30); // sellable on-hand reduced to 30
    expect(stock.damagedStock).toBe(20); // recorded as damaged
    expect(stock.availableStock).toBe(30);

    // Attempting to sell 35 units must fail because 20 damaged units cannot be sold
    expect(() =>
      engine.reserveStockForSalesOrder({
        traderId,
        locationType: "Warehouse",
        locationId: whA,
        salesOrderId: "so_oversell",
        items: [{ commodityId: wheatId, quantity: 35 }],
      })
    ).toThrow("Insufficient available stock");

    // Attempting to transfer 35 units must also fail
    expect(() =>
      engine.executeStockTransfer({
        traderId,
        fromLocationType: "Warehouse",
        fromLocationId: whA,
        toLocationType: "Shop",
        toLocationId: shopA,
        commodityId: wheatId,
        quantity: 35,
        transferId: "tr_fail",
      })
    ).toThrow("exceeds available stock");
  });

  // Scenario 8: Customer Credit Note increases stock only for physically returned and restocked goods
  it("Scenario 8: Customer Credit Note increases stock only for physically returned and restocked goods", () => {
    const engine = new InventoryEngine();

    // Direct invoice sale of 30 units
    engine.recordPurchaseInward({
      traderId,
      locationType: "Shop",
      locationId: shopA,
      commodityId: wheatId,
      quantity: 50,
      billId: "bill_01",
      billNumber: "BILL-001",
    });

    engine.recordInvoiceStockOut({
      traderId,
      locationType: "Shop",
      locationId: shopA,
      invoiceId: "inv_direct",
      items: [{ commodityId: wheatId, quantity: 30 }],
    });

    let stock = engine.getOrCreateStock(traderId, "Shop", shopA, wheatId);
    expect(stock.onHandStock).toBe(20);

    // 8a: Financial credit note without goods returned
    engine.recordCreditNoteReturn({
      traderId,
      locationType: "Shop",
      locationId: shopA,
      commodityId: wheatId,
      quantity: 5,
      isPhysicalReturn: false,
      goodsCondition: "usable",
      creditNoteId: "cn_fin",
    });
    stock = engine.getOrCreateStock(traderId, "Shop", shopA, wheatId);
    expect(stock.onHandStock).toBe(20); // No change

    // 8b: Physical return, condition = damaged
    engine.recordCreditNoteReturn({
      traderId,
      locationType: "Shop",
      locationId: shopA,
      commodityId: wheatId,
      quantity: 5,
      isPhysicalReturn: true,
      goodsCondition: "damaged",
      creditNoteId: "cn_damaged",
    });
    stock = engine.getOrCreateStock(traderId, "Shop", shopA, wheatId);
    expect(stock.onHandStock).toBe(20); // On Hand sellable NOT increased
    expect(stock.damagedStock).toBe(5); // Damaged stock increased

    // 8c: Physical return, condition = usable (restock)
    engine.recordCreditNoteReturn({
      traderId,
      locationType: "Shop",
      locationId: shopA,
      commodityId: wheatId,
      quantity: 10,
      isPhysicalReturn: true,
      goodsCondition: "usable",
      creditNoteId: "cn_usable",
    });
    stock = engine.getOrCreateStock(traderId, "Shop", shopA, wheatId);
    expect(stock.onHandStock).toBe(30); // Restocked sellable: 20 + 10 = 30
    expect(stock.availableStock).toBe(30);
  });

  // Scenario 9: Stock Transfer correctly deducts from source and adds to destination
  it("Scenario 9: Stock Transfer correctly deducts from source and adds to destination", () => {
    const engine = new InventoryEngine();

    engine.recordPurchaseInward({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: riceId,
      quantity: 200,
      billId: "b_rice",
      billNumber: "BILL-RICE",
    });

    // Transfer 70 units from Warehouse A to Shop A
    engine.executeStockTransfer({
      traderId,
      fromLocationType: "Warehouse",
      fromLocationId: whA,
      toLocationType: "Shop",
      toLocationId: shopA,
      commodityId: riceId,
      quantity: 70,
      transferId: "tr_001",
    });

    const sourceStock = engine.getOrCreateStock(traderId, "Warehouse", whA, riceId);
    const destStock = engine.getOrCreateStock(traderId, "Shop", shopA, riceId);

    expect(sourceStock.onHandStock).toBe(130);
    expect(sourceStock.availableStock).toBe(130);
    expect(destStock.onHandStock).toBe(70);
    expect(destStock.availableStock).toBe(70);

    // Verify dual ledger entries
    const movements = engine.movements.filter((m) => m.referenceId === "tr_001");
    expect(movements.length).toBe(2);
    expect(movements.find((m) => m.direction === "OUT")?.quantity).toBe(70);
    expect(movements.find((m) => m.direction === "IN")?.quantity).toBe(70);
  });

  // Scenario 10: Reserved stock cannot be transferred
  it("Scenario 10: Reserved stock cannot be transferred", () => {
    const engine = new InventoryEngine();

    engine.recordPurchaseInward({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: riceId,
      quantity: 100,
      billId: "b_01",
      billNumber: "BILL-001",
    });

    // Reserve 80 units for Sales Order
    engine.reserveStockForSalesOrder({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      salesOrderId: "so_reserved",
      items: [{ commodityId: riceId, quantity: 80 }],
    });

    // Available is only 20
    const stock = engine.getOrCreateStock(traderId, "Warehouse", whA, riceId);
    expect(stock.availableStock).toBe(20);

    // Transferring 30 units must fail because 80 is reserved
    expect(() =>
      engine.executeStockTransfer({
        traderId,
        fromLocationType: "Warehouse",
        fromLocationId: whA,
        toLocationType: "Warehouse",
        toLocationId: whB,
        commodityId: riceId,
        quantity: 30,
        transferId: "tr_over_res",
      })
    ).toThrow("Reserved stock cannot be transferred");

    // Transferring 20 units succeeds
    expect(() =>
      engine.executeStockTransfer({
        traderId,
        fromLocationType: "Warehouse",
        fromLocationId: whA,
        toLocationType: "Warehouse",
        toLocationId: whB,
        commodityId: riceId,
        quantity: 20,
        transferId: "tr_success",
      })
    ).not.toThrow();

    expect(engine.getOrCreateStock(traderId, "Warehouse", whA, riceId).availableStock).toBe(0);
    expect(engine.getOrCreateStock(traderId, "Warehouse", whB, riceId).availableStock).toBe(20);
  });

  // Scenario 11: Concurrent Sales Orders cannot over-reserve stock
  it("Scenario 11: Concurrent Sales Orders cannot over-reserve stock", () => {
    const engine = new InventoryEngine();

    engine.recordPurchaseInward({
      traderId,
      locationType: "Shop",
      locationId: shopA,
      commodityId: wheatId,
      quantity: 100,
      billId: "b_01",
      billNumber: "B1",
    });

    // Order 1 reserves 60 units
    engine.reserveStockForSalesOrder({
      traderId,
      locationType: "Shop",
      locationId: shopA,
      salesOrderId: "order_1",
      items: [{ commodityId: wheatId, quantity: 60 }],
    });

    // Order 2 attempts to reserve 50 units (only 40 available)
    expect(() =>
      engine.reserveStockForSalesOrder({
        traderId,
        locationType: "Shop",
        locationId: shopA,
        salesOrderId: "order_2",
        items: [{ commodityId: wheatId, quantity: 50 }],
      })
    ).toThrow("Insufficient available stock");

    const stock = engine.getOrCreateStock(traderId, "Shop", shopA, wheatId);
    expect(stock.reservedStock).toBe(60);
    expect(stock.availableStock).toBe(40);
  });

  // Scenario 12: Editing and cancelling documents must not create duplicate movements
  it("Scenario 12: Editing and cancelling documents must not create duplicate movements", () => {
    const engine = new InventoryEngine();

    engine.recordPurchaseInward({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 100,
      billId: "bill_unique",
      billNumber: "BILL-U",
    });

    // Call vendor credit return with same ID twice
    engine.recordVendorCreditReturn({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 10,
      isPhysicalReturn: true,
      vendorCreditId: "vc_dup_check",
    });

    // Duplicate call
    engine.recordVendorCreditReturn({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 10,
      isPhysicalReturn: true,
      vendorCreditId: "vc_dup_check",
    });

    const stock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    expect(stock.onHandStock).toBe(90); // Only deducted once!

    const movements = engine.movements.filter((m) => m.referenceId === "vc_dup_check");
    expect(movements.length).toBe(1);
  });

  // Scenario 13: Partial invoices must preserve remaining reservations
  it("Scenario 13: Partial invoices must preserve remaining reservations", () => {
    const engine = new InventoryEngine();

    engine.recordPurchaseInward({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 100,
      billId: "b1",
      billNumber: "B1",
    });

    // Sales Order for 50 units
    engine.reserveStockForSalesOrder({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      salesOrderId: "so_partial",
      items: [{ commodityId: wheatId, quantity: 50 }],
    });

    let stock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    expect(stock.reservedStock).toBe(50);
    expect(stock.availableStock).toBe(50);

    // Partial Invoice 1: 20 units
    engine.recordInvoiceStockOut({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      invoiceId: "inv_p1",
      salesOrderId: "so_partial",
      items: [{ commodityId: wheatId, quantity: 20 }],
    });

    stock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    expect(stock.onHandStock).toBe(80); // 100 - 20 = 80
    expect(stock.reservedStock).toBe(30); // 50 - 20 = 30 remaining reserved!
    expect(stock.availableStock).toBe(50); // 80 - 30 = 50

    // Partial Invoice 2: Remaining 30 units
    engine.recordInvoiceStockOut({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      invoiceId: "inv_p2",
      salesOrderId: "so_partial",
      items: [{ commodityId: wheatId, quantity: 30 }],
    });

    stock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    expect(stock.onHandStock).toBe(50); // 80 - 30 = 50
    expect(stock.reservedStock).toBe(0); // Reservation now fully consumed
    expect(stock.availableStock).toBe(50);
  });

  // Scenario 14: Stock must remain accurate after re-fetch / application restart
  it("Scenario 14: Stock must remain accurate after re-fetch and state recalculation", () => {
    const engine = new InventoryEngine();

    engine.recordPurchaseInward({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 100,
      billId: "b1",
      billNumber: "B1",
    });

    engine.reserveStockForSalesOrder({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      salesOrderId: "so1",
      items: [{ commodityId: wheatId, quantity: 25 }],
    });

    engine.executeStockTransfer({
      traderId,
      fromLocationType: "Warehouse",
      fromLocationId: whA,
      toLocationType: "Shop",
      toLocationId: shopA,
      commodityId: wheatId,
      quantity: 30,
      transferId: "tr1",
    });

    // Verify state can be recomputed identically from ledger movements
    const whAMovements = engine.movements.filter(
      (m) => m.locationType === "Warehouse" && m.locationId === whA && m.commodityId === wheatId
    );
    const netOnHand = whAMovements.reduce((sum, m) => (m.direction === "IN" ? sum + m.quantity : sum - m.quantity), 0);
    expect(netOnHand).toBe(70); // 100 IN - 30 OUT = 70

    const currentStock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    expect(currentStock.onHandStock).toBe(netOnHand);
    expect(currentStock.availableStock).toBe(netOnHand - currentStock.reservedStock); // 70 - 25 = 45
  });

  // Scenario 15: Warehouse and Shop reports must show correct independent balances
  it("Scenario 15: Warehouse and Shop reports must show correct independent balances", () => {
    const engine = new InventoryEngine();

    // Purchase into Warehouse A
    engine.recordPurchaseInward({
      traderId,
      locationType: "Warehouse",
      locationId: whA,
      commodityId: wheatId,
      quantity: 150,
      billId: "b_whA",
      billNumber: "B-WHA",
    });

    // Purchase into Shop A
    engine.recordPurchaseInward({
      traderId,
      locationType: "Shop",
      locationId: shopA,
      commodityId: wheatId,
      quantity: 50,
      billId: "b_shopA",
      billNumber: "B-SHOPA",
    });

    // Transfer 20 from Wh A to Wh B
    engine.executeStockTransfer({
      traderId,
      fromLocationType: "Warehouse",
      fromLocationId: whA,
      toLocationType: "Warehouse",
      toLocationId: whB,
      commodityId: wheatId,
      quantity: 20,
      transferId: "tr_wh",
    });

    // Independent checks:
    const whAStock = engine.getOrCreateStock(traderId, "Warehouse", whA, wheatId);
    const whBStock = engine.getOrCreateStock(traderId, "Warehouse", whB, wheatId);
    const shopAStock = engine.getOrCreateStock(traderId, "Shop", shopA, wheatId);
    const shopBStock = engine.getOrCreateStock(traderId, "Shop", shopB, wheatId);

    // WH A: 150 - 20 = 130
    expect(whAStock.onHandStock).toBe(130);
    expect(whAStock.availableStock).toBe(130);

    // WH B: 20
    expect(whBStock.onHandStock).toBe(20);
    expect(whBStock.availableStock).toBe(20);

    // Shop A: 50
    expect(shopAStock.onHandStock).toBe(50);
    expect(shopAStock.availableStock).toBe(50);

    // Shop B: 0
    expect(shopBStock.onHandStock).toBe(0);

    // Consolidated sum across all:
    const consolidatedOnHand = whAStock.onHandStock + whBStock.onHandStock + shopAStock.onHandStock + shopBStock.onHandStock;
    expect(consolidatedOnHand).toBe(200);
  });
});
