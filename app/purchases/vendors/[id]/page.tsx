import { Suspense } from "react";
import { connectToDatabase } from "@/lib/db";
import { Vendor } from "@/models";
import { VendorForm, type VendorFormData } from "@/components/purchases/vendor-form";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Vendor Details | LedgerFlow",
  description: "View and edit vendor details in LedgerFlow.",
};

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const { mode: requestedMode } = await searchParams;

  await connectToDatabase().catch(() => null);
  const vendorDoc = await Vendor.findById(id).lean().catch(() => null);

  if (!vendorDoc) {
    // If not found in DB, check demo vendors
    if (id.startsWith("V-") || id.startsWith("demo-")) {
      const demoData: Partial<VendorFormData> = {
        id,
        displayName: id === "V-401" ? "Mohan Traders" : id === "V-402" ? "Shree Packaging" : "Metro Logistics",
        companyName: id === "V-401" ? "Mohan Traders Pvt Ltd" : "Shree Packaging Ltd",
        email: id === "V-401" ? "mohan@traders.in" : "finance@shreepack.in",
        workPhone: "+91 98201 44521",
        mobile: "+91 98201 44521",
        openingBalance: 18200,
        status: "Active",
        pan: "ABCDE1234F",
      };
      return (
        <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading vendor details…</div>}>
          <VendorForm
            initialData={demoData}
            mode={requestedMode === "edit" ? "edit" : "view"}
            vendorId={id}
          />
        </Suspense>
      );
    }
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = vendorDoc as Record<string, any>;

  const initialData: Partial<VendorFormData> = {
    id: String(v._id),
    salutation: String(v.salutation || "Mr."),
    firstName: String(v.firstName || ""),
    lastName: String(v.lastName || ""),
    companyName: String(v.companyName || ""),
    displayName: String(v.displayName || v.name || ""),
    email: String(v.email || ""),
    workPhone: String(v.workPhone || v.phone || ""),
    mobile: String(v.mobile || ""),
    language: String(v.language || "English"),
    pan: String(v.pan || ""),
    msmeRegistered: Boolean(v.msmeRegistered),
    msmeType: String(v.msmeType || "Micro"),
    msmeNumber: String(v.msmeNumber || ""),
    currency: String(v.currency || "INR"),
    accountsPayable: String(v.accountsPayable || "Accounts Payable (Sundry Creditors)"),
    openingBalance: Number(v.openingBalance || 0),
    openingBalanceType: (v.openingBalanceType as "credit" | "debit") || "credit",
    paymentTerms: String(v.paymentTerms || "Due on Receipt"),
    tds: String(v.tds || "No TDS"),
    enablePortal: Boolean(v.enablePortal),
    portalLanguage: String(v.portalLanguage || "English"),
    billingAttention: String(v.billingAddress?.attention || ""),
    billingCountry: String(v.billingAddress?.country || "India"),
    billingStreet1: String(v.billingAddress?.street1 || ""),
    billingStreet2: String(v.billingAddress?.street2 || ""),
    billingCity: String(v.billingAddress?.city || ""),
    billingState: String(v.billingAddress?.state || v.state || ""),
    billingPostalCode: String(v.billingAddress?.postalCode || ""),
    billingPhone: String(v.billingAddress?.phone || ""),
    billingFax: String(v.billingAddress?.fax || ""),
    shippingAttention: String(v.shippingAddress?.attention || ""),
    shippingCountry: String(v.shippingAddress?.country || "India"),
    shippingStreet1: String(v.shippingAddress?.street1 || ""),
    shippingStreet2: String(v.shippingAddress?.street2 || ""),
    shippingCity: String(v.shippingAddress?.city || ""),
    shippingState: String(v.shippingAddress?.state || ""),
    shippingPostalCode: String(v.shippingAddress?.postalCode || ""),
    shippingPhone: String(v.shippingAddress?.phone || ""),
    shippingFax: String(v.shippingAddress?.fax || ""),
    contactPersons: Array.isArray(v.contactPersons) ? v.contactPersons : [],
    accountHolderName: String(v.bankDetails?.accountHolderName || ""),
    bankName: String(v.bankDetails?.bankName || ""),
    accountNumber: String(v.bankDetails?.accountNumber || ""),
    confirmAccountNumber: String(v.bankDetails?.accountNumber || ""),
    ifscCode: String(v.bankDetails?.ifscCode || ""),
    branchName: String(v.bankDetails?.branchName || ""),
    customFields: Array.isArray(v.customFields) ? v.customFields : [],
    reportingTags: Array.isArray(v.reportingTags) ? v.reportingTags : [],
    remarks: String(v.remarks || ""),
    documents: Array.isArray(v.documents) ? v.documents : [],
    status: (v.status as "Active" | "Inactive" | "Pending") || "Active",
  };

  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading vendor details…</div>}>
      <VendorForm
        initialData={initialData}
        mode={requestedMode === "edit" ? "edit" : "view"}
        vendorId={id}
      />
    </Suspense>
  );
}
