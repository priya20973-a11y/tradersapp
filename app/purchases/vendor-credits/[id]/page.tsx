import { Suspense } from "react";
import { VendorCreditForm } from "@/components/purchases/vendor-credit-form";

export default async function EditVendorCreditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading vendor credit editor…
        </div>
      }
    >
      <VendorCreditForm initialId={id} isEditMode={true} />
    </Suspense>
  );
}
