import { Suspense } from "react";
import { VendorForm } from "@/components/purchases/vendor-form";

export const metadata = {
  title: "New Vendor | LedgerFlow",
  description: "Create a new supplier or vendor account in LedgerFlow.",
};

export default function NewVendorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-96 flex items-center justify-center p-8 text-sm text-slate-500">
          Loading vendor form…
        </div>
      }
    >
      <VendorForm mode="create" />
    </Suspense>
  );
}
