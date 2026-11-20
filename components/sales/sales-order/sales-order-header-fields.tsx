"use client";

import { Info, Plus, Search, Settings } from "lucide-react";
import {
  type CustomerOption,
  type StockLocationOption,
  deliveryMethods,
  paymentTermsOptions,
  salespersons,
} from "./sales-order-types";

interface SalesOrderHeaderFieldsProps {
  customers: CustomerOption[];
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  stockLocationType: "Warehouse" | "Shop";
  setStockLocationType: (type: "Warehouse" | "Shop") => void;
  stockLocationId: string;
  setStockLocationId: (id: string) => void;
  stockLocationName: string;
  setStockLocationName: (name: string) => void;
  locations: StockLocationOption[];
  isLoadingLocations?: boolean;
  locationError?: string | null;
  onRetryLoadLocations?: () => void;
  salesOrderNumber: string;
  setSalesOrderNumber: (num: string) => void;
  referenceNumber: string;
  setReferenceNumber: (ref: string) => void;
  salesOrderDate: string;
  setSalesOrderDate: (date: string) => void;
  expectedShipmentDate: string;
  setExpectedShipmentDate: (date: string) => void;
  paymentTerms: string;
  setPaymentTerms: (terms: string) => void;
  deliveryMethod: string;
  setDeliveryMethod: (method: string) => void;
  salesperson: string;
  setSalesperson: (sp: string) => void;
  onOpenSearchCustomer: () => void;
  onOpenAddCustomer: () => void;
  onOpenSequenceModal: () => void;
}

