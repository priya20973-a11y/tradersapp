import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { Organization, User } from "@/models";
import {
  PAN_REGEX,
  AADHAAR_REGEX,
  GSTIN_REGEX,
  IFSC_REGEX,
  sanitizeAadhaar,
} from "@/lib/indian-states";
import { handleRouteError } from "@/lib/response";
import { ValidationError, AuthError, ConflictError } from "@/lib/errors";
import { getFinancialYear } from "@/lib/financial-year";

const bankDetailsUpdateSchema = z
  .object({
    accountHolderName: z.string().trim().max(100).optional().default(""),
    accountNumber: z.string().trim().max(35).optional().default(""),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .refine((val) => !val || IFSC_REGEX.test(val), {
        message: "Invalid IFSC Code format (e.g., HDFC0001234)",
      })
      .optional()
      .default(""),
    bankName: z.string().trim().max(100).optional().default(""),
    branch: z.string().trim().max(100).optional().default(""),
  })
  .optional();

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
  email: z.string().trim().toLowerCase().pipe(z.string().email("Invalid email address")).optional(),
  phone: z.string().trim().max(25).optional().default(""),
  role: z.string().trim().max(60).optional().default(""),
  organizationName: z.string().trim().min(2, "Organization name must be at least 2 characters").max(120).optional(),
  tradeName: z.string().trim().max(120).optional().default(""),
  status: z.string().trim().max(40).optional().default("active"),
  currency: z.string().trim().max(10).optional().default("INR"),
  financialYear: z.string().trim().max(20).optional().default(getFinancialYear),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .refine((val) => !val || PAN_REGEX.test(val), {
      message: "Invalid PAN format. Must be 10 characters (e.g., ABCDE1234F)",
    })
    .optional()
    .default(""),
  aadhaar: z
    .string()
    .trim()
    .refine((val) => !val || AADHAAR_REGEX.test(val), {
      message: "Invalid Aadhaar format. Must be 12 digits (e.g., 1234 5678 9012)",
    })
    .optional()
    .default(""),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((val) => !val || GSTIN_REGEX.test(val), {
      message: "Invalid GSTIN format. Must be 15 characters (e.g., 27ABCDE1234F1Z5)",
    })
    .optional()
    .default(""),
  logo: z.string().optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  city: z.string().trim().max(100).optional().default(""),
  state: z.string().trim().max(100).optional().default(""),
  pincode: z.string().trim().max(20).optional().default(""),
  country: z.string().trim().max(100).optional().default("India"),
  bankDetails: bankDetailsUpdateSchema,
});

