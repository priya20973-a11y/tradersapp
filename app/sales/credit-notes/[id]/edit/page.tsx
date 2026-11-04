"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { NewCreditNoteForm } from "@/components/sales/new-credit-note-form";
import type { CreditNoteFormInitialData } from "@/components/sales/new-credit-note-form";

export default function EditCreditNotePage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<CreditNoteFormInitialData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/sales/credit-notes/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.creditNote) {
          setInitialData(data.creditNote);
        } else {
          setError(data.error || "Failed to load credit note.");
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load credit note.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
        <p className="text-sm">Loading credit note for editing…</p>
      </div>
    );
  }

  if (error || !initialData) {
    return (
      <div className="p-8 text-center text-rose-600">
        <p className="text-sm font-semibold">{error || "Credit note not found"}</p>
      </div>
    );
  }

  return <NewCreditNoteForm initialData={initialData} isEditMode={true} />;
}
