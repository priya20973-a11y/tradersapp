"use client";

import { Building2, Check, User } from "lucide-react";

type CustomerClassificationCardsProps = {
  customerType: "Business" | "Individual";
  onSelectType: (type: "Business" | "Individual") => void;
};

export function CustomerClassificationCards({
  customerType,
  onSelectType,
}: CustomerClassificationCardsProps) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
        Customer Classification
      </label>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label
          className={`relative flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition ${
            customerType === "Business"
              ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
          }`}
        >
          <input
            type="radio"
            name="customerType"
            value="Business"
            checked={customerType === "Business"}
            onChange={() => onSelectType("Business")}
            className="sr-only"
          />
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              customerType === "Business" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            <Building2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Business (B2B)</span>
              {customerType === "Business" && <Check className="h-4 w-4 text-blue-600" />}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Registered companies, corporations, enterprises, LLPs, and GST registered dealers.
            </p>
          </div>
        </label>

        <label
          className={`relative flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition ${
            customerType === "Individual"
              ? "border-purple-600 bg-purple-50/40 ring-2 ring-purple-500/20"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
          }`}
        >
          <input
            type="radio"
            name="customerType"
            value="Individual"
            checked={customerType === "Individual"}
            onChange={() => onSelectType("Individual")}
            className="sr-only"
          />
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              customerType === "Individual" ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Individual / Retail (B2C)</span>
              {customerType === "Individual" && <Check className="h-4 w-4 text-purple-600" />}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Direct retail consumers, sole proprietors, independent professionals, or contractors.
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}
