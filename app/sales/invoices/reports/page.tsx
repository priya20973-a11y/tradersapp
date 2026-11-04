import { Suspense } from "react";
import { InvoiceReportsView } from "@/components/invoices/invoice-reports-view";

export const metadata = {
  title: "Invoice Reports | LedgerFlow",
  description: "Customer outstanding, overdue invoices aging, and payment collection tracking.",
};

export default function InvoiceReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading invoice reports…
        </div>
      }
    >
      <InvoiceReportsView />
    </Suspense>
  );
}
