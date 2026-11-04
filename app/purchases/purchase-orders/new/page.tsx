import { Suspense } from "react";
import { PurchaseOrderForm } from "@/components/purchases/purchase-order-form";

export const metadata = {
  title: "New Purchase Order | LedgerFlow",
  description: "Create and dispatch purchase orders to suppliers in LedgerFlow.",
};

export default function NewPurchaseOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-96 flex items-center justify-center p-8 text-sm text-slate-500">
          Loading purchase order form…
        </div>
      }
    >
      <PurchaseOrderForm mode="create" />
    </Suspense>
  );
}
