import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Expense, Organization } from "@/models";

export const expenseRowSchema = z.object({
  expenseAccount: z.string().trim().min(1, "Expense Account is required"),
  notes: z.string().trim().default(""),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
});

export const mileageDetailsSchema = z.object({
  employee: z.string().trim().default(""),
  calculationMethod: z.enum(["distance", "odometer"]).default("distance"),
  distance: z.coerce.number().min(0).default(0),
  unit: z.enum(["KM", "Mile"]).default("KM"),
  rate: z.coerce.number().min(0).default(12),
  startOdometer: z.coerce.number().min(0).default(0),
  endOdometer: z.coerce.number().min(0).default(0),
});

export const receiptSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().default(0),
  type: z.string().default(""),
  url: z.string().default(""),
  uploadedAt: z.string().default(""),
});

export const expenseInputSchema = z.object({
  expenseType: z.enum(["standard", "mileage", "bulk"]).default("standard"),
  date: z.string().min(1, "Date is required"),
  paidThrough: z.string().min(1, "Paid Through account is required"),
  currency: z.string().default("INR"),
  vendor: z.string().trim().default(""),
  invoiceNumber: z.string().trim().default(""),
  customerName: z.string().trim().default(""),
  notes: z.string().trim().default(""),
  amount: z.coerce.number().min(0).optional(),
  status: z.enum(["Paid", "Unbilled", "Reimbursable", "Draft"]).default("Paid"),
  billable: z.boolean().default(false),
  project: z.string().trim().default(""),
  reportingTags: z.array(z.string().trim()).default([]),
  items: z.array(expenseRowSchema).default([]),
  mileageDetails: mileageDetailsSchema.nullable().optional(),
  receipts: z.array(receiptSchema).default([]),
});

export const bulkExpenseInputSchema = z.object({
  bulk: z.literal(true),
  expenses: z.array(expenseInputSchema).min(1, "At least one expense is required in bulk submission"),
});

