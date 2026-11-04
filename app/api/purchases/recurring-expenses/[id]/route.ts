import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { RecurringExpense } from "@/models";
import {
  recurringExpenseSchema,
  calculateNextDate,
  defaultDemoRecurringExpenses,
} from "../route";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase().catch(() => null);

    const profile = await RecurringExpense.findById(id).lean().catch(() => null);
    if (!profile) {
      const demo = defaultDemoRecurringExpenses.find((p) => p.id === id || p._id === id);
      if (demo) {
        return NextResponse.json({ profile: demo });
      }
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

    const profile = await RecurringExpense.findById(id).catch(() => null);
    if (!profile) {
      if (id.startsWith("demo-") || id.startsWith("REC-")) {
        const computedNextDate = data.nextDate || calculateNextDate(data.startDate, data.repeatEvery);
        return NextResponse.json({
          message: "Recurring expense profile updated successfully",
          profile: {
            ...data,
            id,
            _id: id,
            nextDate: computedNextDate,
          },
        });
      }
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
    const profile = await RecurringExpense.findById(id).catch(() => null);
    if (!profile) {
      if (id.startsWith("demo-") || id.startsWith("REC-")) {
        return NextResponse.json({
          message: "Recurring expense updated",
          profile: { id, _id: id, ...body },
        });
      }
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
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase().catch(() => null);

    const deleted = await RecurringExpense.findByIdAndDelete(id).catch(() => null);
    if (!deleted && !id.startsWith("demo-") && !id.startsWith("REC-")) {
      return NextResponse.json({ error: "Recurring expense not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Recurring expense deleted successfully" });
  } catch (err: unknown) {
    console.error("DELETE /api/purchases/recurring-expenses/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete recurring expense" }, { status: 500 });
  }
}
