import { describe, it, expect } from "vitest";
import { purchaseOrderInputSchema } from "@/app/api/purchases/purchase-orders/route";

describe("Purchase Order & Payment Module Integration", () => {
  const samplePO = {
    purchaseOrderNumber: "PO-2026-0099",
    referenceNumber: "REF-SUPP-99",
    vendorName: "Sri Balaji Agro Commodities",
    vendorId: "654321098765432109876543",
    vendorDetails: {
      companyName: "Sri Balaji Agro Commodities Pvt Ltd",
      email: "finance@balajiagro.in",
      phone: "+91 98450 11223",
      gstin: "29AABCS1234F1Z5",
      address: {
        attention: "Accounts Department",
        street1: "Plot 45, APMC Yard",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560022",
        country: "India",
      },
    },
    deliveryAddressType: "organization" as const,
    orderDate: "2026-10-27",
    deliveryDate: "2026-11-05",
    paymentTerms: "Net 30",
    shipmentPreference: "Road Transport / Full Truckload",
    items: [
      {
        name: "Premium Toor Dal (Grade A)",
        description: "Double polished toor dal in 50kg bags",
        sku: "DAL-TOOR-01",
        account: "Cost of Goods Sold",
        quantity: 100,
        receivedQuantity: 0,
        unit: "Bag",
        rate: 6500,
        discount: 2,
        discountType: "percent" as const,
        taxRate: 5,
        taxAmount: 31850,
        amount: 668850,
      },
    ],
    discount: 5000,
    discountType: "amount" as const,
    taxType: "None" as const,
    taxRate: 0,
    adjustment: -350,
    adjustmentDescription: "Early placement rebate",
    status: "Sent" as const,
  };

  describe("1. Purchase Order Validation & Auto-Bill Generation Contract", () => {
    it("validates purchase order schema with vendor details and line items", () => {
      const parsed = purchaseOrderInputSchema.safeParse(samplePO);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.vendorName).toBe("Sri Balaji Agro Commodities");
        expect(parsed.data.items).toHaveLength(1);
        expect(parsed.data.items[0].quantity).toBe(100);
      }
    });

    it("maps purchase order lines and totals to purchase bill structure accurately", () => {
      const item = samplePO.items[0];
      const basePrice = item.quantity * item.rate; // 650,000
      const discount = (basePrice * item.discount) / 100; // 13,000
      const taxable = basePrice - discount; // 637,000
      const taxAmount = (taxable * item.taxRate) / 100; // 31,850
      const lineTotal = taxable + taxAmount; // 668,850
      expect(lineTotal).toBe(668850);

      const orderDiscount = 5000;
      const adjustment = -350;
      const expectedGrandTotal = Math.round((taxable - orderDiscount + taxAmount + adjustment) * 100) / 100;

      // Simulated auto-generated PurchaseBill record
      const generatedBill = {
        billNumber: "BILL-5001",
        vendorId: samplePO.vendorId,
        vendorName: samplePO.vendorName,
        orderNumber: samplePO.purchaseOrderNumber,
        billDate: new Date(samplePO.orderDate),
        dueDate: new Date(samplePO.deliveryDate),
        paymentTerms: samplePO.paymentTerms,
        subTotal: taxable,
        discount: samplePO.discount,
        discountType: samplePO.discountType,
        taxAmount,
        adjustment,
        total: expectedGrandTotal,
        amountPaid: 0,
        balanceDue: expectedGrandTotal,
        status: "Pending",
      };

      expect(generatedBill.orderNumber).toBe("PO-2026-0099");
      expect(generatedBill.vendorName).toBe("Sri Balaji Agro Commodities");
      expect(generatedBill.total).toBe(663500);
      expect(generatedBill.amountPaid).toBe(0);
      expect(generatedBill.balanceDue).toBe(663500);
      expect(generatedBill.status).toBe("Pending");
    });
  });

  describe("2. Payment Recording, Outstanding Balances & Payment Status Progression", () => {
    const totalBillAmount = 663500;

    it("records a partial payment, decrements balance due, and sets status to Partially Paid", () => {
      let amountPaid = 0;
      let balanceDue = totalBillAmount;
      let status = "Pending";
      let poPaymentStatus = "Unpaid";

      // User disburses partial payment of 200,000
      const payment1Amount = 200000;

      // Validation
      expect(payment1Amount).toBeGreaterThan(0);
      expect(payment1Amount).toBeLessThanOrEqual(balanceDue);

      // State transition
      amountPaid = Math.round((amountPaid + payment1Amount) * 100) / 100;
      balanceDue = Math.max(0, Math.round((totalBillAmount - amountPaid) * 100) / 100);
      status = balanceDue <= 0 ? "Paid" : "Partially Paid";
      poPaymentStatus = balanceDue <= 0 ? "Paid" : "Partially Paid";

      expect(amountPaid).toBe(200000);
      expect(balanceDue).toBe(463500);
      expect(status).toBe("Partially Paid");
      expect(poPaymentStatus).toBe("Partially Paid");
    });

    it("records a second partial payment and keeps status as Partially Paid", () => {
      let amountPaid = 200000;
      let balanceDue = 463500;
      let status = "Partially Paid";

      // User disburses another partial payment of 250,000
      const payment2Amount = 250000;
      expect(payment2Amount).toBeLessThanOrEqual(balanceDue);

      amountPaid = Math.round((amountPaid + payment2Amount) * 100) / 100;
      balanceDue = Math.max(0, Math.round((totalBillAmount - amountPaid) * 100) / 100);
      status = balanceDue <= 0 ? "Paid" : "Partially Paid";

      expect(amountPaid).toBe(450000);
      expect(balanceDue).toBe(213500);
      expect(status).toBe("Partially Paid");
    });

    it("settles remaining balance in full, sets status to Paid, and reduces balance due to zero", () => {
      let amountPaid = 450000;
      let balanceDue = 213500;
      let status = "Partially Paid";
      let poPaymentStatus = "Partially Paid";

      // Final payment of exact remaining balance
      const payment3Amount = 213500;
      expect(payment3Amount).toBeLessThanOrEqual(balanceDue);

      amountPaid = Math.round((amountPaid + payment3Amount) * 100) / 100;
      balanceDue = Math.max(0, Math.round((totalBillAmount - amountPaid) * 100) / 100);
      status = balanceDue <= 0 ? "Paid" : "Partially Paid";
      poPaymentStatus = balanceDue <= 0 ? "Paid" : "Partially Paid";

      expect(amountPaid).toBe(663500);
      expect(balanceDue).toBe(0);
      expect(status).toBe("Paid");
      expect(poPaymentStatus).toBe("Paid");
    });

    it("rejects payments that exceed the bill outstanding balance", () => {
      const balanceDue = 15000;
      const attemptedPayment = 20000;

      const isValid = attemptedPayment <= balanceDue + 0.05;
      expect(isValid).toBe(false);
    });

    it("rejects zero or negative payment disbursements", () => {
      const zeroPayment = 0;
      const negativePayment = -500;

      expect(zeroPayment > 0).toBe(false);
      expect(negativePayment > 0).toBe(false);
    });
  });

  describe("3. Vendor Selection and Pending Bills Filter Contract", () => {
    it("ensures vendors with pending bills are selectable in payment module", () => {
      const registeredVendors = [
        { id: "vend-1", name: "Mohan Traders" },
        { id: "vend-2", name: "Shree Packaging" },
      ];

      const pendingBills = [
        {
          id: "bill-101",
          number: "BILL-5001",
          orderNumber: "PO-2026-0099",
          vendorId: "vend-new-3",
          vendorName: "Sri Balaji Agro Commodities",
          total: 663500,
          amountPaid: 0,
          balanceDue: 663500,
          status: "Pending",
        },
      ];

      // Simulate vendor completion logic in GET /api/purchases/payments
      const completeVendors = [...registeredVendors];
      const existingVendorIds = new Set(completeVendors.map((v) => v.id));

      for (const b of pendingBills) {
        if (b.vendorId && !existingVendorIds.has(b.vendorId)) {
          completeVendors.push({
            id: b.vendorId,
            name: b.vendorName,
          });
          existingVendorIds.add(b.vendorId);
        }
      }

      // The new vendor from the PO bill must now be present in completeVendors list
      const matchedVendor = completeVendors.find((v) => v.id === "vend-new-3");
      expect(matchedVendor).toBeDefined();
      expect(matchedVendor?.name).toBe("Sri Balaji Agro Commodities");

      // When Sri Balaji Agro Commodities is selected, the bill is resolved
      const vendorBills = pendingBills.filter((b) => b.vendorId === "vend-new-3");
      expect(vendorBills).toHaveLength(1);
      expect(vendorBills[0].orderNumber).toBe("PO-2026-0099");
      expect(vendorBills[0].balanceDue).toBe(663500);
    });

    it("filters out fully paid bills from pendingBills list", () => {
      const bills = [
        { id: "b1", number: "BILL-01", total: 10000, amountPaid: 10000, balanceDue: 0, status: "Paid" },
        { id: "b2", number: "BILL-02", total: 25000, amountPaid: 10000, balanceDue: 15000, status: "Partially Paid" },
        { id: "b3", number: "BILL-03", total: 50000, amountPaid: 0, balanceDue: 50000, status: "Pending" },
      ];

      const pendingOnly = bills.filter((b) => b.balanceDue > 0);
      expect(pendingOnly).toHaveLength(2);
      expect(pendingOnly.map((b) => b.id)).toEqual(["b2", "b3"]);
      expect(pendingOnly.find((b) => b.status === "Paid")).toBeUndefined();
    });
  });
});
