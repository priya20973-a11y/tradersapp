import { Suspense } from "react";
import { VendorCreditForm } from "@/components/purchases/vendor-credit-form";

export default function NewVendorCreditPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading vendor credit editor…
        </div>
      }
    >
      <VendorCreditForm isEditMode={false} />
    </Suspense>
  );
}