export function SalesOrderHeaderFields({
  customers,
  selectedCustomerId,
  setSelectedCustomerId,
  stockLocationType,
  setStockLocationType,
  stockLocationId,
  setStockLocationId,
  stockLocationName,
  setStockLocationName,
  locations,
  isLoadingLocations = false,
  locationError = null,
  onRetryLoadLocations,
  salesOrderNumber,
  setSalesOrderNumber,
  referenceNumber,
  setReferenceNumber,
  salesOrderDate,
  setSalesOrderDate,
  expectedShipmentDate,
  setExpectedShipmentDate,
  paymentTerms,
  setPaymentTerms,
  deliveryMethod,
  setDeliveryMethod,
  salesperson,
  setSalesperson,
  onOpenSearchCustomer,
  onOpenAddCustomer,
  onOpenSequenceModal,
}: SalesOrderHeaderFieldsProps) {
  return (
    <div className="space-y-4 max-w-4xl">
      {/* Customer Name* */}
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] items-center gap-2.5">
        <label className="text-xs sm:text-sm font-semibold text-slate-800">
          Customer Name<span className="text-rose-500 ml-1">*</span>
        </label>
        <div className="flex items-center gap-2 max-w-xl">
          <div className="relative flex-1">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-slate-50/50 hover:bg-white text-slate-800 transition cursor-pointer"
            >
              <option value="">Select or search a customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.email ? `(${c.email})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onOpenSearchCustomer}
            title="Search customers"
            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs cursor-pointer active:scale-95"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenAddCustomer}
            title="Add new customer"
            className="px-3 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            Add
          </button>
        </div>
      </div>

      {/* Sales Order#* */}
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] items-center gap-2.5">
        <label className="text-xs sm:text-sm font-semibold text-slate-800">
          Sales Order#<span className="text-rose-500 ml-1">*</span>
        </label>
        <div className="relative max-w-md">
          <input
            type="text"
            value={salesOrderNumber}
            onChange={(e) => setSalesOrderNumber(e.target.value)}
            className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white font-mono text-slate-900 pr-9 transition shadow-2xs"
          />
          <button
            type="button"
            onClick={onOpenSequenceModal}
            title="Configure number sequence"
            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 transition cursor-pointer p-0.5 rounded-md hover:bg-slate-100"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reference# */}
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-700">
          <span>Reference#</span>
          <div className="group relative">
            <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
            <div className="absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 hidden group-hover:block z-20 w-52 p-2.5 bg-slate-900 text-white text-[11px] rounded-xl shadow-xl">
              Buyer purchase order or contract reference number.
            </div>
          </div>
        </div>
        <input
          type="text"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          placeholder="e.g. PO-2026-9042"
          className="max-w-md px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white text-slate-800 placeholder:text-slate-400 transition shadow-2xs"
        />
      </div>

      {/* Stock Location */}
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] items-start gap-2.5 pt-1">
        <div className="flex flex-col">
          <label className="text-xs sm:text-sm font-semibold text-slate-800">
            Stock Location<span className="text-rose-500 ml-1">*</span>
          </label>
          <span className="text-[11px] text-slate-500">Inventory source</span>
        </div>
        <div className="space-y-2 max-w-md w-full">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isLoadingLocations}
              onClick={() => {
                if (stockLocationType !== "Warehouse") {
                  setStockLocationType("Warehouse");
                }
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                stockLocationType === "Warehouse"
                  ? "bg-blue-50 border-blue-600 text-blue-700 shadow-xs"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              } ${isLoadingLocations ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              🏢 Warehouse
            </button>
            <button
              type="button"
              disabled={isLoadingLocations}
              onClick={() => {
                if (stockLocationType !== "Shop") {
                  setStockLocationType("Shop");
                }
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                stockLocationType === "Shop"
                  ? "bg-blue-50 border-blue-600 text-blue-700 shadow-xs"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              } ${isLoadingLocations ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              🏪 Shop
            </button>
          </div>
          <div className="relative">
            <select
              value={stockLocationId}
              disabled={isLoadingLocations || locations.filter((l) => l.type === stockLocationType).length === 0}
              onChange={(e) => {
                const locId = e.target.value;
                setStockLocationId(locId);
                const found = locations.find((l) => l.id === locId);
                setStockLocationName(found ? found.name : "");
              }}
              className={`w-full px-3.5 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 transition cursor-pointer ${
                locationError
                  ? "border-rose-300 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                  : "border-slate-200 bg-white text-slate-800 focus:border-blue-500"
              } ${isLoadingLocations ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {isLoadingLocations ? (
                <option value="">Loading {stockLocationType.toLowerCase()}s...</option>
              ) : locations.filter((l) => l.type === stockLocationType).length === 0 ? (
                <option value="" disabled>
                  No active {stockLocationType.toLowerCase()}s available
                </option>
              ) : (
                <>
                  <option value="">Select {stockLocationType}...</option>
                  {locations
                    .filter((l) => l.type === stockLocationType)
                    .map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.code ? `(${loc.code})` : ""}
                      </option>
                    ))}
                </>
              )}
            </select>
          </div>

          {/* Loading State */}
          {isLoadingLocations && (
            <p className="text-[11px] text-blue-600 animate-pulse flex items-center gap-1">
              <span>Fetching active {stockLocationType.toLowerCase()}s...</span>
            </p>
          )}

          {/* Empty State */}
          {!isLoadingLocations && !locationError && locations.filter((l) => l.type === stockLocationType).length === 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
              No active {stockLocationType.toLowerCase()}s found. Please configure active {stockLocationType.toLowerCase()}s in settings.
            </p>
          )}

          {/* Error State with Retry */}
          {locationError && (
            <div className="flex items-center justify-between text-[11px] text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200">
              <span>{locationError}</span>
              {onRetryLoadLocations && (
                <button
                  type="button"
                  onClick={onRetryLoadLocations}
                  className="font-semibold underline hover:text-rose-800 ml-2 cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sales Order Date & Expected Shipment Date */}
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] items-center gap-2.5">
        <label className="text-xs sm:text-sm font-semibold text-slate-800">
          Sales Order Date<span className="text-rose-500 ml-1">*</span>
        </label>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 max-w-2xl">
          <input
            type="date"
            value={salesOrderDate}
            onChange={(e) => setSalesOrderDate(e.target.value)}
            className="w-full sm:w-56 px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white text-slate-800 transition shadow-2xs"
          />
          <span className="text-xs sm:text-sm font-medium text-slate-600 whitespace-nowrap">
            Expected Shipment
          </span>
          <input
            type="date"
            value={expectedShipmentDate}
            onChange={(e) => setExpectedShipmentDate(e.target.value)}
            placeholder="dd/MM/yyyy"
            className="w-full sm:w-56 px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white text-slate-800 transition shadow-2xs"
          />
        </div>
      </div>

      {/* Payment Terms */}
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] items-center gap-2.5">
        <label className="text-xs sm:text-sm font-medium text-slate-700">Payment Terms</label>
        <div className="max-w-md">
          <select
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white text-slate-800 transition shadow-2xs cursor-pointer"
          >
            {paymentTermsOptions.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Delivery Method */}
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] items-center gap-2.5">
        <label className="text-xs sm:text-sm font-medium text-slate-700">Delivery Method</label>
        <div className="max-w-md">
          <select
            value={deliveryMethod}
            onChange={(e) => setDeliveryMethod(e.target.value)}
            className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white text-slate-800 transition shadow-2xs cursor-pointer"
          >
            <option value="">Select a delivery method or logistics carrier</option>
            {deliveryMethods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Salesperson */}
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] items-center gap-2.5">
        <label className="text-xs sm:text-sm font-medium text-slate-700">Salesperson</label>
        <div className="max-w-md">
          <select
            value={salesperson}
            onChange={(e) => setSalesperson(e.target.value)}
            className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white text-slate-800 transition shadow-2xs cursor-pointer"
          >
            <option value="">Select or Add Salesperson</option>
            {salespersons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
