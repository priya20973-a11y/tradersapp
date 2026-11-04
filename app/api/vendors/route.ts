import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Vendor, Organization } from "@/models";
import { vendors as defaultDemoVendors } from "@/lib/demo-data";

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

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean().catch(() => null);
      if (defaultOrg) orgId = String(defaultOrg._id);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const query: Record<string, unknown> = {};
    if (orgId) query.organizationId = orgId;
    if (status && status !== "ALL") query.status = status;

    const dbVendors = await Vendor.find(query).sort({ createdAt: -1 }).lean().catch(() => []);

    if (!dbVendors || dbVendors.length === 0) {
      // Return formatted demo vendors if database has no entries
      return NextResponse.json({
        vendors: defaultDemoVendors.map((v, i) => ({
          _id: v.id,
          id: v.id,
          displayName: v.name,
          name: v.name,
          companyName: v.name,
          email: v.email,
          workPhone: "+91 98201 44521",
          mobile: "+91 98201 44521",
          balance: v.balance,
          openingBalance: v.balance,
          openingBalanceType: "credit",
          status: v.status,
          currency: "INR",
          language: "English",
          paymentTerms: "Due on Receipt",
          pan: "ABCDE1234F",
          billingAddress: {
            country: "India",
            city: "Mumbai",
            state: "Maharashtra",
            postalCode: "400001",
          },
          shippingAddress: {
            country: "India",
            city: "Mumbai",
            state: "Maharashtra",
            postalCode: "400001",
          },
          contactPersons: [],
          bankDetails: {
            accountHolderName: v.name,
            bankName: "HDFC Bank",
            accountNumber: `501002938${i}11`,
            ifscCode: "HDFC0000123",
            branchName: "Fort, Mumbai",
          },
          customFields: [],
          reportingTags: ["Preferred Vendor"],
          remarks: "Regular commodity supplier",
          documents: [],
        })),
      });
    }

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

    let orgId = session?.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne().select("_id").lean();
      if (!defaultOrg) {
        return NextResponse.json({ error: "No active organization found" }, { status: 400 });
      }
      orgId = String(defaultOrg._id);
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
      organizationId: orgId,
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
      state: data.billingAddress?.state,
      contactPersons: data.contactPersons,
      bankDetails: data.bankDetails,
      customFields: data.customFields,
      reportingTags: data.reportingTags,
      remarks: data.remarks,
      documents: data.documents,
      status: data.status,
    });

    return NextResponse.json(
      {
        message: "Vendor created successfully",
        vendor: {
          id: String(newVendor._id),
          _id: String(newVendor._id),
          displayName: newVendor.displayName || newVendor.name,
          name: newVendor.name,
          email: newVendor.email,
          phone: newVendor.phone,
          status: newVendor.status,
          balance: newVendor.openingBalance,
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
