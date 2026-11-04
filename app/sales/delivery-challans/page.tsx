import { Suspense } from "react";
import { DeliveryChallansDirectory } from "@/components/sales/delivery-challans-directory";

export const metadata = {
  title: "Delivery Challans | LedgerFlow",
  description: "Manage outbound delivery challans and shipments in LedgerFlow",
};

export default function DeliveryChallansPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading delivery challans…</div>}>
      <DeliveryChallansDirectory />
    </Suspense>
  );
}

