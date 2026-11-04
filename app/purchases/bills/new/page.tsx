import { Suspense } from "react";
import { BillForm } from "@/components/purchases/bill-form";

export default function NewBillPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading new bill form…
        </div>
      }
    >
      <BillForm isEditMode={false} />
    </Suspense>
  );
}
