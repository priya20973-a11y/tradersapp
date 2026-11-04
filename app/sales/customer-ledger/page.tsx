import type { Metadata } from "next";
import { CustomerLedgerView } from "@/components/sales/customer-ledger-view";

export const metadata: Metadata = {
  title: "Customer Ledger | FinanceOS",
  description: "View customer-wise invoices, opening balance, debit, credit, payments received, and running ledger balance.",
};

export default function CustomerLedgerPage() {
  return <CustomerLedgerView />;
}
