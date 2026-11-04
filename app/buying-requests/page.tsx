import type { Metadata } from "next";
import { BuyingRequestsWorkspace } from "@/components/buying-requests/buying-requests-workspace";

export const metadata: Metadata = {
  title: "Buying Requests | LedgerFlow",
  description: "Create buying demands, discover marketplace open requests, and submit competitive seller offers.",
};

export default function BuyingRequestsPage() {
  return <BuyingRequestsWorkspace />;
}
