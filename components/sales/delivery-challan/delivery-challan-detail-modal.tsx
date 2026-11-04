"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Download,
  Edit2,
  FileText,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import { type DeliveryChallanDocument } from "./delivery-challan-types";
import {
  downloadDeliveryChallanPDF,
  printDeliveryChallan,
} from "./delivery-challan-pdf-generator";

interface DeliveryChallanDetailModalProps {
  challan: DeliveryChallanDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string, number: string) => Promise<void>;
  onStatusChange: (id: string, newStatus: string) => Promise<void>;
}

export function DeliveryChallanDetailModal({
  challan,
  isOpen,
  onClose,
  onDelete,
  onStatusChange,
}: DeliveryChallanDetailModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  if (!isOpen || !challan) return null;

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);
      await downloadDeliveryChallanPDF(challan, challan.customerSnapshot);
    } catch {
      alert("Failed to download PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    try {
      setPrinting(true);
      await printDeliveryChallan(challan, challan.customerSnapshot);
    } catch {
      alert("Failed to print delivery challan.");
    } finally {
      setPrinting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Delivered":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Delivered
          </span>
        );
      case "Open":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Open
          </span>
        );
      case "Draft":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Draft
          </span>
        );
      case "Closed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {challan.deliveryChallanNumber}
                </h3>
                {getStatusBadge(challan.status)}
              </div>
              <p className="text-xs text-slate-500">
                Created on {new Date(challan.deliveryChallanDate).toLocaleDateString("en-IN")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={printing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition text-slate-700 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              {printing ? "Preparing…" : "Print"}
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition text-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? "Downloading…" : "Download PDF"}
            </button>
            <Link
              href={`/sales/delivery-challans/${challan.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Challan & Customer Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Deliver To
              </span>
              <p className="text-sm font-bold text-slate-900">{challan.customerName}</p>
              {challan.customerSnapshot?.email && (
                <p className="text-slate-500">{challan.customerSnapshot.email}</p>
              )}
              {challan.customerSnapshot?.phone && (
                <p className="text-slate-500">{challan.customerSnapshot.phone}</p>
              )}
              {challan.customerSnapshot?.gstin && (
                <p className="text-slate-500 font-mono">GSTIN: {challan.customerSnapshot.gstin}</p>
              )}
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Challan Details
              </span>
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <span className="text-slate-500">Challan Type:</span>
                <span className="font-semibold text-blue-600">{challan.challanType}</span>

                <span className="text-slate-500">Challan Date:</span>
                <span className="font-medium">
                  {new Date(challan.deliveryChallanDate).toLocaleDateString("en-IN")}
                </span>

                {challan.referenceNumber && (
                  <>
                    <span className="text-slate-500">Reference#:</span>
                    <span className="font-mono">{challan.referenceNumber}</span>
                  </>
                )}

                <span className="text-slate-500">Status:</span>
                <div>{getStatusBadge(challan.status)}</div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-semibold uppercase">
                  <th className="py-2 px-3 text-left">#</th>
                  <th className="py-2 px-3 text-left">Item Details</th>
                  <th className="py-2 px-3 text-right">Quantity</th>
                  <th className="py-2 px-3 text-right">Rate</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {challan.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-900">{it.name}</p>
                      {it.description && (
                        <p className="text-slate-500 text-[11px]">{it.description}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {it.quantity} {it.unit || "pcs"}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">₹{it.rate.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                      ₹{it.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculations Breakdown */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Sub Total:</span>
                <span className="tabular-nums font-medium">₹{challan.subTotal.toFixed(2)}</span>
              </div>
              {challan.discount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>
                    Discount {challan.discountType === "percent" ? `(${challan.discount}%)` : ""}:
                  </span>
                  <span className="tabular-nums font-medium">
                    -₹
                    {(challan.discountType === "percent"
                      ? challan.subTotal * (challan.discount / 100)
                      : challan.discount
                    ).toFixed(2)}
                  </span>
                </div>
              )}
              {challan.adjustment !== 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Adjustment:</span>
                  <span className="tabular-nums font-medium">
                    {challan.adjustment >= 0 ? "+" : "-"}₹{Math.abs(challan.adjustment).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="tabular-nums text-sm">₹{challan.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes and Terms */}
          {(challan.customerNotes || challan.termsAndConditions) && (
            <div className="space-y-3 pt-2">
              {challan.customerNotes && (
                <div>
                  <span className="font-bold text-slate-700">Customer Notes:</span>
                  <p className="text-slate-600 mt-0.5">{challan.customerNotes}</p>
                </div>
              )}
              {challan.termsAndConditions && (
                <div>
                  <span className="font-bold text-slate-700">Terms & Conditions:</span>
                  <p className="text-slate-600 mt-0.5 whitespace-pre-line">
                    {challan.termsAndConditions}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Status Change & Delete */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={() => onDelete(challan.id, challan.deliveryChallanNumber)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Challan
          </button>

          <div className="flex items-center gap-2">
            {challan.status !== "Delivered" && (
              <button
                type="button"
                onClick={() => onStatusChange(challan.id, "Delivered")}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition cursor-pointer"
              >
                Mark as Delivered
              </button>
            )}
            {challan.status === "Delivered" && (
              <button
                type="button"
                onClick={() => onStatusChange(challan.id, "Closed")}
                className="px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs transition cursor-pointer"
              >
                Mark as Closed
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

