import type { Metadata } from "next";
import { BuyerDirectory } from "@/components/buyers/buyer-directory";

export const metadata: Metadata = {
  title: "Find Buyers | Marketplace | LedgerFlow",
  description: "Search, filter, and view potential buyers based on commodity, location, and business requirements.",
};

export default function MarketplaceFindBuyersPage() {
  return <BuyerDirectory />;
}
