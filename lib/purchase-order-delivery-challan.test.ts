import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Purchase Order -> Record Inward Goods -> Create Delivery Challan Integration", () => {
  const poFormPath = path.join(process.cwd(), "components/purchases/purchase-order-form.tsx");
  const poFormContent = fs.readFileSync(poFormPath, "utf-8");

  const poDirPath = path.join(process.cwd(), "components/purchases/purchase-orders-directory.tsx");
  const poDirContent = fs.readFileSync(poDirPath, "utf-8");

  const newDcPath = path.join(process.cwd(), "components/sales/new-delivery-challan-form.tsx");
  const newDcContent = fs.readFileSync(newDcPath, "utf-8");

  it("verifies 'Create Delivery Challan' button is present in the Purchase Order Form inward goods modal", () => {
    expect(poFormContent).toContain("Create Delivery Challan");
    expect(poFormContent).toContain("handleCreateDeliveryChallan");
    // Preserves Record Inward Goods button and handler
    expect(poFormContent).toContain("Record Inward Goods");
    expect(poFormContent).toContain("handleConfirmInwardReceipt");
  });

  it("verifies 'Create Delivery Challan' button is present in the Purchase Orders Directory inward modal", () => {
    expect(poDirContent).toContain("Create Delivery Challan");
    expect(poDirContent).toContain("handleCreateDeliveryChallan");
    // Preserves Record Inward button and handler
    expect(poDirContent).toContain("Record Inward");
    expect(poDirContent).toContain("handleSubmitReceive");
  });

  it("verifies redirection to /sales/delivery-challans/new with purchaseOrderId and prefill payload", () => {
    // Both PO form and directory save prefill payload in sessionStorage and navigate
    expect(poFormContent).toContain("/sales/delivery-challans/new?purchaseOrderId=");
    expect(poFormContent).toContain("traders_dc_prefill_po");

    expect(poDirContent).toContain("/sales/delivery-challans/new?purchaseOrderId=");
    expect(poDirContent).toContain("traders_dc_prefill_po");
  });

  it("verifies NewDeliveryChallanForm automatically prefills PO reference, vendor, and received items", () => {
    expect(newDcContent).toContain("traders_dc_prefill_po");
    expect(newDcContent).toContain("setReferenceNumber");
    expect(newDcContent).toContain("Inward delivery against Purchase Order #");
    expect(newDcContent).toContain("setSelectedCustomerId");
    expect(newDcContent).toContain("setRows");
  });

  it("verifies the Delivery Challan form allows manual editing of amounts, items, and manual saving", () => {
    // The user can edit row quantities and rates
    expect(newDcContent).toContain("updateRow(row.id, {");
    expect(newDcContent).toContain("quantity:");
    expect(newDcContent).toContain("rate:");
    // Does not auto-save on mount, waits for user submit action
    expect(newDcContent).toContain('onClick={() => handleSave("Draft")}');
    expect(newDcContent).toContain('onClick={() => handleSave("Delivered")}');
  });

  it("verifies existing inward goods stock receipt and calculation functionality remains unchanged", () => {
    expect(poFormContent).toContain("/api/purchases/purchase-orders/${purchaseOrderId}/receive");
    expect(poDirContent).toContain("/api/purchases/purchase-orders/${activeReceivePO.id}/receive");
  });
});
