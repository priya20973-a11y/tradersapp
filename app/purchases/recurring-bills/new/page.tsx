import { Suspense } from "react";
import { RecurringBillForm } from "@/components/purchases/recurring-bill-form";

export default function NewRecurringBillPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading recurring bill editor…
        </div>
      }
    >
      <RecurringBillForm isEditMode={false} />
    </Suspense>
  );
}
