"use client";

import { ChevronDown, FileText, HelpCircle, Upload, X } from "lucide-react";
import { type AttachedFile, taxOptions } from "./sales-order-types";

interface SalesOrderTotalsCardProps {
  customerNotes: string;
  setCustomerNotes: (v: string) => void;
  termsAndConditions: string;
  setTermsAndConditions: (v: string) => void;
  attachedFiles: AttachedFile[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  subTotal: number;
  discountValue: string;
  setDiscountValue: (v: string) => void;
  discountType: "percent" | "amount";
  setDiscountType: React.Dispatch<React.SetStateAction<"percent" | "amount">>;
  discountAmount: number;
  taxMode: "TDS" | "TCS";
  setTaxMode: (v: "TDS" | "TCS") => void;
  selectedTaxIndex: string;
  setSelectedTaxIndex: (v: string) => void;
  rawTaxAmount: number;
  adjustmentValue: string;
  setAdjustmentValue: (v: string) => void;
  adjustment: number;
  total: number;
}

export function SalesOrderTotalsCard({
  customerNotes,
  setCustomerNotes,
  termsAndConditions,
  setTermsAndConditions,
  attachedFiles,
  onFileUpload,
  onRemoveFile,
  fileInputRef,
  subTotal,
  discountValue,
  setDiscountValue,
  discountType,
  setDiscountType,
  discountAmount,
  taxMode,
  setTaxMode,
  selectedTaxIndex,
  setSelectedTaxIndex,
  rawTaxAmount,
  adjustmentValue,
  setAdjustmentValue,
  adjustment,
  total,
}: SalesOrderTotalsCardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
      {/* Left Column: Notes, Terms, Attachments */}
      <div className="space-y-5">
        {/* Customer Notes */}
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-semibold text-slate-800">Customer Notes</label>
          <textarea
            rows={3}
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            placeholder="Special delivery instructions or order notes visible to the customer..."
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white placeholder:text-slate-400 resize-y shadow-2xs transition"
          />
        </div>

        {/* Terms & Conditions */}
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-semibold text-slate-800">
            Terms & Conditions
          </label>
          <textarea
            rows={4}
            value={termsAndConditions}
            onChange={(e) => setTermsAndConditions(e.target.value)}
            placeholder="Standard commercial terms, delivery warranties, inspection window..."
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white placeholder:text-slate-400 resize-y shadow-2xs transition"
          />
        </div>

        {/* Attach File(s) */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-800 block">
            Attach Order Documents & PO Specs
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              Upload Document
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={onFileUpload}
              className="hidden"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Support for PDF, image, spreadsheet (Up to 10 files, max 5MB each)
          </p>

          {/* Uploaded Files Chips */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {attachedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-700 shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span className="max-w-[150px] truncate font-medium">{file.name}</span>
                  <span className="text-[10px] text-slate-400">
                    ({Math.round(file.size / 1024)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(idx)}
                    className="text-slate-400 hover:text-red-500 ml-1 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Calculations Box */}
      <div className="space-y-6">
        <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xs">
          {/* Sub Total */}
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Sub Total</span>
            <span className="font-bold text-slate-900 tabular-nums">{subTotal.toFixed(2)}</span>
          </div>

          {/* Discount */}
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-600 font-medium">Discount</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-16 px-2.5 py-1 text-sm text-right outline-none text-slate-900 font-medium"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDiscountType((prev) => (prev === "percent" ? "amount" : "percent"))
                  }
                  className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 border-l border-slate-200 text-slate-700 transition cursor-pointer"
                >
                  {discountType === "percent" ? "%" : "₹"}
                </button>
              </div>
              <span className="font-medium text-slate-900 w-24 text-right tabular-nums">
                - {discountAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* TDS / TCS */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200/70">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="taxMode"
                    value="TDS"
                    checked={taxMode === "TDS"}
                    onChange={() => setTaxMode("TDS")}
                    className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                  />
                  TDS (Withholding)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="taxMode"
                    value="TCS"
                    checked={taxMode === "TCS"}
                    onChange={() => setTaxMode("TCS")}
                    className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                  />
                  TCS / GST
                </label>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedTaxIndex}
                  onChange={(e) => setSelectedTaxIndex(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white outline-none focus:border-blue-500 max-w-[190px] text-slate-800 cursor-pointer shadow-2xs"
                >
                  <option value="">Select a Tax Clause</option>
                  {taxOptions
                    .map((t, idx) => ({ ...t, originalIndex: idx }))
                    .filter((t) => t.type === taxMode)
                    .map((t) => (
                      <option key={t.label} value={t.originalIndex}>
                        {t.label}
                      </option>
                    ))}
                </select>
                <span className="text-sm font-medium text-slate-900 w-24 text-right tabular-nums">
                  {taxMode === "TDS" ? "- " : "+ "}
                  {rawTaxAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Adjustment */}
          <div className="flex items-center justify-between gap-4 text-sm pt-2 border-t border-slate-200/70">
            <div className="flex items-center gap-1.5">
              <span className="border border-slate-300 px-2.5 py-0.5 rounded-lg text-xs text-slate-700 font-semibold bg-white shadow-2xs">
                Adjustment
              </span>
              <div className="group relative">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block z-20 w-52 p-2 bg-slate-900 text-white text-[11px] rounded-xl shadow-xl">
                  Add positive or negative adjustment amounts (freight, packaging, round off).
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="any"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(e.target.value)}
                placeholder="0.00"
                className="w-24 px-2.5 py-1 text-sm text-right border border-slate-200 rounded-xl outline-none bg-white focus:border-blue-500 text-slate-900 font-medium shadow-2xs"
              />
              <span className="font-medium text-slate-900 w-24 text-right tabular-nums">
                {adjustment.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between text-base pt-3.5 border-t border-slate-300">
            <span className="font-bold text-slate-900">Total Order Amount ( ₹ )</span>
            <span className="text-2xl font-black text-slate-950 tabular-nums">
              ₹ {total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
