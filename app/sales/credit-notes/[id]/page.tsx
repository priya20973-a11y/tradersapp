import { Suspense } from "react";
import { CreditNoteDetailView } from "@/components/sales/credit-note-detail-view";

export const metadata = {
  title: "Credit Note Details | Sales",
  description: "View sales credit note details and application history.",
};

export default async function CreditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading credit note…
        </div>
      }
    >
      <CreditNoteDetailView id={id} />
    </Suspense>
  );
}

