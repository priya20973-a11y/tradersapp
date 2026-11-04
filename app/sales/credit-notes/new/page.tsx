import { Suspense } from "react";
import { NewCreditNoteForm } from "@/components/sales/new-credit-note-form";

export const metadata = {
  title: "New Credit Note | Sales",
  description: "Create a new sales credit note.",
};

export default function NewCreditNotePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50/50 p-8 text-sm text-slate-500">
          Loading credit note form…
        </div>
      }
    >
      <NewCreditNoteForm />
    </Suspense>
  );
}

