"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  PlusCircle,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  DEFAULT_TCS_RATES,
  DEFAULT_TDS_RATES,
  type DirectTaxOption,
  GST_RATE_PRESETS,
} from "./quote-types";

const TDS_STORAGE_KEY = "traders_direct_taxes_tds_custom";
const TCS_STORAGE_KEY = "traders_direct_taxes_tcs_custom";
const emptyCustomTaxes: DirectTaxOption[] = [];
const customTaxCache = new Map<string, { raw: string | null; options: DirectTaxOption[] }>();

function getStoredCustomTaxes(key: string): DirectTaxOption[] {
  if (typeof window === "undefined") return emptyCustomTaxes;
  try {
    const raw = localStorage.getItem(key);
    const cached = customTaxCache.get(key);
    if (cached?.raw === raw) return cached.options;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const options = Array.isArray(parsed)
      ? parsed.filter(
          (item): item is DirectTaxOption =>
            typeof item === "object" &&
            item !== null &&
            "id" in item &&
            typeof item.id === "string" &&
            "name" in item &&
            typeof item.name === "string" &&
            "rate" in item &&
            typeof item.rate === "number",
        )
      : [];
    customTaxCache.set(key, { raw, options });
    return options;
  } catch {
    return emptyCustomTaxes;
  }
}

function subscribeToCustomTaxes(onChange: () => void) {
  window.addEventListener("direct_taxes_updated", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("direct_taxes_updated", onChange);
    window.removeEventListener("storage", onChange);
  };
}

const getStoredTds = () => getStoredCustomTaxes(TDS_STORAGE_KEY);
const getStoredTcs = () => getStoredCustomTaxes(TCS_STORAGE_KEY);
const getServerCustomTaxes = () => emptyCustomTaxes;

function saveCustomTaxes(key: string, taxes: DirectTaxOption[]) {
  const raw = JSON.stringify(taxes);
  try {
    localStorage.setItem(key, raw);
  } catch {
    return;
  }
  customTaxCache.set(key, { raw, options: taxes });
  window.dispatchEvent(new Event("direct_taxes_updated"));
}

export interface QuoteTotalsCardProps {
  subTotal: number;
  discountValue: string;
  setDiscountValue: (v: string) => void;
  discountType: "percent" | "amount";
  setDiscountType: React.Dispatch<React.SetStateAction<"percent" | "amount">>;
  discountAmount: number;
  gstRate: string;
  setGstRate: (v: string) => void;
  gstAmount: number;
  // TDS / TCS
  tdsTcsMode: "TDS" | "TCS";
  setTdsTcsMode: (mode: "TDS" | "TCS") => void;
  selectedTax: DirectTaxOption | null;
  setSelectedTax: (tax: DirectTaxOption | null) => void;
  tdsTcsAmount: number;
  // Adjustment & Total
  adjustmentValue: string;
  setAdjustmentValue: (v: string) => void;
  adjustment: number;
  total: number;
}

