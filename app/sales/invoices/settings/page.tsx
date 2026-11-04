import { Suspense } from "react";
import { InvoiceSettingsForm } from "@/components/invoices/invoice-settings-form";

export const metadata = {
  title: "Invoice Settings | LedgerFlow",
  description: "Configure invoice prefixes, numbering, banking details, and PDF layout.",
};

export default function InvoiceSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading invoice settings…
        </div>
      }
    >
      <InvoiceSettingsForm />
    </Suspense>
  );
}
