export type OrganizationOption = { id: string; name: string };

export type TraderRow = {
  id: string;
  traderCode: string;
  legalBusinessName: string;
  tradeName: string;
  businessType: string;
  tradingStatus: string;
  roles: string[];
  mainCommodities: string[];
  primaryContact: string;
  city: string;
  state: string;
  gstin: string;
  kycStatus: string;
  creditLimit: number;
  receivable: number;
  payable: number;
  creditUtilization: number;
};

export type TraderDetail = TraderRow & Record<string, unknown> & {
  billingAddress?: { city?: string; state?: string; line1?: string; postalCode?: string };
  contacts?: { name: string; mobile?: string; email?: string }[];
  bankAccounts?: { id: string; bankName: string; accountHolderName: string; maskedAccountNumber: string; verificationStatus: string }[];
  creditPeriodDays?: number;
  paymentTerms?: string;
  creditApprovalStatus?: string;
  notes?: string;
  mainCommodities?: string[];
  creditHoldReason?: string;
};

export const emptyTraderForm = {
  traderCode: "",
  legalBusinessName: "",
  tradeName: "",
  businessType: "Proprietorship",
  roles: ["Buyer", "Seller"],
  mainCommodities: "",
  contactName: "",
  mobile: "",
  email: "",
  city: "",
  state: "",
  gstin: "",
  pan: "",
  creditLimit: "0",
  creditPeriodDays: "0",
  paymentTerms: "",
};

export function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

export { emptyTraderForm as emptyForm };
