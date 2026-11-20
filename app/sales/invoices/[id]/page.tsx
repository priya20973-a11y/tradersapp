import { Suspense } from "react";
import { InvoiceDetailView } from "@/components/invoices/invoice-detail-view";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading invoice details…
        </div>
      }
    >
      <InvoiceDetailView id={id} />
    </Suspense>
  );
}
