export interface BillItemInput {
  id?: string;
  itemId?: string;
  name: string;
  description?: string;
  account: string;
  quantity: number;
  rate: number;
  taxRate?: number;
  taxAmount?: number;
  customerId?: string;
  customerName?: string;
  amount?: number;
}

export interface BillCalculationInput {
  items: BillItemInput[];
  discount: number;
  discountType?: "percent" | "amount";
  taxType: "GST" | "TDS" | "None";
  taxRate?: number;
  isIntraState?: boolean;
  adjustment?: number;
}

export interface BillCalculationOutput {
  subTotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  adjustment: number;
  total: number;
  items: BillItemInput[];
}

export const PAYMENT_TERMS_OPTIONS = [
  { label: "Due on Receipt", days: 0 },
  { label: "Net 15", days: 15 },
  { label: "Net 30", days: 30 },
  { label: "Net 45", days: 45 },
  { label: "Net 60", days: 60 },
  { label: "Due end of the month", days: -1 },
  { label: "Custom", days: null },
];

export const STANDARD_ACCOUNTS = [
  "Cost of Goods Sold",
  "Packaging Consumables",
  "Freight & Logistics",
  "Warehouse Rent & Lease",
  "Office Supplies",
  "Advertising & Marketing",
  "Repairs & Maintenance",
  "Utilities & Power",
  "Consulting & Legal",
  "Raw Materials",
];

export const GST_RATES = [
  { label: "0% GST", rate: 0 },
  { label: "5% GST", rate: 5 },
  { label: "12% GST", rate: 12 },
  { label: "18% GST", rate: 18 },
  { label: "28% GST", rate: 28 },
];

export function formatDateOnly(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculateDueDate(billDateStr: string, paymentTerms: string): string {
  if (!billDateStr) return "";
  const parts = billDateStr.split("-").map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return billDateStr;
  }
  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  const term = PAYMENT_TERMS_OPTIONS.find((t) => t.label === paymentTerms);
  if (!term || term.days === null) {
    return billDateStr;
  }

  if (term.days === -1) {
    // End of the month
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return formatDateOnly(endOfMonth);
  }

  const dueDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + term.days);
  return formatDateOnly(dueDate);
}

export function calculateBillTotals({
  items,
  discount,
  discountType = "percent",
  taxType,
  taxRate = 18,
  isIntraState = true,
  adjustment = 0,
}: BillCalculationInput): BillCalculationOutput {
  let subTotal = 0;
  let totalLineTax = 0;

  const processedItems = items.map((item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const rate = Math.max(0, Number(item.rate) || 0);
    const lineAmount = Math.round(qty * rate * 100) / 100;
    const itemTaxRate = Number(item.taxRate) || 0;
    const lineTax = Math.round(((lineAmount * itemTaxRate) / 100) * 100) / 100;

    subTotal += lineAmount;
    totalLineTax += lineTax;

    return {
      ...item,
      quantity: qty,
      rate,
      amount: lineAmount,
      taxAmount: lineTax,
    };
  });

  subTotal = Math.round(subTotal * 100) / 100;

  let discountAmount = 0;
  const rawDiscount = Math.max(0, Number(discount) || 0);
  if (discountType === "percent") {
    discountAmount = Math.round(((subTotal * rawDiscount) / 100) * 100) / 100;
  } else {
    discountAmount = Math.min(subTotal, Math.round(rawDiscount * 100) / 100);
  }

  const taxableAmount = Math.max(0, Math.round((subTotal - discountAmount) * 100) / 100);

  let finalTax = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (taxType === "GST") {
    // If line items specified taxes, use line taxes proportionally discounted, or calculate on taxableAmount
    if (totalLineTax > 0) {
      const discountRatio = subTotal > 0 ? taxableAmount / subTotal : 1;
      finalTax = Math.round(totalLineTax * discountRatio * 100) / 100;
    } else if (taxRate > 0) {
      finalTax = Math.round(((taxableAmount * taxRate) / 100) * 100) / 100;
    }

    if (isIntraState) {
      cgst = Math.round((finalTax / 2) * 100) / 100;
      sgst = Math.round((finalTax - cgst) * 100) / 100;
    } else {
      igst = finalTax;
    }
  } else if (taxType === "TDS") {
    // TDS is deducted (negative tax) or withheld
    const rate = Number(taxRate) || 0;
    finalTax = -Math.round(((taxableAmount * rate) / 100) * 100) / 100;
  }

  const adj = Math.round((Number(adjustment) || 0) * 100) / 100;
  const total = Math.max(0, Math.round((taxableAmount + finalTax + adj) * 100) / 100);

  return {
    subTotal,
    discountAmount,
    taxableAmount,
    taxAmount: finalTax,
    cgst,
    sgst,
    igst,
    adjustment: adj,
    total,
    items: processedItems,
  };
}
