import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  AuditEvent,
  Customer,
  DocumentSequence,
  InvoiceSettings,
  Organization,
  PaymentTerm,
  SalesDocument,
  User,
} from "@/models";
import {
  calculateInvoiceTotals,
  type CalculateItemInput,
} from "@/lib/invoice-utils";
import type { InvoiceItemPayload, InvoicePayload } from "@/lib/invoice-api-types";
import { calculateDueDateFromPaymentTerms } from "@/lib/payment-terms";
import {
  extractNumberPart,
  findNextAvailableInvoiceNumber,
  getFiscalYear,
} from "@/lib/invoice-numbering";
import {
  databaseUnavailable,
  getSalesScope,
  isDatabaseConnectionError,
  respondError,
} from "../sales-service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrganizationId = url.searchParams.get("organizationId") ?? undefined;
    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to access invoices.", 401);

    await connectToDatabase();
    if (session.user.id === "admin" && !requestedOrganizationId) {
      const organizations = await Organization.find({ status: "active" })
        .select("_id name")
        .sort({ name: 1 })
        .lean();
      return NextResponse.json({
        organizations: organizations.map((org) => ({
          id: String(org._id),
          name: org.name,
        })),
        invoices: [],
        stats: {
          totalInvoiced: 0,
          totalPaid: 0,
          totalOutstanding: 0,
          totalOverdue: 0,
          counts: { total: 0, draft: 0, sent: 0, partlyPaid: 0, paid: 0, overdue: 0, void: 0 },
        },
        customers: [],
        isAdmin: true,
      });
    }

    const scope = await getSalesScope(requestedOrganizationId, session);
    if ("error" in scope) return scope.error;

    const { organizationId } = scope;
    const search = url.searchParams.get("search")?.trim().toLowerCase();
    const statusFilter = url.searchParams.get("status")?.trim().toLowerCase();
    const customerIdFilter = url.searchParams.get("customerId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const query: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      type: "Invoice",
    };

    if (customerIdFilter && isValidObjectId(customerIdFilter)) {
      query.customerId = new Types.ObjectId(customerIdFilter);
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      query.issueDate = dateFilter;
    }

    const [invoicesRaw, customers, settingsDoc, org, userDoc] = await Promise.all([
      SalesDocument.find(query).sort({ issueDate: -1, createdAt: -1 }).lean(),
      Customer.find({ organizationId })
        .select("_id name companyName email phone gstin state paymentTerms billingAddress shippingAddress")
        .sort({ name: 1 })
        .lean(),
      InvoiceSettings.findOne({ organizationId }).lean(),
      Organization.findById(organizationId).select("name gstin currency logo").lean(),
      session.user.id
        ? User.findById(session.user.id).select("logo").lean()
        : User.findOne({ email: session.user.email }).select("logo").lean(),
    ]);

    const profileLogo = String(userDoc?.logo || org?.logo || "");
    const settings = settingsDoc
      ? {
          ...settingsDoc,
          companyDetails: {
            ...settingsDoc.companyDetails,
            logoUrl: settingsDoc.companyDetails?.logoUrl || profileLogo,
          },
          showCompanyLogo:
            settingsDoc.pdfTemplate?.showCompanyLogo !== undefined
              ? Boolean(settingsDoc.pdfTemplate.showCompanyLogo)
              : settingsDoc.showCompanyLogo !== undefined
              ? Boolean(settingsDoc.showCompanyLogo)
              : true,
          pdfTemplate: {
            ...settingsDoc.pdfTemplate,
            showCompanyLogo:
              settingsDoc.pdfTemplate?.showCompanyLogo !== undefined
                ? Boolean(settingsDoc.pdfTemplate.showCompanyLogo)
                : settingsDoc.showCompanyLogo !== undefined
                ? Boolean(settingsDoc.showCompanyLogo)
                : true,
          },
        }
      : null;

    const customerMap = new Map(
      customers.map((c) => [String(c._id), c]),
    );

    const now = new Date();

    // Map and calculate effective statuses & KPI statistics
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;

    const counts = {
      total: 0,
      draft: 0,
      sent: 0,
      partlyPaid: 0,
      paid: 0,
      overdue: 0,
      void: 0,
    };

    const formattedInvoices = invoicesRaw.map((inv) => {
      const id = String(inv._id);
      const cust = customerMap.get(String(inv.customerId));
      const customerName = inv.customerSnapshot?.name || cust?.name || "Unknown Customer";
      const customerCompany = inv.customerSnapshot?.companyName || cust?.companyName || "";

      const total = Number(inv.total ?? 0);
      const amountPaid = Number(inv.amountPaid ?? 0);
      const creditedAmount = Number(inv.creditedAmount ?? 0);
      const balanceDue = Math.max(0, Math.round((total - amountPaid - creditedAmount) * 100) / 100);

      // Determine dynamic status: if past due date and balance > 0 and not Void/Draft, treat as Overdue
      let effectiveStatus = inv.status;
      const isPastDue = inv.dueDate && new Date(inv.dueDate) < now && balanceDue > 0;

      if (inv.status === "Void") {
        effectiveStatus = "Void";
      } else if (balanceDue === 0 && total > 0) {
        effectiveStatus = "Paid";
      } else if (amountPaid > 0 && balanceDue > 0) {
        effectiveStatus = isPastDue ? "Overdue" : "Partially Paid";
      } else if (isPastDue && inv.status !== "Draft") {
        effectiveStatus = "Overdue";
      }

      // Aggregate stats
      if (effectiveStatus !== "Void") {
        totalInvoiced += total;
        totalPaid += amountPaid;
        totalOutstanding += balanceDue;
        if (effectiveStatus === "Overdue" || (isPastDue && inv.status !== "Draft")) {
          totalOverdue += balanceDue;
        }
      }

      counts.total += 1;
      if (effectiveStatus === "Draft") counts.draft += 1;
      else if (effectiveStatus === "Sent") counts.sent += 1;
      else if (effectiveStatus === "Partially Paid" || effectiveStatus === "Partly paid") counts.partlyPaid += 1;
      else if (effectiveStatus === "Paid") counts.paid += 1;
      else if (effectiveStatus === "Overdue") counts.overdue += 1;
      else if (effectiveStatus === "Void") counts.void += 1;

      return {
        id,
        number: inv.number,
        customerId: String(inv.customerId),
        customerName,
        customerCompany,
        customerSnapshot: inv.customerSnapshot,
        status: effectiveStatus,
        issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString() : "",
        dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : "",
        paymentTerms: inv.paymentTerms || "Due on Receipt",
        subTotal: Number(inv.subTotal ?? 0),
        discount: Number(inv.discount ?? 0),
        discountType: inv.discountType || "percent",
        taxAmount: Number(inv.taxAmount ?? 0),
        cgst: Number(inv.cgst ?? 0),
        sgst: Number(inv.sgst ?? 0),
        igst: Number(inv.igst ?? 0),
        shippingCharges: Number(inv.shippingCharges ?? 0),
        adjustment: Number(inv.adjustment ?? 0),
        roundOff: Number(inv.roundOff ?? 0),
        total,
        amountPaid,
        creditedAmount,
        balanceDue,
        currency: inv.currency || org?.currency || "INR",
        referenceNumber: inv.referenceNumber || "",
        salesperson: inv.salesperson || "",
        subject: inv.subject || "",
        notes: inv.notes || "",
        customerNotes: inv.customerNotes || "",
        termsAndConditions: inv.termsAndConditions || "",
        itemsCount: inv.items?.length || 0,
        emailsSentCount: inv.emailsSent?.length || 0,
        createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : "",
      };
    });

    // Apply search and status filters on results
    let filteredInvoices = formattedInvoices;

    if (statusFilter && statusFilter !== "all") {
      filteredInvoices = filteredInvoices.filter((inv) => {
        const s = inv.status.toLowerCase();
        if (statusFilter === "partially paid" || statusFilter === "partly paid") {
          return s === "partially paid" || s === "partly paid";
        }
        return s === statusFilter;
      });
    }

    if (search) {
      filteredInvoices = filteredInvoices.filter((inv) => {
        return (
          inv.number.toLowerCase().includes(search) ||
          String(inv.customerName).toLowerCase().includes(search) ||
          String(inv.customerCompany).toLowerCase().includes(search) ||
          inv.referenceNumber.toLowerCase().includes(search) ||
          inv.salesperson.toLowerCase().includes(search) ||
          inv.subject.toLowerCase().includes(search)
        );
      });
    }

    return NextResponse.json({
      invoices: filteredInvoices,
      stats: {
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        totalOverdue: Math.round(totalOverdue * 100) / 100,
        counts,
      },
      customers: customers.map((c) => ({
        id: String(c._id),
        name: c.name,
        companyName: c.companyName || "",
        email: c.email || "",
        phone: c.phone || "",
        gstin: c.gstin || "",
        state: c.state || "",
        paymentTerms: c.paymentTerms || "Due on Receipt",
        billingAddress: c.billingAddress,
        shippingAddress: c.shippingAddress,
      })),
      settings: settings || null,
      organizationName: org?.name || "LedgerFlow",
      isAdmin: scope.isAdmin,
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("GET /api/sales/invoices error:", error);
    return respondError("Failed to load invoices.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to create invoices.", 401);

    let payload: InvoicePayload;
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

    // Validate Customer
    const customerId = payload.customerId;
    if (!customerId || !isValidObjectId(customerId)) {
      return respondError("Select a valid customer.", 400);
    }

    const customer = await Customer.findOne({ _id: customerId, organizationId }).lean();
    if (!customer) {
      return respondError("Customer not found in this organization.", 404);
    }

    // Validate Items
    const rawItems: InvoiceItemPayload[] = Array.isArray(payload.items) ? payload.items : [];
    if (rawItems.length === 0) {
      return respondError("Add at least one item to the invoice.", 400);
    }

    const validItems: CalculateItemInput[] = rawItems.map((item) => ({
      quantity: Math.max(0, Number(item.quantity) || 1),
      rate: Math.max(0, Number(item.rate) || 0),
      discount: Math.max(0, Number(item.discount) || 0),
      discountType: item.discountType === "amount" ? "amount" : "percent",
      taxRate: Math.max(0, Number(item.taxRate) || 0),
    }));

    // Fetch Organization & InvoiceSettings for numbering & company defaults
    const [settings, org] = await Promise.all([
      InvoiceSettings.findOne({ organizationId }),
      Organization.findById(organizationId).lean(),
    ]);

    const orgState = settings?.companyDetails?.state || "";
    const placeOfSupply = (payload.placeOfSupply || customer.state || orgState).trim();

    // Run precise calculation
    const calculatedTotals = calculateInvoiceTotals({
      items: validItems,
      invoiceDiscount: Number(payload.discount) || 0,
      invoiceDiscountType: payload.discountType === "amount" ? "amount" : "percent",
      shippingCharges: Number(payload.shippingCharges) || 0,
      adjustment: Number(payload.adjustment) || 0,
      autoRoundOff: true,
      placeOfSupply,
      organizationState: orgState,
      amountPaid: 0,
    });

    // Concurrency-safe unique invoice number allocation
    let invoiceNumber = (payload.number || "").trim();
    const autoGenerate = settings?.autoGenerateNumbering !== false;
    const prefix = settings?.invoicePrefix || "INV-";
    const padding = settings?.numberZeroPadding || 6;
    const currentFY = getFiscalYear();

    if (!invoiceNumber) {
      if (!autoGenerate) {
        return respondError("Invoice number is required when manual numbering is enabled.", 400);
      }

      // Check fiscal year restart
      let baseNextNumber = settings?.nextNumber || 1;
      if (
        settings?.restartNumberingEachFiscalYear &&
        settings.lastFiscalYear &&
        settings.lastFiscalYear !== currentFY
      ) {
        baseNextNumber = 1;
      }

      // Find next available sequential number that does not collide
      const escapedPrefix = prefix.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      const existingInvoices = await SalesDocument.find({
        organizationId,
        type: "Invoice",
        number: { $regex: `^${escapedPrefix}` },
      }).select("number").lean();

      const existingSet = new Set(existingInvoices.map((inv) => inv.number));
      const allocated = findNextAvailableInvoiceNumber(prefix, baseNextNumber, padding, existingSet);
      invoiceNumber = allocated.invoiceNumber;

      // Update settings nextNumber
      await InvoiceSettings.updateOne(
        { organizationId },
        { $set: { nextNumber: allocated.allocatedNumber + 1, lastFiscalYear: currentFY } }
      );
      await DocumentSequence.updateOne(
        { organizationId, modelName: "Invoice" },
        { $set: { nextNumber: allocated.allocatedNumber, prefix } },
        { upsert: true }
      );
    } else {
      // User provided an invoice number (either prefilled from auto-generate or typed manually)
      // Check collision
      const existing = await SalesDocument.findOne({
        organizationId,
        type: "Invoice",
        number: invoiceNumber,
      }).select("_id");
      if (existing) {
        return respondError(`Invoice number ${invoiceNumber} already exists.`, 409);
      }

      // If auto-generate is active, advance the nextNumber counter
      if (autoGenerate) {
        const numPart = extractNumberPart(invoiceNumber, prefix);
        if (numPart !== null) {
          const nextVal = Math.max(numPart + 1, (settings?.nextNumber || 1) + 1);
          await InvoiceSettings.updateOne(
            { organizationId },
            { $set: { nextNumber: nextVal, lastFiscalYear: currentFY } }
          );
          await DocumentSequence.updateOne(
            { organizationId, modelName: "Invoice" },
            { $set: { nextNumber: nextVal - 1, prefix } },
            { upsert: true }
          );
        }
      }
    }

    // Snapshot Customer details
    const customerSnapshot = {
      name: String(customer.name || "Customer"),
      companyName: customer.companyName ? String(customer.companyName) : "",
      gstin: customer.gstin ? String(customer.gstin) : "",
      pan: customer.pan ? String(customer.pan) : "",
      email: customer.email ? String(customer.email) : "",
      phone: customer.phone ? String(customer.phone) : (customer.mobile ? String(customer.mobile) : ""),
      mobile: customer.mobile ? String(customer.mobile) : "",
      billingAddress: customer.billingAddress as Record<string, unknown> | undefined,
      shippingAddress: customer.shippingAddress as Record<string, unknown> | undefined,
    };

    // Snapshot Items with computed amounts
    const itemsSnapshot = rawItems.map((item, idx: number) => {
      const calc = calculatedTotals.items[idx];
      return {
        itemId: item.itemId && isValidObjectId(item.itemId) ? new Types.ObjectId(item.itemId) : undefined,
        name: (item.name || "").trim() || "Item",
        description: (item.description || "").trim(),
        hsnCode: (item.hsnCode || "").trim(),
        unit: (item.unit || "pcs").trim(),
        quantity: calc.quantity,
        rate: calc.rate,
        discount: Number(item.discount) || 0,
        discountType: (item.discountType === "amount" ? "amount" : "percent") as "amount" | "percent",
        taxRate: calc.taxRate,
        taxAmount: calc.taxAmount,
        amount: calc.amount,
      };
    });

    // Bank Details Snapshot
    const bankDetailsSnapshot = settings?.bankDetails
      ? {
          bankName: settings.bankDetails.bankName,
          accountHolder: settings.bankDetails.accountHolder,
          accountNumber: settings.bankDetails.accountNumber,
          ifsc: settings.bankDetails.ifsc,
          branch: settings.bankDetails.branch,
          upiId: settings.bankDetails.upiId,
        }
      : undefined;

    // Issue Date and Due Date
    const issueDate = payload.issueDate ? new Date(payload.issueDate) : new Date();
    let dueDate: Date | undefined;
    if (payload.dueDate) {
      dueDate = new Date(payload.dueDate);
    } else {
      // Calculate due date based on payment terms (supporting custom and standard terms)
      const terms = payload.paymentTerms || settings?.defaultPaymentTerms || customer.paymentTerms || "Due on Receipt";
      const dbTerms = await PaymentTerm.find({ organizationId }).lean().catch(() => []);
      const formattedTerms = dbTerms.map((t) => ({ name: t.name, days: t.days, isCustom: true }));
      const dateStr = calculateDueDateFromPaymentTerms(issueDate, terms, formattedTerms);
      dueDate = new Date(dateStr);
    }

    const initialStatus = payload.status === "Sent" ? "Sent" : "Draft";

    const newInvoice = (await SalesDocument.create({
      organizationId: new Types.ObjectId(organizationId),
      type: "Invoice",
      number: invoiceNumber,
      customerId: new Types.ObjectId(String(customer._id)),
      status: initialStatus,
      issueDate,
      dueDate,
      paymentTerms: payload.paymentTerms || settings?.defaultPaymentTerms || "Due on Receipt",
      salesperson: (payload.salesperson || "").trim(),
      subject: (payload.subject || "").trim(),
      referenceNumber: (payload.referenceNumber || "").trim(),
      customerNotes: payload.customerNotes || settings?.defaultNotes || "Thank you for your business.",
      termsAndConditions: payload.termsAndConditions || settings?.defaultTerms || "",
      placeOfSupply,
      currency: String(settings?.currency || org?.currency || "INR"),
      subTotal: calculatedTotals.subTotal,
      discount: calculatedTotals.totalDiscount,
      discountType: payload.discountType === "amount" ? "amount" : "percent",
      taxRate: calculatedTotals.items[0]?.taxRate || 0,
      taxAmount: calculatedTotals.totalTax,
      cgst: calculatedTotals.cgst,
      sgst: calculatedTotals.sgst,
      igst: calculatedTotals.igst,
      shippingCharges: calculatedTotals.shippingCharges,
      adjustment: calculatedTotals.adjustment,
      roundOff: calculatedTotals.roundOff,
      total: calculatedTotals.grandTotal,
      amountPaid: 0,
      creditedAmount: 0,
      customerSnapshot,
      bankDetailsSnapshot,
      items: itemsSnapshot,
      emailsSent: [],
    }));

    // Record Audit Event
    await AuditEvent.create({
      organizationId,
      actorId: String(session.user.id),
      action: "CREATE_INVOICE",
      entityType: "Invoice",
      entityId: String(newInvoice._id),
      changes: {
        number: invoiceNumber,
        total: calculatedTotals.grandTotal,
        customerName: customer.name,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        invoice: {
          id: String(newInvoice._id),
          number: newInvoice.number,
          total: newInvoice.total,
          status: newInvoice.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("POST /api/sales/invoices error:", error);
    return respondError("Failed to create invoice.", 500);
  }
}
