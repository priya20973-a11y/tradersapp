import { Suspense } from "react";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export const metadata = {
  title: "New Invoice | LedgerFlow",
  description: "Create a new commercial tax invoice in LedgerFlow",
};

export default function NewInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading invoice form…
        </div>
      }
    >
      <InvoiceForm />
    </Suspense>
  );
}
