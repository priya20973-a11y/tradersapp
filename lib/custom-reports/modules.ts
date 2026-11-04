/**
 * lib/custom-reports/modules.ts
 *
 * Client-safe definitions for supported Custom Report modules, their available fields,
 * default selections, formatting, and filtering capabilities.
 */

export type ReportModuleId =
  | "Sales"
  | "Purchase"
  | "Quotes"
  | "Bills"
  | "Expenses"
  | "Payments"
  | "Customers"
  | "Vendors"
  | "Items"
  | "Inventory";

export type FieldFormat = "text" | "currency" | "date" | "number" | "badge";

export interface ReportFieldDef {
  key: string;
  label: string;
  format: FieldFormat;
  description?: string;
  defaultSelected?: boolean;
  sortable?: boolean;
  groupable?: boolean;
}

export interface ReportModuleDef {
  id: ReportModuleId;
  label: string;
  shortName: string;
  description: string;
  category: "Revenue & Sales" | "Procurement" | "Finance & Accounting" | "Master Data" | "Supply Chain";
  icon: string;
  accentColor: string;
  fields: ReportFieldDef[];
  defaultSort: { field: string; direction: "asc" | "desc" };
  statusOptions?: string[];
  paymentStatusOptions?: string[];
  dateFieldOptions: { key: string; label: string }[];
  amountField?: string;
  partyType: "customer" | "vendor" | "both" | "none";
}

