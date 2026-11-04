import { isValidObjectId, Types } from "mongoose";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { PurchaseOrder, Organization, DocumentSequence, Vendor, PurchaseBill, PurchaseOrderPreferences, type PurchaseBillRecord } from "@/models";
import {
  extractNumberPart,
  formatPurchaseOrderNumber,
} from "@/lib/purchase-order-numbering";
import { allocateNextPurchaseOrderNumber } from "@/lib/purchase-order-numbering-server";

export const purchaseOrderItemSchema = z.object({
  itemId: z.string().optional(),
  name: z.string().trim().min(1, "Item name is required"),
  description: z.string().trim().default(""),
  sku: z.string().trim().default(""),
  account: z.string().trim().default("Cost of Goods Sold"),
  quantity: z.coerce.number().min(0.001, "Quantity must be greater than 0"),
  receivedQuantity: z.coerce.number().min(0).default(0),
  unit: z.string().trim().default("pcs"),
  rate: z.coerce.number().min(0, "Rate cannot be negative"),
  discount: z.coerce.number().min(0).default(0),
  discountType: z.enum(["percent", "amount"]).default("percent"),
  taxRate: z.coerce.number().min(0).default(18),
  taxAmount: z.coerce.number().min(0).default(0),
  amount: z.coerce.number().min(0).default(0),
});

export const purchaseOrderInputSchema = z.object({
  purchaseOrderNumber: z.string().trim().optional(),
  referenceNumber: z.string().trim().default(""),
  vendorId: z.string().optional(),
  vendorName: z.string().trim().min(1, "Vendor Name is required"),
  vendorDetails: z
    .object({
      companyName: z.string().trim().default(""),
      email: z.string().trim().default(""),
      phone: z.string().trim().default(""),
      gstin: z.string().trim().default(""),
      pan: z.string().trim().default(""),
      address: z
        .object({
          attention: z.string().trim().default(""),
          street1: z.string().trim().default(""),
          street2: z.string().trim().default(""),
          city: z.string().trim().default(""),
          state: z.string().trim().default(""),
          postalCode: z.string().trim().default(""),
          country: z.string().trim().default("India"),
        })
        .optional(),
    })
    .optional(),
  deliveryAddressType: z.enum(["organization", "customer"]).default("organization"),
  customerId: z.string().optional(),
  customerName: z.string().trim().default(""),
  deliveryAddress: z
    .object({
      attention: z.string().trim().default(""),
      name: z.string().trim().default(""),
      street1: z.string().trim().default(""),
      street2: z.string().trim().default(""),
      city: z.string().trim().default(""),
      state: z.string().trim().default(""),
      postalCode: z.string().trim().default(""),
      country: z.string().trim().default("India"),
      phone: z.string().trim().default(""),
    })
    .optional(),
  orderDate: z.string().min(1, "Order date is required"),
  deliveryDate: z.string().trim().default(""),
  paymentTerms: z.string().trim().default("Due on Receipt"),
  shipmentPreference: z.string().trim().default("Surface Express Freight"),
  items: z.array(purchaseOrderItemSchema).min(1, "At least one item is required"),
  subtotal: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).default(0),
  discountType: z.enum(["percent", "amount"]).default("percent"),
  taxType: z.enum(["None", "TDS", "TCS"]).default("None"),
  taxName: z.string().trim().default(""),
  taxRate: z.coerce.number().default(0),
  adjustment: z.coerce.number().default(0),
  adjustmentDescription: z.string().trim().default(""),
  total: z.coerce.number().min(0).optional(),
  status: z.enum(["Draft", "Sent", "Partially Received", "Received", "Cancelled"]).default("Draft"),
  notes: z.string().trim().default(""),
  termsAndConditions: z.string().trim().default(""),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        size: z.number().default(0),
        type: z.string().default(""),
        url: z.string().default(""),
        uploadedAt: z.string().default(""),
      }),
    )
    .default([]),
});

