import { StockTransferView } from "@/components/inventory/stock-transfer-view";

export const metadata = {
  title: "Stock Transfers | Trader App",
  description: "Transfer commodity stock between Warehouses and Shops atomically with complete audit ledger.",
};

export default function StockTransfersPage() {
  return <StockTransferView />;
}
