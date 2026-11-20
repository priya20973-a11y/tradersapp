import { WarehouseDashboard } from "@/components/inventory/warehouse-dashboard";

export const metadata = {
  title: "Warehouse Inventory | Trader App",
  description: "Track warehouse-wise commodity stock, reservations, ledger, and write-offs.",
};

export default function WarehouseInventoryPage() {
  return <WarehouseDashboard />;
}
