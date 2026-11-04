"use client";

import { Info, Settings } from "lucide-react";

type QuoteHeaderFieldsProps = {
  quoteNumber: string;
  setQuoteNumber: (v: string) => void;
  referenceNumber: string;
  setReferenceNumber: (v: string) => void;
  quoteDate: string;
  setQuoteDate: (v: string) => void;
  expiryDate: string;
  setExpiryDate: (v: string) => void;
  subject: string;
  setSubject: (v: string) => void;
};

export function QuoteHeaderFields({
  quoteNumber,
  setQuoteNumber,
  referenceNumber,
  setReferenceNumber,
  quoteDate,
  setQuoteDate,
  expiryDate,
  setExpiryDate,
  subject,
  setSubject,
}: QuoteHeaderFieldsProps) {
  return (
    <>
      {/* Quote# */}
      <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] items-center gap-2">
        <label className="text-sm font-medium text-red-500">
          Quote#<span className="text-red-500 ml-0.5">*</span>
        </label>
        <div className="relative max-w-md">
          <input
            type="text"
            value={quoteNumber}
            onChange={(e) => setQuoteNumber(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white font-mono text-slate-800 pr-9"
          />
          <button
            type="button"
            title="Configure quote number sequence"
            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reference# */}
      <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] items-center gap-2">
        <label className="text-sm font-medium text-slate-700">Reference#</label>
        <input
          type="text"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          placeholder="Enter reference number"
          className="max-w-md px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Quote Date & Expiry Date */}
      <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] items-center gap-2">
        <label className="text-sm font-medium text-red-500">
          Quote Date<span className="text-red-500 ml-0.5">*</span>
        </label>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 max-w-2xl">
          <input
            type="date"
            value={quoteDate}
            onChange={(e) => setQuoteDate(e.target.value)}
            className="w-full sm:w-56 px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
          />
          <span className="text-sm font-medium text-slate-700 whitespace-nowrap">Expiry Date</span>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            placeholder="dd/MM/yyyy"
            className="w-full sm:w-56 px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
          />
        </div>
      </div>

      {/* Subject */}
      <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] items-start gap-2 pt-1">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 pt-2">
          <span>Subject</span>
          <Info className="w-3.5 h-3.5 text-slate-400" />
        </div>
        <div className="max-w-2xl">
          <textarea
            rows={2}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Let your customer know what this Quote is for"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white resize-y"
          />
        </div>
      </div>
    </>
  );
}
