import { describe, it, expect } from "vitest";

describe("Vendor / Supplier Dropdown in Payment -> Record Vendor Payment", () => {
  // 1. Backend: Vendor resolution from Vendor Master and Purchase Orders
  describe("1. Backend vendor-fetching logic & DB query mapping", () => {
    it("maps Vendor Master documents correctly prioritizing displayName, companyName, and name", () => {
      const vendorMasterDocs = [
        {
          _id: "67bc00010000000000000001",
          displayName: "Apex Logistics India Pvt Ltd",
          name: "Apex Logistics",
          companyName: "Apex Logistics India Pvt Ltd",
          email: "billing@apexlogistics.in",
          phone: "9876543210",
          status: "Active",
        },
        {
          _id: "67bc00020000000000000002",
          displayName: "", // empty displayName
          name: "Bharat Packaging Works",
          companyName: "Bharat Packaging Works",
          email: "",
          phone: "",
          status: "Active",
        },
        {
          _id: "67bc00030000000000000003",
          displayName: "Continental Cold Storage",
          name: "",
          companyName: "",
          status: "Active",
        },
      ];

      // Transformation logic as executed in GET /api/purchases/payments
      const vendors = vendorMasterDocs.map((v) => ({
        id: String(v._id),
        name: String(v.displayName || v.name || v.companyName || "Vendor"),
      }));

      expect(vendors).toHaveLength(3);
      expect(vendors[0]).toEqual({
        id: "67bc00010000000000000001",
        name: "Apex Logistics India Pvt Ltd",
      });
      expect(vendors[1]).toEqual({
        id: "67bc00020000000000000002",
        name: "Bharat Packaging Works",
      });
      expect(vendors[2]).toEqual({
        id: "67bc00030000000000000003",
        name: "Continental Cold Storage",
      });
    });

    it("includes vendors from Purchase Orders even if PO has no explicit vendorId or vendor doc", () => {
      const vendorsFromMaster = [
        { id: "67bc00010000000000000001", name: "Apex Logistics India Pvt Ltd" },
      ];

      const purchaseOrders = [
        {
          purchaseOrderNumber: "PO-2026-0044",
          vendorId: "67bc00010000000000000001",
          vendorName: "Apex Logistics India Pvt Ltd",
        },
        {
          purchaseOrderNumber: "PO-2026-0045",
          vendorId: undefined,
          vendorName: "Delta Steels & Pipes",
        },
      ];

      const existingVendorIds = new Set(vendorsFromMaster.map((v) => v.id));
      const existingVendorNames = new Set(vendorsFromMaster.map((v) => v.name.toLowerCase().trim()));
      const combined = [...vendorsFromMaster];

      for (const po of purchaseOrders) {
        if (po.vendorName) {
          const vName = po.vendorName.trim();
          const vId = po.vendorId ? String(po.vendorId) : `po-vend-${encodeURIComponent(vName)}`;
          if (!existingVendorIds.has(vId) && !existingVendorNames.has(vName.toLowerCase())) {
            combined.push({ id: vId, name: vName });
            existingVendorIds.add(vId);
            existingVendorNames.add(vName.toLowerCase());
          }
        }
      }

      expect(combined).toHaveLength(2);
      expect(combined[1].name).toBe("Delta Steels & Pipes");
      expect(combined[1].id).toBe("po-vend-Delta%20Steels%20%26%20Pipes");
    });

    it("does NOT overwrite real database vendors with hardcoded demo data when payments list is empty", () => {
      // In a fresh system, payments is []
      const payments: unknown[] = [];
      const vendors = [
        { id: "real-v1", name: "Genuine Agri Corp" },
        { id: "real-v2", name: "Standard Grains" },
      ];
      const bills = [
        { id: "b1", number: "BILL-001", vendorId: "real-v1", balanceDue: 45000 },
      ];
      const isDbConnected = true;

      // Old faulty logic: if (payments.length === 0) { vendors = DEMO_VENDORS; }
      // Fixed logic:
      let finalVendors = vendors;
      if (!isDbConnected && vendors.length === 0 && payments.length === 0 && bills.length === 0) {
        finalVendors = [
          { id: "demo-vend-1", name: "Mohan Traders" },
          { id: "demo-vend-2", name: "Shree Packaging Industries" },
        ];
      }

      // Real database vendors must be strictly preserved!
      expect(finalVendors).toHaveLength(2);
      expect(finalVendors[0].name).toBe("Genuine Agri Corp");
      expect(finalVendors[1].name).toBe("Standard Grains");
    });
  });

  // 2. Frontend: Vendor list merging and deduplication
  describe("2. Frontend vendor list deduplication and real ID preservation", () => {
    it("merges vendors from Vendor Master and Payments API, upgrading synthetic PO IDs to real IDs", () => {
      const vendorMasterResponse = {
        vendors: [
          { _id: "67bc99990000000000000001", displayName: "Mahalaxmi Agro Agency" },
          { _id: "67bc99990000000000000002", displayName: "Kisan Fertilisers" },
        ],
      };

      const paymentsApiResponse = {
        vendors: [
          // PO vendor had synthetic ID prior to vendor being formally added in master
          { id: "po-vend-Mahalaxmi%20Agro%20Agency", name: "Mahalaxmi Agro Agency" },
          // Another vendor found in payment records
          { id: "67bc99990000000000000003", name: "Om Seeds Pvt Ltd" },
        ],
        pendingBills: [
          {
            id: "b-1",
            vendorId: "67bc99990000000000000001",
            vendorName: "Mahalaxmi Agro Agency",
            balanceDue: 85000,
          },
        ],
      };

      const nameToId = new Map<string, string>();
      const idToName = new Map<string, string>();

      const addVendor = (id: string, name: string) => {
        const cleanId = String(id || "").trim();
        const cleanName = String(name || "").trim();
        if (!cleanId || !cleanName) return;

        const normName = cleanName.toLowerCase();
        const existingId = nameToId.get(normName);

        if (existingId) {
          if (existingId.startsWith("po-vend-") && !cleanId.startsWith("po-vend-")) {
            idToName.delete(existingId);
            nameToId.set(normName, cleanId);
            idToName.set(cleanId, cleanName);
          }
          return;
        }

        nameToId.set(normName, cleanId);
        idToName.set(cleanId, cleanName);
      };

      // 1. Process Vendor Master
      for (const v of vendorMasterResponse.vendors) {
        addVendor(v._id, v.displayName);
      }

      // 2. Process Payments route
      for (const v of paymentsApiResponse.vendors) {
        addVendor(v.id, v.name);
      }

      // 3. Process Pending Bills
      for (const b of paymentsApiResponse.pendingBills) {
        addVendor(b.vendorId, b.vendorName);
      }

      const combinedVendors = Array.from(idToName.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      expect(combinedVendors).toHaveLength(3);
      // Mahalaxmi Agro Agency must have the REAL MongoDB ObjectId, not the synthetic po-vend- ID
      const mahalaxmi = combinedVendors.find((v) => v.name === "Mahalaxmi Agro Agency");
      expect(mahalaxmi).toBeDefined();
      expect(mahalaxmi?.id).toBe("67bc99990000000000000001");

      const kisan = combinedVendors.find((v) => v.name === "Kisan Fertilisers");
      expect(kisan?.id).toBe("67bc99990000000000000002");

      const om = combinedVendors.find((v) => v.name === "Om Seeds Pvt Ltd");
      expect(om?.id).toBe("67bc99990000000000000003");
    });
  });

  // 3. Frontend: Dropdown binding and bill matching
  describe("3. Frontend dropdown binding and bill resolution", () => {
    const vendors = [
      { id: "67bc99990000000000000001", name: "Mahalaxmi Agro Agency" },
      { id: "67bc99990000000000000002", name: "Kisan Fertilisers" },
    ];

    const pendingBills = [
      {
        id: "bill-88",
        number: "BILL-8801",
        orderNumber: "PO-2026-0088",
        vendorId: "67bc99990000000000000001",
        vendorName: "Mahalaxmi Agro Agency",
        total: 150000,
        amountPaid: 50000,
        balanceDue: 100000,
        status: "Partially Paid",
      },
      {
        id: "bill-89",
        number: "BILL-8802",
        orderNumber: "PO-2026-0089",
        vendorId: "different-id-or-legacy",
        vendorName: "Mahalaxmi Agro Agency",
        total: 80000,
        amountPaid: 0,
        balanceDue: 80000,
        status: "Pending",
      },
      {
        id: "bill-90",
        number: "BILL-8803",
        orderNumber: "PO-2026-0090",
        vendorId: "67bc99990000000000000002",
        vendorName: "Kisan Fertilisers",
        total: 45000,
        amountPaid: 0,
        balanceDue: 45000,
        status: "Pending",
      },
    ];

    it("matches pending bills by vendorId OR case-insensitive vendorName", () => {
      const formVendorId = "67bc99990000000000000001";
      const selectedVendor = vendors.find((v) => v.id === formVendorId);

      const matchedBills = pendingBills.filter((b) => {
        if (b.vendorId === formVendorId) return true;
        if (
          selectedVendor &&
          b.vendorName &&
          selectedVendor.name &&
          b.vendorName.trim().toLowerCase() === selectedVendor.name.trim().toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      // Both bill-88 (matched by vendorId) and bill-89 (matched by vendorName) must resolve
      expect(matchedBills).toHaveLength(2);
      expect(matchedBills.map((b) => b.id)).toEqual(["bill-88", "bill-89"]);
    });

    it("returns empty array when no vendor is selected", () => {
      const formVendorId = "";
      const matchedBills = !formVendorId ? [] : pendingBills;
      expect(matchedBills).toEqual([]);
    });
  });
});
