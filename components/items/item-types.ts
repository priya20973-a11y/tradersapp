export interface ItemRecord {
  id: string;
  name: string;
  sku: string;
  type: "goods" | "service";
  unit: string;
  salesPrice: number;
  purchasePrice: number;
  salesAccount?: string;
  purchaseAccount?: string;
  salesDescription?: string;
  purchaseDescription?: string;
  preferredVendor?: string;
  stock: number;
  active: boolean;
  hsnCode?: string;
  commodityCategory?: string;
  category?: string;
  openingStock?: number;
  trackSales?: boolean;
  trackPurchase?: boolean;
  inventoryTracking?: boolean;
}

export type SortField = "name" | "salesPrice" | "purchasePrice" | "stock";
export type SortOrder = "asc" | "desc";
export type ViewMode = "table" | "grid";
export type TypeFilter = "all" | "goods" | "service" | "low_stock";

export const formatCurrency = (val: number) => {
  return "₹" + (val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const getMarginColorClass = (marginPercent: number | null) => {
  if (marginPercent === null) return "";
  if (marginPercent < 0) return "text-red-500";
  if (marginPercent >= 20) return "text-emerald-600";
  if (marginPercent > 0) return "text-blue-600";
  return "text-slate-400";
};
