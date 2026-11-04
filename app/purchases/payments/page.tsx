import type { Metadata } from "next";
import { VendorPaymentsDirectory } from "@/components/purchases/vendor-payments-directory";

export const metadata: Metadata = {
  title: "Vendor Payments | FinanceOS",
  description: "Record supplier remittances, bank transfers, purchase bill settlements, and outgoing payment audit.",
};

export default function VendorPaymentsPage() {
  return <VendorPaymentsDirectory />;
}