const DEMO_FALLBACK_PROFILE = {
  id: "demo-user-id",
  name: "Suresh Agarwal",
  email: "suresh@bharatgodam.com",
  phone: "+91 98765 43210",
  role: "Organization Owner",
  organizationName: "BharatGodam Foods Ltd",
  tradeName: "BharatGodam Foods",
  status: "active",
  currency: "INR",
  financialYear: getFinancialYear(),
  pan: "AABCB1234F",
  aadhaar: "987654321098",
  gstin: "27ABCDE1234F1Z7",
  logo: "",
  address: "Plot 42, Sector 18, APMC Market",
  city: "Navi Mumbai",
  state: "Maharashtra",
  pincode: "400703",
  country: "India",
  bankDetails: {
    accountHolderName: "BharatGodam Foods Ltd",
    accountNumber: "50200012345678",
    ifsc: "HDFC0000042",
    bankName: "HDFC Bank",
    branch: "Vashi APMC Branch",
  },
  mustChangePassword: false,
  createdAt: "2026-01-15T10:00:00.000Z",
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions).catch(() => null);

    const isPlatformAdmin = Boolean(
      session?.user?.id === "admin" || session?.user?.role === "Super Admin"
    );

    if (isPlatformAdmin) {
      return NextResponse.json({
        ok: true,
        profile: {
          id: "admin",
          name: session?.user?.name || "Admin",
          email: session?.user?.email || "admin@example.com",
          role: "Super Admin",
          organizationName: "System Administration",
          financialYear: getFinancialYear(),
          isAdmin: true,
        },
        isAdmin: true,
        isDemo: false,
      });
    }

    if (!session?.user?.email) {
      return NextResponse.json({
        ok: true,
        profile: DEMO_FALLBACK_PROFILE,
        isAdmin: false,
        isDemo: true,
      });
    }

    await connectToDatabase();

    const user = await User.findOne({
      email: session.user.email.toLowerCase(),
      isDeleted: { $ne: true },
    }).lean();

    if (!user) {
      return NextResponse.json({
        ok: true,
        profile: DEMO_FALLBACK_PROFILE,
        isAdmin: false,
        isDemo: true,
      });
    }

    const userRecord = user as unknown as Record<string, unknown>;
    let organization: Record<string, unknown> | null = null;

    if (userRecord.organizationId) {
      organization = (await Organization.findById(userRecord.organizationId).lean()) as Record<string, unknown> | null;
    }

    const orgBank = organization?.bankDetails as Record<string, string> | undefined;
    const userBank = userRecord.bankDetails as Record<string, string> | undefined;

    const mergedBank = {
      accountHolderName: userBank?.accountHolderName || orgBank?.accountHolderName || "",
      accountNumber: userBank?.accountNumber || orgBank?.accountNumber || "",
      ifsc: userBank?.ifsc || orgBank?.ifsc || "",
      bankName: userBank?.bankName || orgBank?.bankName || "",
      branch: userBank?.branch || orgBank?.branch || "",
    };

    const profile = {
      id: String(userRecord._id),
      name: String(userRecord.name || ""),
      email: String(userRecord.email || ""),
      phone: String(userRecord.phone || organization?.phone || ""),
      role: String(userRecord.role || "Organization Owner"),
      organizationName: String(organization?.name || "My Organization"),
      tradeName: String(organization?.tradeName || userRecord.tradeName || ""),
      status: String(organization?.status || "active"),
      currency: String(organization?.currency || userRecord.currency || "INR"),
      financialYear: String(organization?.financialYear || userRecord.financialYear || getFinancialYear()),
      pan: String(userRecord.pan || organization?.pan || ""),
      aadhaar: String(userRecord.aadhaar || organization?.aadhaar || ""),
      gstin: String(userRecord.gstin || organization?.gstin || ""),
      logo: String(userRecord.logo || organization?.logo || ""),
      address: String(userRecord.address || organization?.address || ""),
      city: String(userRecord.city || organization?.city || ""),
      state: String(userRecord.state || organization?.state || ""),
      pincode: String(userRecord.pincode || organization?.pincode || ""),
      country: String(userRecord.country || organization?.country || "India"),
      bankDetails: mergedBank,
      mustChangePassword: Boolean(userRecord.mustChangePassword),
      createdAt: userRecord.createdAt || new Date().toISOString(),
      isAdmin: Boolean(userRecord.role === "Super Admin"),
    };

    return NextResponse.json({
      ok: true,
      profile,
      isAdmin: Boolean(userRecord.role === "Super Admin"),
      isDemo: false,
    });
  } catch (error) {
    return handleRouteError(error, "get-profile");
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }

    const validation = profileUpdateSchema.safeParse(payload);
    if (!validation.success) {
      const issue = validation.error.issues[0]?.message || "Invalid profile data.";
      throw new ValidationError(issue);
    }

    const data = validation.data;
    const cleanAadhaar = data.aadhaar ? sanitizeAadhaar(data.aadhaar) : "";
    const cleanBank = data.bankDetails
      ? {
          accountHolderName: data.bankDetails.accountHolderName || undefined,
          accountNumber: data.bankDetails.accountNumber || undefined,
          ifsc: data.bankDetails.ifsc || undefined,
          bankName: data.bankDetails.bankName || undefined,
          branch: data.bankDetails.branch || undefined,
        }
      : undefined;

    if (!session?.user?.email) {
      // Return updated state for demo/preview mode without rejecting
      return NextResponse.json({
        ok: true,
        message: "Profile updated successfully (demo mode).",
        profile: {
          ...DEMO_FALLBACK_PROFILE,
          name: data.name || DEMO_FALLBACK_PROFILE.name,
          email: data.email || DEMO_FALLBACK_PROFILE.email,
          phone: data.phone ?? DEMO_FALLBACK_PROFILE.phone,
          role: data.role ?? DEMO_FALLBACK_PROFILE.role,
          organizationName: data.organizationName || DEMO_FALLBACK_PROFILE.organizationName,
          tradeName: data.tradeName ?? DEMO_FALLBACK_PROFILE.tradeName,
          status: data.status ?? DEMO_FALLBACK_PROFILE.status,
          currency: data.currency ?? DEMO_FALLBACK_PROFILE.currency,
          financialYear: data.financialYear ?? DEMO_FALLBACK_PROFILE.financialYear,
          pan: data.pan ?? DEMO_FALLBACK_PROFILE.pan,
          aadhaar: cleanAadhaar || DEMO_FALLBACK_PROFILE.aadhaar,
          gstin: data.gstin ?? DEMO_FALLBACK_PROFILE.gstin,
          logo: data.logo ?? DEMO_FALLBACK_PROFILE.logo,
          address: data.address ?? DEMO_FALLBACK_PROFILE.address,
          city: data.city ?? DEMO_FALLBACK_PROFILE.city,
          state: data.state ?? DEMO_FALLBACK_PROFILE.state,
          pincode: data.pincode ?? DEMO_FALLBACK_PROFILE.pincode,
          country: data.country ?? DEMO_FALLBACK_PROFILE.country,
          bankDetails: {
            ...DEMO_FALLBACK_PROFILE.bankDetails,
            ...(data.bankDetails || {}),
          },
        },
      });
    }

    await connectToDatabase();

    const user = await User.findOne({
      email: session.user.email.toLowerCase(),
      isDeleted: { $ne: true },
    });

    if (!user) {
      throw new AuthError("User profile not found.");
    }

    // If email is changing, verify no collision
    if (data.email && data.email !== user.email) {
      const emailCollision = await User.findOne({
        email: data.email,
        _id: { $ne: user._id },
        isDeleted: { $ne: true },
      });
      if (emailCollision) {
        throw new ConflictError("An account with that email address already exists.");
      }
    }

    // Build user update object
    const userUpdate: Record<string, unknown> = {};
    if (data.name) userUpdate.name = data.name;
    if (data.email) userUpdate.email = data.email;
    if (data.phone !== undefined) userUpdate.phone = data.phone;
    if (data.role !== undefined) userUpdate.role = data.role;
    if (data.tradeName !== undefined) userUpdate.tradeName = data.tradeName;
    if (data.currency !== undefined) userUpdate.currency = data.currency;
    if (data.financialYear !== undefined) userUpdate.financialYear = data.financialYear;
    if (data.pan !== undefined) userUpdate.pan = data.pan;
    if (data.aadhaar !== undefined) userUpdate.aadhaar = cleanAadhaar;
    if (data.gstin !== undefined) userUpdate.gstin = data.gstin;
    if (data.logo !== undefined) userUpdate.logo = data.logo;
    if (data.address !== undefined) userUpdate.address = data.address;
    if (data.city !== undefined) userUpdate.city = data.city;
    if (data.state !== undefined) userUpdate.state = data.state;
    if (data.pincode !== undefined) userUpdate.pincode = data.pincode;
    if (data.country !== undefined) userUpdate.country = data.country;
    if (cleanBank) userUpdate.bankDetails = cleanBank;

    await User.findByIdAndUpdate(user._id, { $set: userUpdate });

    // Build organization update object
    if (user.organizationId) {
      const orgUpdate: Record<string, unknown> = {};
      if (data.organizationName) orgUpdate.name = data.organizationName;
      if (data.tradeName !== undefined) orgUpdate.tradeName = data.tradeName;
      if (data.phone !== undefined) orgUpdate.phone = data.phone;
      if (data.status !== undefined) orgUpdate.status = data.status;
      if (data.currency !== undefined) orgUpdate.currency = data.currency;
      if (data.financialYear !== undefined) orgUpdate.financialYear = data.financialYear;
      if (data.pan !== undefined) orgUpdate.pan = data.pan;
      if (data.aadhaar !== undefined) orgUpdate.aadhaar = cleanAadhaar;
      if (data.gstin !== undefined) orgUpdate.gstin = data.gstin;
      if (data.logo !== undefined) orgUpdate.logo = data.logo;
      if (data.address !== undefined) orgUpdate.address = data.address;
      if (data.city !== undefined) orgUpdate.city = data.city;
      if (data.state !== undefined) orgUpdate.state = data.state;
      if (data.pincode !== undefined) orgUpdate.pincode = data.pincode;
      if (data.country !== undefined) orgUpdate.country = data.country;
      if (cleanBank) orgUpdate.bankDetails = cleanBank;

      await Organization.findByIdAndUpdate(user.organizationId, { $set: orgUpdate });
    }

    const updatedProfile = {
      id: String(user._id),
      name: data.name || user.name,
      email: data.email || user.email,
      phone: data.phone ?? user.phone,
      role: data.role ?? user.role,
      organizationName: data.organizationName || "My Organization",
      tradeName: data.tradeName ?? "",
      status: data.status ?? "active",
      currency: data.currency ?? "INR",
      financialYear: data.financialYear ?? getFinancialYear(),
      pan: data.pan,
      aadhaar: cleanAadhaar,
      gstin: data.gstin,
      logo: data.logo,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      country: data.country,
      bankDetails: data.bankDetails || {
        accountHolderName: "",
        accountNumber: "",
        ifsc: "",
        bankName: "",
        branch: "",
      },
    };

    return NextResponse.json({
      ok: true,
      message: "Profile updated successfully.",
      profile: updatedProfile,
    });
  } catch (error) {
    return handleRouteError(error, "update-profile");
  }
}
