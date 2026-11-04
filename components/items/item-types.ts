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
