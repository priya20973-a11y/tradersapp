"use client";

import { Suspense, use } from "react";
import { CustomerDirectory } from "@/components/sales/customer-directory";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="min-h-96 bg-white p-8 text-sm text-slate-500">Loading customer profile…</div>}>
      <CustomerDirectory initialCustomerId={id} />
    </Suspense>
  );
}
