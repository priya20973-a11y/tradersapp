import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Vendor } from "@/models";

const addressSchema = z.object({
  attention: z.string().trim().default(""),
  country: z.string().trim().default("India"),
  street1: z.string().trim().default(""),
  street2: z.string().trim().default(""),
  city: z.string().trim().default(""),
  state: z.string().trim().default(""),
  postalCode: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  fax: z.string().trim().default(""),
});

const defaultAddress = {
  attention: "",
  country: "India",
  street1: "",
  street2: "",
  city: "",
  state: "",
  postalCode: "",
  phone: "",
  fax: "",
};

const bankSchema = z.object({
  accountHolderName: z.string().trim().default(""),
  bankName: z.string().trim().default(""),
  accountNumber: z.string().trim().default(""),
  ifscCode: z.string().trim().default(""),
  branchName: z.string().trim().default(""),
});

const defaultBank = {
  accountHolderName: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  branchName: "",
};

export const vendorInputSchema = z.object({
  // Basic Information
  salutation: z.string().trim().default("Mr."),
  firstName: z.string().trim().default(""),
  lastName: z.string().trim().default(""),
  companyName: z.string().trim().default(""),
  displayName: z.string().trim().min(1, "Display Name is required").max(150),
  email: z.string().trim().email("Invalid email address").or(z.literal("")).default(""),
  workPhone: z.string().trim().default(""),
  mobile: z.string().trim().default(""),
  language: z.string().trim().default("English"),
  gstin: z.string().trim().default(""),
  state: z.string().trim().default(""),

  // Other Details
  pan: z.string().trim().max(10).default(""),
  msmeRegistered: z.boolean().default(false),
  msmeType: z.string().trim().default(""),
  msmeNumber: z.string().trim().default(""),
  currency: z.string().trim().default("INR"),
  accountsPayable: z.string().trim().default("Accounts Payable"),
  openingBalance: z.coerce.number().default(0),
  openingBalanceType: z.enum(["credit", "debit"]).default("credit"),
  paymentTerms: z.string().trim().default("Due on Receipt"),
  tds: z.string().trim().default("No TDS"),
  enablePortal: z.boolean().default(false),
  portalLanguage: z.string().trim().default("English"),

  // Addresses
  billingAddress: addressSchema.default(defaultAddress),
  shippingAddress: addressSchema.default(defaultAddress),

  // Contact Persons
  contactPersons: z
    .array(
      z.object({
        id: z.string().optional(),
        salutation: z.string().trim().default("Mr."),
        firstName: z.string().trim().default(""),
        lastName: z.string().trim().default(""),
        email: z.string().trim().default(""),
        workPhone: z.string().trim().default(""),
        mobile: z.string().trim().default(""),
        designation: z.string().trim().default(""),
        department: z.string().trim().default(""),
        isPrimary: z.boolean().default(false),
      }),
    )
    .default([]),

  // Bank Details
  bankDetails: bankSchema.default(defaultBank),

  // Custom Fields
  customFields: z
    .array(
      z.object({
        label: z.string().trim().default(""),
        value: z.string().trim().default(""),
      }),
    )
    .default([]),

  // Reporting Tags
  reportingTags: z.array(z.string().trim()).default([]),

  // Remarks
  remarks: z.string().trim().default(""),

  // Documents
  documents: z
    .array(
      z.object({
        name: z.string().trim(),
        size: z.number().default(0),
        type: z.string().default(""),
        url: z.string().default(""),
        uploadedAt: z.string().default(""),
      }),
    )
    .default([]),

  status: z.enum(["Active", "Inactive", "Pending"]).default("Active"),
});