export function QuoteTotalsCard({
  subTotal,
  discountValue,
  setDiscountValue,
  discountType,
  setDiscountType,
  discountAmount,
  gstRate,
  setGstRate,
  gstAmount,
  tdsTcsMode,
  setTdsTcsMode,
  selectedTax,
  setSelectedTax,
  tdsTcsAmount,
  adjustmentValue,
  setAdjustmentValue,
  adjustment,
  total,
}: QuoteTotalsCardProps) {
  const taxableAmount = Math.max(0, subTotal - discountAmount);
  const currentGstRateNum = parseFloat(gstRate);

  // Dropdown states
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Custom taxes state loaded from storage
  const customTdsList = useSyncExternalStore(
    subscribeToCustomTaxes,
    getStoredTds,
    getServerCustomTaxes,
  );
  const customTcsList = useSyncExternalStore(
    subscribeToCustomTaxes,
    getStoredTcs,
    getServerCustomTaxes,
  );

  // Modal for adding new tax
  const [showAddTaxModal, setShowAddTaxModal] = useState(false);
  const [newTaxName, setNewTaxName] = useState("");
  const [newTaxRate, setNewTaxRate] = useState("");
  const [newTaxSection, setNewTaxSection] = useState("");
  const [newTaxError, setNewTaxError] = useState("");

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Combine default & custom taxes
  const availableTds = [...DEFAULT_TDS_RATES, ...customTdsList];
  const availableTcs = [...DEFAULT_TCS_RATES, ...customTcsList];
  const activeList = tdsTcsMode === "TDS" ? availableTds : availableTcs;

  // Filtered by search query
  const filteredList = activeList.filter((tax) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      tax.name.toLowerCase().includes(q) ||
      tax.rate.toString().includes(q) ||
      (tax.section && tax.section.toLowerCase().includes(q))
    );
  });

  const handleModeChange = (newMode: "TDS" | "TCS") => {
    setTdsTcsMode(newMode);
    // If current selected tax doesn't belong to new mode, clear it
    if (selectedTax) {
      const existsInNew = (newMode === "TDS" ? availableTds : availableTcs).some(
        (t) => t.id === selectedTax.id || t.name === selectedTax.name
      );
      if (!existsInNew) {
        setSelectedTax(null);
      }
    }
  };

  const handleSelectTax = (tax: DirectTaxOption) => {
    setSelectedTax(tax);
    setIsDropdownOpen(false);
    setSearchQuery("");
  };

  const handleClearTax = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTax(null);
  };

  const handleSaveNewTax = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTaxName.trim();
    const rate = parseFloat(newTaxRate);

    if (!name) {
      setNewTaxError("Please enter a tax name.");
      return;
    }
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setNewTaxError("Please enter a valid rate between 0 and 100.");
      return;
    }

    const createdTax: DirectTaxOption = {
      id: `${tdsTcsMode.toLowerCase()}-${Date.now()}`,
      name,
      rate,
      section: newTaxSection.trim() || undefined,
      isCustom: true,
    };

    if (tdsTcsMode === "TDS") {
      const updated = [...customTdsList, createdTax];
      saveCustomTaxes(TDS_STORAGE_KEY, updated);
    } else {
      const updated = [...customTcsList, createdTax];
      saveCustomTaxes(TCS_STORAGE_KEY, updated);
    }

    // Auto-select newly created tax
    setSelectedTax(createdTax);
    setShowAddTaxModal(false);
    setNewTaxName("");
    setNewTaxRate("");
    setNewTaxSection("");
    setNewTaxError("");
    setIsDropdownOpen(false);
  };

  const handleDeleteCustomTax = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tdsTcsMode === "TDS") {
      const updated = customTdsList.filter((t) => t.id !== id);
      saveCustomTaxes(TDS_STORAGE_KEY, updated);
    } else {
      const updated = customTcsList.filter((t) => t.id !== id);
      saveCustomTaxes(TCS_STORAGE_KEY, updated);
    }
    if (selectedTax?.id === id) {
      setSelectedTax(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-5 space-y-4">
        {/* Sub Total */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">Sub Total</span>
          <span className="font-semibold text-slate-900">{subTotal.toFixed(2)}</span>
        </div>

        {/* Discount */}
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-slate-600 font-medium">Discount</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-slate-300 rounded-md bg-white overflow-hidden">
              <input
                type="number"
                step="any"
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="w-16 px-2 py-1 text-sm text-right outline-none"
              />
              <button
                type="button"
                onClick={() => setDiscountType((prev) => (prev === "percent" ? "amount" : "percent"))}
                className="px-2 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 border-l border-slate-300 text-slate-600 cursor-pointer"
              >
                {discountType === "percent" ? "%" : "₹"}
              </button>
            </div>
            <span className="font-medium text-slate-900 w-24 text-right">
              {discountAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Taxable Amount (visible if discount is applied) */}
        {discountAmount > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
            <span>Taxable Amount</span>
            <span className="font-mono">{taxableAmount.toFixed(2)}</span>
          </div>
        )}

        {/* TDS / TCS Section (matches reference screenshot) */}
        <div className="relative pt-1 border-t border-slate-200/60" ref={dropdownRef}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Radio options: TDS / TCS */}
            <div className="flex items-center gap-3.5">
              <label className="flex items-center gap-1.5 cursor-pointer text-sm font-semibold text-slate-800">
                <input
                  type="radio"
                  name="tdsTcsOption"
                  value="TDS"
                  checked={tdsTcsMode === "TDS"}
                  onChange={() => handleModeChange("TDS")}
                  className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span>TDS</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-sm font-semibold text-slate-800">
                <input
                  type="radio"
                  name="tdsTcsOption"
                  value="TCS"
                  checked={tdsTcsMode === "TCS"}
                  onChange={() => handleModeChange("TCS")}
                  className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span>TCS</span>
              </label>

              {/* Dropdown trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className={`inline-flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white transition cursor-pointer min-w-[170px] max-w-[260px] truncate shadow-xs ${
                    isDropdownOpen
                      ? "border-blue-500 ring-2 ring-blue-500/20 text-blue-700"
                      : "border-slate-300 text-slate-700 hover:border-slate-400"
                  }`}
                  aria-expanded={isDropdownOpen}
                >
                  <span className="truncate">
                    {selectedTax ? `${selectedTax.name} [${selectedTax.rate}%]` : "Select a Tax"}
                  </span>
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    {selectedTax && (
                      <span
                        role="button"
                        onClick={handleClearTax}
                        title="Clear tax"
                        className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    )}
                    {isDropdownOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Amount display: - 0.00 for TDS, + 0.00 for TCS */}
            <div className="text-right">
              <span
                className={`font-semibold text-sm w-24 inline-block ${
                  tdsTcsAmount > 0
                    ? tdsTcsMode === "TDS"
                      ? "text-rose-600"
                      : "text-emerald-600"
                    : "text-slate-900"
                }`}
              >
                {tdsTcsMode === "TDS" ? "- " : "+ "}
                {tdsTcsAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Searchable Dropdown Menu Popup (Matches Screenshot) */}
          {isDropdownOpen && (
            <div className="absolute left-0 sm:left-24 top-full mt-1.5 w-80 sm:w-96 rounded-xl border border-blue-400/80 bg-white shadow-2xl z-50 overflow-hidden text-xs animate-in fade-in-50 zoom-in-95">
              {/* Search input */}
              <div className="p-2.5 border-b border-slate-100">
                <div className="relative flex items-center border border-blue-500 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-blue-500/20">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    placeholder="Search"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent outline-none text-xs text-slate-800 placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tax List Title Header */}
              <div className="px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                <span>{tdsTcsMode}</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {filteredList.length} applicable
                </span>
              </div>

              {/* Tax Items List */}
              <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
                {filteredList.length === 0 ? (
                  <div className="p-4 text-center text-slate-400">
                    No matching {tdsTcsMode} tax rates found.
                  </div>
                ) : (
                  filteredList.map((tax) => {
                    const isSelected = selectedTax?.id === tax.id || selectedTax?.name === tax.name;
                    return (
                      <div
                        key={tax.id}
                        onClick={() => handleSelectTax(tax)}
                        className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition ${
                          isSelected
                            ? "bg-blue-600 text-white font-semibold shadow-xs"
                            : "hover:bg-blue-50/80 text-slate-700"
                        }`}
                      >
                        <div className="flex flex-col truncate pr-2">
                          <span className="truncate">
                            {tax.name} [{tax.rate}%]
                          </span>
                          {tax.section && (
                            <span
                              className={`text-[10px] ${
                                isSelected ? "text-blue-100" : "text-slate-400"
                              }`}
                            >
                              {tax.section}
                            </span>
                          )}
                        </div>

                        {tax.isCustom && (
                          <button
                            type="button"
                            title="Delete custom tax"
                            onClick={(e) => handleDeleteCustomTax(e, tax.id)}
                            className={`p-1 rounded opacity-0 group-hover:opacity-100 transition ${
                              isSelected
                                ? "text-white/80 hover:text-white"
                                : "text-slate-400 hover:text-rose-600"
                            }`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add New Tax Button */}
              <div className="p-2 border-t border-slate-100 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setShowAddTaxModal(true);
                  }}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-blue-600" />
                  <span>+ New {tdsTcsMode} Tax</span>
                </button>
              </div>

              {/* Note Banner as in reference screenshot */}
              <div className="bg-slate-100/90 border-t border-slate-200/80 p-3 text-[11px] text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-800">Note: </span>
                To view or manage {tdsTcsMode}, go to{" "}
                <span className="text-slate-800 font-medium">
                  Settings &gt; Direct Taxes &gt; {tdsTcsMode} Rates.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* GST (%) Section */}
        <div className="space-y-2 pt-1 border-t border-slate-200/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-700 font-semibold text-xs whitespace-nowrap">GST (%)</span>
              {/* Preset buttons */}
              <div className="flex items-center gap-1">
                {GST_RATE_PRESETS.map((rate) => {
                  const isSelected = currentGstRateNum === rate && gstRate !== "";
                  return (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setGstRate(String(rate))}
                      className={`px-1.5 py-0.5 text-[11px] rounded transition cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 text-white font-bold shadow-xs"
                          : "bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-medium"
                      }`}
                    >
                      {rate}%
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <div className="flex items-center border border-slate-300 rounded-md bg-white overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  className="w-16 px-2 py-1 text-sm text-right outline-none bg-white font-medium text-slate-800"
                />
                <span className="px-2 py-1 text-xs font-semibold bg-slate-100 border-l border-slate-300 text-slate-500 select-none">
                  %
                </span>
              </div>
              <span className="text-sm font-semibold text-slate-900 w-24 text-right">
                + {gstAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Adjustment */}
        <div className="flex items-center justify-between gap-4 text-sm pt-1 border-t border-slate-200/60">
          <div className="flex items-center gap-1.5">
            <span className="border border-dashed border-slate-300 px-2 py-0.5 rounded text-xs text-slate-600 font-medium bg-white">
              Adjustment
            </span>
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              step="any"
              value={adjustmentValue}
              onChange={(e) => setAdjustmentValue(e.target.value)}
              placeholder="0.00"
              className="w-24 px-2 py-1 text-sm text-right border border-slate-300 rounded-md outline-none bg-white focus:border-blue-500"
            />
            <span className="font-medium text-slate-900 w-24 text-right">
              {adjustment.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between text-base pt-3 border-t border-slate-300">
          <span className="font-bold text-slate-900">Total ( ₹ )</span>
          <span className="text-xl font-bold text-slate-950">{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Modal: Add New TDS / TCS Tax */}
      {showAddTaxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                New {tdsTcsMode} Tax Rate
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddTaxModal(false);
                  setNewTaxError("");
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewTax} className="p-6 space-y-4 text-xs">
              {newTaxError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
                  {newTaxError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tax Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Professional Consultancy Services"
                  value={newTaxName}
                  onChange={(e) => setNewTaxName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tax Rate (%) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    placeholder="e.g. 5"
                    value={newTaxRate}
                    onChange={(e) => setNewTaxRate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Section (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sec 194J"
                    value={newTaxSection}
                    onChange={(e) => setNewTaxSection(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTaxModal(false);
                    setNewTaxError("");
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Save & Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
