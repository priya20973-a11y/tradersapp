import { Suspense } from "react";
import { EditDeliveryChallanView } from "@/components/sales/edit-delivery-challan-view";

export const metadata = {
  title: "Edit Delivery Challan | LedgerFlow",
  description: "Edit existing delivery challan in LedgerFlow",
};

export default async function EditDeliveryChallanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading edit form…
        </div>
      }
    >
      <EditDeliveryChallanView id={id} />
    </Suspense>
  );
}

