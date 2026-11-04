"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { type InvoiceRecord } from "@/components/invoices/invoice-types";

export default function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sales/invoices/${id}`)
      .then((res) => res.json())
      .then((data: { invoice?: InvoiceRecord; error?: string }) => {
        if (data.invoice) {
          setInvoice(data.invoice);
        } else {
          setError(data.error || "Invoice not found.");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Loading invoice for editing...
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center">
        <h3 className="text-base font-bold text-rose-800">
          Cannot Edit Invoice
        </h3>
        <p className="mt-1 text-xs text-rose-600">{error || "Invoice not found."}</p>
        <div className="mt-5">
          <Link
            href="/sales/invoices"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  return <InvoiceForm initialData={invoice} isEditing={true} />;
}
