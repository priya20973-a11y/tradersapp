import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  AuditEvent,
  DocumentSequence,
  InvoiceSettings,
  Organization,
  User,
  type InvoiceSettingsRecord,
} from "@/models";
import {
  formatInvoiceNumber,
  getFiscalYear,
  parseNextNumberInput,
} from "@/lib/invoice-numbering";
import {
  databaseUnavailable,
  getSalesScope,
  isDatabaseConnectionError,
  respondError,
} from "../../sales-service";

interface InvoiceSettingsPayload {
  organizationId?: string;
  autoGenerateNumbering?: boolean;
  invoicePrefix?: string;
  nextNumber?: string | number;
  numberZeroPadding?: number;
  restartNumberingEachFiscalYear?: boolean;
  defaultPaymentTerms?: string;
  defaultNotes?: string;
  defaultTerms?: string;
  currency?: string;
  defaultTaxRate?: number;
  showCompanyLogo?: boolean;
  companyDetails?: Partial<InvoiceSettingsRecord["companyDetails"]>;
  bankDetails?: Partial<InvoiceSettingsRecord["bankDetails"]>;
  pdfTemplate?: Partial<InvoiceSettingsRecord["pdfTemplate"]>;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrganizationId = url.searchParams.get("organizationId") ?? undefined;
    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to access settings.", 401);

    const scope = await getSalesScope(requestedOrganizationId, session);
    if ("error" in scope) return scope.error;

    const { organizationId } = scope;
    await connectToDatabase();

    const [settingsDoc, org, userDoc] = await Promise.all([
      InvoiceSettings.findOne({ organizationId }).lean(),
      Organization.findById(organizationId).lean(),
      session.user.id
        ? User.findById(session.user.id).lean()
        : User.findOne({ email: session.user.email }).lean(),
    ]);

    let settings = settingsDoc;
    const profileLogo = String(userDoc?.logo || org?.logo || "");
    const orgName = org?.name ? String(org.name) : "Bharat Traders & Commodities Ltd.";
    const orgTradeName = org?.tradeName ? String(org.tradeName) : "LedgerFlow";
    const orgGstin = org?.gstin ? String(org.gstin) : "";
    const orgCurrency = org?.currency ? String(org.currency) : "INR";

    if (!settings) {
      // Create defaults seeded from organization and user profile
      settings = await InvoiceSettings.create({
        organizationId: new Types.ObjectId(organizationId),
        invoicePrefix: "INV-",
        nextNumber: 1,
        autoGenerateNumbering: true,
        numberZeroPadding: 6,
        restartNumberingEachFiscalYear: false,
        lastFiscalYear: getFiscalYear(),
        defaultPaymentTerms: "Due on Receipt",
        defaultNotes: "Thank you for your business. Please reach out with any questions.",
        defaultTerms:
          "1. Payment is due as per the terms specified above.\n2. Please quote invoice number in all payment remittances.\n3. Goods once sold will not be returned without prior authorization.",
        currency: orgCurrency,
        defaultTaxRate: 18,
        showCompanyLogo: true,
        companyDetails: {
          legalName: orgName,
          tradeName: orgTradeName,
          gstin: orgGstin,
          pan: "",
          email: "billing@ledgerflow.io",
          phone: "+91 98765 43210",
          website: "https://ledgerflow.io",
          address: "Plot 42, APMC Market Yard",
          city: "Navi Mumbai",
          state: "Maharashtra",
          postalCode: "400705",
          country: "India",
          logoUrl: profileLogo,
        },
        bankDetails: {
          bankName: "HDFC Bank Ltd.",
          accountHolder: orgName,
          accountNumber: "50200012345678",
          ifsc: "HDFC0001234",
          branch: "Vashi Sector 19",
          upiId: "bharattraders@hdfcbank",
        },
        pdfTemplate: {
          layout: "modern",
          accentColor: "#2563eb",
          showCompanyLogo: true,
          showQrCode: true,
          showSignature: true,
          signatureLabel: "Authorized Signatory",
        },
      });
    }

    const currentFY = getFiscalYear();
    let currentNext = settings.nextNumber || 1;
    let lastFY = settings.lastFiscalYear || "";

    if (settings.restartNumberingEachFiscalYear && lastFY && lastFY !== currentFY) {
      currentNext = 1;
      lastFY = currentFY;
      await InvoiceSettings.updateOne(
        { _id: settings._id },
        { $set: { nextNumber: 1, lastFiscalYear: currentFY } }
      );
    }

