import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Vendor, PurchaseBill, VendorPayment, VendorCredit } from "@/models";
import { calculateVendorLedger } from "@/lib/ledger-utils";

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") ?? undefined;
    const requestedVendId = url.searchParams.get("vendorId") ?? undefined;
    const startDate = url.searchParams.get("startDate") ?? undefined;
    const endDate = url.searchParams.get("endDate") ?? undefined;
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to view vendor ledger.", 401);
    }

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && requestedOrgId && isValidObjectId(requestedOrgId)) {
      organizationId = requestedOrgId;
    }

    if (!organizationId) {
      return respondError("Unauthorized", 401);
    }

    type LedgerVendorItem = {
      _id: unknown;
      name: string;
      email?: string;
      phone?: string;
      gstin?: string;
      state?: string;
      openingBalance?: number;
      status?: string;
    };

    type VendorLedgerTx = {
      id: string;
      date: string | Date;
      type: "Purchase Bill" | "Payment Made" | "Vendor Credit";
      referenceNumber: string;
      description?: string;
      amount: number;
      rawDoc?: Record<string, unknown>;
    };

    type PurchaseBillRecord = {
      _id: unknown;
      billDate?: unknown;
      createdAt?: unknown;
      billNumber?: unknown;
      notes?: unknown;
      total?: unknown;
      amountPaid?: unknown;
      status?: unknown;
    };

    type VendorPaymentRecord = {
      _id: unknown;
      paymentDate?: unknown;
      createdAt?: unknown;
      paymentNumber?: unknown;
      notes?: unknown;
      paymentMode?: unknown;
      amount?: unknown;
      referenceNumber?: unknown;
      status?: unknown;
    };

    type VendorCreditRecord = {
      _id: unknown;
      vendorCreditDate?: unknown;
      createdAt?: unknown;
      creditNoteNumber?: unknown;
      subject?: unknown;
      notes?: unknown;
      total?: unknown;
      status?: unknown;
      balanceRemaining?: unknown;
    };

    let vendorsList: LedgerVendorItem[] = [];
    let selectedVendor: LedgerVendorItem | null = null;
    let billsList: PurchaseBillRecord[] = [];
    let paymentsList: VendorPaymentRecord[] = [];
    let creditsList: VendorCreditRecord[] = [];

    let isDbConnected = false;
    try {
      await connectToDatabase();
      isDbConnected = true;
    } catch {
      isDbConnected = false;
    }

    if (isDbConnected && organizationId && isValidObjectId(organizationId)) {
      const orgObjId = new Types.ObjectId(organizationId);

      vendorsList = await Vendor.find({ organizationId: orgObjId })
        .select("_id name email phone gstin state openingBalance status")
        .sort({ name: 1 })
        .lean();

      if (vendorsList.length > 0) {
        const matchedVendor = requestedVendId && isValidObjectId(requestedVendId)
          ? vendorsList.find((v) => String(v._id) === requestedVendId)
          : undefined;

        selectedVendor = matchedVendor ?? vendorsList[0] ?? null;

        if (selectedVendor) {
          const vendObjId = new Types.ObjectId(String(selectedVendor._id));
          const [bills, payments, credits] = await Promise.all([
            PurchaseBill.find({ organizationId: orgObjId, vendorId: vendObjId }).sort({ billDate: 1 }).lean(),
            VendorPayment.find({ organizationId: orgObjId, vendorId: vendObjId }).sort({ paymentDate: 1 }).lean(),
            VendorCredit.find({ organizationId: orgObjId, vendorId: vendObjId, status: { $ne: "Void" } }).sort({ vendorCreditDate: 1 }).lean(),
          ]);
          billsList = bills;
          paymentsList = payments;
          creditsList = credits;
        }
      }
    }

    if (!selectedVendor) {
      return NextResponse.json({
        vendor: null,
        vendors: vendorsList.map((v) => ({
          id: String(v._id),
          name: v.name,
          openingBalance: Number(v.openingBalance || 0),
        })),
        summary: {
          openingBalance: 0,
          totalDebit: 0,
          totalCredit: 0,
          closingBalance: 0,
          netOutstanding: 0,
          transactionCount: 0,
        },
        lines: [],
      });
    }

    const openingBalance = Number(selectedVendor.openingBalance || 0);

    let rawTransactions: VendorLedgerTx[] = [];

    if (billsList.length > 0 || paymentsList.length > 0 || creditsList.length > 0) {
      const formattedBills: VendorLedgerTx[] = billsList.map((b) => ({
        id: String(b._id),
        date: (b.billDate as string | Date | undefined) || (b.createdAt as string | Date | undefined) || new Date(),
        type: "Purchase Bill",
        referenceNumber: String(b.billNumber ?? ""),
        description: String(b.notes ?? `Purchase Bill #${b.billNumber ?? ""}`),
        amount: Number(b.total ?? 0),
        rawDoc: {
          id: String(b._id),
          number: b.billNumber,
          status: b.status,
          total: b.total,
          amountPaid: b.amountPaid,
        },
      }));

      const formattedPayments: VendorLedgerTx[] = paymentsList.map((p) => ({
        id: String(p._id),
        date: (p.paymentDate as string | Date | undefined) || (p.createdAt as string | Date | undefined) || new Date(),
        type: "Payment Made",
        referenceNumber: String(p.paymentNumber ?? ""),
        description: String(p.notes ?? `Payment Made (${p.paymentMode ?? ""})`),
        amount: Number(p.amount ?? 0),
        rawDoc: {
          id: String(p._id),
          number: p.paymentNumber,
          mode: p.paymentMode,
          ref: p.referenceNumber,
          status: p.status,
        },
      }));

      const formattedCredits: VendorLedgerTx[] = creditsList.map((c) => ({
        id: String(c._id),
        date: (c.vendorCreditDate as string | Date | undefined) || (c.createdAt as string | Date | undefined) || new Date(),
        type: "Vendor Credit",
        referenceNumber: String(c.creditNoteNumber ?? ""),
        description: String(c.subject ?? c.notes ?? `Vendor Credit #${c.creditNoteNumber ?? ""}`),
        amount: Number(c.total ?? 0),
        rawDoc: {
          id: String(c._id),
          number: c.creditNoteNumber,
          status: c.status,
          total: c.total,
          balanceRemaining: c.balanceRemaining,
        },
      }));

      rawTransactions = [...formattedBills, ...formattedPayments, ...formattedCredits];
    } else {
      rawTransactions = [];
    }

    const calculated = calculateVendorLedger(openingBalance, rawTransactions, {
      startDate,
      endDate,
    });

    let filteredLines = calculated.lines;
    if (search) {
      filteredLines = calculated.lines.filter(
        (l) =>
          l.type === "Opening Balance" ||
          l.referenceNumber.toLowerCase().includes(search) ||
          l.description.toLowerCase().includes(search) ||
          l.type.toLowerCase().includes(search),
      );
    }

    return NextResponse.json({
      vendor: {
        id: String(selectedVendor._id),
        name: selectedVendor.name,
        email: selectedVendor.email || "",
        phone: selectedVendor.phone || "",
        gstin: selectedVendor.gstin || "",
        state: selectedVendor.state || "",
        openingBalance,
        status: selectedVendor.status || "Active",
      },
      vendors: vendorsList.map((v) => ({
        id: String(v._id),
        name: v.name,
        openingBalance: Number(v.openingBalance || 0),
      })),
      summary: calculated.summary,
      lines: filteredLines,
    });
  } catch (error) {
    console.error("GET /api/purchases/vendor-ledger error:", error);
    return respondError("Failed to fetch vendor ledger.", 500);
  }
}
