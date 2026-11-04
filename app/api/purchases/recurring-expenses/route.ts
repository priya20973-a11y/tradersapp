import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { RecurringExpense, Organization } from "@/models";

export const recurringExpenseSchema = z.object({
  profileName: z.string().trim().min(1, "Profile Name is required"),
  repeatEvery: z.enum([
    "Week",
    "2 Weeks",
    "Month",
    "2 Months",
    "3 Months",
    "6 Months",
    "Year",
  ]).default("Month"),
  startDate: z.string().min(1, "Start Date is required"),
  endsOn: z.string().default(""),
  neverExpires: z.boolean().default(true),
  expenseAccount: z.string().trim().min(1, "Expense Account is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  currency: z.string().default("INR"),
  paidThrough: z.string().trim().min(1, "Paid Through account is required"),
  vendor: z.string().trim().default(""),
  notes: z.string().trim().max(500, "Notes cannot exceed 500 characters").default(""),
  customerName: z.string().trim().default(""),
  reportingTags: z.array(z.string().trim()).default([]),
  status: z.enum(["Active", "Paused", "Expired"]).default("Active"),
  nextDate: z.string().optional(),
});

export function calculateNextDate(startDateStr: string, repeatEvery: string): string {
  if (!startDateStr) return "";
  const d = new Date(startDateStr);
  if (isNaN(d.getTime())) return "";
  const next = new Date(d);
  switch (repeatEvery) {
    case "Week":
      next.setDate(next.getDate() + 7);
      break;
    case "2 Weeks":
      next.setDate(next.getDate() + 14);
      break;
    case "Month":
      next.setMonth(next.getMonth() + 1);
      break;
    case "2 Months":
      next.setMonth(next.getMonth() + 2);
      break;
    case "3 Months":
      next.setMonth(next.getMonth() + 3);
      break;
    case "6 Months":
      next.setMonth(next.getMonth() + 6);
      break;
    case "Year":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString().split("T")[0];
}

export const defaultDemoRecurringExpenses = [
  {
    _id: "demo-rec-01",
    id: "demo-rec-01",
    profileName: "Warehouse Lease - Unit B",
    repeatEvery: "Month",
    startDate: "2026-10-01",
    endsOn: "",
    neverExpires: true,
    nextDate: "2026-11-01",
    expenseAccount: "Warehouse & Storage Maintenance",
    amount: 75000,
    currency: "INR",
    paidThrough: "HDFC Primary Bank",
    vendor: "IndoSpace Properties",
    notes: "Monthly warehouse lease retainer including security deposit maintenance",
    customerName: "",
    reportingTags: ["Lease", "Warehouse"],
    status: "Active",
  },
  {
    _id: "demo-rec-02",
    id: "demo-rec-02",
    profileName: "Cloud ERP & Inventory License",
    repeatEvery: "Month",
    startDate: "2026-10-05",
    endsOn: "",
    neverExpires: true,
    nextDate: "2026-11-05",
    expenseAccount: "Software & Technology Subscriptions",
    amount: 22500,
    currency: "INR",
    paidThrough: "HDFC Primary Bank",
    vendor: "TechFlow Systems",
    notes: "Multi-seat inventory management software subscription",
    customerName: "",
    reportingTags: ["Software", "HQ"],
    status: "Active",
  },
  {
    _id: "demo-rec-03",
    id: "demo-rec-03",
    profileName: "Security & Surveillance Retainer",
    repeatEvery: "Month",
    startDate: "2026-10-07",
    endsOn: "",
    neverExpires: true,
    nextDate: "2026-11-07",
    expenseAccount: "Security Services",
    amount: 17500,
    currency: "INR",
    paidThrough: "ICICI Operational Bank",
    vendor: "Sentinel Security Services",
    notes: "24/7 CCTV surveillance and security guard staffing",
    customerName: "Astra Foods",
    reportingTags: ["Security"],
    status: "Active",
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
    const search = searchParams.get("search")?.toLowerCase().trim();
    const status = searchParams.get("status");

    const query: Record<string, unknown> = {};
    if (orgId) query.organizationId = orgId;
    if (status && status !== "ALL") query.status = status;

    const dbProfiles = await RecurringExpense.find(query)
      .sort({ createdAt: -1 })
      .lean()
      .catch(() => []);

    if (!dbProfiles || dbProfiles.length === 0) {
      let filtered = [...defaultDemoRecurringExpenses];
      if (status && status !== "ALL") {
        filtered = filtered.filter((p) => p.status.toLowerCase() === status.toLowerCase());
      }
      if (search) {
        filtered = filtered.filter((p) =>
          [p.profileName, p.expenseAccount, p.vendor, p.customerName, p.notes]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(search)),
        );
      }
      return NextResponse.json({ profiles: filtered });
    }

    let results = dbProfiles.map((p: Record<string, unknown>) => ({
      _id: String(p._id),
      id: String(p._id),
      profileName: String(p.profileName || ""),
      repeatEvery: String(p.repeatEvery || "Month"),
      startDate: String(p.startDate || ""),
      endsOn: String(p.endsOn || ""),
      neverExpires: Boolean(p.neverExpires),
      nextDate: String(p.nextDate || ""),
      expenseAccount: String(p.expenseAccount || ""),
      amount: Number(p.amount || 0),
      currency: String(p.currency || "INR"),
      paidThrough: String(p.paidThrough || ""),
      vendor: String(p.vendor || ""),
      notes: String(p.notes || ""),
      customerName: String(p.customerName || ""),
      reportingTags: Array.isArray(p.reportingTags) ? p.reportingTags : [],
      status: String(p.status || "Active"),
      lastGeneratedDate: String(p.lastGeneratedDate || ""),
      createdAt: p.createdAt ? String(p.createdAt) : "",
      updatedAt: p.updatedAt ? String(p.updatedAt) : "",
    }));

    if (search) {
      results = results.filter((p) =>
        [p.profileName, p.expenseAccount, p.vendor, p.customerName, p.notes]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search)),
      );
    }

    return NextResponse.json({ profiles: results });
  } catch (err: unknown) {
    console.error("GET /api/purchases/recurring-expenses error:", err);
    return NextResponse.json({ error: "Failed to fetch recurring expenses" }, { status: 500 });
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

    const parsed = recurringExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const computedNextDate = data.nextDate || calculateNextDate(data.startDate, data.repeatEvery);

    const doc = await RecurringExpense.create({
      organizationId: orgId,
      profileName: data.profileName,
      repeatEvery: data.repeatEvery,
      startDate: data.startDate,
      endsOn: data.neverExpires ? "" : data.endsOn,
      neverExpires: data.neverExpires,
      nextDate: computedNextDate,
      expenseAccount: data.expenseAccount,
      amount: data.amount,
      currency: data.currency,
      paidThrough: data.paidThrough,
      vendor: data.vendor,
      notes: data.notes,
      customerName: data.customerName,
      reportingTags: data.reportingTags,
      status: data.status,
    });

    return NextResponse.json(
      {
        message: "Recurring expense profile created successfully",
        recurringExpense: {
          ...doc.toObject(),
          id: String(doc._id),
          _id: String(doc._id),
        },
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("POST /api/purchases/recurring-expenses error:", err);
    return NextResponse.json({ error: "Failed to create recurring expense" }, { status: 500 });
  }
}
