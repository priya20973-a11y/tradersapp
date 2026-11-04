import type { Metadata } from "next";
import { VendorLedgerView } from "@/components/purchases/vendor-ledger-view";

export const metadata: Metadata = {
  title: "Vendor Ledger | FinanceOS",
  description: "View vendor-wise purchase bills, opening balance, debit, credit, payments made, and running ledger balance.",
};

export default function VendorLedgerPage() {
  return <VendorLedgerView />;
}
