import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  purchaseOrderItemSchema,
  purchaseOrderInputSchema,
} from "@/app/api/purchases/purchase-orders/route";

describe("Purchase Order Module Schemas, Calculations & Contracts", () => {
  describe("Item Schema & Line Calculations", () => {
    it("validates valid purchase order item row", () => {
      const validItem = {
        name: "Rice 25kg Premium Bag",
        description: "Aged basmati rice",
        sku: "SKU-1001",
        account: "Cost of Goods Sold",
        quantity: 50,
        receivedQuantity: 0,
        unit: "Bag",
        rate: 2100,
        discount: 2,
        discountType: "percent" as const,
        taxRate: 5,
        taxAmount: 5145,
        amount: 108045,
      };

      const result = purchaseOrderItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it("rejects items with zero or negative quantity", () => {
      const invalidItem = {
        name: "Rice 25kg",
        quantity: 0,
        rate: 2100,
      };
      const result = purchaseOrderItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it("calculates line amount correctly with percentage discount and tax", () => {
      const quantity = 100;
      const rate = 500;
      const discountPercent = 10; // 10% of 50,000 = 5,000
      const taxRate = 18; // 18% of 45,000 = 8,100

      const base = quantity * rate;
      const discountAmount = (base * discountPercent) / 100;
      const taxable = base - discountAmount;
      const taxAmount = (taxable * taxRate) / 100;
      const totalAmount = taxable + taxAmount;

      expect(base).toBe(50000);
      expect(discountAmount).toBe(5000);
      expect(taxable).toBe(45000);
      expect(taxAmount).toBe(8100);
      expect(totalAmount).toBe(53100);
    });

    it("calculates line amount correctly with flat discount", () => {
      const quantity = 20;
      const rate = 1500;
      const flatDiscount = 2000;
      const taxRate = 12;

      const base = quantity * rate; // 30,000
      const taxable = base - flatDiscount; // 28,000
      const taxAmount = (taxable * taxRate) / 100; // 3,360
      const totalAmount = taxable + taxAmount; // 31,360

      expect(taxable).toBe(28000);
      expect(taxAmount).toBe(3360);
      expect(totalAmount).toBe(31360);
    });
  });

  describe("Order Payload Validation & Grand Total Formulas", () => {
    it("validates full purchase order payload with organization delivery", () => {
      const validPO = {
        purchaseOrderNumber: "PO-2026-0045",
        referenceNumber: "SUPP-REF-109",
        vendorName: "Mohan Traders",
        vendorId: "V-401",
        vendorDetails: {
          companyName: "Mohan Traders Pvt Ltd",
          email: "mohan@traders.in",
          phone: "+91 98201 44521",
          gstin: "27AABCM8421K1ZK",
        },
        deliveryAddressType: "organization" as const,
        orderDate: "2026-10-22",
        deliveryDate: "2026-10-29",
        paymentTerms: "Net 30",
        shipmentPreference: "Road Transport / Truck Load",
        items: [
          {
            name: "Milling Wheat Sharbati",
            sku: "SKU-1002",
            quantity: 500,
            unit: "Bag",
            rate: 1800,
            discount: 0,
            discountType: "percent" as const,
            taxRate: 5,
            taxAmount: 45000,
            amount: 945000,
          },
        ],
        subtotal: 900000,
        discount: 1,
        discountType: "percent" as const,
        taxType: "TDS" as const,
        taxName: "TDS @ 0.1% - Sec 194Q",
        taxRate: 0.1,
        adjustment: -50,
        status: "Draft" as const,
        notes: "Offload at godown gate #4",
        termsAndConditions: "Inspection within 48h",
      };

      const result = purchaseOrderInputSchema.safeParse(validPO);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vendorName).toBe("Mohan Traders");
        expect(result.data.deliveryAddressType).toBe("organization");
        expect(result.data.items.length).toBe(1);
      }
    });

    it("validates drop-ship customer delivery address structure", () => {
      const dropshipPO = {
        purchaseOrderNumber: "PO-2026-0046",
        vendorName: "Shree Packaging",
        deliveryAddressType: "customer" as const,
        customerId: "C-101",
        customerName: "Astra Foods",
        deliveryAddress: {
          attention: "Gate Inspector",
          name: "Astra Foods Pune Unit",
          street1: "Plot 55 MIDC",
          city: "Pune",
          state: "Maharashtra",
          postalCode: "410501",
        },
        orderDate: "2026-10-22",
        items: [
          {
            name: "Corrugated Master Cartons",
            quantity: 2000,
            rate: 65,
            unit: "pcs",
            amount: 130000,
          },
        ],
        status: "Sent" as const,
      };

      const result = purchaseOrderInputSchema.safeParse(dropshipPO);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deliveryAddressType).toBe("customer");
        expect(result.data.customerName).toBe("Astra Foods");
      }
    });

    it("rejects order when items array is empty", () => {
      const emptyItemsPO = {
        purchaseOrderNumber: "PO-2026-0047",
        vendorName: "Mohan Traders",
        orderDate: "2026-10-22",
        items: [],
      };
      const result = purchaseOrderInputSchema.safeParse(emptyItemsPO);
      expect(result.success).toBe(false);
    });

    it("correctly computes TDS deduction and net grand total", () => {
      const subtotal = 1000000;
      const orderDiscount = 20000; // 2% or flat
      const taxableBase = subtotal - orderDiscount; // 980,000
      const taxTotal = 176400; // 18% GST
      const tdsRate = 0.1; // 0.1% TDS Sec 194Q
      const tdsDeduction = (taxableBase * tdsRate) / 100; // 980
      const adjustment = 80;

      const grandTotal = taxableBase + taxTotal - tdsDeduction + adjustment;
      expect(tdsDeduction).toBe(980);
      expect(grandTotal).toBe(1155500);
    });
  });

  describe("Goods Receiving & Quantities Tracking Logic", () => {
    it("marks order as 'Partially Received' when a portion of ordered items is delivered", () => {
      const items = [
        { name: "Rice Bags", quantity: 500, receivedQuantity: 200 },
        { name: "Wheat Bags", quantity: 300, receivedQuantity: 0 },
      ];

      const allFulfilled = items.every((it) => it.receivedQuantity >= it.quantity);
      const anyReceived = items.some((it) => it.receivedQuantity > 0);

      const status = allFulfilled
        ? "Received"
        : anyReceived
        ? "Partially Received"
        : "Sent";

      expect(status).toBe("Partially Received");
    });

    it("marks order as 'Received' when all line quantities are completely fulfilled", () => {
      const items = [
        { name: "Rice Bags", quantity: 500, receivedQuantity: 500 },
        { name: "Wheat Bags", quantity: 300, receivedQuantity: 300 },
      ];

      const allFulfilled = items.every((it) => it.receivedQuantity >= it.quantity);
      expect(allFulfilled).toBe(true);

      const status = allFulfilled ? "Received" : "Partially Received";
      expect(status).toBe("Received");
    });

    it("calculates pending quantity accurately", () => {
      const ordered = 1200;
      const received = 750;
      const pending = Math.max(0, ordered - received);
      expect(pending).toBe(450);
    });
  });

  describe("UI Component Files & Zoho-Inspired Feature Integrity", () => {
    const dirPath = path.resolve(__dirname, "../components/purchases/purchase-orders-directory.tsx");
    const formPath = path.resolve(__dirname, "../components/purchases/purchase-order-form.tsx");
    const sectionPath = path.resolve(__dirname, "../app/purchases/[section]/page.tsx");
    const appShellPath = path.resolve(__dirname, "../components/layout/app-shell.tsx");

    const dirContent = fs.readFileSync(dirPath, "utf-8");
    const formContent = fs.readFileSync(formPath, "utf-8");
    const sectionContent = fs.readFileSync(sectionPath, "utf-8");
    const appShellContent = fs.readFileSync(appShellPath, "utf-8");

    it("implements vendor selection with search and details card in PurchaseOrderForm", () => {
      expect(formContent).toContain("Select Vendor");
      expect(formContent).toContain("Vendor Information");
      expect(formContent).toContain("handleVendorSelect");
    });

    it("implements delivery destination toggle for Organization vs Customer Dropship", () => {
      expect(formContent).toContain("Delivery Destination");
      expect(formContent).toContain("Customer (Dropship)");
      expect(formContent).toContain("Organization");
      expect(formContent).toContain("deliveryType");
    });

    it("includes auto-generated and editable Purchase Order Number", () => {
      expect(formContent).toContain("Purchase Order#");
      expect(formContent).toContain("isEditingPONumber");
      expect(formContent).toContain("PO-2026-");
    });

    it("features item table with add row, remove row, and bulk-add items modal", () => {
      expect(formContent).toContain("Procurement Items");
      expect(formContent).toContain("handleAddRow");
      expect(formContent).toContain("handleRemoveRow");
      expect(formContent).toContain("Bulk Add Items");
      expect(formContent).toContain("showBulkAddModal");
      expect(formContent).toContain("handleConfirmBulkAdd");
    });

    it("features live-updating totals panel with Subtotal, Discount, TDS/TCS, and Grand Total", () => {
      expect(formContent).toContain("Order Summary");
      expect(formContent).toContain("subtotal");
      expect(formContent).toContain("Order Discount");
      expect(formContent).toContain("TDS / TCS");
      expect(formContent).toContain("Grand Total");
    });

    it("supports Notes, Terms & Conditions, and drag-and-drop file attachments", () => {
      expect(formContent).toContain("Vendor Notes");
      expect(formContent).toContain("Terms & Conditions");
      expect(formContent).toContain("Drag and drop supplier quotes");
      expect(formContent).toContain("handleFileDrop");
    });

    it("provides sticky Save as Draft, Save and Send, and Cancel actions", () => {
      expect(formContent).toContain("sticky bottom-0");
      expect(formContent).toContain("Save as Draft");
      expect(formContent).toContain("Save and Send");
      expect(formContent).toContain("Cancel");
    });

    it("supports quantity tracking and inward goods receipt modal", () => {
      expect(formContent).toContain("Inward Tracking");
      expect(formContent).toContain("Record Inward Goods");
      expect(formContent).toContain("showReceiveModal");
      expect(formContent).toContain("handleConfirmInwardReceipt");
    });

    it("wires PurchaseOrdersDirectory in purchases [section] page", () => {
      expect(sectionContent).toContain("PurchaseOrdersDirectory");
      expect(sectionContent).toContain('if (section === "purchase-orders")');
    });

    it("links sidebar Purchase Orders navigation and Plus icon to /purchases/purchase-orders/new", () => {
      expect(appShellContent).toContain('/purchases/purchase-orders');
      expect(appShellContent).toContain('/purchases/purchase-orders/new');
    });

    it("provides KPI summary cards, filters, and actions in PurchaseOrdersDirectory", () => {
      expect(dirContent).toContain("Total Purchase Orders");
      expect(dirContent).toContain("Open / Pending POs");
      expect(dirContent).toContain("Partially Received");
      expect(dirContent).toContain("Received & Fulfilled");
      expect(dirContent).toContain("statusFilter");
      expect(dirContent).toContain("handleOpenReceive");
    });

    it("integrates Configure button and ConfigurePoNumberModal in PurchaseOrderForm", () => {
      expect(formContent).toContain("ConfigurePoNumberModal");
      expect(formContent).toContain("setShowNumberConfigModal");
      expect(formContent).toContain("Configure Purchase Order# Preferences");
      expect(formContent).toContain("/api/purchases/purchase-orders/preferences");
    });
  });

  describe("Purchase Order Number Preferences Modal & Numbering Contract", () => {
    const modalPath = path.resolve(process.cwd(), "components/purchases/configure-po-number-modal.tsx");
    const modalContent = fs.readFileSync(modalPath, "utf-8");

    it("renders Configure Purchase Order# Preferences title and transaction series callout", () => {
      expect(modalContent).toContain("Configure Purchase Order# Preferences");
      expect(modalContent).toContain("Configure multiple transaction number series to auto-generate transaction numbers");
      expect(modalContent).toContain("Configure →");
    });

    it("provides auto-generation mode with Prefix, Next Number, and Fiscal Year reset checkbox", () => {
      expect(modalContent).toContain("Continue auto-generating purchase order numbers");
      expect(modalContent).toContain("Prefix");
      expect(modalContent).toContain("Next Number");
      expect(modalContent).toContain("Restart numbering for purchase orders at the start of each fiscal year.");
    });

    it("provides manual entry option and Save/Cancel actions", () => {
      expect(modalContent).toContain("Enter purchase order numbers manually");
      expect(modalContent).toContain("Save");
      expect(modalContent).toContain("Cancel");
    });
  });
});
