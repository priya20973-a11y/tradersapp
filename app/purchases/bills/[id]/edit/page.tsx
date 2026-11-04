import { Suspense } from "react";
import { BillForm } from "@/components/purchases/bill-form";

export default async function EditBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading bill editor…
        </div>
      }
    >
      <BillForm initialId={id} isEditMode={true} />
    </Suspense>
  );
}
