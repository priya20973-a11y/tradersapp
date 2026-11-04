import type { Types } from "mongoose";

export interface InvoiceItemPayload {
  itemId?: string | Types.ObjectId;
  name?: string;
  description?: string;
  hsnCode?: string;
  unit?: string;
  quantity?: number;
  rate?: number;
  discount?: number;
  discountType?: "percent" | "amount";
  taxRate?: number;
}

export interface InvoicePayload {
  organizationId?: string;
  customerId?: string | Types.ObjectId;
  items?: InvoiceItemPayload[];
  placeOfSupply?: string;
  discount?: number;
  discountType?: "percent" | "amount";
  shippingCharges?: number;
  adjustment?: number;
  number?: string;
  issueDate?: string | number;
  dueDate?: string | number;
  paymentTerms?: string;
  status?: string;
  salesperson?: string;
  subject?: string;
  referenceNumber?: string;
  customerNotes?: string;
  termsAndConditions?: string;
}
