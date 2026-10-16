import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SalesWorkspace } from "@/components/sales/sales-workspace";
import { CustomerDirectory } from "@/components/sales/customer-directory";

const salesSections = new Set([
  "customers",
  "quotes",
  "orders",
  "invoices",
  "recurring-invoices",
  "delivery-challans",
  "payments-received",
  "credit-notes",
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
  return <SalesWorkspace section={section as Parameters<typeof SalesWorkspace>[0]["section"]} />;
}
