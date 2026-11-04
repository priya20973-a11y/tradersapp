import { Suspense } from "react";
import { BillsDirectory } from "@/components/purchases/bills-directory";

export default function PurchasesBillsPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading purchase bills…
        </div>
      }
    >
      <BillsDirectory />
    </Suspense>
  );
}
