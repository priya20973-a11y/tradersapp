import { Suspense } from "react";
import { SalesOrdersDirectory } from "@/components/sales/sales-orders-directory";

export const metadata = {
  title: "Sales Orders | LedgerFlow",
  description: "Manage sales orders, fulfillment, and invoices in LedgerFlow",
};

export default function SalesOrdersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading sales orders…</div>}>
      <SalesOrdersDirectory />
    </Suspense>
  );
}
