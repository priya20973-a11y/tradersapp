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

    if (!selectedCustomer) {
      return NextResponse.json({
        customer: null,
        customers: [],
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
