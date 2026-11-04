import { Suspense } from "react";
import { CreditNotesDirectory } from "@/components/sales/credit-notes-directory";

export const metadata = {
  title: "Credit Notes | Sales",
  description: "Manage sales credit notes and apply them to customer invoices.",
};

export default function CreditNotesPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading credit notes…
        </div>
      }
    >
      <CreditNotesDirectory />
    </Suspense>
  );
}

