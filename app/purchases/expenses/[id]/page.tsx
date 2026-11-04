import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/models";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { defaultDemoExpenses } from "@/app/api/expenses/route";

export const metadata = {
  title: "Expense Details | LedgerFlow",
  description: "View and edit recorded expenses and mileage claims in LedgerFlow.",
};

export default async function ExpenseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const { mode: requestedMode } = await searchParams;

  await connectToDatabase().catch(() => null);
  const expenseDoc = await Expense.findById(id).lean().catch(() => null);

  let expenseData: Record<string, unknown> | null = null;

  if (expenseDoc) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = expenseDoc as Record<string, any>;
    expenseData = {
      id: String(doc._id),
      _id: String(doc._id),
      referenceNumber: doc.referenceNumber || "",
      expenseType: doc.expenseType || "standard",
      date: doc.date || "",
      paidThrough: doc.paidThrough || "Petty Cash Account",
      currency: doc.currency || "INR",
      vendor: doc.vendor || "",
      invoiceNumber: doc.invoiceNumber || "",
      customerName: doc.customerName || "",
      notes: doc.notes || "",
      amount: Number(doc.amount || 0),
      status: doc.status || "Paid",
      billable: Boolean(doc.billable),
      project: doc.project || "",
      reportingTags: Array.isArray(doc.reportingTags) ? doc.reportingTags : [],
      items: Array.isArray(doc.items)
        ? doc.items.map((it: { expenseAccount?: string; notes?: string; amount?: number }) => ({
            expenseAccount: it.expenseAccount || "",
            notes: it.notes || "",
            amount: Number(it.amount || 0),
          }))
        : [],
      mileageDetails: doc.mileageDetails
        ? {
            employee: doc.mileageDetails.employee || "",
            calculationMethod: doc.mileageDetails.calculationMethod || "distance",
            distance: Number(doc.mileageDetails.distance || 0),
            unit: doc.mileageDetails.unit || "KM",
            rate: Number(doc.mileageDetails.rate || 12),
            startOdometer: Number(doc.mileageDetails.startOdometer || 0),
            endOdometer: Number(doc.mileageDetails.endOdometer || 0),
          }
        : null,
      receipts: Array.isArray(doc.receipts) ? doc.receipts : [],
    };
  } else {
    // Check fallback demo expenses
    const demo = defaultDemoExpenses.find((e) => e.id === id || e.referenceNumber === id);
    if (demo) {
      expenseData = demo as unknown as Record<string, unknown>;
    }
  }

  if (!expenseData) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-96 flex items-center justify-center p-8 text-sm text-slate-500">
          Loading expense details…
        </div>
      }
    >
      <ExpenseForm
        initialData={expenseData}
        mode={requestedMode === "edit" ? "edit" : "view"}
        expenseId={id}
      />
    </Suspense>
  );
}
