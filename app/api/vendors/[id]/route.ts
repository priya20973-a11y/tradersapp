import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Vendor } from "@/models";
import { vendorInputSchema } from "../route";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const vendor = await Vendor.findById(id).lean();
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    return NextResponse.json({ vendor });
  } catch (err: unknown) {
    console.error("GET /api/vendors/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch vendor" }, { status: 500 });
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
    await connectToDatabase();

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Check duplicate name excluding this vendor
    const escapedName = data.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existing = await Vendor.findOne({
      _id: { $ne: id },
      organizationId: vendor.organizationId,
      name: { $regex: new RegExp(`^${escapedName}$`, "i") },
    }).lean();

    if (existing) {
      return NextResponse.json(
        {
          error: `Another vendor with the display name "${data.displayName}" already exists.`,
        },
        { status: 409 },
      );
    }

    Object.assign(vendor, {
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

    await vendor.save();

    return NextResponse.json({
      message: "Vendor updated successfully",
      vendor,
    });
  } catch (err: unknown) {
    console.error("PUT /api/vendors/[id] error:", err);
    return NextResponse.json({ error: "Failed to update vendor" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const vendor = await Vendor.findByIdAndDelete(id);
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Vendor deleted successfully" });
  } catch (err: unknown) {
    console.error("DELETE /api/vendors/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete vendor" }, { status: 500 });
  }
}