export const defaultDemoExpenses = [
  {
    id: "EXP-2026-081",
    referenceNumber: "EXP-2026-081",
    expenseType: "standard",
    date: "2026-10-20",
    paidThrough: "HDFC Primary Bank",
    currency: "INR",
    vendor: "Apex Freight Solutions",
    invoiceNumber: "TRK-98214",
    customerName: "Astra Foods",
    notes: "Interstate commodity transport to central warehouse",
    amount: 18400,
    status: "Paid",
    billable: true,
    project: "Grains Supply 2026",
    reportingTags: ["Freight", "North Region"],
    items: [
      {
        expenseAccount: "Freight & Shipping Charges",
        notes: "Full container shipping charge",
        amount: 18400,
      },
    ],
    receipts: [
      {
        id: "rc-1",
        name: "Lorry_Receipt_98214.pdf",
        size: 345000,
        type: "application/pdf",
        url: "",
        uploadedAt: "20 Oct 2026",
      },
    ],
  },
  {
    id: "EXP-2026-082",
    referenceNumber: "EXP-2026-082",
    expenseType: "standard",
    date: "2026-10-18",
    paidThrough: "ICICI Operational",
    currency: "INR",
    vendor: "Central Agro Warehousing",
    invoiceNumber: "WH-1092",
    customerName: "",
    notes: "Monthly storage charge for wheat stocks",
    amount: 45000,
    status: "Paid",
    billable: false,
    project: "Warehousing",
    reportingTags: ["Storage"],
    items: [
      {
        expenseAccount: "Warehouse & Storage Maintenance",
        notes: "Cold room temperature retention fees",
        amount: 45000,
      },
    ],
    receipts: [],
  },
  {
    id: "MIL-2026-015",
    referenceNumber: "MIL-2026-015",
    expenseType: "mileage",
    date: "2026-10-19",
    paidThrough: "Petty Cash Account",
    currency: "INR",
    vendor: "HP Fuel Station",
    invoiceNumber: "TRIP-2026-441",
    customerName: "City Retail",
    notes: "Field audit and lot inspection trip to Nashik depot",
    amount: 1020,
    status: "Paid",
    billable: true,
    project: "Field Audit",
    reportingTags: ["Travel", "Mileage"],
    items: [
      {
        expenseAccount: "Vehicle Fuel & Running Expenses",
        notes: "Mileage travel (85 KM @ ₹12.00/KM)",
        amount: 1020,
      },
    ],
    mileageDetails: {
      employee: "Rajesh Sharma",
      calculationMethod: "distance",
      distance: 85,
      unit: "KM",
      rate: 12,
      startOdometer: 14200,
      endOdometer: 14285,
    },
    receipts: [
      {
        id: "rc-2",
        name: "Toll_Plaza_Receipt.jpg",
        size: 182000,
        type: "image/jpeg",
        url: "",
        uploadedAt: "19 Oct 2026",
      },
    ],
  },
  {
    id: "MIL-2026-014",
    referenceNumber: "MIL-2026-014",
    expenseType: "mileage",
    date: "2026-10-16",
    paidThrough: "Employee Personal Funds (Reimbursable)",
    currency: "INR",
    vendor: "Indian Oil Corp",
    invoiceNumber: "TRIP-2026-439",
    customerName: "Astra Foods",
    notes: "Client factory visit for wheat moisture testing",
    amount: 1440,
    status: "Reimbursable",
    billable: true,
    project: "Quality Assurance",
    reportingTags: ["Client Visit"],
    items: [
      {
        expenseAccount: "Travel & Conveyance",
        notes: "120 KM travel reimbursement claim",
        amount: 1440,
      },
    ],
    mileageDetails: {
      employee: "Anil Kumar",
      calculationMethod: "odometer",
      distance: 120,
      unit: "KM",
      rate: 12,
      startOdometer: 22100,
      endOdometer: 22220,
    },
    receipts: [],
  },
  {
    id: "EXP-2026-083",
    referenceNumber: "EXP-2026-083",
    expenseType: "standard",
    date: "2026-10-14",
    paidThrough: "Petty Cash Account",
    currency: "INR",
    vendor: "AgriLab Quality Analysts",
    invoiceNumber: "LAB-4402",
    customerName: "Ganga Stores",
    notes: "Commodity lab certification for pesticide residues",
    amount: 7200,
    status: "Reimbursable",
    billable: true,
    project: "Testing & Compliance",
    reportingTags: ["Lab"],
    items: [
      {
        expenseAccount: "Quality Inspection & Testing Fees",
        notes: "Lab testing charges per sample",
        amount: 7200,
      },
    ],
    receipts: [],
  },
];

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
    const search = searchParams.get("search")?.toLowerCase();
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    const query: Record<string, unknown> = {};
    if (orgId) query.organizationId = orgId;
    if (type && type !== "all") query.expenseType = type;
    if (status && status !== "ALL") query.status = status;

    const dbExpenses = await Expense.find(query).sort({ date: -1, createdAt: -1 }).lean().catch(() => []);

    if (!dbExpenses || dbExpenses.length === 0) {
      // Filter demo fallback expenses
      let filtered = [...defaultDemoExpenses];
      if (type && type !== "all") {
        filtered = filtered.filter((e) => e.expenseType === type);
      }
      if (status && status !== "ALL") {
        filtered = filtered.filter((e) => e.status.toLowerCase() === status.toLowerCase());
      }
      if (search) {
        filtered = filtered.filter((e) =>
          [e.vendor, e.customerName, e.notes, e.referenceNumber, e.items?.[0]?.expenseAccount]
            .filter(Boolean)
            .some((val) => String(val).toLowerCase().includes(search)),
        );
      }

      return NextResponse.json({ expenses: filtered });
    }

    let results = dbExpenses.map((exp: Record<string, unknown>) => ({
      id: String(exp._id),
      _id: String(exp._id),
      referenceNumber: exp.referenceNumber || `EXP-${String(exp._id).slice(-4)}`,
      expenseType: exp.expenseType || "standard",
      date: exp.date || "",
      paidThrough: exp.paidThrough || "",
      currency: exp.currency || "INR",
      vendor: exp.vendor || "",
      invoiceNumber: exp.invoiceNumber || "",
      customerName: exp.customerName || "",
      notes: exp.notes || "",
      amount: Number(exp.amount || 0),
      status: exp.status || "Paid",
      billable: Boolean(exp.billable),
      project: exp.project || "",
      reportingTags: exp.reportingTags || [],
      items: exp.items || [],
      mileageDetails: exp.mileageDetails || null,
      receipts: exp.receipts || [],
    }));

    if (search) {
      results = results.filter((e) =>
        [e.vendor, e.customerName, e.notes, e.referenceNumber, (e.items as Array<{ expenseAccount?: string }>)?.[0]?.expenseAccount]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(search)),
      );
    }

    return NextResponse.json({ expenses: results });
  } catch (err: unknown) {
    console.error("GET /api/expenses error:", err);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
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

    // Check if bulk submission
    if (body && typeof body === "object" && "bulk" in body && body.bulk === true) {
      const bulkResult = bulkExpenseInputSchema.safeParse(body);
      if (!bulkResult.success) {
        return NextResponse.json(
          { error: "Validation failed on bulk expenses", details: bulkResult.error.flatten().fieldErrors },
          { status: 400 },
        );
      }

      const createdList = [];
      for (let i = 0; i < bulkResult.data.expenses.length; i++) {
        const item = bulkResult.data.expenses[i];
        const refNumber = `EXP-${Date.now().toString().slice(-4)}${i + 1}`;
        const totalAmount =
          typeof item.amount === "number" && item.amount > 0
            ? item.amount
            : item.items.reduce((sum, r) => sum + r.amount, 0);

        const newExp = await Expense.create({
          organizationId: orgId,
          referenceNumber: refNumber,
          expenseType: item.expenseType,
          date: item.date,
          paidThrough: item.paidThrough,
          currency: item.currency,
          vendor: item.vendor,
          invoiceNumber: item.invoiceNumber,
          customerName: item.customerName,
          notes: item.notes,
          amount: totalAmount,
          status: item.status,
          billable: item.billable,
          project: item.project,
          reportingTags: item.reportingTags,
          items:
            item.items.length > 0
              ? item.items
              : [{ expenseAccount: "General Purchases", notes: item.notes, amount: totalAmount }],
          mileageDetails: item.mileageDetails || null,
          receipts: item.receipts,
        });

        createdList.push({
          id: String(newExp._id),
          referenceNumber: refNumber,
          amount: totalAmount,
        });
      }

      return NextResponse.json(
        {
          message: `${createdList.length} expenses saved successfully`,
          expenses: createdList,
        },
        { status: 201 },
      );
    }

    // Single Expense / Mileage Submission
    const parseResult = expenseInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parseResult.data;
    const isMileage = data.expenseType === "mileage";
    const refPrefix = isMileage ? "MIL" : "EXP";
    const refNumber = `${refPrefix}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    let computedAmount = 0;
    if (isMileage && data.mileageDetails) {
      computedAmount = Math.round(data.mileageDetails.distance * data.mileageDetails.rate * 100) / 100;
      if (typeof data.amount === "number" && data.amount > 0) {
        computedAmount = data.amount;
      }
    } else if (data.items.length > 0) {
      computedAmount = data.items.reduce((sum, row) => sum + row.amount, 0);
    } else if (typeof data.amount === "number") {
      computedAmount = data.amount;
    }

    const newExpense = await Expense.create({
      organizationId: orgId,
      referenceNumber: refNumber,
      expenseType: data.expenseType,
      date: data.date,
      paidThrough: data.paidThrough,
      currency: data.currency,
      vendor: data.vendor,
      invoiceNumber: data.invoiceNumber,
      customerName: data.customerName,
      notes: data.notes,
      amount: computedAmount,
      status: data.status,
      billable: data.billable,
      project: data.project,
      reportingTags: data.reportingTags,
      items:
        data.items.length > 0
          ? data.items
          : [
              {
                expenseAccount: isMileage ? "Vehicle Fuel & Running Expenses" : "General Operating Expense",
                notes: data.notes,
                amount: computedAmount,
              },
            ],
      mileageDetails: data.mileageDetails || null,
      receipts: data.receipts,
    });

    return NextResponse.json(
      {
        message: `${isMileage ? "Mileage expense" : "Expense"} recorded successfully`,
        expense: {
          id: String(newExpense._id),
          referenceNumber: refNumber,
          amount: computedAmount,
          date: newExpense.date,
          status: newExpense.status,
        },
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("POST /api/expenses error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
