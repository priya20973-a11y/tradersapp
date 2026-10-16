import { Suspense } from "react";
import { NewCustomerForm } from "@/components/sales/new-customer-form";

export default function NewCustomerPage() {
  return (
    <Suspense fallback={<main className="min-h-96 bg-white p-8 text-sm text-slate-500">Loading customer form…</main>}>
      <NewCustomerForm />
    </Suspense>
  );
}
