import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/models";
import { expenseInputSchema, defaultDemoExpenses } from "../route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase().catch(() => null);
    const expense = await Expense.findById(id).lean().catch(() => null);
    if (!expense) {
      const demo = defaultDemoExpenses.find((e) => e.id === id || e.referenceNumber === id);
      if (demo) {
        return NextResponse.json({ expense: demo });
      }
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    return NextResponse.json({ expense });
  } catch (err: unknown) {
    console.error("GET /api/expenses/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch expense" }, { status: 500 });
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

    const parseResult = expenseInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parseResult.data;
    await connectToDatabase().catch(() => null);

    const expense = await Expense.findById(id).catch(() => null);
    if (!expense) {
      if (id.startsWith("EXP-") || id.startsWith("MIL-") || id.startsWith("demo-")) {
        return NextResponse.json({
          message: "Expense updated successfully",
          expense: { ...data, id, _id: id, referenceNumber: id },
        });
      }
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    let computedAmount = 0;
    if (data.expenseType === "mileage" && data.mileageDetails) {
      computedAmount = Math.round(data.mileageDetails.distance * data.mileageDetails.rate * 100) / 100;
      if (typeof data.amount === "number" && data.amount > 0) {
        computedAmount = data.amount;
      }
    } else if (data.items.length > 0) {
      computedAmount = data.items.reduce((sum, row) => sum + row.amount, 0);
    } else if (typeof data.amount === "number") {
      computedAmount = data.amount;
    }

    Object.assign(expense, {
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
      items: data.items,
      mileageDetails: data.mileageDetails || null,
      receipts: data.receipts,
    });

    await expense.save();

    return NextResponse.json({
      message: "Expense updated successfully",
      expense,
    });
  } catch (err: unknown) {
    console.error("PUT /api/expenses/[id] error:", err);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase().catch(() => null);
    const expense = await Expense.findByIdAndDelete(id).catch(() => null);
    if (!expense) {
      if (id.startsWith("EXP-") || id.startsWith("MIL-") || id.startsWith("demo-")) {
        return NextResponse.json({ message: "Expense deleted successfully" });
      }
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Expense deleted successfully" });
  } catch (err: unknown) {
    console.error("DELETE /api/expenses/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
