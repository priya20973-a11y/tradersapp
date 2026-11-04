import type { Metadata } from "next";
import { BuyerDirectory } from "@/components/buyers/buyer-directory";

export const metadata: Metadata = {
  title: "Find Buyers | LedgerFlow",
  description: "Browse verified commodity buyers, food processors, and wholesale merchants across India.",
};

export default function FindBuyersPage() {
  return <BuyerDirectory />;
}
