import { Suspense } from "react";
import { InvoicesDirectory } from "@/components/invoices/invoices-directory";

export const metadata = {
  title: "Invoices | LedgerFlow",
  description: "Search, filter, manage invoices, record payments and track collections.",
};

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
            Loading invoices directory…
          </div>
        }
      >
        <InvoicesDirectory />
      </Suspense>
    </div>
  );
}