export type VendorInput = z.infer<typeof vendorInputSchema>;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase().catch(() => null);

    const requestedOrgId = new URL(request.url).searchParams.get("organizationId");
    const orgId = session?.user?.id === "admin" && requestedOrgId ? requestedOrgId : session?.user?.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const query: Record<string, unknown> = { organizationId: orgId };
    if (status && status !== "ALL") query.status = status;

    const dbVendors = await Vendor.find(query).sort({ createdAt: -1 }).lean().catch(() => []);

    return NextResponse.json({
      vendors: dbVendors.map((v: Record<string, unknown>) => ({
        _id: String(v._id),
        id: String(v._id),
        displayName: v.displayName || v.name,
        name: v.name || v.displayName,
        companyName: v.companyName || "",
        email: v.email || "",
        workPhone: v.workPhone || v.phone || "",
        mobile: v.mobile || "",
        balance: v.openingBalance || 0,
        openingBalance: v.openingBalance || 0,
        openingBalanceType: v.openingBalanceType || "credit",
        status: v.status || "Active",
        currency: v.currency || "INR",
        language: v.language || "English",
        paymentTerms: v.paymentTerms || "Due on Receipt",
        pan: v.pan || "",
        gstin: (v.gstin as string) || "",
        state: (v.state as string) || (v.billingAddress as { state?: string })?.state || "",
        msmeRegistered: Boolean(v.msmeRegistered),
        msmeType: v.msmeType || "",
        msmeNumber: v.msmeNumber || "",
        tds: v.tds || "No TDS",
        enablePortal: Boolean(v.enablePortal),
        billingAddress: v.billingAddress || {},
        shippingAddress: v.shippingAddress || {},
        contactPersons: v.contactPersons || [],
        bankDetails: v.bankDetails || {},
        customFields: v.customFields || [],
        reportingTags: v.reportingTags || [],
        remarks: v.remarks || "",
        documents: v.documents || [],
      })),
    });
  } catch (err: unknown) {
    console.error("GET /api/vendors error:", err);
    return NextResponse.json({ error: "Failed to fetch vendors" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const parseResult = vendorInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = parseResult.data;
    const session = await getServerSession(authOptions).catch(() => null);
    await connectToDatabase();

    const requestedOrgId = new URL(request.url).searchParams.get("organizationId");
    const orgId = session?.user?.id === "admin" && requestedOrgId ? requestedOrgId : session?.user?.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for duplicate vendor display name within this organization
    const escapedName = data.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existing = await Vendor.findOne({
      organizationId: orgId,
      name: { $regex: new RegExp(`^${escapedName}$`, "i") },
    }).lean();

    if (existing) {
      return NextResponse.json(
        {
          error: `A vendor with the display name "${data.displayName}" already exists. Please choose a unique display name.`,
        },
        { status: 409 },
      );
    }

    // Create the vendor record
    const newVendor = await Vendor.create({
      organizationId: new Types.ObjectId(orgId),
      name: data.displayName,
      displayName: data.displayName,
      salutation: data.salutation,
      firstName: data.firstName,
      lastName: data.lastName,
      companyName: data.companyName,
      email: data.email || undefined,
      phone: data.workPhone || data.mobile || undefined,
      workPhone: data.workPhone,
      mobile: data.mobile,
      language: data.language,
      pan: data.pan,
      msmeRegistered: data.msmeRegistered,
      msmeType: data.msmeType,
      msmeNumber: data.msmeNumber,
      currency: data.currency,
      accountsPayable: data.accountsPayable,
      openingBalance: data.openingBalance,
      openingBalanceType: data.openingBalanceType,
      paymentTerms: data.paymentTerms,
      tds: data.tds,
      enablePortal: data.enablePortal,
      portalLanguage: data.portalLanguage,
      billingAddress: data.billingAddress,
      shippingAddress: data.shippingAddress,
      gstin: data.gstin || undefined,
      state: data.state || data.billingAddress?.state || undefined,
      contactPersons: data.contactPersons,
      bankDetails: data.bankDetails,
      customFields: data.customFields,
      reportingTags: data.reportingTags,
      remarks: data.remarks,
      documents: data.documents,
      status: data.status,
    });

    const createdVendor = newVendor as unknown as Record<string, unknown>;

    return NextResponse.json(
      {
        message: "Vendor created successfully",
        vendor: {
          id: String(createdVendor._id),
          _id: String(createdVendor._id),
          displayName: String(createdVendor.displayName || createdVendor.name || data.displayName),
          name: String(createdVendor.name || data.displayName),
          email: String(createdVendor.email || ""),
          phone: String(createdVendor.phone || createdVendor.workPhone || ""),
          gstin: String(createdVendor.gstin || ""),
          state: String(createdVendor.state || ""),
          status: String(createdVendor.status || "Active"),
          balance: Number(createdVendor.openingBalance || 0),
        },
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("POST /api/vendors error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
