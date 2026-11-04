import { Suspense } from "react";
import { VendorsDirectory } from "@/components/purchases/vendors-directory";

export default function VendorsPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading vendors…
        </div>
      }
    >
      <VendorsDirectory />
    </Suspense>
  );
}
