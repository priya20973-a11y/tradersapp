import { Suspense } from "react";
import { NewDeliveryChallanForm } from "@/components/sales/new-delivery-challan-form";

export const metadata = {
  title: "New Delivery Challan | LedgerFlow",
  description: "Create a new outbound delivery challan in LedgerFlow",
};

export default function NewDeliveryChallanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading form…</div>}>
      <NewDeliveryChallanForm />
    </Suspense>
  );
}

