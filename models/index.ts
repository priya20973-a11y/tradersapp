import mongoose, { Schema, Types, type Model } from "mongoose";

type SalesDocumentType =
  | "Quote"
  | "Sales Order"
  | "Invoice"
  | "Recurring Invoice"
  | "Delivery Challan"
  | "Payment Received"
  | "Credit Note";

type TraderRole = "Buyer" | "Seller" | "Broker" | "Commission Agent" | "Consignment Owner";

interface SalesDocumentRecord {
  organizationId: Types.ObjectId;
  type: SalesDocumentType;
  number: string;
  customerId: Types.ObjectId;
  relatedDocumentId?: Types.ObjectId;
  status: string;
  issueDate: Date;
  dueDate?: Date;
  nextRunDate?: Date;
  frequency?: "Weekly" | "Monthly" | "Quarterly" | "Yearly";
  total: number;
  amountPaid: number;
  creditedAmount: number;
  method?: "Cash" | "Bank" | "UPI" | "Cheque";
  referenceNumber?: string;
  notes?: string;
}

interface TraderProfileRecord {
  organizationId: Types.ObjectId;
  traderCode: string;
  legalBusinessName: string;
  tradeName?: string;
  businessType: string;
  tradingStatus: "Active" | "Inactive" | "Blocked";
  roles: TraderRole[];
  customerId?: Types.ObjectId;
  vendorId?: Types.ObjectId;
  mainCommodities: string[];
  primaryMarket?: string;
  operatingMarkets: string[];
  preferredWarehouseIds: Types.ObjectId[];
  accountManagerId?: Types.ObjectId;
  preferredLanguage?: string;
  notes?: string;
  tags: string[];
  gstRegistrationType?: string;
  gstin?: string;
  pan?: string;
  gstinVerificationStatus: string;
  licenses: { type: string; number: string; expiresAt?: Date }[];
  kycStatus: string;
  kycReviewDate?: Date;
  kycReviewedBy?: Types.ObjectId;
  contacts: { name: string; designation?: string; mobile?: string; whatsapp?: string; email?: string }[];
  billingAddress?: { line1?: string; city?: string; district?: string; state?: string; stateCode?: string; country?: string; postalCode?: string };
  shippingAddress?: { line1?: string; city?: string; district?: string; state?: string; stateCode?: string; country?: string; postalCode?: string };
  branches: { name: string; address?: string; city?: string; state?: string; postalCode?: string }[];
  creditLimit: number;
  creditPeriodDays: number;
  paymentTerms?: string;
  openingReceivable: number;
  openingPayable: number;
  securityDeposit: number;
  preferredPaymentMethods: string[];
  riskCategory: string;
  creditApprovalStatus: string;
  approvedBy?: Types.ObjectId;
  creditHoldReason?: string;
  bankAccounts: {
    _id: Types.ObjectId;
    accountHolderName: string;
    bankName: string;
    encryptedAccountNumber: string;
    accountNumberLast4: string;
    ifscCode?: string;
    branch?: string;
    verificationStatus: string;
    upiId?: string;
  }[];
}

interface WarehouseRecord {
  organizationId: Types.ObjectId;
  code: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  status: "Active" | "Inactive";
  locations: { code: string; name: string; type: string; capacity?: number; unit?: string }[];
}

interface TradeDealRecord {
  organizationId: Types.ObjectId;
  dealReference: string;
  dealType: string;
  status: string;
  tradeDate: Date;
  buyerTraderId?: Types.ObjectId;
  sellerTraderId?: Types.ObjectId;
  brokerTraderId?: Types.ObjectId;
  commodityItemId: Types.ObjectId;
  variety?: string;
  grade?: string;
  cropYear?: string;
  originMarket?: string;
  contractedQuantity: number;
  unit: string;
  actualBagWeight?: number;
  agreedRate: number;
  rateBasis: string;
  commissionRate: number;
  commissionAmount: number;
  otherCharges: number;
  expectedDeliveryDate?: Date;
  deliveryLocation?: string;
  warehouseId?: Types.ObjectId;
  linkedSalesOrderId?: Types.ObjectId;
  linkedPurchaseOrderReference?: string;
  linkedInvoiceIds: Types.ObjectId[];
  advanceAmount: number;
  settlementTerms?: string;
  internalRemarks?: string;
  estimatedCosts: { category: string; amount: number }[];
  realizedCosts: { category: string; amount: number }[];
  deliveredQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  settledAmount: number;
}

