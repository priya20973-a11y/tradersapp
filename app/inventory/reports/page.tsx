import { InventoryReportView } from "@/components/inventory/inventory-report-view";

export const metadata = {
  title: "Inventory Report | Trader App",
  description: "Consolidated multi-location stock report across all warehouses and shops with independent balances and valuation.",
};

export default function InventoryReportsPage() {
  return <InventoryReportView />;
}