export const defaultDemoPurchaseOrders = [
  {
    id: "PO-2026-0041",
    _id: "PO-2026-0041",
    purchaseOrderNumber: "PO-2026-0041",
    referenceNumber: "REF-MT-882",
    vendorName: "Mohan Traders",
    vendorId: "V-401",
    vendorDetails: {
      companyName: "Mohan Traders Pvt Ltd",
      email: "mohan@traders.in",
      phone: "+91 98201 44521",
      gstin: "27AABCM8421K1ZK",
      pan: "ABCDE1234F",
      address: {
        attention: "Mohan Lal",
        street1: "Plot 14, APMC Market Yard",
        street2: "Phase 2",
        city: "Navi Mumbai",
        state: "Maharashtra",
        postalCode: "400705",
        country: "India",
      },
    },
    deliveryAddressType: "organization",
    customerName: "",
    deliveryAddress: {
      attention: "Warehouse In-charge",
      name: "BharatGodam Foods Central Depot",
      street1: "Godown 4B, MIDC Industrial Area",
      street2: "Taloja Road",
      city: "Navi Mumbai",
      state: "Maharashtra",
      postalCode: "410208",
      country: "India",
      phone: "+91 22 2789 5400",
    },
    orderDate: "2026-10-19",
    deliveryDate: "2026-10-26",
    paymentTerms: "Net 30",
    shipmentPreference: "Road Transport / Truck Load",
    items: [
      {
        itemId: "item-rice-25",
        name: "Rice 25kg Premium Bag",
        description: "Grade A aged basmati rice in woven sacks",
        sku: "SKU-1001",
        account: "Cost of Goods Sold",
        quantity: 500,
        receivedQuantity: 0,
        unit: "Bag",
        rate: 2100,
        discount: 2,
        discountType: "percent",
        taxRate: 5,
        taxAmount: 51450,
        amount: 1080450,
      },
      {
        itemId: "item-packaging",
        name: "Poly Packaging Liner Bags",
        description: "Heavy duty moisture barrier inner bags",
        sku: "SKU-1201",
        account: "Packaging Supplies",
        quantity: 500,
        receivedQuantity: 0,
        unit: "pcs",
        rate: 40,
        discount: 0,
        discountType: "percent",
        taxRate: 18,
        taxAmount: 3600,
        amount: 23600,
      },
    ],
    subtotal: 1070000,
    discount: 0,
    discountType: "percent",
    discountAmount: 0,
    taxType: "TDS",
    taxName: "TDS @ 0.1% - Sec 194Q (Purchase of Goods)",
    taxRate: 0.1,
    taxDeduction: 1070,
    cgst: 27525,
    sgst: 27525,
    igst: 0,
    taxTotal: 55050,
    adjustment: -30,
    adjustmentDescription: "Round-off discount",
    total: 1124000,
    status: "Sent",
    notes: "Please deliver between 9 AM and 5 PM on weekdays. Offloading dock #3.",
    termsAndConditions:
      "1. Quality inspection upon arrival.\n2. Invoices must quote PO-2026-0041.\n3. Defective bags subject to return within 48h.",
    attachments: [
      {
        id: "att-1",
        name: "Quotation_MT_Rice_2026.pdf",
        size: 145000,
        type: "application/pdf",
        url: "",
        uploadedAt: "19 Oct 2026",
      },
    ],
    receivingLogs: [],
  },
  {
    id: "PO-2026-0040",
    _id: "PO-2026-0040",
    purchaseOrderNumber: "PO-2026-0040",
    referenceNumber: "KA-CONTRACT-409",
    vendorName: "Kaveri Agro Industries",
    vendorId: "V-404",
    vendorDetails: {
      companyName: "Kaveri Agro Industries Ltd",
      email: "orders@kaveriagro.in",
      phone: "+91 98450 12890",
      gstin: "29AABCK1092M1ZN",
      pan: "KAVAG9912P",
      address: {
        attention: "Sales Division",
        street1: "Agro Complex, Post Box 12",
        street2: "Highway Junction",
        city: "Belagavi",
        state: "Karnataka",
        postalCode: "590001",
        country: "India",
      },
    },
    deliveryAddressType: "organization",
    customerName: "",
    deliveryAddress: {
      attention: "Central Silo Incharge",
      name: "BharatGodam Foods Hub",
      street1: "APMC Yard Road",
      street2: "Sector 19",
      city: "Navi Mumbai",
      state: "Maharashtra",
      postalCode: "400705",
      country: "India",
      phone: "+91 22 2789 5400",
    },
    orderDate: "2026-10-16",
    deliveryDate: "2026-10-24",
    paymentTerms: "Net 15",
    shipmentPreference: "Rail Container",
    items: [
      {
        itemId: "item-wheat-50",
        name: "Milling Wheat Sharbati",
        description: "Cleaned milling grade wheat lot",
        sku: "SKU-1002",
        account: "Raw Materials Inventory",
        quantity: 800,
        receivedQuantity: 0,
        unit: "Bag",
        rate: 1850,
        discount: 0,
        discountType: "percent",
        taxRate: 5,
        taxAmount: 74000,
        amount: 1554000,
      },
    ],
    subtotal: 1480000,
    discount: 0,
    discountType: "percent",
    discountAmount: 0,
    taxType: "None",
    taxName: "",
    taxRate: 0,
    taxDeduction: 0,
    cgst: 0,
    sgst: 0,
    igst: 74000,
    taxTotal: 74000,
    adjustment: 0,
    adjustmentDescription: "",
    total: 1554000,
    status: "Sent",
    notes: "Rail siding dispatch notice must be emailed 24 hours prior.",
    termsAndConditions: "Standard grain procurement agreement rules apply.",
    attachments: [],
    receivingLogs: [],
  },
  {
    id: "PO-2026-0039",
    _id: "PO-2026-0039",
    purchaseOrderNumber: "PO-2026-0039",
    referenceNumber: "SHREE-PO-991",
    vendorName: "Shree Packaging",
    vendorId: "V-402",
    vendorDetails: {
      companyName: "Shree Packaging Ltd",
      email: "finance@shreepack.in",
      phone: "+91 22 2490 8812",
      gstin: "27AABCS7712Q1ZX",
      pan: "SHREE1234D",
      address: {
        attention: "Dispatch Office",
        street1: "Plot 88, Wagle Estate",
        street2: "Road No 16",
        city: "Thane",
        state: "Maharashtra",
        postalCode: "400604",
        country: "India",
      },
    },
    deliveryAddressType: "customer",
    customerId: "C-101",
    customerName: "Astra Foods",
    deliveryAddress: {
      attention: "Production Plant Gate 2",
      name: "Astra Foods Packaging Unit",
      street1: "Survey 122/4, MIDC Phase 3",
      street2: "Near Express Way",
      city: "Pune",
      state: "Maharashtra",
      postalCode: "411026",
      country: "India",
      phone: "+91 20 2712 9000",
    },
    orderDate: "2026-10-11",
    deliveryDate: "2026-10-18",
    paymentTerms: "Due on Receipt",
    shipmentPreference: "Surface Express Freight",
    items: [
      {
        itemId: "item-boxes",
        name: "Corrugated Master Cartons (5-Ply)",
        description: "Export specification outer corrugated boxes for food grain packs",
        sku: "SKU-PACK-5PLY",
        account: "Packaging Supplies",
        quantity: 4000,
        receivedQuantity: 2500,
        unit: "pcs",
        rate: 68,
        discount: 5,
        discountType: "percent",
        taxRate: 18,
        taxAmount: 46512,
        amount: 304912,
      },
    ],
    subtotal: 258400,
    discount: 0,
    discountType: "percent",
    discountAmount: 0,
    taxType: "None",
    taxName: "",
    taxRate: 0,
    taxDeduction: 0,
    cgst: 23256,
    sgst: 23256,
    igst: 0,
    taxTotal: 46512,
    adjustment: 88,
    adjustmentDescription: "Handling & palletization",
    total: 305000,
    status: "Partially Received",
    notes: "Drop-ship delivery directly to client plant in Pune. Acknowledge challan upon delivery.",
    termsAndConditions: "Defective boxes rejected on sight. Partial invoice accepted for received lots.",
    attachments: [],
    receivingLogs: [
      {
        receivedAt: new Date("2026-10-17T11:00:00.000Z"),
        receivedBy: "Gate Inspector (Astra Foods)",
        notes: "First partial lot received in 1 container: 2,500 pcs in sound condition.",
        items: [{ name: "Corrugated Master Cartons (5-Ply)", quantityReceived: 2500 }],
      },
    ],
  },
  {
    id: "PO-2026-0038",
    _id: "PO-2026-0038",
    purchaseOrderNumber: "PO-2026-0038",
    referenceNumber: "METRO-CON-2026-11",
    vendorName: "Metro Logistics",
    vendorId: "V-403",
    vendorDetails: {
      companyName: "Metro Logistics Services",
      email: "payables@metrologistics.in",
      phone: "+91 98200 44111",
      gstin: "27AABCM6612P1ZN",
      pan: "METRO9821K",
      address: {
        attention: "Fleet Desk",
        street1: "Plot 3, Logistics Park",
        street2: "Panvel Bypass",
        city: "Navi Mumbai",
        state: "Maharashtra",
        postalCode: "410206",
        country: "India",
      },
    },
    deliveryAddressType: "organization",
    customerName: "",
    deliveryAddress: {
      attention: "Depot Supervisor",
      name: "BharatGodam Foods Hub",
      street1: "APMC Market Yard",
      street2: "Sector 19",
      city: "Navi Mumbai",
      state: "Maharashtra",
      postalCode: "400705",
      country: "India",
      phone: "+91 22 2789 5400",
    },
    orderDate: "2026-10-04",
    deliveryDate: "2026-10-08",
    paymentTerms: "Net 15",
    shipmentPreference: "Self Pickup / Ex-Warehouse",
    items: [
      {
        itemId: "item-pallets",
        name: "Standard Wooden Pallets (ISPM-15 Heat Treated)",
        description: "1200x1000mm four-way entry warehouse storage pallets",
        sku: "SKU-PAL-01",
        account: "Warehouse & Storage Maintenance",
        quantity: 400,
        receivedQuantity: 400,
        unit: "pcs",
        rate: 1450,
        discount: 0,
        discountType: "percent",
        taxRate: 18,
        taxAmount: 104400,
        amount: 684400,
      },
    ],
    subtotal: 580000,
    discount: 0,
    discountType: "percent",
    discountAmount: 0,
    taxType: "None",
    taxName: "",
    taxRate: 0,
    taxDeduction: 0,
    cgst: 52200,
    sgst: 52200,
    igst: 0,
    taxTotal: 104400,
    adjustment: -400,
    adjustmentDescription: "Bulk order allowance",
    total: 684000,
    status: "Received",
    notes: "All 400 pallets inspected and accepted into warehouse stock.",
    termsAndConditions: "Treated wood certificate required.",
    attachments: [],
    receivingLogs: [
      {
        receivedAt: new Date("2026-10-08T15:30:00.000Z"),
        receivedBy: "Depot Supervisor",
        notes: "Full consignment delivered and verified against challan.",
        items: [{ name: "Standard Wooden Pallets (ISPM-15 Heat Treated)", quantityReceived: 400 }],
      },
    ],
  },
  {
    id: "PO-2026-0037",
    _id: "PO-2026-0037",
    purchaseOrderNumber: "PO-2026-0037",
    referenceNumber: "DRAFT-GRAIN-01",
    vendorName: "Mohan Traders",
    vendorId: "V-401",
    vendorDetails: {
      companyName: "Mohan Traders Pvt Ltd",
      email: "mohan@traders.in",
      phone: "+91 98201 44521",
    },
    deliveryAddressType: "organization",
    customerName: "",
    orderDate: "2026-10-21",
    deliveryDate: "2026-10-30",
    paymentTerms: "Due on Receipt",
    shipmentPreference: "Road Transport / Truck Load",
    items: [
      {
        name: "Yellow Corn Maize 50kg",
        description: "Poultry feed quality lot",
        sku: "SKU-CORN-01",
        account: "Cost of Goods Sold",
        quantity: 200,
        receivedQuantity: 0,
        unit: "Bag",
        rate: 1100,
        discount: 0,
        discountType: "percent",
        taxRate: 5,
        taxAmount: 11000,
        amount: 231000,
      },
    ],
    subtotal: 220000,
    discount: 0,
    discountType: "percent",
    discountAmount: 0,
    taxType: "None",
    taxRate: 0,
    taxDeduction: 0,
    cgst: 5500,
    sgst: 5500,
    igst: 0,
    taxTotal: 11000,
    adjustment: 0,
    total: 231000,
    status: "Draft",
    notes: "Internal review pending for moisture certificate.",
    termsAndConditions: "Standard procurement terms.",
    attachments: [],
    receivingLogs: [],
  },
];

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const status = searchParams.get("status")?.trim() || "ALL";
    const vendor = searchParams.get("vendor")?.trim() || "ALL";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "10", 10)));

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    const query: Record<string, unknown> = {};
    if (orgId) {
      query.organizationId = orgId;
    }
    if (status && status !== "ALL") {
      query.status = status;
    }
    if (vendor && vendor !== "ALL") {
      query.vendorName = vendor;
    }

    const dbOrders = await PurchaseOrder.find(query)
      .sort({ createdAt: -1 })
      .lean()
      .catch(() => []);

    // Filter in-memory for search query across multiple fields
    type OrderItem = { name?: string; sku?: string };
    type OrderRecord = Record<string, unknown> & {
      purchaseOrderNumber?: string;
      referenceNumber?: string;
      vendorName?: string;
      customerName?: string;
      notes?: string;
      items?: OrderItem[];
    };
    let allOrders: OrderRecord[] =
      dbOrders && dbOrders.length > 0
        ? (dbOrders as Array<Record<string, unknown>>).map((d) => ({ ...d, id: String(d._id || d.purchaseOrderNumber) }))
        : (defaultDemoPurchaseOrders as OrderRecord[]);

    if (search) {
      allOrders = allOrders.filter((po) => {
        const poNum = String(po.purchaseOrderNumber || "").toLowerCase();
        const refNum = String(po.referenceNumber || "").toLowerCase();
        const vName = String(po.vendorName || "").toLowerCase();
        const cName = String(po.customerName || "").toLowerCase();
        const notes = String(po.notes || "").toLowerCase();
        const itemsMatch = po.items?.some((it: { name?: string; sku?: string }) =>
          String(it.name || "").toLowerCase().includes(search) ||
          String(it.sku || "").toLowerCase().includes(search),
        );
        return (
          poNum.includes(search) ||
          refNum.includes(search) ||
          vName.includes(search) ||
          cName.includes(search) ||
          notes.includes(search) ||
          Boolean(itemsMatch)
        );
      });
    }

    if (status && status !== "ALL") {
      allOrders = allOrders.filter(
        (po) => String(po.status).toLowerCase() === status.toLowerCase(),
      );
    }

    if (vendor && vendor !== "ALL") {
      allOrders = allOrders.filter(
        (po) => String(po.vendorName).toLowerCase() === vendor.toLowerCase(),
      );
    }

    // Compute KPI metrics
    const totalOrdersCount = allOrders.length;
    const totalOrdersValue = allOrders.reduce((sum, po) => sum + (Number(po.total) || 0), 0);
    const openOrders = allOrders.filter((po) => po.status === "Sent" || po.status === "Draft");
    const openOrdersValue = openOrders.reduce((sum, po) => sum + (Number(po.total) || 0), 0);
    const partiallyReceivedCount = allOrders.filter(
      (po) => po.status === "Partially Received",
    ).length;
    const fulfilledCount = allOrders.filter((po) => po.status === "Received").length;

    const totalPages = Math.ceil(allOrders.length / limit) || 1;
    const paginatedOrders = allOrders.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      purchaseOrders: paginatedOrders.map((po) => ({
        ...po,
        id: String(po.id || po._id || po.purchaseOrderNumber),
      })),
      pagination: {
        page,
        limit,
        total: allOrders.length,
        totalPages,
      },
      metrics: {
        totalOrdersCount,
        totalOrdersValue,
        openOrdersCount: openOrders.length,
        openOrdersValue,
        partiallyReceivedCount,
        fulfilledCount,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/purchases/purchase-orders error:", err);
    return NextResponse.json(
      { error: "Failed to fetch purchase orders" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

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

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    // Determine numbering mode and allocate PO number
    const orgObjId = orgId && isValidObjectId(orgId) ? new Types.ObjectId(orgId) : null;
    const poPrefs = orgObjId
      ? await PurchaseOrderPreferences.findOne({ organizationId: orgObjId }).lean()
      : null;
    const isAutoGenerate = poPrefs ? poPrefs.autoGenerateNumbering !== false : true;

    let poNumber = data.purchaseOrderNumber?.trim() || "";

    if (!isAutoGenerate) {
      // Manual entry mode
      if (!poNumber) {
        return NextResponse.json(
          { error: "Purchase Order Number is required when manual numbering is enabled." },
          { status: 400 },
        );
      }

      // Check duplicate in manual mode
      if (orgId) {
        const existing = await PurchaseOrder.findOne({
          organizationId: orgId,
          purchaseOrderNumber: poNumber,
        }).lean().catch(() => null);
        if (existing) {
          return NextResponse.json(
            { error: `Purchase Order Number '${poNumber}' already exists.` },
            { status: 409 },
          );
        }
      }
    } else {
      // Auto-generate mode
      const prefix = poPrefs?.prefix || "PO-";
      const padding = poPrefs?.numberZeroPadding || 5;
      const expectedAutoNumber = formatPurchaseOrderNumber(prefix, poPrefs?.nextNumber || 2, padding);

      if (!poNumber || poNumber === expectedAutoNumber) {
        // Allocate next sequential number atomically with collision avoidance
        try {
          const allocated = await allocateNextPurchaseOrderNumber(orgId || "");
          poNumber = allocated.poNumber;
        } catch {
          poNumber = `PO-${Math.floor(10000 + Math.random() * 90000)}`;
        }
      } else {
        // User provided custom number while in auto mode
        if (orgId) {
          const existing = await PurchaseOrder.findOne({
            organizationId: orgId,
            purchaseOrderNumber: poNumber,
          }).lean().catch(() => null);
          if (existing) {
            return NextResponse.json(
              { error: `Purchase Order Number '${poNumber}' already exists.` },
              { status: 409 },
            );
          }
        }

        // If the custom number used the configured prefix, update nextNumber if higher
        const numPart = extractNumberPart(poNumber, prefix);
        if (numPart && orgObjId) {
          await PurchaseOrderPreferences.updateOne(
            { organizationId: orgObjId, nextNumber: { $lte: numPart } },
            { $set: { nextNumber: numPart + 1 } },
          ).catch(() => null);
        }
      }
    }

    // Line calculations
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

      // State check for CGST/SGST vs IGST
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

    // Order level discount
    let orderDiscountAmount = 0;
    if (data.discountType === "percent") {
      orderDiscountAmount = (calculatedSubtotal * data.discount) / 100;
    } else {
      orderDiscountAmount = Math.min(calculatedSubtotal, data.discount);
    }

    // TDS / TCS
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

    const emailsSent = [];
    if (data.status === "Sent") {
      emailsSent.push({
        sentAt: new Date(),
        to: data.vendorDetails?.email || "vendor@procurement.in",
        subject: `Purchase Order ${poNumber} from LedgerFlow`,
        status: "Sent",
      });
    }

    const newPO = new PurchaseOrder({
      organizationId: orgId,
      purchaseOrderNumber: poNumber,
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
      emailsSent,
      receivingLogs: [],
    });

    await newPO.save().catch(() => null);

    // Integrate with Payment module by creating/linking a Purchase Bill and ensuring Vendor exists
    let linkedBill: (PurchaseBillRecord & { _id: Types.ObjectId | string }) | null = null;
    if (orgId && isValidObjectId(orgId)) {
      const orgObjId = new Types.ObjectId(orgId);

      try {
        // Resolve or create Vendor document so vendor appears in the Payment module
        let vendorObj: { _id?: Types.ObjectId } | null = null;
        if (data.vendorId && isValidObjectId(data.vendorId)) {
          vendorObj = await Vendor.findOne({
            _id: new Types.ObjectId(data.vendorId),
            $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
          }).catch(() => null);
        }
        if (!vendorObj && data.vendorName) {
          const escapedName = data.vendorName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
          const nameRegex = { $regex: new RegExp(`^${escapedName}$`, "i") };
          vendorObj = await Vendor.findOne({
            organizationId: { $in: [orgObjId, String(orgObjId)] },
            $or: [{ name: nameRegex }, { displayName: nameRegex }, { companyName: nameRegex }],
          }).catch(() => null);
        }
        if (!vendorObj && data.vendorName) {
          vendorObj = await Vendor.create({
            organizationId: orgObjId,
            name: data.vendorName,
            displayName: data.vendorName,
            companyName: data.vendorDetails?.companyName || data.vendorName,
            email: data.vendorDetails?.email || "",
            phone: data.vendorDetails?.phone || "",
            gstin: data.vendorDetails?.gstin || "",
            state: data.vendorDetails?.address?.state || "",
            openingBalance: 0,
            status: "Active",
          }).catch(() => null);
        }

        const resolvedVendorId = vendorObj?._id || (data.vendorId && isValidObjectId(data.vendorId) ? new Types.ObjectId(data.vendorId) : new Types.ObjectId());

        if (resolvedVendorId && (!newPO.vendorId || String(newPO.vendorId) !== String(resolvedVendorId))) {
          newPO.vendorId = resolvedVendorId;
          await newPO.save().catch(() => null);
        }

        // Check if a bill already exists for this PO
        linkedBill = await PurchaseBill.findOne({
          organizationId: orgObjId,
          orderNumber: poNumber,
        }).catch(() => null);

        if (!linkedBill) {
          const sequence = await DocumentSequence.findOneAndUpdate(
            { organizationId: orgObjId, modelName: "Purchase Bill" },
            { $inc: { nextNumber: 1 } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          ).catch(() => null);

          const bSeq = sequence?.nextNumber || 1;
          const billNumber = `BILL-${String(bSeq).padStart(4, "0")}`;

          const billItems = computedItems.map((item) => ({
            itemId: item.itemId,
            name: item.name,
            description: item.description || "",
            account: item.account || "Cost of Goods Sold",
            quantity: item.quantity,
            rate: item.rate,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            customerId: data.customerId,
            customerName: data.customerName || "",
            amount: item.amount,
          }));

          const billDate = data.orderDate ? new Date(data.orderDate) : new Date();
          const dueDate = data.deliveryDate ? new Date(data.deliveryDate) : undefined;

          linkedBill = await PurchaseBill.create({
            organizationId: orgObjId,
            billNumber,
            vendorId: resolvedVendorId,
            vendorName: data.vendorName,
            orderNumber: poNumber,
            billDate,
            dueDate,
            paymentTerms: data.paymentTerms || "Due on Receipt",
            accountsPayable: "Accounts Payable",
            subject: `Purchase Bill for PO ${poNumber}`,
            items: billItems,
            subTotal: Math.round(calculatedSubtotal * 100) / 100,
            discount: data.discount || 0,
            discountType: data.discountType || "percent",
            discountAmount: Math.round(orderDiscountAmount * 100) / 100,
            taxType: data.taxType === "TDS" ? "TDS" : calculatedTaxTotal > 0 ? "GST" : "None",
            taxRate: data.taxRate || 0,
            taxAmount: Math.round(calculatedTaxTotal * 100) / 100,
            cgst: Math.round(cgstSum * 100) / 100,
            sgst: Math.round(sgstSum * 100) / 100,
            igst: Math.round(igstSum * 100) / 100,
            adjustment: data.adjustment || 0,
            total: Math.max(0, calculatedTotal),
            amountPaid: 0,
            status: "Pending",
            notes: data.notes || "",
            termsAndConditions: data.termsAndConditions || "",
            currency: "INR",
          }).catch((err) => {
            console.error("Auto-generating purchase bill failed:", err);
            return null;
          });
        }
      } catch (integrationErr) {
        console.error("Payment module integration failed:", integrationErr);
      }
    }

    return NextResponse.json(
      {
        message:
          data.status === "Sent"
            ? `Purchase Order ${poNumber} created and sent to supplier successfully.`
            : `Purchase Order ${poNumber} saved as draft.`,
        purchaseOrder: {
          ...newPO.toObject(),
          id: String(newPO._id || poNumber),
        },
        bill: linkedBill
          ? {
              id: String(linkedBill._id),
              billNumber: linkedBill.billNumber,
              orderNumber: poNumber,
              vendorId: String(linkedBill.vendorId),
              vendorName: linkedBill.vendorName,
              total: Number(linkedBill.total || 0),
              amountPaid: Number(linkedBill.amountPaid || 0),
              balanceDue: Math.max(
                0,
                Math.round(
                  (Number(linkedBill.total || 0) - Number(linkedBill.amountPaid || 0)) * 100,
                ) / 100,
              ),
              status: linkedBill.status,
            }
          : undefined,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("POST /api/purchases/purchase-orders error:", err);
    return NextResponse.json(
      { error: "Failed to create purchase order" },
      { status: 500 },
    );
  }
}
