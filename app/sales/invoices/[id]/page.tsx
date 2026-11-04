"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { type InvoiceRecord, type InvoiceSettingsData } from "@/components/invoices/invoice-types";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [settings, setSettings] = useState<InvoiceSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/sales/invoices/${id}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load invoice.");
        }
        if (isMounted) {
          setInvoice(data.invoice);
          setSettings(data.settings);
        }
      } catch (e: unknown) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : "Failed to load invoice.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, [id, refreshIndex]);

  const handleRefresh = useCallback(() => {
    setRefreshIndex((prev) => prev + 1);
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Loading invoice details...
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center">
        <h3 className="text-base font-bold text-rose-800">
          Invoice Not Found
        </h3>
        <p className="mt-1 text-xs text-rose-600">
          {error || "The requested invoice could not be located."}
        </p>
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

  return (
    <InvoicePreview
      invoice={invoice}
      settings={settings}
      onRefresh={handleRefresh}
    />
  );
}
