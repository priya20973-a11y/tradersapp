import { Suspense } from "react";
import { VendorCreditsDirectory } from "@/components/purchases/vendor-credits-directory";

export default function PurchasesVendorCreditsPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading vendor credits…
        </div>
      }
    >
      <VendorCreditsDirectory />
    </Suspense>
  );
}
