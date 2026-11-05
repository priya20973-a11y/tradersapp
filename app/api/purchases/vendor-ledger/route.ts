import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Vendor, PurchaseBill, VendorPayment, VendorCredit } from "@/models";
import { calculateVendorLedger } from "@/lib/ledger-utils";

const DEMO_VENDORS = [
  {
    id: "demo-vend-1",
    name: "Mohan Traders",
    email: "mohan@traders.in",
    phone: "+91 98450 12345",
    gstin: "29AABCM5678J1Z2",
    state: "Karnataka",
    openingBalance: 18200,
    status: "Active",
  },
  {
    id: "demo-vend-2",
    name: "Shree Packaging Industries",
    email: "finance@shreepack.in",
    phone: "+91 98220 98765",
    gstin: "27AABCS4321K1Z4",
    state: "Maharashtra",
    openingBalance: 9600,
    status: "Active",
  },
  {
    id: "demo-vend-3",
    name: "Metro Logistics & Warehousing",
    email: "payables@metrologistics.in",
    phone: "+91 98111 22334",
    gstin: "27AABCM8765L1Z6",
    state: "Maharashtra",
    openingBalance: 12000,
    status: "Active",
  },
];

const DEMO_VENDOR_TRANSACTIONS = [
  {
    id: "demo-bill-1",
    date: "2026-10-03T09:00:00.000Z",
    type: "Purchase Bill" as const,
    referenceNumber: "BILL-4421",
    description: "Purchase Bill for Premium Pulses Lot A",
    amount: 68000,
  },
  {
    id: "demo-vpay-1",
    date: "2026-10-07T11:30:00.000Z",
    type: "Payment Made" as const,
    referenceNumber: "VPAY-0891",
    description: "Disbursement via NEFT (Ref: HDFCN2628109)",
    amount: 50000,
  },
  {
    id: "demo-bill-2",
    date: "2026-10-12T14:15:00.000Z",
    type: "Purchase Bill" as const,
    referenceNumber: "BILL-4424",
    description: "Purchase Bill for Moisture-proof Grain Sacks",
    amount: 32000,
  },
  {
    id: "demo-vpay-2",
    date: "2026-10-18T16:45:00.000Z",
    type: "Payment Made" as const,
    referenceNumber: "VPAY-0895",
    description: "Disbursement via IMPS (Ref: ICICI9928371192)",
    amount: 35000,
  },
];

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
      vendorsList = DEMO_VENDORS.map((v) => ({ _id: v.id, ...v }));
      selectedVendor =
        (requestedVendId && vendorsList.find((v) => String(v._id) === requestedVendId)) ||
        vendorsList[0] ||
        null;
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
      rawTransactions = DEMO_VENDOR_TRANSACTIONS;
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
