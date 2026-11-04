import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { PurchaseOrder, PurchaseBill } from "@/models";
import {
  purchaseOrderInputSchema,
  defaultDemoPurchaseOrders,
} from "../route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase().catch(() => null);

    let po = await PurchaseOrder.findById(id).lean().catch(() => null);
    if (!po) {
      po = await PurchaseOrder.findOne({ purchaseOrderNumber: id }).lean().catch(() => null);
    }

    if (!po) {
      const demo = defaultDemoPurchaseOrders.find(
        (p) => p.id === id || p._id === id || p.purchaseOrderNumber === id,
      );
      if (demo) {
        return NextResponse.json({ purchaseOrder: demo });
      }
      return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });
    }

    const linkedBill = await PurchaseBill.findOne({
      orderNumber: po.purchaseOrderNumber,
    }).lean().catch(() => null);

    return NextResponse.json({
      purchaseOrder: {
        ...po,
        id: String(po._id || po.purchaseOrderNumber),
      },
      bill: linkedBill
        ? {
            id: String(linkedBill._id),
            billNumber: linkedBill.billNumber,
            total: linkedBill.total,
            amountPaid: linkedBill.amountPaid || 0,
            balanceDue: Math.max(
              0,
              Math.round(
                (Number(linkedBill.total || 0) - Number(linkedBill.amountPaid || 0)) * 100,
              ) / 100,
            ),
            status: linkedBill.status,
          }
        : null,
    });
  } catch (err: unknown) {
    console.error("GET /api/purchases/purchase-orders/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch purchase order" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const parseResult = purchaseOrderInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parseResult.data;
    await connectToDatabase().catch(() => null);

    let po = await PurchaseOrder.findById(id).catch(() => null);
    if (!po) {
      po = await PurchaseOrder.findOne({ purchaseOrderNumber: id }).catch(() => null);
    }

    // Calculations
    let calculatedSubtotal = 0;
    let calculatedTaxTotal = 0;
    let cgstSum = 0;
    let sgstSum = 0;
    let igstSum = 0;

    const computedItems = data.items.map((item) => {
      const basePrice = item.quantity * item.rate;
      let lineDiscount = 0;
      if (item.discountType === "percent") {
        lineDiscount = (basePrice * item.discount) / 100;
      } else {
        lineDiscount = Math.min(basePrice, item.discount);
      }
      const taxable = Math.max(0, basePrice - lineDiscount);
      const taxAmount = Math.round(((taxable * item.taxRate) / 100) * 100) / 100;
      const lineAmount = Math.round((taxable + taxAmount) * 100) / 100;

      calculatedSubtotal += taxable;
      calculatedTaxTotal += taxAmount;

      const vendorState = data.vendorDetails?.address?.state?.toLowerCase().trim() || "";
      const deliveryState = data.deliveryAddress?.state?.toLowerCase().trim() || "maharashtra";
      const isInterState = vendorState && deliveryState && vendorState !== deliveryState;

      if (isInterState) {
        igstSum += taxAmount;
      } else {
        cgstSum += taxAmount / 2;
        sgstSum += taxAmount / 2;
      }

      return {
        ...item,
        taxAmount,
        amount: lineAmount,
        receivedQuantity: item.receivedQuantity || 0,
      };
    });

    let orderDiscountAmount = 0;
    if (data.discountType === "percent") {
      orderDiscountAmount = (calculatedSubtotal * data.discount) / 100;
    } else {
      orderDiscountAmount = Math.min(calculatedSubtotal, data.discount);
    }

    let taxDeduction = 0;
    if (data.taxType === "TDS" && data.taxRate > 0) {
      taxDeduction = Math.round(((calculatedSubtotal * data.taxRate) / 100) * 100) / 100;
    } else if (data.taxType === "TCS" && data.taxRate > 0) {
      taxDeduction = -Math.round(((calculatedSubtotal * data.taxRate) / 100) * 100) / 100;
    }

    const calculatedTotal =
      Math.round(
        (calculatedSubtotal -
          orderDiscountAmount +
          calculatedTaxTotal -
          taxDeduction +
          (data.adjustment || 0)) *
          100,
      ) / 100;

    if (!po) {
      // Demo fallback mock update
      if (id.startsWith("PO-") || id.startsWith("demo-")) {
        return NextResponse.json({
          message: "Purchase Order updated successfully",
          purchaseOrder: {
            ...data,
            id,
            _id: id,
            purchaseOrderNumber: data.purchaseOrderNumber || id,
            items: computedItems,
            subtotal: Math.round(calculatedSubtotal * 100) / 100,
            discountAmount: Math.round(orderDiscountAmount * 100) / 100,
            taxDeduction,
            cgst: Math.round(cgstSum * 100) / 100,
            sgst: Math.round(sgstSum * 100) / 100,
            igst: Math.round(igstSum * 100) / 100,
            taxTotal: Math.round(calculatedTaxTotal * 100) / 100,
            total: Math.max(0, calculatedTotal),
          },
        });
      }
      return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });
    }

    Object.assign(po, {
      referenceNumber: data.referenceNumber,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
      vendorDetails: data.vendorDetails,
      deliveryAddressType: data.deliveryAddressType,
      customerId: data.customerId,
      customerName: data.customerName,
      deliveryAddress: data.deliveryAddress,
      orderDate: data.orderDate,
      deliveryDate: data.deliveryDate,
      paymentTerms: data.paymentTerms,
      shipmentPreference: data.shipmentPreference,
      items: computedItems,
      subtotal: Math.round(calculatedSubtotal * 100) / 100,
      discount: data.discount,
      discountType: data.discountType,
      discountAmount: Math.round(orderDiscountAmount * 100) / 100,
      taxType: data.taxType,
      taxName: data.taxName,
      taxRate: data.taxRate,
      taxDeduction,
      cgst: Math.round(cgstSum * 100) / 100,
      sgst: Math.round(sgstSum * 100) / 100,
      igst: Math.round(igstSum * 100) / 100,
      taxTotal: Math.round(calculatedTaxTotal * 100) / 100,
      adjustment: data.adjustment || 0,
      adjustmentDescription: data.adjustmentDescription || "",
      total: Math.max(0, calculatedTotal),
      status: data.status,
      notes: data.notes,
      termsAndConditions: data.termsAndConditions,
      attachments: data.attachments,
    });

    if (data.status === "Sent" && (!po.emailsSent || po.emailsSent.length === 0)) {
      if (!po.emailsSent) po.emailsSent = [];
      po.emailsSent.push({
        sentAt: new Date(),
        to: data.vendorDetails?.email || "vendor@procurement.in",
        subject: `Updated Purchase Order ${po.purchaseOrderNumber}`,
        status: "Sent",
      });
    }

    await po.save().catch(() => null);

    return NextResponse.json({
      message: "Purchase Order updated successfully",
      purchaseOrder: {
        ...po.toObject(),
        id: String(po._id || po.purchaseOrderNumber),
      },
    });
  } catch (err: unknown) {
    console.error("PUT /api/purchases/purchase-orders/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update purchase order" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase().catch(() => null);

    let po = await PurchaseOrder.findByIdAndDelete(id).catch(() => null);
    if (!po) {
      po = await PurchaseOrder.findOneAndDelete({ purchaseOrderNumber: id }).catch(() => null);
    }

    if (!po) {
      if (id.startsWith("PO-") || id.startsWith("demo-")) {
        return NextResponse.json({ message: "Purchase Order deleted successfully" });
      }
      return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Purchase Order deleted successfully" });
  } catch (err: unknown) {
    console.error("DELETE /api/purchases/purchase-orders/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete purchase order" },
      { status: 500 },
    );
  }
}
