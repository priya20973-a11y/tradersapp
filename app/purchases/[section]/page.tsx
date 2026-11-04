import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VendorsDirectory } from "@/components/purchases/vendors-directory";
import { VendorLedgerView } from "@/components/purchases/vendor-ledger-view";
import { VendorPaymentsDirectory } from "@/components/purchases/vendor-payments-directory";
import { ExpensesDirectory } from "@/components/expenses/expenses-directory";
import { PurchaseOrdersDirectory } from "@/components/purchases/purchase-orders-directory";
import { RecurringExpensesDirectory } from "@/components/purchases/recurring-expenses-directory";
import { BillsDirectory } from "@/components/purchases/bills-directory";
import { RecurringBillsDirectory } from "@/components/purchases/recurring-bills-directory";
import { VendorCreditsDirectory } from "@/components/purchases/vendor-credits-directory";
import { PurchasesWorkspace, type PurchasesSection } from "@/components/purchases/purchases-workspace";

const purchasesSections = new Set([
  "vendors",
  "vendor-ledger",
  "payments",
  "payments-made",
  "expenses",
  "recurring-expenses",
  "purchase-orders",
  "bills",
  "recurring-bills",
  "vendor-credits",
]);

export function generateStaticParams() {
  return [...purchasesSections].map((section) => ({ section }));
}

export default async function PurchasesSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading purchases section…
        </div>
      }
    >
      <PurchasesSectionContent params={params} />
    </Suspense>
  );
}

async function PurchasesSectionContent({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!purchasesSections.has(section)) notFound();
  if (section === "vendors") {
    return <VendorsDirectory />;
  }
  if (section === "vendor-ledger") {
    return <VendorLedgerView />;
  }
  if (section === "payments" || section === "payments-made") {
    return <VendorPaymentsDirectory />;
  }
  if (section === "expenses") {
    return <ExpensesDirectory />;
  }
  if (section === "recurring-expenses") {
    return <RecurringExpensesDirectory />;
  }
  if (section === "purchase-orders") {
    return <PurchaseOrdersDirectory />;
  }
  if (section === "bills") {
    return <BillsDirectory />;
  }
  if (section === "recurring-bills") {
    return <RecurringBillsDirectory />;
  }
  if (section === "vendor-credits") {
    return <VendorCreditsDirectory />;
  }
  return <PurchasesWorkspace section={section as PurchasesSection} />;
}