interface StockLotRecord {
  organizationId: Types.ObjectId;
  lotId: string;
  externalLotNumber?: string;
  commodityItemId: Types.ObjectId;
  variety?: string;
  grade?: string;
  cropYear?: string;
  ownershipType: "Trader-owned" | "Customer-owned" | "Consignment" | "Warehouse-owned";
  ownerTraderId?: Types.ObjectId;
  supplierTraderId?: Types.ObjectId;
  tradeDealId?: Types.ObjectId;
  warehouseId: Types.ObjectId;
  locationCode?: string;
  numberOfBags: number;
  bagWeight?: number;
  grossWeight: number;
  tareWeight: number;
  unit: string;
  physicalQuantity: number;
  reservedQuantity: number;
  dispatchedQuantity: number;
  damagedQuantity: number;
  purchaseCost: number;
  allocatedLandedCost: number;
  status: string;
  purchaseDate?: Date;
  inwardDate: Date;
  moisturePercent?: number;
  defectPercent?: number;
  notes?: string;
}

interface StockMovementRecord {
  organizationId: Types.ObjectId;
  movementId: string;
  lotId: Types.ObjectId;
  movementType: string;
  sourceWarehouseId?: Types.ObjectId;
  destinationWarehouseId?: Types.ObjectId;
  quantity: number;
  unit: string;
  referenceDocument?: string;
  reservationId?: string;
  occurredAt: Date;
  userId?: Types.ObjectId;
  actorId: string;
  remarks?: string;
  idempotencyKey: string;
  reversedMovementId?: Types.ObjectId;
}

interface TraderPaymentRecord {
  organizationId: Types.ObjectId;
  traderId: Types.ObjectId;
  direction: "Receipt" | "Payment";
  paymentDate: Date;
  method: string;
  amount: number;
  unallocatedAmount: number;
  allocations: { targetType: "Invoice" | "Deal"; targetId: Types.ObjectId; amount: number }[];
  referenceNumber?: string;
  notes?: string;
  status: "Posted" | "Reversed";
  idempotencyKey: string;
  actorId: string;
}

const OrganizationSchema = new Schema(
  {
    name: { type: String, required: true },
    tradeName: String,
    gstin: String,
    currency: { type: String, default: "INR" },
    financialYear: String,
    status: { type: String, enum: ["pending", "active", "inactive"], default: "pending" },
    orgId: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: [
        "Super Admin",
        "Organization Owner",
        "Administrator",
        "Accountant",
        "Sales Manager",
        "Sales Executive",
        "Purchase Manager",
        "Inventory Manager",
        "Read-Only Auditor",
      ],
      default: "Administrator",
    },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    authVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const CustomerSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    customerType: { type: String, enum: ["Business", "Individual"], default: "Business" },
    salutation: String,
    firstName: String,
    lastName: String,
    companyName: String,
    contactPerson: String,
    email: String,
    phone: String,
    mobile: String,
    gstin: String,
    pan: String,
    state: String,
    customerLanguage: { type: String, default: "English" },
    currency: { type: String, default: "INR" },
    paymentTerms: { type: String, default: "Due on Receipt" },
    openingBalance: { type: Number, default: 0 },
    creditLimit: { type: Number, default: 0 },
    unusedCredits: { type: Number, default: 0 },
    allowPortal: { type: Boolean, default: false },
    billingAddress: {
      attention: String,
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    shippingAddress: {
      attention: String,
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    contactPersons: [{
      name: String,
      email: String,
      phone: String,
      mobile: String,
    }],
    customFields: [{ label: String, value: String }],
    reportingTags: [String],
    remarks: String,
    status: { type: String, enum: ["Active", "Inactive", "Review"], default: "Active" },
  },
  { timestamps: true },
);

CustomerSchema.index({ organizationId: 1, name: 1 }, { unique: false });

const VendorSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    email: String,
    phone: String,
    gstin: String,
    state: String,
    openingBalance: { type: Number, default: 0 },
    status: { type: String, enum: ["Active", "Inactive", "Pending"], default: "Active" },
  },
  { timestamps: true },
);

const ItemSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    hsnCode: String,
    type: { type: String, enum: ["goods", "service"], default: "goods" },
    unit: String,
    salesPrice: Number,
    purchasePrice: Number,
    gstRate: Number,
    openingStock: { type: Number, default: 0 },
    reorderLevel: Number,
    inventoryTracking: { type: Boolean, default: true },
    commodityCategory: String,
    varieties: [{ type: String, trim: true }],
    grades: [{ type: String, trim: true }],
    sizeCalibres: [{ type: String, trim: true }],
    alternateUnits: [
      {
        unit: { type: String, required: true },
        kilogramsPerUnit: { type: Number, required: true, min: 0.000001 },
      },
    ],
    standardBagWeightKg: { type: Number, min: 0.000001 },
    packagingTypes: [{ type: String, trim: true }],
    qualityParameters: [{ name: { type: String, required: true }, unit: String, required: Boolean }],
    shelfLifeDays: { type: Number, min: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const TraderProfileSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    traderCode: { type: String, required: true, trim: true, uppercase: true },
    legalBusinessName: { type: String, required: true, trim: true },
    tradeName: { type: String, trim: true },
    businessType: {
      type: String,
      enum: ["Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited", "FPO", "Cooperative", "Other"],
      required: true,
    },
    tradingStatus: { type: String, enum: ["Active", "Inactive", "Blocked"], default: "Active" },
    roles: {
      type: [String],
      enum: ["Buyer", "Seller", "Broker", "Commission Agent", "Consignment Owner"],
      required: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    mainCommodities: [{ type: String, trim: true }],
    primaryMarket: String,
    operatingMarkets: [{ type: String, trim: true }],
    preferredWarehouseIds: [{ type: Schema.Types.ObjectId, ref: "Warehouse" }],
    accountManagerId: { type: Schema.Types.ObjectId, ref: "User" },
    preferredLanguage: String,
    notes: String,
    tags: [{ type: String, trim: true }],
    gstRegistrationType: String,
    gstin: { type: String, uppercase: true, trim: true },
    pan: { type: String, uppercase: true, trim: true },
    gstinVerificationStatus: { type: String, enum: ["Unverified", "Pending", "Verified", "Failed"], default: "Unverified" },
    licenses: [{ type: String, number: String, expiresAt: Date }],
    kycStatus: { type: String, enum: ["Not Started", "Pending", "Approved", "Rejected", "Expired"], default: "Not Started" },
    kycReviewDate: Date,
    kycReviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    contacts: [
      {
        name: { type: String, required: true, trim: true },
        designation: String,
        mobile: String,
        whatsapp: String,
        email: String,
      },
    ],
    billingAddress: {
      line1: String,
      city: String,
      district: String,
      state: String,
      stateCode: String,
      country: String,
      postalCode: String,
    },
    shippingAddress: {
      line1: String,
      city: String,
      district: String,
      state: String,
      stateCode: String,
      country: String,
      postalCode: String,
    },
    branches: [{ name: { type: String, required: true }, address: String, city: String, state: String, postalCode: String }],
    creditLimit: { type: Number, min: 0, default: 0 },
    creditPeriodDays: { type: Number, min: 0, default: 0 },
    paymentTerms: String,
    openingReceivable: { type: Number, min: 0, default: 0 },
    openingPayable: { type: Number, min: 0, default: 0 },
    securityDeposit: { type: Number, min: 0, default: 0 },
    preferredPaymentMethods: [{ type: String, enum: ["Cash", "Bank", "UPI", "Cheque", "RTGS", "NEFT"] }],
    riskCategory: { type: String, enum: ["Low", "Medium", "High"], default: "Low" },
    creditApprovalStatus: { type: String, enum: ["Pending", "Approved", "Rejected", "On Hold"], default: "Pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    creditHoldReason: String,
    bankAccounts: [
      {
        accountHolderName: { type: String, required: true },
        bankName: { type: String, required: true },
        encryptedAccountNumber: { type: String, required: true, select: false },
        accountNumberLast4: { type: String, required: true, select: true },
        ifscCode: String,
        branch: String,
        verificationStatus: { type: String, enum: ["Unverified", "Pending", "Verified", "Failed"], default: "Unverified" },
        upiId: String,
      },
    ],
  },
  { timestamps: true, optimisticConcurrency: true },
);

TraderProfileSchema.index({ organizationId: 1, traderCode: 1 }, { unique: true });
TraderProfileSchema.index({ organizationId: 1, legalBusinessName: 1 });
TraderProfileSchema.index({ organizationId: 1, tradingStatus: 1 });

const WarehouseSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    address: String,
    city: String,
    state: String,
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    locations: [
      {
        code: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ["Chamber", "Floor", "Stack", "Rack", "Other"], default: "Other" },
        capacity: { type: Number, min: 0 },
        unit: String,
      },
    ],
  },
  { timestamps: true },
);
WarehouseSchema.index({ organizationId: 1, code: 1 }, { unique: true });

const TradeDealSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    dealReference: { type: String, required: true, trim: true, uppercase: true },
    dealType: { type: String, enum: ["Purchase", "Sale", "Buy-Sell", "Brokered Deal", "Consignment"], required: true },
    status: {
      type: String,
      enum: [
        "Draft",
        "Negotiation",
        "Confirmed",
        "Partially Delivered",
        "Delivered",
        "Partially Invoiced",
        "Invoiced",
        "Partially Settled",
        "Settled",
        "Cancelled",
        "Disputed",
      ],
      default: "Draft",
    },
    tradeDate: { type: Date, default: Date.now },
    buyerTraderId: { type: Schema.Types.ObjectId, ref: "TraderProfile" },
    sellerTraderId: { type: Schema.Types.ObjectId, ref: "TraderProfile" },
    brokerTraderId: { type: Schema.Types.ObjectId, ref: "TraderProfile" },
    commodityItemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    variety: String,
    grade: String,
    cropYear: String,
    originMarket: String,
    contractedQuantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    actualBagWeight: { type: Number, min: 0.000001 },
    agreedRate: { type: Number, required: true, min: 0 },
    rateBasis: { type: String, required: true },
    commissionRate: { type: Number, min: 0, default: 0 },
    commissionAmount: { type: Number, min: 0, default: 0 },
    otherCharges: { type: Number, min: 0, default: 0 },
    expectedDeliveryDate: Date,
    deliveryLocation: String,
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse" },
    linkedSalesOrderId: { type: Schema.Types.ObjectId, ref: "SalesDocument" },
    linkedPurchaseOrderReference: String,
    linkedInvoiceIds: [{ type: Schema.Types.ObjectId, ref: "SalesDocument" }],
    advanceAmount: { type: Number, min: 0, default: 0 },
    settlementTerms: String,
    internalRemarks: String,
    estimatedCosts: [{ category: { type: String, required: true }, amount: { type: Number, min: 0, required: true } }],
    realizedCosts: [{ category: { type: String, required: true }, amount: { type: Number, min: 0, required: true } }],
    deliveredQuantity: { type: Number, min: 0, default: 0 },
    acceptedQuantity: { type: Number, min: 0, default: 0 },
    rejectedQuantity: { type: Number, min: 0, default: 0 },
    settledAmount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true, optimisticConcurrency: true },
);
TradeDealSchema.index({ organizationId: 1, dealReference: 1 }, { unique: true });
TradeDealSchema.index({ organizationId: 1, status: 1, tradeDate: -1 });

const StockLotSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    lotId: { type: String, required: true, trim: true, uppercase: true },
    externalLotNumber: String,
    commodityItemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    variety: String,
    grade: String,
    cropYear: String,
    ownershipType: {
      type: String,
      enum: ["Trader-owned", "Customer-owned", "Consignment", "Warehouse-owned"],
      required: true,
    },
    ownerTraderId: { type: Schema.Types.ObjectId, ref: "TraderProfile" },
    supplierTraderId: { type: Schema.Types.ObjectId, ref: "TraderProfile" },
    tradeDealId: { type: Schema.Types.ObjectId, ref: "TradeDeal" },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    locationCode: String,
    numberOfBags: { type: Number, min: 0, default: 0 },
    bagWeight: { type: Number, min: 0.000001 },
    grossWeight: { type: Number, min: 0, default: 0 },
    tareWeight: { type: Number, min: 0, default: 0 },
    unit: { type: String, required: true },
    physicalQuantity: { type: Number, min: 0, default: 0 },
    reservedQuantity: { type: Number, min: 0, default: 0 },
    dispatchedQuantity: { type: Number, min: 0, default: 0 },
    damagedQuantity: { type: Number, min: 0, default: 0 },
    purchaseCost: { type: Number, min: 0, default: 0 },
    allocatedLandedCost: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: [
        "Expected",
        "Inward Pending",
        "In Stock",
        "Partially Reserved",
        "Reserved",
        "Partially Sold",
        "Dispatched",
        "Exhausted",
        "Damaged",
        "On Hold",
      ],
      default: "Expected",
    },
    purchaseDate: Date,
    inwardDate: { type: Date, default: Date.now },
    moisturePercent: { type: Number, min: 0, max: 100 },
    defectPercent: { type: Number, min: 0, max: 100 },
    notes: String,
  },
  { timestamps: true },
);
StockLotSchema.index({ organizationId: 1, lotId: 1 }, { unique: true });
StockLotSchema.index({ organizationId: 1, commodityItemId: 1, warehouseId: 1, status: 1 });
StockLotSchema.index({ organizationId: 1, ownerTraderId: 1 });

const StockMovementSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    movementId: { type: String, required: true, trim: true, uppercase: true },
    lotId: { type: Schema.Types.ObjectId, ref: "StockLot", required: true },
    movementType: {
      type: String,
      enum: [
        "Opening Stock",
        "Inward",
        "Outward",
        "Transfer",
        "Reservation",
        "Reservation Release",
        "Sales Dispatch",
        "Purchase Return",
        "Sales Return",
        "Damage",
        "Adjustment",
        "Reversal",
      ],
      required: true,
    },
    sourceWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse" },
    destinationWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse" },
    quantity: { type: Number, required: true, min: 0.000001 },
    unit: { type: String, required: true },
    referenceDocument: String,
    reservationId: String,
    occurredAt: { type: Date, default: Date.now },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    actorId: { type: String, required: true },
    remarks: String,
    idempotencyKey: { type: String, required: true },
    reversedMovementId: { type: Schema.Types.ObjectId, ref: "StockMovement" },
  },
  { timestamps: true },
);
StockMovementSchema.index({ organizationId: 1, movementId: 1 }, { unique: true });
StockMovementSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true });
StockMovementSchema.index({ organizationId: 1, lotId: 1, occurredAt: -1 });

const TraderPaymentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    traderId: { type: Schema.Types.ObjectId, ref: "TraderProfile", required: true, index: true },
    direction: { type: String, enum: ["Receipt", "Payment"], required: true },
    paymentDate: { type: Date, default: Date.now },
    method: { type: String, enum: ["Cash", "Bank", "UPI", "Cheque", "RTGS", "NEFT"], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    unallocatedAmount: { type: Number, required: true, min: 0 },
    allocations: [{
      targetType: { type: String, enum: ["Invoice", "Deal"], required: true },
      targetId: { type: Schema.Types.ObjectId, required: true },
      amount: { type: Number, required: true, min: 0.01 },
    }],
    referenceNumber: String,
    notes: String,
    status: { type: String, enum: ["Posted", "Reversed"], default: "Posted" },
    idempotencyKey: { type: String, required: true },
    actorId: { type: String, required: true },
  },
  { timestamps: true },
);
TraderPaymentSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true });
TraderPaymentSchema.index({ organizationId: 1, traderId: 1, paymentDate: -1 });

const AuditEventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    changes: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
AuditEventSchema.index({ organizationId: 1, entityType: 1, entityId: 1, occurredAt: -1 });

ItemSchema.index({ organizationId: 1, sku: 1 }, { unique: true });

const InvoiceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    invoiceNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    status: { type: String, enum: ["Draft", "Sent", "Paid", "Partly paid", "Overdue"], default: "Draft" },
    subtotal: Number,
    discount: Number,
    taxRate: Number,
    total: Number,
    amountPaid: Number,
    dueDate: Date,
  },
  { timestamps: true },
);

InvoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });

const SalesDocumentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    type: {
      type: String,
      enum: [
        "Quote",
        "Sales Order",
        "Invoice",
        "Recurring Invoice",
        "Delivery Challan",
        "Payment Received",
        "Credit Note",
      ],
      required: true,
    },
    number: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    relatedDocumentId: { type: Schema.Types.ObjectId, ref: "SalesDocument" },
    status: { type: String, required: true, default: "Draft" },
    issueDate: { type: Date, default: Date.now },
    dueDate: Date,
    nextRunDate: Date,
    frequency: { type: String, enum: ["Weekly", "Monthly", "Quarterly", "Yearly"] },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    creditedAmount: { type: Number, default: 0, min: 0 },
    method: { type: String, enum: ["Cash", "Bank", "UPI", "Cheque"] },
    referenceNumber: String,
    notes: String,
  },
  { timestamps: true },
);

SalesDocumentSchema.index({ organizationId: 1, type: 1, number: 1 }, { unique: true });

const PaymentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ["Cash", "Bank", "UPI", "Cheque"], default: "Bank" },
    referenceNumber: String,
    status: { type: String, enum: ["Posted", "Reversed"], default: "Posted" },
  },
  { timestamps: true },
);

const BankAccountSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    accountType: { type: String, enum: ["Bank", "Cash"], default: "Bank" },
    accountNumber: String,
    currentBalance: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const ChartOfAccountSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    accountType: { type: String, enum: ["Asset", "Liability", "Equity", "Revenue", "Expense"], required: true },
    normalBalance: { type: String, enum: ["debit", "credit"], required: true },
    code: String,
  },
  { timestamps: true },
);

const JournalEntrySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    description: { type: String, required: true },
    postedAt: { type: Date, default: Date.now },
    isBalanced: { type: Boolean, default: false },
    totalDebits: Number,
    totalCredits: Number,
  },
  { timestamps: true },
);

const TaxRateSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    rate: { type: Number, required: true },
    type: { type: String, enum: ["CGST", "SGST", "IGST", "Custom"], default: "Custom" },
  },
  { timestamps: true },
);

const DocumentSequenceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    prefix: { type: String, required: true },
    nextNumber: { type: Number, default: 1 },
    modelName: { type: String, required: true },
  },
  { timestamps: true },
);

DocumentSequenceSchema.index({ organizationId: 1, modelName: 1 }, { unique: true });

export const Organization =
  (mongoose.models.Organization as Model<Record<string, unknown>>) ||
  mongoose.model("Organization", OrganizationSchema);
export const User =
  (mongoose.models.User as Model<Record<string, unknown>>) || mongoose.model("User", UserSchema);
export const Customer =
  (mongoose.models.Customer as Model<Record<string, unknown>>) ||
  mongoose.model("Customer", CustomerSchema);
export const Vendor =
  (mongoose.models.Vendor as Model<Record<string, unknown>>) ||
  mongoose.model("Vendor", VendorSchema);
export const Item =
  (mongoose.models.Item as Model<Record<string, unknown>>) || mongoose.model("Item", ItemSchema);
export const TraderProfile =
  (mongoose.models.TraderProfile as Model<TraderProfileRecord>) ||
  mongoose.model<TraderProfileRecord>("TraderProfile", TraderProfileSchema);
export const Warehouse =
  (mongoose.models.Warehouse as Model<WarehouseRecord>) ||
  mongoose.model<WarehouseRecord>("Warehouse", WarehouseSchema);
export const TradeDeal =
  (mongoose.models.TradeDeal as Model<TradeDealRecord>) ||
  mongoose.model<TradeDealRecord>("TradeDeal", TradeDealSchema);
export const StockLot =
  (mongoose.models.StockLot as Model<StockLotRecord>) ||
  mongoose.model<StockLotRecord>("StockLot", StockLotSchema);
export const StockMovement =
  (mongoose.models.StockMovement as Model<StockMovementRecord>) ||
  mongoose.model<StockMovementRecord>("StockMovement", StockMovementSchema);
export const TraderPayment =
  (mongoose.models.TraderPayment as Model<TraderPaymentRecord>) ||
  mongoose.model<TraderPaymentRecord>("TraderPayment", TraderPaymentSchema);
export const AuditEvent =
  (mongoose.models.AuditEvent as Model<Record<string, unknown>>) ||
  mongoose.model("AuditEvent", AuditEventSchema);
export const Invoice =
  (mongoose.models.Invoice as Model<Record<string, unknown>>) ||
  mongoose.model("Invoice", InvoiceSchema);
export const SalesDocument =
  (mongoose.models.SalesDocument as Model<SalesDocumentRecord>) ||
  mongoose.model<SalesDocumentRecord>("SalesDocument", SalesDocumentSchema);
export const Payment =
  (mongoose.models.Payment as Model<Record<string, unknown>>) ||
  mongoose.model("Payment", PaymentSchema);
export const BankAccount =
  (mongoose.models.BankAccount as Model<Record<string, unknown>>) ||
  mongoose.model("BankAccount", BankAccountSchema);
export const ChartOfAccount =
  (mongoose.models.ChartOfAccount as Model<Record<string, unknown>>) ||
  mongoose.model("ChartOfAccount", ChartOfAccountSchema);
export const JournalEntry =
  (mongoose.models.JournalEntry as Model<Record<string, unknown>>) ||
  mongoose.model("JournalEntry", JournalEntrySchema);
export const TaxRate =
  (mongoose.models.TaxRate as Model<Record<string, unknown>>) ||
  mongoose.model("TaxRate", TaxRateSchema);
export const DocumentSequence =
  (mongoose.models.DocumentSequence as Model<Record<string, unknown>>) ||
  mongoose.model("DocumentSequence", DocumentSequenceSchema);
