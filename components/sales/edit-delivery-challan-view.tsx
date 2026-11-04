"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { NewDeliveryChallanForm } from "./new-delivery-challan-form";
import { type DeliveryChallanDocument } from "./delivery-challan/delivery-challan-types";

export function EditDeliveryChallanView({ id }: { id: string }) {
  const [result, setResult] = useState<{
    id: string;
    challan: DeliveryChallanDocument | null;
    error: string | null;
  } | null>(null);
  const loading = result?.id !== id;
  const challan = result?.id === id ? result.challan : null;
  const error = result?.id === id ? result.error : null;

  useEffect(() => {
    let isMounted = true;

    fetch(`/api/sales/delivery-challans/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Delivery challan not found");
        return res.json();
      })
      .then((data) => {
        if (isMounted) setResult({ id, challan: data.deliveryChallan, error: null });
      })
      .catch((err) => {
        if (isMounted) {
          setResult({
            id,
            challan: null,
            error: err instanceof Error ? err.message : "Failed to load delivery challan",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        Loading delivery challan form…
      </div>
    );
  }

  if (error || !challan) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center space-y-4">
        <p className="text-sm font-semibold text-rose-600">{error || "Not found"}</p>
        <Link
          href="/sales/delivery-challans"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Delivery Challans
        </Link>
      </div>
    );
  }

  return <NewDeliveryChallanForm initialData={challan} isEditMode={true} />;
}
