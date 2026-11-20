import { ShopDashboard } from "@/components/inventory/shop-dashboard";

export const metadata = {
  title: "Shop Inventory | Trader App",
  description: "Track shop-wise commodity stock, ledger, retail movements, and damaged write-offs independently.",
};

export default function ShopInventoryPage() {
  return <ShopDashboard />;
}
