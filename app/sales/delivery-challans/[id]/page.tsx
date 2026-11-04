import { Suspense } from "react";
import { DeliveryChallanDetailView } from "@/components/sales/delivery-challan-detail-view";

export const metadata = {
  title: "Delivery Challan Details | LedgerFlow",
  description: "View delivery challan details, download PDF, or print",
};

export default async function DeliveryChallanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading delivery challan…
        </div>
      }
    >
      <DeliveryChallanDetailView id={id} />
    </Suspense>
  );
}

