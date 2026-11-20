import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { RecurringExpense } from "@/models";
import { recurringExpenseSchema, calculateNextDate } from "../route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase().catch(() => null);

    const session = await getServerSession(authOptions).catch(() => null);
    const requestedOrgId = new URL(request.url).searchParams.get("organizationId");
    const orgId = session?.user?.id === "admin" && requestedOrgId ? requestedOrgId : session?.user?.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await RecurringExpense.findOne({ _id: id, organizationId: orgId }).lean().catch(() => null);
    if (!profile) {
      return NextResponse.json({ error: "Recurring expense profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      profile: {
        ...profile,
        id: String(profile._id),
        _id: String(profile._id),
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/purchases/recurring-expenses/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch recurring expense" }, { status: 500 });
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

    const parsed = recurringExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    await connectToDatabase().catch(() => null);

    const session = await getServerSession(authOptions).catch(() => null);
    const requestedOrgId = new URL(request.url).searchParams.get("organizationId");
    const orgId = session?.user?.id === "admin" && requestedOrgId ? requestedOrgId : session?.user?.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await RecurringExpense.findOne({ _id: id, organizationId: orgId }).catch(() => null);
    if (!profile) {
      return NextResponse.json({ error: "Recurring expense profile not found" }, { status: 404 });
    }

    const computedNextDate = data.nextDate || calculateNextDate(data.startDate, data.repeatEvery);

    Object.assign(profile, {
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

    await profile.save();

    return NextResponse.json({
      message: "Recurring expense profile updated successfully",
      profile: {
        ...profile.toObject(),
        id: String(profile._id),
        _id: String(profile._id),
      },
    });
  } catch (err: unknown) {
    console.error("PUT /api/purchases/recurring-expenses/[id] error:", err);
    return NextResponse.json({ error: "Failed to update recurring expense" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    await connectToDatabase().catch(() => null);

    const session = await getServerSession(authOptions).catch(() => null);
    const requestedOrgId = new URL(request.url).searchParams.get("organizationId");
    const orgId = session?.user?.id === "admin" && requestedOrgId ? requestedOrgId : session?.user?.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await RecurringExpense.findOne({ _id: id, organizationId: orgId }).catch(() => null);
    if (!profile) {
      return NextResponse.json({ error: "Recurring expense not found" }, { status: 404 });
    }

    if (typeof body.status === "string" && ["Active", "Paused", "Expired"].includes(body.status)) {
      profile.status = body.status;
    }

    await profile.save();
    return NextResponse.json({
      message: "Status updated successfully",
      profile: { ...profile.toObject(), id: String(profile._id), _id: String(profile._id) },
    });
  } catch (err: unknown) {
    console.error("PATCH /api/purchases/recurring-expenses/[id] error:", err);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase().catch(() => null);

    const session = await getServerSession(authOptions).catch(() => null);
    const requestedOrgId = new URL(request.url).searchParams.get("organizationId");
    const orgId = session?.user?.id === "admin" && requestedOrgId ? requestedOrgId : session?.user?.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deleted = await RecurringExpense.findOneAndDelete({ _id: id, organizationId: orgId }).catch(() => null);
    if (!deleted) {
      return NextResponse.json({ error: "Recurring expense not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Recurring expense deleted successfully" });
  } catch (err: unknown) {
    console.error("DELETE /api/purchases/recurring-expenses/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete recurring expense" }, { status: 500 });
  }
}
