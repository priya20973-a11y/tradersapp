import { Suspense } from "react";
import { ExpenseForm } from "@/components/expenses/expense-form";

export const metadata = {
  title: "Record Expense | LedgerFlow",
  description: "Record single expenses, mileage claims, or bulk expenses in LedgerFlow.",
};

export default function NewExpensePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-96 flex items-center justify-center p-8 text-sm text-slate-500">
          Loading expense form…
        </div>
      }
    >
      <ExpenseForm mode="create" />
    </Suspense>
  );
}
