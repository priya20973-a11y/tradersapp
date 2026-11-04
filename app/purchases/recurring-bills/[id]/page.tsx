import { Suspense } from "react";
import { RecurringBillForm } from "@/components/purchases/recurring-bill-form";

export default async function EditRecurringBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading recurring bill editor…
        </div>
      }
    >
      <RecurringBillForm initialId={id} isEditMode={true} />
    </Suspense>
  );
}
