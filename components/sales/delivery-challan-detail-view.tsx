"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Edit2,
  Loader2,
  Printer,
  Trash2,
} from "lucide-react";
import { type DeliveryChallanDocument } from "./delivery-challan/delivery-challan-types";
import {
  downloadDeliveryChallanPDF,
  printDeliveryChallan,
} from "./delivery-challan/delivery-challan-pdf-generator";

export function DeliveryChallanDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [result, setResult] = useState<{
    id: string;
    challan: DeliveryChallanDocument | null;
    error: string | null;
  } | null>(null);
  const loading = result?.id !== id;
  const challan = result?.id === id ? result.challan : null;
  const error = result?.id === id ? result.error : null;
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetch(`/api/sales/delivery-challans/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Delivery challan not found");
        return res.json();
      })
      .then((data) => {
        if (isMounted) setResult({ id, challan: data.deliveryChallan, error: null });
      })
      .catch((err) => {
        if (isMounted) {
          setResult({
            id,
            challan: null,
            error: err instanceof Error ? err.message : "Failed to load delivery challan",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleDownloadPDF = async () => {
    if (!challan) return;
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
    if (!challan) return;
    try {
      setPrinting(true);
      await printDeliveryChallan(challan, challan.customerSnapshot);
    } catch {
      alert("Failed to print delivery challan.");
    } finally {
      setPrinting(false);
    }
  };

  const handleDelete = async () => {
    if (!challan) return;
    if (!window.confirm(`Are you sure you want to delete Delivery Challan #${challan.deliveryChallanNumber}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/sales/delivery-challans/${challan.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete delivery challan.");
      router.push("/sales/delivery-challans");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete.");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!challan) return;
    try {
      const res = await fetch(`/api/sales/delivery-challans/${challan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status.");
      setResult((prev) =>
        prev?.id === id && prev.challan
          ? { ...prev, challan: { ...prev.challan, status: newStatus } }
          : prev,
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        Loading delivery challan…
      </div>
    );
  }

  if (error || !challan) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center space-y-4">
        <p className="text-sm font-semibold text-rose-600">{error || "Not found"}</p>
        <Link
          href="/sales/delivery-challans"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Delivery Challans
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/sales/delivery-challans"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to List
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={printing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            {printing ? "Preparing…" : "Print"}
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
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
            onClick={handleDelete}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            title="Delete Challan"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Document Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {challan.deliveryChallanNumber}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {challan.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Challan Type: <span className="font-semibold text-slate-700">{challan.challanType}</span>
            </p>
          </div>

          <div className="text-left sm:text-right text-xs space-y-1">
            <p className="text-slate-500">
              Date: <span className="font-semibold text-slate-800">{new Date(challan.deliveryChallanDate).toLocaleDateString("en-IN")}</span>
            </p>
            {challan.referenceNumber && (
              <p className="text-slate-500">
                Ref #: <span className="font-mono font-medium text-slate-800">{challan.referenceNumber}</span>
              </p>
            )}
          </div>
        </div>

        {/* Deliver To */}
        <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-1 text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Deliver To (Customer)
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

        {/* Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-semibold uppercase">
                <th className="py-2.5 px-3 text-left">#</th>
                <th className="py-2.5 px-3 text-left">Item Details</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3 text-right">Rate ( ₹ )</th>
                <th className="py-2.5 px-3 text-right">Amount ( ₹ )</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {challan.items.map((it, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-slate-900">{it.name}</p>
                    {it.description && <p className="text-slate-500 text-[11px]">{it.description}</p>}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {it.quantity} {it.unit || "pcs"}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">{it.rate.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                    {it.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Sub Total:</span>
              <span className="tabular-nums font-semibold">₹{challan.subTotal.toFixed(2)}</span>
            </div>
            {challan.discount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Discount ({challan.discount}{challan.discountType === "percent" ? "%" : "₹"}):</span>
                <span className="tabular-nums font-semibold">
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
                <span className="tabular-nums font-semibold">
                  {challan.adjustment >= 0 ? "+" : "-"}₹{Math.abs(challan.adjustment).toFixed(2)}
                </span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
              <span className="text-sm">Grand Total:</span>
              <span className="tabular-nums text-base">₹{challan.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        {(challan.customerNotes || challan.termsAndConditions) && (
          <div className="space-y-4 pt-4 border-t border-slate-100 text-xs">
            {challan.customerNotes && (
              <div>
                <span className="font-bold text-slate-700">Customer Notes:</span>
                <p className="text-slate-600 mt-0.5">{challan.customerNotes}</p>
              </div>
            )}
            {challan.termsAndConditions && (
              <div>
                <span className="font-bold text-slate-700">Terms & Conditions:</span>
                <p className="text-slate-600 mt-0.5 whitespace-pre-line">{challan.termsAndConditions}</p>
              </div>
            )}
          </div>
        )}

        {/* Status Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Quick Status Change:</span>
            {challan.status !== "Delivered" && (
              <button
                type="button"
                onClick={() => handleStatusChange("Delivered")}
                className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs cursor-pointer transition"
              >
                Mark as Delivered
              </button>
            )}
            {challan.status === "Delivered" && (
              <button
                type="button"
                onClick={() => handleStatusChange("Closed")}
                className="px-3 py-1 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-xs cursor-pointer transition"
              >
                Mark as Closed
              </button>
            )}
            {challan.status !== "Void" && (
              <button
                type="button"
                onClick={() => handleStatusChange("Void")}
                className="px-3 py-1 text-xs font-semibold border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer transition"
              >
                Void Challan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
