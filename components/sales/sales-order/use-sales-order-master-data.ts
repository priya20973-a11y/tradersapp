"use client";

import { useEffect, useState } from "react";
import { type CustomerOption, type ItemOption } from "./sales-order-types";

export function useSalesOrderMasterData() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [availableItems, setAvailableItems] = useState<ItemOption[]>([]);
  const [salesOrderNumber, setSalesOrderNumber] = useState("SO-00001");
  const [sequencePrefix, setSequencePrefix] = useState("SO");
  const [sequenceNextNumber, setSequenceNextNumber] = useState("00001");

  useEffect(() => {
    let isMounted = true;

    // Load customers
    fetch("/api/sales")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: { customers?: CustomerOption[]; documents?: { type: string; number: string }[] }) => {
        if (!isMounted) return;
        if (data.customers && data.customers.length > 0) {
          setCustomers(data.customers);
        } else {
          setCustomers([
            { id: "c-101", name: "Astra Foods", email: "billing@astrafoods.in", phone: "+91 98200 11223" },
            { id: "c-102", name: "City Retail & Groceries", email: "accounts@cityretail.in", phone: "+91 98400 44556" },
            { id: "c-103", name: "Ganga Stores Pvt Ltd", email: "ap@gangastores.in", phone: "+91 98765 43210" },
          ]);
        }

        if (data.documents) {
          const soDocs = data.documents.filter((d) => d.type === "Sales Order");
          const nextCount = soDocs.length + 1;
          const formatted = `SO-${String(nextCount).padStart(5, "0")}`;
          setSalesOrderNumber(formatted);
          setSequenceNextNumber(String(nextCount).padStart(5, "0"));
        }
      })
      .catch(() => {
        if (isMounted) {
          setCustomers([
            { id: "c-101", name: "Astra Foods", email: "billing@astrafoods.in", phone: "+91 98200 11223" },
            { id: "c-102", name: "City Retail & Groceries", email: "accounts@cityretail.in", phone: "+91 98400 44556" },
            { id: "c-103", name: "Ganga Stores Pvt Ltd", email: "ap@gangastores.in", phone: "+91 98765 43210" },
          ]);
        }
      });

    // Load items
    fetch("/api/items")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: { items?: ItemOption[] }) => {
        if (!isMounted) return;
        if (data.items && data.items.length > 0) {
          setAvailableItems(
            data.items.map((i) => ({
              id: i.id,
              name: i.name,
              sku: i.sku,
              salesPrice: i.salesPrice || 0,
              salesDescription: i.salesDescription || "",
              unit: i.unit || "pcs",
            }))
          );
        } else {
          setAvailableItems([
            { id: "item-1", name: "Premium Basmati Rice 25kg", sku: "RICE-BAS-25", salesPrice: 2200, salesDescription: "Long grain aged aromatic basmati rice", unit: "Bag" },
            { id: "item-2", name: "Sharbati Wheat 10kg", sku: "WHEAT-SHAR-10", salesPrice: 1280, salesDescription: "Grade-A MP Sharbati whole grain", unit: "Bag" },
            { id: "item-3", name: "Refined Mustard Oil 15L Tin", sku: "OIL-MUST-15", salesPrice: 2150, salesDescription: "Cold-pressed Kachi Ghani pure mustard oil", unit: "Tin" },
            { id: "item-4", name: "Organic Toor Dal 5kg", sku: "PULSE-TOOR-5", salesPrice: 780, salesDescription: "Unpolished organic high protein toor dal", unit: "Pack" },
            { id: "item-5", name: "Packaging & Handling Service", sku: "SRV-PACK", salesPrice: 350, salesDescription: "Corrugated box and shrink wrap palleting", unit: "Service" },
          ]);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAvailableItems([
            { id: "item-1", name: "Premium Basmati Rice 25kg", sku: "RICE-BAS-25", salesPrice: 2200, salesDescription: "Long grain aged aromatic basmati rice", unit: "Bag" },
            { id: "item-2", name: "Sharbati Wheat 10kg", sku: "WHEAT-SHAR-10", salesPrice: 1280, salesDescription: "Grade-A MP Sharbati whole grain", unit: "Bag" },
            { id: "item-3", name: "Refined Mustard Oil 15L Tin", sku: "OIL-MUST-15", salesPrice: 2150, salesDescription: "Cold-pressed Kachi Ghani pure mustard oil", unit: "Tin" },
          ]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    customers,
    setCustomers,
    availableItems,
    salesOrderNumber,
    setSalesOrderNumber,
    sequencePrefix,
    setSequencePrefix,
    sequenceNextNumber,
    setSequenceNextNumber,
  };
}
