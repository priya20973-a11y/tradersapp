import type { Metadata } from "next";
import { CustomerPaymentsDirectory } from "@/components/sales/customer-payments-directory";

export const metadata: Metadata = {
  title: "Customer Payments | FinanceOS",
  description: "Record customer collections, bank receipts, UPI/cheque settlements, and invoice reconciliations.",
};

export default function CustomerPaymentsPage() {
  return <CustomerPaymentsDirectory />;
}