export const REPORT_MODULES: ReportModuleDef[] = [
  {
    id: "Sales",
    label: "Sales Orders & Invoices",
    shortName: "Sales",
    description: "All customer sales orders, tax invoices, and fulfilled transactions.",
    category: "Revenue & Sales",
    icon: "ShoppingCart",
    accentColor: "blue",
    partyType: "customer",
    amountField: "total",
    defaultSort: { field: "issueDate", direction: "desc" },
    dateFieldOptions: [
      { key: "issueDate", label: "Invoice / Order Date" },
      { key: "dueDate", label: "Due Date" },
      { key: "createdAt", label: "Creation Date" },
    ],
    statusOptions: ["Draft", "Confirmed", "Sent", "Invoiced", "Fulfilled", "Cancelled"],
    paymentStatusOptions: ["Paid", "Partially Paid", "Unpaid", "Overdue"],
    fields: [
      { key: "number", label: "Order / Invoice #", format: "text", defaultSelected: true, sortable: true },
      { key: "issueDate", label: "Date", format: "date", defaultSelected: true, sortable: true },
      { key: "customerName", label: "Customer Name", format: "text", defaultSelected: true, sortable: true, groupable: true },
      { key: "customerEmail", label: "Customer Email", format: "text", defaultSelected: false },
      { key: "customerPhone", label: "Customer Phone", format: "text", defaultSelected: false },
      { key: "status", label: "Order Status", format: "badge", defaultSelected: true, sortable: true, groupable: true },
      { key: "subTotal", label: "Sub Total", format: "currency", defaultSelected: false, sortable: true },
      { key: "discount", label: "Discount Amount", format: "currency", defaultSelected: false },
      { key: "taxAmount", label: "GST Amount", format: "currency", defaultSelected: false },
      { key: "total", label: "Total Amount", format: "currency", defaultSelected: true, sortable: true },
      { key: "dueDate", label: "Due Date", format: "date", defaultSelected: true, sortable: true },
      { key: "referenceNumber", label: "Reference #", format: "text", defaultSelected: false },
      { key: "salesperson", label: "Salesperson", format: "text", defaultSelected: false, groupable: true },
      { key: "itemsCount", label: "Total Items", format: "number", defaultSelected: false },
    ],
  },
  {
    id: "Quotes",
    label: "Sales Quotations & Proposals",
    shortName: "Quotes",
    description: "Proposals sent to customers with pricing, GST, TDS/TCS, and conversion status.",
    category: "Revenue & Sales",
    icon: "FileSpreadsheet",
    accentColor: "indigo",
    partyType: "customer",
    amountField: "total",
    defaultSort: { field: "issueDate", direction: "desc" },
    dateFieldOptions: [
      { key: "issueDate", label: "Quote Date" },
      { key: "expiryDate", label: "Expiry Date" },
      { key: "createdAt", label: "Creation Date" },
    ],
    statusOptions: ["Draft", "Sent", "Accepted", "Rejected", "Converted"],
    fields: [
      { key: "number", label: "Quote Number", format: "text", defaultSelected: true, sortable: true },
      { key: "issueDate", label: "Quote Date", format: "date", defaultSelected: true, sortable: true },
      { key: "expiryDate", label: "Expiry Date", format: "date", defaultSelected: true, sortable: true },
      { key: "customerName", label: "Customer", format: "text", defaultSelected: true, sortable: true, groupable: true },
      { key: "status", label: "Quote Status", format: "badge", defaultSelected: true, sortable: true, groupable: true },
      { key: "subTotal", label: "Sub Total", format: "currency", defaultSelected: false, sortable: true },
      { key: "discount", label: "Discount", format: "currency", defaultSelected: false },
      { key: "taxAmount", label: "GST Amount", format: "currency", defaultSelected: false },
      { key: "tdsTcsType", label: "TDS / TCS Type", format: "text", defaultSelected: false, groupable: true },
      { key: "tdsTcsRate", label: "TDS / TCS Rate %", format: "number", defaultSelected: false },
      { key: "tdsTcsAmount", label: "TDS / TCS Amount", format: "currency", defaultSelected: false },
      { key: "adjustment", label: "Adjustment", format: "currency", defaultSelected: false },
      { key: "total", label: "Quote Value", format: "currency", defaultSelected: true, sortable: true },
      { key: "referenceNumber", label: "Reference #", format: "text", defaultSelected: false },
      { key: "subject", label: "Subject", format: "text", defaultSelected: false },
    ],
  },
  {
    id: "Purchase",
    label: "Purchase Orders",
    shortName: "Purchase Orders",
    description: "Procurement orders issued to raw material vendors and suppliers.",
    category: "Procurement",
    icon: "Truck",
    accentColor: "emerald",
    partyType: "vendor",
    amountField: "total",
    defaultSort: { field: "orderDate", direction: "desc" },
    dateFieldOptions: [
      { key: "orderDate", label: "Order Date" },
      { key: "expectedDeliveryDate", label: "Delivery Date" },
      { key: "createdAt", label: "Creation Date" },
    ],
    statusOptions: ["Draft", "Issued", "Confirmed", "Partially Received", "Received", "Cancelled"],
    fields: [
      { key: "poNumber", label: "PO Number", format: "text", defaultSelected: true, sortable: true },
      { key: "orderDate", label: "Order Date", format: "date", defaultSelected: true, sortable: true },
      { key: "vendorName", label: "Vendor", format: "text", defaultSelected: true, sortable: true, groupable: true },
      { key: "status", label: "PO Status", format: "badge", defaultSelected: true, sortable: true, groupable: true },
      { key: "expectedDeliveryDate", label: "Expected Delivery", format: "date", defaultSelected: true, sortable: true },
      { key: "paymentTerms", label: "Payment Terms", format: "text", defaultSelected: false, groupable: true },
      { key: "subTotal", label: "Sub Total", format: "currency", defaultSelected: false },
      { key: "taxAmount", label: "Tax Amount", format: "currency", defaultSelected: false },
      { key: "total", label: "PO Total", format: "currency", defaultSelected: true, sortable: true },
      { key: "referenceNumber", label: "Reference #", format: "text", defaultSelected: false },
    ],
  },
  {
    id: "Bills",
    label: "Purchase Bills",
    shortName: "Bills",
    description: "Inbound vendor bills, accounts payable, payment terms, and settled balances.",
    category: "Procurement",
    icon: "ReceiptText",
    accentColor: "teal",
    partyType: "vendor",
    amountField: "total",
    defaultSort: { field: "billDate", direction: "desc" },
    dateFieldOptions: [
      { key: "billDate", label: "Bill Date" },
      { key: "dueDate", label: "Due Date" },
      { key: "createdAt", label: "Creation Date" },
    ],
    statusOptions: ["Draft", "Open", "Partially Paid", "Paid", "Overdue", "Void"],
    fields: [
      { key: "billNumber", label: "Bill Number", format: "text", defaultSelected: true, sortable: true },
      { key: "billDate", label: "Bill Date", format: "date", defaultSelected: true, sortable: true },
      { key: "dueDate", label: "Due Date", format: "date", defaultSelected: true, sortable: true },
      { key: "vendorName", label: "Vendor", format: "text", defaultSelected: true, sortable: true, groupable: true },
      { key: "status", label: "Bill Status", format: "badge", defaultSelected: true, sortable: true, groupable: true },
      { key: "subTotal", label: "Sub Total", format: "currency", defaultSelected: false },
      { key: "discountAmount", label: "Discount", format: "currency", defaultSelected: false },
      { key: "taxAmount", label: "Tax Amount", format: "currency", defaultSelected: false },
      { key: "total", label: "Bill Total", format: "currency", defaultSelected: true, sortable: true },
      { key: "amountPaid", label: "Amount Paid", format: "currency", defaultSelected: true, sortable: true },
      { key: "balanceDue", label: "Balance Due", format: "currency", defaultSelected: true, sortable: true },
      { key: "orderNumber", label: "Order #", format: "text", defaultSelected: false },
      { key: "paymentTerms", label: "Terms", format: "text", defaultSelected: false, groupable: true },
    ],
  },
  {
    id: "Expenses",
    label: "Operating Expenses",
    shortName: "Expenses",
    description: "Direct & indirect business expenses, categories, tax deductions, and payment methods.",
    category: "Finance & Accounting",
    icon: "WalletCards",
    accentColor: "rose",
    partyType: "vendor",
    amountField: "amount",
    defaultSort: { field: "date", direction: "desc" },
    dateFieldOptions: [
      { key: "date", label: "Expense Date" },
      { key: "createdAt", label: "Creation Date" },
    ],
    statusOptions: ["Paid", "Unpaid", "Reimbursed", "Pending Approval"],
    fields: [
      { key: "expenseNumber", label: "Expense #", format: "text", defaultSelected: true, sortable: true },
      { key: "date", label: "Date", format: "date", defaultSelected: true, sortable: true },
      { key: "category", label: "Category", format: "text", defaultSelected: true, sortable: true, groupable: true },
      { key: "vendorName", label: "Merchant / Vendor", format: "text", defaultSelected: true, sortable: true, groupable: true },
      { key: "amount", label: "Amount", format: "currency", defaultSelected: true, sortable: true },
      { key: "taxAmount", label: "Tax Included", format: "currency", defaultSelected: false },
      { key: "paymentMethod", label: "Payment Mode", format: "text", defaultSelected: true, groupable: true },
      { key: "paidThrough", label: "Paid Account", format: "text", defaultSelected: false, groupable: true },
      { key: "status", label: "Status", format: "badge", defaultSelected: true, sortable: true, groupable: true },
      { key: "referenceNumber", label: "Reference #", format: "text", defaultSelected: false },
      { key: "notes", label: "Notes / Purpose", format: "text", defaultSelected: false },
    ],
  },
  {
    id: "Payments",
    label: "Payments (Received & Made)",
    shortName: "Payments",
    description: "Combined record of incoming client receipts and outgoing vendor settlements.",
    category: "Finance & Accounting",
    icon: "BadgeDollarSign",
    accentColor: "amber",
    partyType: "both",
    amountField: "amount",
    defaultSort: { field: "date", direction: "desc" },
    dateFieldOptions: [
      { key: "date", label: "Payment Date" },
      { key: "createdAt", label: "Recorded Date" },
    ],
    statusOptions: ["Settled", "Pending", "Failed", "Bounced"],
    fields: [
      { key: "paymentNumber", label: "Payment / Ref #", format: "text", defaultSelected: true, sortable: true },
      { key: "date", label: "Date", format: "date", defaultSelected: true, sortable: true },
      { key: "partyType", label: "Type (In/Out)", format: "badge", defaultSelected: true, sortable: true, groupable: true },
      { key: "partyName", label: "Party Name", format: "text", defaultSelected: true, sortable: true, groupable: true },
      { key: "amount", label: "Amount", format: "currency", defaultSelected: true, sortable: true },
      { key: "paymentMode", label: "Mode (NEFT/UPI/Cash)", format: "text", defaultSelected: true, groupable: true },
      { key: "reference", label: "Transaction / UTR #", format: "text", defaultSelected: true },
      { key: "bankAccount", label: "Bank Account", format: "text", defaultSelected: false, groupable: true },
      { key: "notes", label: "Notes", format: "text", defaultSelected: false },
    ],
  },
  {
    id: "Customers",
    label: "Customer Directory",
    shortName: "Customers",
    description: "Registered buyers, GSTIN compliance, contact profiles, and outstanding balances.",
    category: "Master Data",
    icon: "Users",
    accentColor: "cyan",
    partyType: "none",
    defaultSort: { field: "name", direction: "asc" },
    dateFieldOptions: [
      { key: "createdAt", label: "Registration Date" },
    ],
    fields: [
      { key: "name", label: "Customer Name", format: "text", defaultSelected: true, sortable: true },
      { key: "companyName", label: "Company / Trade Name", format: "text", defaultSelected: true, sortable: true },
      { key: "email", label: "Email Address", format: "text", defaultSelected: true, sortable: true },
      { key: "phone", label: "Phone", format: "text", defaultSelected: true },
      { key: "gstin", label: "GSTIN", format: "text", defaultSelected: true },
      { key: "pan", label: "PAN", format: "text", defaultSelected: false },
      { key: "city", label: "City", format: "text", defaultSelected: true, groupable: true },
      { key: "state", label: "State", format: "text", defaultSelected: true, groupable: true },
      { key: "outstanding", label: "Total Receivables", format: "currency", defaultSelected: true, sortable: true },
      { key: "createdAt", label: "Joined Date", format: "date", defaultSelected: false, sortable: true },
    ],
  },
  {
    id: "Vendors",
    label: "Vendor Directory",
    shortName: "Vendors",
    description: "Approved supplier profiles, statutory PAN/GST, payment terms, and payable balances.",
    category: "Master Data",
    icon: "Building2",
    accentColor: "purple",
    partyType: "none",
    defaultSort: { field: "name", direction: "asc" },
    dateFieldOptions: [
      { key: "createdAt", label: "Created Date" },
    ],
    fields: [
      { key: "name", label: "Vendor Name", format: "text", defaultSelected: true, sortable: true },
      { key: "companyName", label: "Company / Firm Name", format: "text", defaultSelected: true, sortable: true },
      { key: "email", label: "Email", format: "text", defaultSelected: true },
      { key: "phone", label: "Phone", format: "text", defaultSelected: true },
      { key: "gstin", label: "GSTIN", format: "text", defaultSelected: true },
      { key: "pan", label: "PAN", format: "text", defaultSelected: false },
      { key: "city", label: "City", format: "text", defaultSelected: true, groupable: true },
      { key: "state", label: "State", format: "text", defaultSelected: true, groupable: true },
      { key: "paymentTerms", label: "Default Terms", format: "text", defaultSelected: false, groupable: true },
      { key: "tds", label: "TDS Status", format: "text", defaultSelected: false },
      { key: "createdAt", label: "Added Date", format: "date", defaultSelected: false, sortable: true },
    ],
  },
  {
    id: "Items",
    label: "Commodities & Catalog Items",
    shortName: "Items",
    description: "Agricultural commodities, trading goods, selling/purchase rates, and HSN codes.",
    category: "Master Data",
    icon: "Package",
    accentColor: "orange",
    partyType: "none",
    amountField: "salesPrice",
    defaultSort: { field: "name", direction: "asc" },
    dateFieldOptions: [
      { key: "createdAt", label: "Created Date" },
    ],
    fields: [
      { key: "name", label: "Item / Commodity Name", format: "text", defaultSelected: true, sortable: true },
      { key: "sku", label: "SKU / Code", format: "text", defaultSelected: true, sortable: true },
      { key: "unit", label: "Unit (kg/Qtl/MT)", format: "text", defaultSelected: true, groupable: true },
      { key: "salesPrice", label: "Sales Rate (₹)", format: "currency", defaultSelected: true, sortable: true },
      { key: "purchasePrice", label: "Purchase Rate (₹)", format: "currency", defaultSelected: true, sortable: true },
      { key: "taxRate", label: "GST Rate %", format: "number", defaultSelected: true, groupable: true },
      { key: "hsnCode", label: "HSN Code", format: "text", defaultSelected: false },
      { key: "description", label: "Description", format: "text", defaultSelected: false },
    ],
  },
  {
    id: "Inventory",
    label: "Warehouse & Stock Lots",
    shortName: "Inventory",
    description: "Physical commodity lots, bag counts, moisture/grade quality, and warehouse locations.",
    category: "Supply Chain",
    icon: "Layers",
    accentColor: "sky",
    partyType: "none",
    defaultSort: { field: "createdAt", direction: "desc" },
    dateFieldOptions: [
      { key: "inwardDate", label: "Inward Date" },
      { key: "createdAt", label: "Stock Date" },
    ],
    statusOptions: ["In Stock", "Allocated", "Dispatched", "Released", "Damaged"],
    fields: [
      { key: "lotNumber", label: "Lot Number", format: "text", defaultSelected: true, sortable: true },
      { key: "commodityName", label: "Commodity", format: "text", defaultSelected: true, sortable: true, groupable: true },
      { key: "warehouse", label: "Warehouse", format: "text", defaultSelected: true, sortable: true, groupable: true },
      { key: "variety", label: "Variety", format: "text", defaultSelected: false, groupable: true },
      { key: "grade", label: "Grade / Quality", format: "text", defaultSelected: false, groupable: true },
      { key: "bagCount", label: "Bags / Units", format: "number", defaultSelected: true, sortable: true },
      { key: "quantityKg", label: "Weight (kg)", format: "number", defaultSelected: true, sortable: true },
      { key: "inwardDate", label: "Inward Date", format: "date", defaultSelected: true, sortable: true },
      { key: "status", label: "Lot Status", format: "badge", defaultSelected: true, sortable: true, groupable: true },
    ],
  },
];

export function getModuleDefinition(moduleId: string): ReportModuleDef | undefined {
  return REPORT_MODULES.find((m) => m.id === moduleId);
}
