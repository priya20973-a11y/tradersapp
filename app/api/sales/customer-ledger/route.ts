import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Customer, SalesDocument } from "@/models";
import { calculateCustomerLedger } from "@/lib/ledger-utils";
import {
  databaseUnavailable,
  isDatabaseConnectionError,
  respondError,
} from "../sales-service";

const DEMO_CUSTOMERS = [
  {
    id: "demo-cust-1",
    name: "Astra Foods Ltd.",
    companyName: "Astra Foods Enterprises",
    email: "billing@astrafoods.in",
    phone: "+91 98200 11223",
    gstin: "27AABCA1234F1Z8",
    openingBalance: 25000,
    creditLimit: 200000,
    status: "Active",
  },
  {
    id: "demo-cust-2",
    name: "City Retail Supermarket",
    companyName: "City Retail India Pvt Ltd",
    email: "accounts@cityretail.in",
    phone: "+91 98199 44556",
    gstin: "27AAACC5678G2Z1",
    openingBalance: 15000,
    creditLimit: 150000,
    status: "Active",
  },
  {
    id: "demo-cust-3",
    name: "Ganga Stores & Provisions",
    companyName: "Ganga Trading Co.",
    email: "ap@gangastores.in",
    phone: "+91 98333 77889",
    gstin: "27AABCG9012H3Z4",
    openingBalance: 5000,
    creditLimit: 100000,
    status: "Active",
  },
];

const DEMO_TRANSACTIONS = [
  {
    id: "demo-inv-1",
    date: "2026-10-02T10:00:00.000Z",
    type: "Invoice" as const,
    referenceNumber: "INV-1025",
    description: "Tax Invoice for Basmati Rice (25kg Bags x 50)",
    amount: 55000,
  },
  {
    id: "demo-pay-1",
    date: "2026-10-06T14:30:00.000Z",
    type: "Payment Received" as const,
    referenceNumber: "PAY-0042",
    description: "Payment received via NEFT (Ref: HDFCN2628001)",
    amount: 30000,
  },
  {
    id: "demo-inv-2",
    date: "2026-10-11T11:15:00.000Z",
    type: "Invoice" as const,
    referenceNumber: "INV-1028",
    description: "Tax Invoice for Wheat Flour Sharbati (30 Bags)",
    amount: 42500,
  },
  {
    id: "demo-cn-1",
    date: "2026-10-14T16:00:00.000Z",
    type: "Credit Note" as const,
    referenceNumber: "CN-0014",
    description: "Credit note for damaged bag return (Ref: INV-1025)",
    amount: 2500,
  },
  {
    id: "demo-pay-2",
    date: "2026-10-19T09:45:00.000Z",
    type: "Payment Received" as const,
    referenceNumber: "PAY-0048",
    description: "Payment received via UPI (Ref: UPI/261019/9912)",
    amount: 40000,
  },
];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") ?? undefined;
    const requestedCustId = url.searchParams.get("customerId") ?? undefined;
    const startDate = url.searchParams.get("startDate") ?? undefined;
    const endDate = url.searchParams.get("endDate") ?? undefined;
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to view customer ledger.", 401);
    }

    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && requestedOrgId && isValidObjectId(requestedOrgId)) {
      organizationId = requestedOrgId;
    }

interface LedgerCustomerItem {
  _id: Types.ObjectId | string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  openingBalance?: number;
  creditLimit?: number;
  status?: string;
}

interface LedgerDocument {
  _id: Types.ObjectId | string;
  number?: string;
  receiptNumber?: string;
  issueDate?: Date | string;
  createdAt?: Date | string;
  type: string;
  total?: number;
  notes?: string;
  method?: string;
  status?: string;
  referenceNumber?: string;
}

    let customersList: LedgerCustomerItem[] = [];
    let selectedCustomer: LedgerCustomerItem | null = null;
    let documentsList: LedgerDocument[] = [];

    let isDbConnected = false;
    try {
      await connectToDatabase();
      isDbConnected = true;
    } catch {
      isDbConnected = false;
    }

    if (isDbConnected && organizationId && isValidObjectId(organizationId)) {
      const orgObjId = new Types.ObjectId(organizationId);

      customersList = await Customer.find({ organizationId: orgObjId })
        .select("_id name companyName email phone gstin openingBalance creditLimit status")
        .sort({ name: 1 })
        .lean();

      if (customersList.length > 0) {
        if (requestedCustId && isValidObjectId(requestedCustId)) {
          selectedCustomer = customersList.find((c) => String(c._id) === requestedCustId) ?? null;
        }
        if (!selectedCustomer) {
          selectedCustomer = customersList[0];
        }

        if (selectedCustomer) {
          const custObjId = new Types.ObjectId(String(selectedCustomer._id));
          documentsList = await SalesDocument.find({
            organizationId: orgObjId,
            customerId: custObjId,
            type: { $in: ["Invoice", "Payment Received", "Credit Note"] },
          })
            .sort({ issueDate: 1, createdAt: 1 })
            .lean();
        }
      }
    }

    // Fallback if no customer in DB or DB empty
    if (!selectedCustomer) {
      customersList = DEMO_CUSTOMERS.map((c) => ({
        _id: c.id,
        ...c,
      }));
      selectedCustomer =
        (requestedCustId && customersList.find((c) => String(c._id) === requestedCustId)) ||
        customersList[0];
      documentsList = DEMO_TRANSACTIONS.map((d) => ({
        _id: d.id,
        number: d.referenceNumber,
        issueDate: d.date,
        type: d.type,
        total: d.amount,
        notes: d.description,
      }));
    }

    const openingBalance = Number(selectedCustomer.openingBalance || 0);

    const rawTransactions = documentsList.map((doc) => {
      const docType = doc.type as "Invoice" | "Payment Received" | "Credit Note";
      let desc = String(doc.notes || "");
      if (!desc) {
        if (docType === "Invoice") desc = `Tax Invoice #${doc.number}`;
        else if (docType === "Payment Received") desc = `Payment Received (${doc.method || "Bank"})`;
        else desc = `Credit Note #${doc.number}`;
      }

      return {
        id: String(doc._id),
        date: (doc.issueDate || doc.createdAt || new Date()) as string | Date,
        type: docType,
        referenceNumber: String(doc.number || doc.receiptNumber || String(doc._id).slice(-6)),
        description: desc,
        amount: Number(doc.total || 0),
        rawDoc: {
          id: String(doc._id),
          number: doc.number,
          status: doc.status,
          method: doc.method,
          referenceNumber: doc.referenceNumber,
          notes: doc.notes,
        },
      };
    });

    const calculated = calculateCustomerLedger(openingBalance, rawTransactions, {
      startDate,
      endDate,
    });

    // Optional text filter on lines
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
      customer: {
        id: String(selectedCustomer._id),
        name: selectedCustomer.name,
        companyName: selectedCustomer.companyName || "",
        email: selectedCustomer.email || "",
        phone: selectedCustomer.phone || "",
        gstin: selectedCustomer.gstin || "",
        openingBalance,
        creditLimit: Number(selectedCustomer.creditLimit || 0),
        status: selectedCustomer.status || "Active",
      },
      customers: customersList.map((c) => ({
        id: String(c._id),
        name: c.name,
        companyName: c.companyName || "",
        openingBalance: Number(c.openingBalance || 0),
      })),
      summary: calculated.summary,
      lines: filteredLines,
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) return databaseUnavailable(error);
    console.error("GET /api/sales/customer-ledger error:", error);
    return respondError("Failed to fetch customer ledger.", 500);
  }
}
