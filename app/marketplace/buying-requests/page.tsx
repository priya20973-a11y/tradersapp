import type { Metadata } from "next";
import { BuyingRequestsWorkspace } from "@/components/buying-requests/buying-requests-workspace";

export const metadata: Metadata = {
  title: "Buying Requests | Marketplace | LedgerFlow",
  description: "Create, view, and manage buyer requests, including commodity, quantity, target price, location, and request status.",
};

export default function MarketplaceBuyingRequestsPage() {
  return <BuyingRequestsWorkspace />;
}
