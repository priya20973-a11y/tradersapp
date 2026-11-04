export interface CustomerOption {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  billingAddress?: {
    attention?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  shippingAddress?: {
    attention?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface ItemOption {
  id: string;
  name: string;
  sku?: string;
  salesPrice?: number;
  salesDescription?: string;
  unit?: string;
}

export interface ChallanItemRow {
  id: string;
  itemId?: string;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface AttachedFile {
  name: string;
  size?: number;
  type?: string;
  data?: string;
  url?: string;
}

export interface DeliveryChallanDocument {
  id: string;
  deliveryChallanNumber: string;
  customerId: string;
  customerName: string;
  customerSnapshot?: CustomerOption;
  referenceNumber?: string;
  challanType: string;
  deliveryChallanDate: string;
  status: "Draft" | "Open" | "Delivered" | "Closed" | "Void" | string;
  subTotal: number;
  discount: number;
  discountType: "percent" | "amount";
  adjustment: number;
  total: number;
  customerNotes?: string;
  termsAndConditions?: string;
  items: ChallanItemRow[];
  attachments?: AttachedFile[];
  createdAt?: string;
}

export interface DeliveryChallanPreferencesData {
  autoGenerateNumbering: boolean;
  prefix: string;
  nextNumber: number;
  numberZeroPadding: number;
  restartNumberingEachFiscalYear: boolean;
  lastFiscalYear?: string;
  formattedNextNumber?: string;
}

