import { Suspense } from "react";
import { BillDetailView } from "@/components/purchases/bill-detail-view";

export default async function ViewBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading bill details…
        </div>
      }
    >
      <BillDetailView id={id} />
    </Suspense>
  );
}
