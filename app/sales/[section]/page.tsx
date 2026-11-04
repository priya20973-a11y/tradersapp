import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SalesWorkspace } from "@/components/sales/sales-workspace";
import { CustomerDirectory } from "@/components/sales/customer-directory";
import { CustomerLedgerView } from "@/components/sales/customer-ledger-view";
import { CustomerPaymentsDirectory } from "@/components/sales/customer-payments-directory";
import { QuotesDirectory } from "@/components/sales/quotes-directory";
import { SalesOrdersDirectory } from "@/components/sales/sales-orders-directory";
import { InvoicesDirectory } from "@/components/invoices/invoices-directory";
import { CreditNotesDirectory } from "@/components/sales/credit-notes-directory";
import { DeliveryChallansDirectory } from "@/components/sales/delivery-challans-directory";
import { WarehouseCatalog } from "@/components/trading/warehouse-catalog";

const salesSections = new Set([
  "customers",
  "customer-ledger",
  "payments",
  "payments-received",
  "quotes",
  "orders",
  "invoices",
  "recurring-invoices",
  "delivery-challans",
  "credit-notes",
  "warehouses",
]);

export function generateStaticParams() {
  return [...salesSections].map((section) => ({ section }));
}

export default async function SalesSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading sales section…</div>}>
      <SalesSectionContent params={params} />
    </Suspense>
  );
}

async function SalesSectionContent({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!salesSections.has(section)) notFound();
  if (section === "customers") return <CustomerDirectory />;
  if (section === "customer-ledger") return <CustomerLedgerView />;
  if (section === "payments" || section === "payments-received") return <CustomerPaymentsDirectory />;
  if (section === "quotes") return <QuotesDirectory />;
  if (section === "orders") return <SalesOrdersDirectory />;
  if (section === "invoices") return <InvoicesDirectory />;
  if (section === "credit-notes") return <CreditNotesDirectory />;
  if (section === "delivery-challans") return <DeliveryChallansDirectory />;
  if (section === "warehouses") return <WarehouseCatalog />;
  return <SalesWorkspace section={section as Parameters<typeof SalesWorkspace>[0]["section"]} />;
}
