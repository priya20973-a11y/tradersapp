"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  Boxes,
  FileSpreadsheet,
  Grid3X3,
  List,
  Package,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { NewItemForm } from "@/components/items/new-item-form";
import {
  type ItemRecord,
  type SortField,
  type SortOrder,
  type ViewMode,
  type TypeFilter,
} from "@/components/items/item-types";
import { ItemKpiCards } from "@/components/items/item-kpi-cards";
import { ItemTableView } from "@/components/items/item-table-view";
import { ItemGridView } from "@/components/items/item-grid-view";
import { ItemQuickViewModal } from "@/components/items/item-quick-view-modal";

let itemsCache: ItemRecord[] | null = null;
let itemsCacheTime = 0;
const ITEMS_TTL_MS = 30_000;

export default function ItemsPage() {
  const [items, setItems] = useState<ItemRecord[]>(() => itemsCache || []);
  const [loading, setLoading] = useState(() => !itemsCache);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemRecord | null>(null);
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const isFresh = itemsCache && Date.now() - itemsCacheTime < ITEMS_TTL_MS;
    if (isFresh) {
      return;
    }

    fetch("/api/items")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (isMounted) {
          const list = data.items || [];
          itemsCache = list;
          itemsCacheTime = Date.now();
          setItems(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshItems = () => {
    setIsRefreshing(true);
    fetch("/api/items")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        const list = data.items || [];
        itemsCache = list;
        itemsCacheTime = Date.now();
        setItems(list);
        setIsRefreshing(false);
      })
      .catch(() => setIsRefreshing(false));
  };

  const handleCopySku = (sku: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(sku);
    setCopiedSku(sku);
    setTimeout(() => setCopiedSku(null), 2000);
  };

  const filteredItems = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    const result = items.filter((item) => {
      const matchesSearch =
        !searchLower ||
        item.name.toLowerCase().includes(searchLower) ||
        (item.sku && item.sku.toLowerCase().includes(searchLower)) ||
        (item.unit && item.unit.toLowerCase().includes(searchLower)) ||
        (item.preferredVendor && item.preferredVendor.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;

      if (typeFilter === "goods") return item.type === "goods";
      if (typeFilter === "service") return item.type === "service";
      if (typeFilter === "low_stock") return item.type === "goods" && (item.stock || 0) < 15;
      return true;
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "salesPrice") {
        comparison = (a.salesPrice || 0) - (b.salesPrice || 0);
      } else if (sortField === "purchasePrice") {
        comparison = (a.purchasePrice || 0) - (b.purchasePrice || 0);
      } else if (sortField === "stock") {
        comparison = (a.stock || 0) - (b.stock || 0);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [items, searchTerm, typeFilter, sortField, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 sm:p-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Inventory & Items
            </span>
            <span className="text-xs text-slate-400">/</span>
            <span className="text-xs font-medium text-slate-500">Catalog Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
            Items & Inventory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Maintain your commodities, goods, billable service rates, pricing matrix, and valuation ledgers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={refreshItems}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
            title="Refresh item list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const rows = [
                ["ID", "Name", "SKU", "Type", "Unit", "Sales Price", "Cost Price", "Stock"],
                ...filteredItems.map((i) => [
                  i.id || "",
                  `"${i.name.replace(/"/g, '""')}"`,
                  i.sku || "",
                  i.type,
                  i.unit,
                  i.salesPrice || 0,
                  i.purchasePrice || 0,
                  i.stock || 0,
                ]),
              ];
              const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", `items_export_${new Date().toISOString().split("T")[0]}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-2xs"
            title="Export CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Export</span>
          </button>

          <Link
            href="/items/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Item</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <ItemKpiCards items={items} onFilterChange={(f) => setTypeFilter(f)} />

      {/* Filter & Controls Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              typeFilter === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Items ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("goods")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              typeFilter === "goods"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Goods ({items.filter((i) => i.type === "goods").length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("service")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              typeFilter === "service"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-purple-50 text-purple-700 hover:bg-purple-100"
            }`}
          >
            Services ({items.filter((i) => i.type === "service").length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("low_stock")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              typeFilter === "low_stock"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            Low Stock ({items.filter((i) => i.type === "goods" && (i.stock || 0) < 15).length})
          </button>
        </div>

        {/* Right Search, Sort & View Mode */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, SKU, vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-0.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 ml-2" />
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="bg-transparent text-xs font-medium text-slate-700 py-1.5 pl-1 pr-6 border-none focus:ring-0 outline-none cursor-pointer"
            >
              <option value="name">Name</option>
              <option value="salesPrice">Sales Price</option>
              <option value="purchasePrice">Cost Price</option>
              <option value="stock">Stock Level</option>
            </select>
            <button
              type="button"
              onClick={toggleSortOrder}
              title={`Sort ${sortOrder === "asc" ? "Ascending" : "Descending"}`}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition"
            >
              <ArrowDownUp className="h-3 w-3" />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View"
              className={`p-1.5 rounded-lg transition ${
                viewMode === "table" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={`p-1.5 rounded-lg transition ${
                viewMode === "grid" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-xs">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3 animate-pulse">
            <Package className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-900">Loading catalog items…</p>
          <p className="text-xs text-slate-500 mt-1">Retrieving latest pricing and inventory levels</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3.5">
            <Boxes className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No items match your criteria</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `No items found matching "${searchTerm}". Try a different keyword or reset filters.`
              : "Get started by adding your first product, commodity, or billable service to your organization."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setTypeFilter("all");
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Clear Filters
              </button>
            )}
            <Link
              href="/items/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add First Item
            </Link>
          </div>
        </div>
      ) : viewMode === "table" ? (
        <ItemTableView
          items={filteredItems}
          copiedSku={copiedSku}
          onCopySku={handleCopySku}
          onSelectItem={(item) => setSelectedItem(item)}
        />
      ) : (
        <ItemGridView
          items={filteredItems}
          onSelectItem={(item) => setSelectedItem(item)}
        />
      )}

      {/* Item Quick-Details Drawer */}
      {selectedItem && (
        <ItemQuickViewModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Modal for New Item Form if toggled */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl my-8">
            <NewItemForm
              onSuccess={() => {
                setShowModal(false);
                refreshItems();
              }}
              onCancel={() => setShowModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