    const padding = settings.numberZeroPadding || 6;
    const prefix = settings.invoicePrefix || "INV-";
    const formattedNextNumber = formatInvoiceNumber(prefix, currentNext, padding);

    const resolvedLogoUrl = settings.companyDetails?.logoUrl || profileLogo;
    const showCompanyLogo =
      settings.pdfTemplate?.showCompanyLogo !== undefined
        ? Boolean(settings.pdfTemplate.showCompanyLogo)
        : settings.showCompanyLogo !== undefined
        ? Boolean(settings.showCompanyLogo)
        : true;

    const enrichedSettings = {
      ...settings,
      showCompanyLogo,
      companyDetails: {
        ...(settings.companyDetails || {}),
        logoUrl: resolvedLogoUrl,
      },
      pdfTemplate: {
        ...(settings.pdfTemplate || {}),
        showCompanyLogo,
      },
      nextNumber: currentNext,
      autoGenerateNumbering: settings.autoGenerateNumbering ?? true,
      numberZeroPadding: padding,
      restartNumberingEachFiscalYear: Boolean(settings.restartNumberingEachFiscalYear),
      lastFiscalYear: lastFY,
      formattedNextNumber,
    };

    return NextResponse.json({
      settings: enrichedSettings,
      organization: {
        id: String(org?._id),
        name: org?.name || "",
        tradeName: org?.tradeName || "",
        gstin: org?.gstin || "",
      },
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("GET settings error:", error);
    return respondError("Failed to fetch settings.", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to update settings.", 401);

    let payload: InvoiceSettingsPayload;
    try {
      payload = await request.json();
    } catch {
      return respondError("Submit valid JSON data.", 400);
    }

    const requestedOrganizationId = payload.organizationId as string | undefined;
    const scope = await getSalesScope(requestedOrganizationId, session);
    if ("error" in scope) return scope.error;

    const { organizationId } = scope;
    await connectToDatabase();

    const updateData: Record<string, unknown> = {};

    if (payload.autoGenerateNumbering !== undefined) {
      updateData.autoGenerateNumbering = Boolean(payload.autoGenerateNumbering);
    }
    if (payload.invoicePrefix !== undefined) {
      updateData.invoicePrefix = String(payload.invoicePrefix).trim() || "INV-";
    }
    if (payload.nextNumber !== undefined) {
      const parsed = parseNextNumberInput(payload.nextNumber);
      updateData.nextNumber = parsed.nextNumber;
      if (payload.numberZeroPadding === undefined) {
        updateData.numberZeroPadding = parsed.padding;
      }
    }
    if (payload.numberZeroPadding !== undefined) {
      updateData.numberZeroPadding = Math.max(1, Number(payload.numberZeroPadding) || 6);
    }
    if (payload.restartNumberingEachFiscalYear !== undefined) {
      updateData.restartNumberingEachFiscalYear = Boolean(payload.restartNumberingEachFiscalYear);
      updateData.lastFiscalYear = getFiscalYear();
    }
    if (payload.defaultPaymentTerms !== undefined) updateData.defaultPaymentTerms = String(payload.defaultPaymentTerms);
    if (payload.defaultNotes !== undefined) updateData.defaultNotes = String(payload.defaultNotes);
    if (payload.defaultTerms !== undefined) updateData.defaultTerms = String(payload.defaultTerms);
    if (payload.currency !== undefined) updateData.currency = String(payload.currency);
    if (payload.defaultTaxRate !== undefined) updateData.defaultTaxRate = Number(payload.defaultTaxRate) || 0;

    const [org, userDoc] = await Promise.all([
      Organization.findById(organizationId).lean(),
      session.user.id
        ? User.findById(session.user.id).lean()
        : User.findOne({ email: session.user.email }).lean(),
    ]);
    const profileLogo = String(userDoc?.logo || org?.logo || "");

    const logoOption =
      payload.showCompanyLogo !== undefined
        ? Boolean(payload.showCompanyLogo)
        : payload.pdfTemplate && payload.pdfTemplate.showCompanyLogo !== undefined
        ? Boolean(payload.pdfTemplate.showCompanyLogo)
        : undefined;

    if (logoOption !== undefined) {
      updateData.showCompanyLogo = logoOption;
    }

    if (payload.companyDetails && typeof payload.companyDetails === "object") {
      updateData.companyDetails = {
        legalName: String(payload.companyDetails.legalName || "").trim(),
        tradeName: String(payload.companyDetails.tradeName || "").trim(),
        gstin: String(payload.companyDetails.gstin || "").trim().toUpperCase(),
        pan: String(payload.companyDetails.pan || "").trim().toUpperCase(),
        email: String(payload.companyDetails.email || "").trim(),
        phone: String(payload.companyDetails.phone || "").trim(),
        website: String(payload.companyDetails.website || "").trim(),
        address: String(payload.companyDetails.address || "").trim(),
        city: String(payload.companyDetails.city || "").trim(),
        state: String(payload.companyDetails.state || "").trim(),
        postalCode: String(payload.companyDetails.postalCode || "").trim(),
        country: String(payload.companyDetails.country || "India").trim(),
        logoUrl: String(payload.companyDetails.logoUrl || profileLogo || "").trim(),
      };
    }

    if (payload.bankDetails && typeof payload.bankDetails === "object") {
      updateData.bankDetails = {
        bankName: String(payload.bankDetails.bankName || "").trim(),
        accountHolder: String(payload.bankDetails.accountHolder || "").trim(),
        accountNumber: String(payload.bankDetails.accountNumber || "").trim(),
        ifsc: String(payload.bankDetails.ifsc || "").trim().toUpperCase(),
        branch: String(payload.bankDetails.branch || "").trim(),
        upiId: String(payload.bankDetails.upiId || "").trim(),
      };
    }

    if (payload.pdfTemplate && typeof payload.pdfTemplate === "object") {
      updateData.pdfTemplate = {
        layout: payload.pdfTemplate.layout && ["modern", "classic", "minimal"].includes(payload.pdfTemplate.layout)
          ? payload.pdfTemplate.layout
          : "modern",
        accentColor: String(payload.pdfTemplate.accentColor || "#2563eb").trim(),
        showCompanyLogo:
          payload.pdfTemplate.showCompanyLogo !== undefined
            ? Boolean(payload.pdfTemplate.showCompanyLogo)
            : logoOption !== undefined
            ? logoOption
            : true,
        showQrCode: Boolean(payload.pdfTemplate.showQrCode ?? true),
        showSignature: Boolean(payload.pdfTemplate.showSignature ?? true),
        signatureLabel: String(payload.pdfTemplate.signatureLabel || "Authorized Signatory").trim(),
      };
    }

    const settings = await InvoiceSettings.findOneAndUpdate(
      { organizationId },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Sync sequence counter for concurrency safety
    if (updateData.nextNumber !== undefined || updateData.invoicePrefix !== undefined) {
      await DocumentSequence.findOneAndUpdate(
        { organizationId, modelName: "Invoice" },
        {
          $set: {
            prefix: settings.invoicePrefix || "INV-",
            nextNumber: Math.max(0, (settings.nextNumber || 1) - 1),
          },
        },
        { upsert: true }
      );
    }

    await AuditEvent.create({
      organizationId,
      actorId: String(session.user.id),
      action: "UPDATE_INVOICE_SETTINGS",
      entityType: "InvoiceSettings",
      entityId: String(settings._id),
      changes: {
        prefix: settings.invoicePrefix,
        nextNumber: settings.nextNumber,
        autoGenerateNumbering: settings.autoGenerateNumbering,
        showCompanyLogo: settings.showCompanyLogo,
      },
    });

    const padding = settings.numberZeroPadding || 6;
    const prefix = settings.invoicePrefix || "INV-";
    const formattedNextNumber = formatInvoiceNumber(prefix, settings.nextNumber || 1, padding);
    const settingsObj = settings.toObject();
    const resolvedLogoUrl = settingsObj.companyDetails?.logoUrl || profileLogo;
    const showCompanyLogo =
      settingsObj.pdfTemplate?.showCompanyLogo !== undefined
        ? Boolean(settingsObj.pdfTemplate.showCompanyLogo)
        : settingsObj.showCompanyLogo !== undefined
        ? Boolean(settingsObj.showCompanyLogo)
        : true;

    return NextResponse.json({
      ok: true,
      settings: {
        ...settingsObj,
        showCompanyLogo,
        companyDetails: {
          ...(settingsObj.companyDetails || {}),
          logoUrl: resolvedLogoUrl,
        },
        pdfTemplate: {
          ...(settingsObj.pdfTemplate || {}),
          showCompanyLogo,
        },
        formattedNextNumber,
      },
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("PUT settings error:", error);
    return respondError("Failed to save settings.", 500);
  }
}
