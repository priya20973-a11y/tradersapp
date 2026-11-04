"use client";

import { CheckCircle2, Printer, X } from "lucide-react";
import { formatCurrency, numberToIndianWords } from "@/lib/invoice-utils";
import { type InvoiceRecord, type PaymentRecordData } from "./invoice-types";

interface PaymentReceiptModalProps {
  isOpen: boolean;
  payment: PaymentRecordData;
  invoice: InvoiceRecord;
  companyName?: string;
  onClose: () => void;
}

export function PaymentReceiptModal({
  isOpen,
  payment,
  invoice,
  companyName = "Bharat Traders & Commodities Ltd.",
  onClose,
}: PaymentReceiptModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Payment Receipt
              </h3>
              <p className="text-xs text-slate-500">
                Receipt #{payment.receiptNumber || payment.number}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Receipt Paper */}
        <div
          id="printable-payment-receipt"
          className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-slate-800"
        >
          <div className="text-center pb-4 border-b border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Official Receipt
            </p>
            <h4 className="mt-1 text-lg font-bold text-slate-900">
              {companyName}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Receipt: {payment.receiptNumber || payment.number} • Date:{" "}
              {payment.paymentDate
                ? new Date(payment.paymentDate).toLocaleDateString("en-IN")
                : new Date().toLocaleDateString("en-IN")}
            </p>
          </div>

          <div className="my-5 text-center">
            <p className="text-xs text-slate-500">Amount Received</p>
            <p className="mt-1 text-3xl font-extrabold text-emerald-600">
              {formatCurrency(payment.amount, invoice.currency)}
            </p>
            <p className="mt-1.5 text-xs font-medium text-slate-600 italic">
              {numberToIndianWords(payment.amount)}
            </p>
          </div>

          <div className="space-y-2.5 rounded-xl bg-white p-4 border border-slate-200 text-xs text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Received From:</span>
              <span className="font-semibold text-slate-900">
                {invoice.customerName}
                {invoice.customerCompany && ` (${invoice.customerCompany})`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Against Invoice:</span>
              <span className="font-semibold text-blue-600">
                {invoice.number}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Mode:</span>
              <span className="font-semibold text-slate-900">
                {payment.method}
              </span>
            </div>
            {payment.referenceNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500">Reference / UTR:</span>
                <span className="font-mono font-medium text-slate-900">
                  {payment.referenceNumber}
                </span>
              </div>
            )}
            {payment.notes && (
              <div className="flex justify-between">
                <span className="text-slate-500">Remarks:</span>
                <span className="font-medium text-slate-800">{payment.notes}</span>
              </div>
            )}
            <div className="border-t border-slate-100 pt-2 flex justify-between">
              <span className="text-slate-500">Invoice Remaining Balance:</span>
              <span className="font-bold text-rose-600">
                {formatCurrency(invoice.balanceDue, invoice.currency)}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Status: Verified & Recorded</span>
            <span>Authorized Signatory</span>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print Receipt
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
