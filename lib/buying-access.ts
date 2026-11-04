import { isValidObjectId, Types } from "mongoose";
import { NextResponse } from "next/server";
import { requirePermission, type AuthUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { AuditEvent, BuyerProfile, Organization } from "@/models";
import { AppError } from "@/lib/errors";

export interface BuyingScope {
  organizationId: string;
  actorId: string;
  role: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export type BuyingScopeResult =
  | { scope: BuyingScope }
  | { response: NextResponse };

function errorResponse(message: string, status: number) {
  return { response: NextResponse.json({ error: message }, { status }) } as const;
}

export function isBuyerAdmin(user: { id?: string; role?: string } | null | undefined): boolean {
  if (!user) return false;
  const role = user.role?.trim().toLowerCase();
  return (
    user.id === "admin" ||
    user.role === "Super Admin" ||
    user.role === "Administrator" ||
    user.role === "Organization Owner" ||
    role === "super admin" ||
    role === "administrator" ||
    role === "admin" ||
    role === "organization owner"
  );
}

export async function getBuyingScope(
  requestedOrganizationId?: string,
  permission: string = "view-buyers",
  options?: { req?: Request },
): Promise<BuyingScopeResult> {
  let user: AuthUser;
  try {
    user = await requirePermission(permission, options);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse("Authentication failed.", 401);
  }

  await connectToDatabase();

  const isAdminUser = isBuyerAdmin(user);

  if (user.id !== "admin") {
    if (!user.organizationId || !isValidObjectId(user.organizationId)) {
      return errorResponse("Your account is not linked to an organization.", 403);
    }
    if (requestedOrganizationId && requestedOrganizationId !== user.organizationId) {
      return errorResponse("You can only access records in your own organization.", 403);
    }
    return {
      scope: {
        organizationId: user.organizationId,
        actorId: user.id,
        role: user.role,
        name: user.name || user.email || "User",
        email: user.email || "",
        isAdmin: isAdminUser,
      },
    };
  }

  // Admin user
  let targetOrgId = requestedOrganizationId;
  if (!targetOrgId || !isValidObjectId(targetOrgId)) {
    const defaultOrg = await Organization.findOne({ status: "active" }).select("_id name").sort({ createdAt: 1 }).lean();
    if (!defaultOrg) {
      return errorResponse("No active organization found. Create an organization first.", 400);
    }
    targetOrgId = String(defaultOrg._id);
  }

  const organization = await Organization.findOne({ _id: targetOrgId, status: "active" }).select("_id").lean();
  if (!organization) {
    return errorResponse("The selected organization was not found or is inactive.", 404);
  }

  return {
    scope: {
      organizationId: String(organization._id),
      actorId: user.id,
      role: user.role,
      name: user.name || "Administrator",
      email: user.email || "admin@example.com",
      isAdmin: true,
    },
  };
}

export async function recordBuyingAudit({
  organizationId,
  actorId,
  action,
  entityType,
  entityId,
  changes = {},
}: {
  organizationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
}) {
  try {
    await AuditEvent.create({
      organizationId: new Types.ObjectId(organizationId),
      actorId,
      action,
      entityType,
      entityId,
      changes,
      occurredAt: new Date(),
    });
  } catch (err) {
    console.error("Failed to record buying audit event:", err);
  }
}

export async function seedInitialBuyersIfEmpty(organizationId: string) {
  try {
    const count = await BuyerProfile.countDocuments({ organizationId: new Types.ObjectId(organizationId) });
    if (count > 0) return;

    const sampleBuyers = [
      {
        buyerCode: "BYR-1001",
        companyName: "Kisan Agro Foods Pvt Ltd",
        contactPerson: "Rajesh Patel",
        designation: "Procurement Head",
        email: "rajesh@kisanagro.com",
        phone: "+91 98250 12345",
        whatsapp: "+91 98250 12345",
        city: "Ahmedabad",
        state: "Gujarat",
        businessType: "Processor / Miller",
        commodities: ["Wheat", "Basmati Rice", "Cumin Seeds"],
        annualVolume: "5,000 MT",
        minQuantity: 50,
        maxQuantity: 500,
        unit: "MT",
        paymentTerms: "15 Days Post Delivery",
        gstin: "24AAACK1234A1Z5",
        verified: true,
        rating: 4.8,
        status: "Active",
        description: "Leading flour and agro-processing plant operating across Western India with regular weekly procurement.",
        yearEstablished: 2012,
      },
      {
        buyerCode: "BYR-1002",
        companyName: "Surat Grain Merchants LLP",
        contactPerson: "Mehul Shah",
        designation: "Managing Partner",
        email: "mehul@suratgrain.com",
        phone: "+91 98980 23456",
        whatsapp: "+91 98980 23456",
        city: "Surat",
        state: "Gujarat",
        businessType: "Wholesaler",
        commodities: ["Mustard", "Soybean", "Groundnut"],
        annualVolume: "2,500 MT",
        minQuantity: 20,
        maxQuantity: 200,
        unit: "MT",
        paymentTerms: "Immediate upon weighing & QC",
        gstin: "24AABCS5678B1Z2",
        verified: true,
        rating: 4.6,
        status: "Active",
        description: "Wholesale grain & oilseeds distributor serving south Gujarat wholesale mandis and retail chains.",
        yearEstablished: 2016,
      },
      {
        buyerCode: "BYR-1003",
        companyName: "Deccan Spices & Pulses",
        contactPerson: "Sanjay Deshmukh",
        designation: "Purchase Director",
        email: "sanjay@deccanspices.com",
        phone: "+91 94220 34567",
        whatsapp: "+91 94220 34567",
        city: "Pune",
        state: "Maharashtra",
        businessType: "Processor / Miller",
        commodities: ["Turmeric", "Coriander", "Chickpeas"],
        annualVolume: "1,800 MT",
        minQuantity: 10,
        maxQuantity: 150,
        unit: "MT",
        paymentTerms: "30% Advance, 70% against LR",
        gstin: "27AABCD9012C1Z8",
        verified: true,
        rating: 4.9,
        status: "Active",
        description: "Spice grinding and pulse milling unit with export-oriented grade standards.",
        yearEstablished: 2008,
      },
      {
        buyerCode: "BYR-1004",
        companyName: "Punjab Grain Exporters",
        contactPerson: "Harpreet Singh",
        designation: "Supply Chain Manager",
        email: "harpreet@punjabgrain.com",
        phone: "+91 98140 45678",
        whatsapp: "+91 98140 45678",
        city: "Ludhiana",
        state: "Punjab",
        businessType: "Exporter",
        commodities: ["Non-Basmati Rice", "Wheat", "Maize"],
        annualVolume: "25,000 MT",
        minQuantity: 100,
        maxQuantity: 2000,
        unit: "MT",
        paymentTerms: "LC at sight / CAD",
        gstin: "03AAACP3456D1Z1",
        verified: true,
        rating: 4.7,
        status: "Active",
        description: "Merchant exporter shipping bulk grain containers to Middle East and SE Asian destinations.",
        yearEstablished: 2014,
      },
      {
        buyerCode: "BYR-1005",
        companyName: "Malwa Oilseeds Cooperative",
        contactPerson: "Dinesh Verma",
        designation: "General Manager",
        email: "dinesh@malwaoilseeds.org",
        phone: "+91 97550 56789",
        whatsapp: "+91 97550 56789",
        city: "Indore",
        state: "Madhya Pradesh",
        businessType: "Cooperative",
        commodities: ["Soybean", "Mustard", "Cotton Seed"],
        annualVolume: "8,000 MT",
        minQuantity: 30,
        maxQuantity: 400,
        unit: "MT",
        paymentTerms: "Direct Bank Transfer on delivery",
        gstin: "23AABCM7890E1Z4",
        verified: true,
        rating: 4.5,
        status: "Active",
        description: "Federation of farmer groups aggregating and processing oilseeds for cooperative oil extraction plants.",
        yearEstablished: 2010,
      },
      {
        buyerCode: "BYR-1006",
        companyName: "Krishna Rice Industries",
        contactPerson: "Amit Goyal",
        designation: "Partner",
        email: "amit@krishnarice.in",
        phone: "+91 98960 67890",
        whatsapp: "+91 98960 67890",
        city: "Karnal",
        state: "Haryana",
        businessType: "Processor / Miller",
        commodities: ["Basmati Rice", "Wheat", "Paddy"],
        annualVolume: "12,000 MT",
        minQuantity: 50,
        maxQuantity: 1000,
        unit: "MT",
        paymentTerms: "7 Days Net",
        gstin: "06AAACK2345F1Z9",
        verified: true,
        rating: 4.8,
        status: "Active",
        description: "Ultra-modern automated rice milling facility looking for premium farm-direct raw paddy and milled rice.",
        yearEstablished: 2005,
      },
      {
        buyerCode: "BYR-1007",
        companyName: "Southern Agro Commodities",
        contactPerson: "V. Rama Rao",
        designation: "Procurement Director",
        email: "ramarao@southernagro.com",
        phone: "+91 98480 78901",
        whatsapp: "+91 98480 78901",
        city: "Guntur",
        state: "Andhra Pradesh",
        businessType: "Wholesaler",
        commodities: ["Red Chilli", "Turmeric", "Castor Seeds"],
        annualVolume: "3,500 MT",
        minQuantity: 15,
        maxQuantity: 300,
        unit: "MT",
        paymentTerms: "Advance 20%, Balance 80% on delivery",
        gstin: "37AABCS6789G1Z3",
        verified: true,
        rating: 4.6,
        status: "Active",
        description: "Premier spices and commercial crops trading house covering major AP & Telangana market yards.",
        yearEstablished: 2017,
      },
      {
        buyerCode: "BYR-1008",
        companyName: "Jaipur Pulse Processors",
        contactPerson: "Suresh Agarwal",
        designation: "Proprietor",
        email: "suresh@jaipurpulses.com",
        phone: "+91 94140 89012",
        whatsapp: "+91 94140 89012",
        city: "Jaipur",
        state: "Rajasthan",
        businessType: "Wholesaler",
        commodities: ["Chickpeas", "Moong Dal", "Guar Gum"],
        annualVolume: "4,000 MT",
        minQuantity: 25,
        maxQuantity: 250,
        unit: "MT",
        paymentTerms: "RTGS on dispatch",
        gstin: "08AABCJ4567H1Z6",
        verified: true,
        rating: 4.7,
        status: "Active",
        description: "Specialized in pulse processing, sorting, grading and wholesale packaging for north Indian distribution.",
        yearEstablished: 2013,
      },
    ];

    const orgIdObj = new Types.ObjectId(organizationId);
    await BuyerProfile.insertMany(
      sampleBuyers.map((b) => ({
        ...b,
        organizationId: orgIdObj,
      })),
    );
  } catch (err) {
    console.error("Failed to seed initial buyers:", err);
  }
}

export async function seedInitialRequestsIfEmpty(
  organizationId: string,
  actorId: string,
  actorName: string,
  actorEmail?: string,
) {
  try {
    const { BuyingRequest, RequestOffer } = await import("@/models/buying");
    const orgIdObj = new Types.ObjectId(organizationId);
    const count = await BuyingRequest.countDocuments({ organizationId: orgIdObj });
    if (count > 0) return;

    const userObjId = Types.ObjectId.isValid(actorId)
      ? new Types.ObjectId(actorId)
      : new Types.ObjectId("6ad5bbebc705e44f38b65451");

    await BuyingRequest.create({
      requestId: "BR-2001",
      organizationId: orgIdObj,
      buyerId: userObjId,
      buyerName: actorName || "Rutvi",
      buyerCompany: "BharatGodam Foods",
      buyerEmail: actorEmail || "rutvitalaviya@gmail.com",
      buyerPhone: "+91 98250 11223",
      commodity: "Sharbati Wheat",
      requiredQuantity: 120,
      unit: "MT",
      targetPrice: 2850,
      qualitySpecs: "Moisture < 11%, Foreign Matter < 1.0%, High Gluten Grade A",
      deliveryLocation: "Warehouse 4, Sanand Mandi, Ahmedabad, Gujarat",
      requiredDeliveryDate: new Date(Date.now() + 14 * 86400000),
      description: "Immediate procurement requirement for direct milling plant. Immediate RTGS upon laboratory QC clearance.",
      status: "Open",
      offersCount: 0,
    });

    const req2 = await BuyingRequest.create({
      requestId: "BR-2002",
      organizationId: orgIdObj,
      buyerId: userObjId,
      buyerName: actorName || "Rutvi",
      buyerCompany: "BharatGodam Foods",
      buyerEmail: actorEmail || "rutvitalaviya@gmail.com",
      buyerPhone: "+91 98250 11223",
      commodity: "1121 Raw Basmati Rice",
      requiredQuantity: 75,
      unit: "MT",
      targetPrice: 6200,
      qualitySpecs: "Average Grain Length 8.35mm, Broken < 1.0%, Moisture < 12%",
      deliveryLocation: "Karnal Rice Cluster, Haryana",
      requiredDeliveryDate: new Date(Date.now() + 20 * 86400000),
      description: "Export consignment packing. Clean jumbo bags (1 MT) or 50 kg HDPE bags required.",
      status: "In Progress",
      offersCount: 2,
    });

    // Add 2 realistic sample offers for req2
    await RequestOffer.create([
      {
        offerId: "OFF-3001",
        requestId: req2._id,
        organizationId: orgIdObj,
        sellerId: userObjId,
        sellerName: "Harpreet Singh",
        sellerCompany: "Punjab Grain Exporters",
        sellerEmail: "harpreet@punjabgrain.com",
        sellerPhone: "+91 98140 45678",
        offeredPrice: 6150,
        availableQuantity: 75,
        unit: "MT",
        deliveryTerms: "Ex-warehouse Karnal / FOR destination. 100% payment on delivery.",
        validTill: new Date(Date.now() + 7 * 86400000),
        remarks: "Premium 1121 quality ready in lot of 75 MT. Moisture tested 11.2%, broken 0.8%. Ready for immediate dispatch.",
        status: "Pending",
      },
      {
        offerId: "OFF-3002",
        requestId: req2._id,
        organizationId: orgIdObj,
        sellerId: userObjId,
        sellerName: "Rajesh Patel",
        sellerCompany: "Kisan Agro Foods",
        sellerEmail: "rajesh@kisanagro.com",
        sellerPhone: "+91 98250 12345",
        offeredPrice: 6250,
        availableQuantity: 50,
        unit: "MT",
        deliveryTerms: "CIF destination with transit insurance included.",
        validTill: new Date(Date.now() + 5 * 86400000),
        remarks: "Double polished 1121 Basmati, bagged in 50kg bags. 50 MT readily available in warehouse.",
        status: "Pending",
      },
    ]);

    await BuyingRequest.create({
      requestId: "BR-2003",
      organizationId: orgIdObj,
      buyerId: userObjId,
      buyerName: "Surat Grain Merchants",
      buyerCompany: "Surat Grain Merchants LLP",
      buyerEmail: "mehul@suratgrain.com",
      buyerPhone: "+91 98980 23456",
      commodity: "Yellow Soybean",
      requiredQuantity: 200,
      unit: "MT",
      targetPrice: 4700,
      qualitySpecs: "Oil Content > 18.5%, Moisture < 10%, Foreign Matter < 2%",
      deliveryLocation: "APMC Yard, Kota, Rajasthan",
      requiredDeliveryDate: new Date(Date.now() + 30 * 86400000),
      description: "Bulk oil extraction unit procurement. Can accept deliveries in split rakes or truckloads of 30 MT.",
      status: "Open",
      offersCount: 0,
    });

    await BuyingRequest.create({
      requestId: "BR-2004",
      organizationId: orgIdObj,
      buyerId: userObjId,
      buyerName: "Agro Processors Ltd",
      buyerCompany: "Agro Processors Ltd",
      buyerEmail: "procurement@agroprocessors.com",
      buyerPhone: "+91 98765 88990",
      commodity: "Desi Chickpeas (Chana)",
      requiredQuantity: 100,
      unit: "MT",
      targetPrice: 5800,
      qualitySpecs: "Clean machine graded, moisture < 10%, damage < 1%",
      deliveryLocation: "Indore Mandi, Madhya Pradesh",
      requiredDeliveryDate: new Date(Date.now() - 5 * 86400000),
      description: "Procurement completed and accepted. Consignment successfully fulfilled.",
      status: "Closed",
      offersCount: 1,
    });
  } catch (err) {
    console.error("Failed to seed initial buying requests:", err);
  }
}

