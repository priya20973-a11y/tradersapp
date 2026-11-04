import type { Metadata } from "next";
import { TraderDirectory } from "@/components/trading/trader-directory";

export const metadata: Metadata = {
  title: "Trader | Marketplace | LedgerFlow",
  description: "Marketplace Trader module - coming soon.",
};

export default function MarketplaceTradersPage() {
  return <TraderDirectory />;
}
