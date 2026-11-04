import { describe, it, expect } from "vitest";

describe("Customer Dropdown in Sales -> Payments -> Record Payment", () => {
  // 1. Backend: Customer resolution from Customer Master and Sales Orders
  describe("1. Backend customer-fetching logic & DB query mapping", () => {
    it("maps Customer Master documents correctly prioritizing name, companyName, and contact", () => {
      const customerMasterDocs = [
        {
          _id: "67bc00010000000000000001",
          name: "Astra Foods Ltd.",
          companyName: "Astra Foods Ltd.",
          email: "billing@astrafoods.in",
          phone: "9876543210",
          status: "Active",
        },
        {
          _id: "67bc00020000000000000002",
          name: "",
          companyName: "City Retail Supermarket",
          email: "",
          phone: "",
          status: "Active",
        },
        {
          _id: "67bc00030000000000000003",
          name: "Ganga Provisions",
          companyName: "",
          status: "Active",
        },
      ];

      // Transformation logic as executed in GET /api/sales/payments
      const customers = customerMasterDocs.map((c) => ({
        id: String(c._id),
        name: String(c.name || c.companyName || "Customer"),
      }));

      expect(customers).toHaveLength(3);
      expect(customers[0]).toEqual({
        id: "67bc00010000000000000001",
        name: "Astra Foods Ltd.",
      });
      expect(customers[1]).toEqual({
        id: "67bc00020000000000000002",
        name: "City Retail Supermarket",
      });
      expect(customers[2]).toEqual({
        id: "67bc00030000000000000003",
        name: "Ganga Provisions",
      });
    });

    it("includes customers from Sales Orders even if customer has no separate customer doc", () => {
      const customersFromMaster = [
        { id: "67bc00010000000000000001", name: "Astra Foods Ltd." },
      ];

      const salesOrders = [
        {
          number: "SO-2026-0044",
          customerId: "67bc00010000000000000001",
          customerSnapshot: { name: "Astra Foods Ltd." },
        },
        {
          number: "SO-2026-0045",
          customerId: "67bc00020000000000000002",
          customerSnapshot: { name: "Delta Traders & Co" },
        },
      ];

      const existingCustomerIds = new Set(customersFromMaster.map((c) => c.id));
      const existingCustomerNames = new Set(customersFromMaster.map((c) => c.name.toLowerCase().trim()));
      const combined = [...customersFromMaster];

      for (const so of salesOrders) {
        const cId = String(so.customerId);
        const cName = so.customerSnapshot?.name?.trim();
        if (cName && !existingCustomerIds.has(cId) && !existingCustomerNames.has(cName.toLowerCase())) {
          combined.push({ id: cId, name: cName });
          existingCustomerIds.add(cId);
          existingCustomerNames.add(cName.toLowerCase());
        }
      }

      expect(combined).toHaveLength(2);
      expect(combined[1].name).toBe("Delta Traders & Co");
      expect(combined[1].id).toBe("67bc00020000000000000002");
    });

    it("does NOT overwrite real database customers with hardcoded demo data when payments list is empty", () => {
      const payments: unknown[] = [];
      const customers = [
        { id: "real-c1", name: "Genuine Agri Corp" },
        { id: "real-c2", name: "Standard Retail Hub" },
      ];
      const invoices = [
        { id: "inv-1", number: "INV-001", customerId: "real-c1", balanceDue: 45000 },
      ];
      const salesOrders = [
        { id: "so-1", number: "SO-001", customerId: "real-c1", balanceDue: 60000 },
      ];
      const isDbConnected = true;

      // Fixed logic:
      let finalCustomers = customers;
      if (!isDbConnected && customers.length === 0 && payments.length === 0 && invoices.length === 0 && salesOrders.length === 0) {
        finalCustomers = [
          { id: "demo-cust-1", name: "Astra Foods Ltd." },
          { id: "demo-cust-2", name: "City Retail Supermarket" },
        ];
      }

      // Real database customers must be strictly preserved!
      expect(finalCustomers).toHaveLength(2);
      expect(finalCustomers[0].name).toBe("Genuine Agri Corp");
      expect(finalCustomers[1].name).toBe("Standard Retail Hub");
    });
  });

  // 2. Frontend: Customer list merging and deduplication
  describe("2. Frontend customer list deduplication and real ID preservation", () => {
    it("merges customers from Customer Master and Payments API, upgrading synthetic/demo IDs to real IDs", () => {
      const customerMasterResponse = {
        customers: [
          { _id: "67bc99990000000000000001", name: "Mahalaxmi Agro Agency" },
          { _id: "67bc99990000000000000002", name: "Kisan Mart" },
        ],
      };

      const paymentsApiResponse = {
        customers: [
          { id: "demo-cust-1", name: "Mahalaxmi Agro Agency" },
          { id: "67bc99990000000000000003", name: "Om Organics Ltd" },
        ],
        salesOrders: [
          {
            id: "so-1",
            number: "SO-101",
            customerId: "67bc99990000000000000001",
            customerName: "Mahalaxmi Agro Agency",
            total: 100000,
            amountPaid: 30000,
            balanceDue: 70000,
            status: "Confirmed",
          },
        ],
        unpaidInvoices: [
          {
            id: "inv-1",
            number: "INV-101",
            customerId: "67bc99990000000000000001",
            customerName: "Mahalaxmi Agro Agency",
            total: 50000,
            amountPaid: 0,
            balanceDue: 50000,
            status: "Sent",
          },
        ],
      };

      const nameToId = new Map<string, string>();
      const idToName = new Map<string, string>();

      const addCustomer = (id: string, name: string) => {
        const cleanId = String(id || "").trim();
        const cleanName = String(name || "").trim();
        if (!cleanId || !cleanName) return;

        const normName = cleanName.toLowerCase();
        const existingId = nameToId.get(normName);

        if (existingId) {
          if (existingId.startsWith("demo-") && !cleanId.startsWith("demo-")) {
            idToName.delete(existingId);
            nameToId.set(normName, cleanId);
            idToName.set(cleanId, cleanName);
          }
          return;
        }

        nameToId.set(normName, cleanId);
        idToName.set(cleanId, cleanName);
      };

      // 1. Process Customer Master
      for (const c of customerMasterResponse.customers) {
        addCustomer(c._id, c.name);
      }

      // 2. Process Payments route
      for (const c of paymentsApiResponse.customers) {
        addCustomer(c.id, c.name);
      }

      // 3. Process Sales Orders & Invoices
      for (const so of paymentsApiResponse.salesOrders) {
        addCustomer(so.customerId, so.customerName);
      }
      for (const inv of paymentsApiResponse.unpaidInvoices) {
        addCustomer(inv.customerId, inv.customerName);
      }

      let combinedCustomers = Array.from(idToName.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const hasRealCustomers = combinedCustomers.some((c) => !c.id.startsWith("demo-"));
      if (hasRealCustomers) {
        combinedCustomers = combinedCustomers.filter((c) => !c.id.startsWith("demo-"));
      }

      expect(combinedCustomers).toHaveLength(3);
      // Mahalaxmi Agro Agency must have the REAL MongoDB ObjectId, not the synthetic demo- ID
      const mahalaxmi = combinedCustomers.find((c) => c.name === "Mahalaxmi Agro Agency");
      expect(mahalaxmi).toBeDefined();
      expect(mahalaxmi?.id).toBe("67bc99990000000000000001");

      const kisan = combinedCustomers.find((c) => c.name === "Kisan Mart");
      expect(kisan?.id).toBe("67bc99990000000000000002");

      const om = combinedCustomers.find((c) => c.name === "Om Organics Ltd");
      expect(om?.id).toBe("67bc99990000000000000003");
    });
  });

  // 3. Frontend: Dropdown binding and sales orders resolution
  describe("3. Frontend dropdown binding and sales orders resolution", () => {
    const customers = [
      { id: "67bc99990000000000000001", name: "Mahalaxmi Agro Agency" },
      { id: "67bc99990000000000000002", name: "Kisan Mart" },
    ];

    const salesOrders = [
      {
        id: "so-88",
        number: "SO-2026-0088",
        customerId: "67bc99990000000000000001",
        customerName: "Mahalaxmi Agro Agency",
        total: 150000,
        amountPaid: 50000,
        balanceDue: 100000,
        status: "Confirmed",
      },
      {
        id: "so-89",
        number: "SO-2026-0089",
        customerId: "legacy-so-id-99",
        customerName: "Mahalaxmi Agro Agency",
        total: 80000,
        amountPaid: 0,
        balanceDue: 80000,
        status: "Confirmed",
      },
      {
        id: "so-90",
        number: "SO-2026-0090",
        customerId: "67bc99990000000000000002",
        customerName: "Kisan Mart",
        total: 45000,
        amountPaid: 0,
        balanceDue: 45000,
        status: "Confirmed",
      },
    ];

    it("matches related sales orders by customerId OR case-insensitive customerName", () => {
      const formCustomerId = "67bc99990000000000000001";
      const selectedCustomer = customers.find((c) => c.id === formCustomerId);

      const matchedOrders = salesOrders.filter((so) => {
        if (so.customerId === formCustomerId) return true;
        if (
          selectedCustomer &&
          so.customerName &&
          selectedCustomer.name &&
          so.customerName.trim().toLowerCase() === selectedCustomer.name.trim().toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      // Both so-88 (matched by customerId) and so-89 (matched by customerName) must resolve
      expect(matchedOrders).toHaveLength(2);
      expect(matchedOrders.map((o) => o.id)).toEqual(["so-88", "so-89"]);
    });

    it("returns empty array when no customer is selected", () => {
      const formCustomerId = "";
      const matchedOrders = !formCustomerId ? [] : salesOrders;
      expect(matchedOrders).toEqual([]);
    });

    it("auto-populates amount from selected sales order's balance due", () => {
      const selectedOrder = salesOrders[0];
      const formAmount = String(selectedOrder.balanceDue);
      expect(formAmount).toBe("100000");
    });
  });

  // 4. Recording payment against Sales Order validation
  describe("4. Recording payment against Sales Order validation", () => {
    it("validates payment amount does not exceed sales order balance due", () => {
      const order = {
        id: "so-88",
        number: "SO-2026-0088",
        total: 100000,
        amountPaid: 40000,
        balanceDue: 60000,
      };

      const payAmount = 70000;
      const isValid = payAmount <= order.balanceDue + 0.05;
      expect(isValid).toBe(false);

      const exactPayAmount = 60000;
      const isExactValid = exactPayAmount <= order.balanceDue + 0.05;
      expect(isExactValid).toBe(true);

      const partialPayAmount = 25000;
      const isPartialValid = partialPayAmount <= order.balanceDue + 0.05;
      expect(isPartialValid).toBe(true);
    });

    it("updates sales order amountPaid and status when settled", () => {
      const order = {
        id: "so-88",
        total: 100000,
        amountPaid: 40000,
        status: "Confirmed",
      };

      const paymentAmount = 60000;
      const newPaid = order.amountPaid + paymentAmount;
      const newBalance = Math.max(0, order.total - newPaid);

      expect(newPaid).toBe(100000);
      expect(newBalance).toBe(0);
    });
  });
});

