import { Suspense } from "react";
import { NewQuoteForm } from "@/components/sales/new-quote-form";

export const metadata = {
  title: "New Quote | LedgerFlow",
  description: "Create a new sales quote in LedgerFlow",
};

export default function NewQuotePage() {
  return (
    <div className="max-w-5xl mx-auto py-2">
      <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading quote form…</div>}>
        <NewQuoteForm />
      </Suspense>
    </div>
  );
}
