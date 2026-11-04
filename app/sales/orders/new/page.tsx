import { Suspense } from "react";
import { NewSalesOrderForm } from "@/components/sales/new-sales-order-form";

export const metadata = {
  title: "New Sales Order | LedgerFlow",
  description: "Create a new sales order in LedgerFlow",
};

export default function NewSalesOrderPage() {
  return (
    <div className="max-w-5xl mx-auto py-2">
      <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading sales order form…</div>}>
        <NewSalesOrderForm />
      </Suspense>
    </div>
  );
}
