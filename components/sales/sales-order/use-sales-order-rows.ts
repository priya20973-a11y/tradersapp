"use client";

import { useState } from "react";
import type { OrderItemRow, ItemOption } from "./sales-order-types";
import { taxOptions } from "./sales-order-types";

export function useSalesOrderRows(availableItems: ItemOption[]) {
  const [rows, setRows] = useState<OrderItemRow[]>([
    {
      id: "row-1",
      name: "",
      description: "",
      quantity: 1,
      rate: 0,
      amount: 0,
    },
  ]);

  const [discountValue, setDiscountValue] = useState("0");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [taxMode, setTaxMode] = useState<"TDS" | "TCS">("TDS");
  const [selectedTaxIndex, setSelectedTaxIndex] = useState<string>("");
  const [adjustmentValue, setAdjustmentValue] = useState("0");

  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkSelectedItems, setBulkSelectedItems] = useState<Record<string, number>>({});
  const [showBulkActionsMenu, setShowBulkActionsMenu] = useState(false);

  const updateRow = (id: string, updates: Partial<OrderItemRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...updates };
        const q = Number(next.quantity) || 0;
        const rate = Number(next.rate) || 0;
        next.amount = Math.round(q * rate * 100) / 100;
        return next;
      })
    );
  };

  const handleSelectItem = (id: string, itemId: string) => {
    const found = availableItems.find((i) => i.id === itemId);
    if (found) {
      updateRow(id, {
        itemId: found.id,
        name: found.name,
        description: found.salesDescription || (found.sku ? `SKU: ${found.sku}` : ""),
        rate: found.salesPrice || 0,
      });
    } else {
      updateRow(id, { itemId: undefined, name: itemId });
    }
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: "",
        description: "",
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      setRows([
        {
          id: `row-${Date.now()}`,
          name: "",
          description: "",
          quantity: 1,
          rate: 0,
          amount: 0,
        },
      ]);
    }
  };

  const handleConfirmBulkAdd = () => {
    const newItemsToAdd: OrderItemRow[] = [];
    Object.entries(bulkSelectedItems).forEach(([itemId, qty]) => {
      if (qty > 0) {
        const item = availableItems.find((i) => i.id === itemId);
        if (item) {
          newItemsToAdd.push({
            id: `row-${Date.now()}-${item.id}`,
            itemId: item.id,
            name: item.name,
            description: item.salesDescription || (item.sku ? `SKU: ${item.sku}` : ""),
            quantity: qty,
            rate: item.salesPrice || 0,
            amount: Math.round(qty * (item.salesPrice || 0) * 100) / 100,
          });
        }
      }
    });

    if (newItemsToAdd.length > 0) {
      setRows((prev) => {
        if (prev.length === 1 && !prev[0].name && prev[0].rate === 0) {
          return newItemsToAdd;
        }
        return [...prev, ...newItemsToAdd];
      });
    }

    setBulkSelectedItems({});
    setShowBulkAddModal(false);
  };

  const clearRows = () => {
    setRows([
      {
        id: `row-${Date.now()}`,
        name: "",
        description: "",
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ]);
  };

  // Calculations
  const subTotal = rows.reduce((acc, row) => acc + (row.amount || 0), 0);
  const totalQuantity = rows.reduce((acc, row) => acc + (Number(row.quantity) || 0), 0);

  const discountNum = parseFloat(discountValue) || 0;
  const discountAmount =
    discountType === "percent"
      ? Math.round(((subTotal * discountNum) / 100) * 100) / 100
      : discountNum;

  const afterDiscount = Math.max(0, subTotal - discountAmount);

  const selectedTax =
    selectedTaxIndex !== "" ? taxOptions[parseInt(selectedTaxIndex, 10)] : null;
  const taxRate = selectedTax ? selectedTax.rate : 0;
  const rawTaxAmount = Math.round(afterDiscount * taxRate * 100) / 100;
  const taxAmount = taxMode === "TDS" ? -rawTaxAmount : rawTaxAmount;

  const adjustment = parseFloat(adjustmentValue) || 0;
  const total = Math.max(0, Math.round((afterDiscount + taxAmount + adjustment) * 100) / 100);

  return {
    rows,
    setRows,
    updateRow,
    handleSelectItem,
    addRow,
    removeRow,
    clearRows,
    showBulkAddModal,
    setShowBulkAddModal,
    bulkSelectedItems,
    setBulkSelectedItems,
    handleConfirmBulkAdd,
    showBulkActionsMenu,
    setShowBulkActionsMenu,
    discountValue,
    setDiscountValue,
    discountType,
    setDiscountType,
    taxMode,
    setTaxMode,
    selectedTaxIndex,
    setSelectedTaxIndex,
    selectedTax,
    adjustmentValue,
    setAdjustmentValue,
    subTotal,
    totalQuantity,
    discountAmount,
    afterDiscount,
    taxRate,
    rawTaxAmount,
    taxAmount,
    adjustment,
    total,
  };
}
