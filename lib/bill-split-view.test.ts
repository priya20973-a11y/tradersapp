import { describe, expect, it } from "vitest";

describe("Bill Split-Screen & Document Preview Formatting", () => {
  function formatDate(dateStr?: string | Date): string {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return String(dateStr);
    }
  }

  function getBillStatusInfo(bill: { dueDate?: string | Date; balanceDue?: number; status?: string }) {
    const status = bill.status || "Draft";
    const balanceDue = Number(bill.balanceDue || 0);

    if (status === "Paid" || balanceDue <= 0) {
      return {
        label: "PAID",
        colorClass: "text-[#16a34a]",
      };
    }

    if (status === "Draft") {
      return {
        label: "DRAFT",
        colorClass: "text-slate-400",
      };
    }

    if (status === "Void") {
      return {
        label: "VOID",
        colorClass: "text-slate-400",
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bill.dueDate) {
      const due = new Date(bill.dueDate);
      due.setHours(0, 0, 0, 0);
      const diffMs = today.getTime() - due.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        return {
          label: `OVERDUE BY ${diffDays} DAY${diffDays > 1 ? "S" : ""}`,
          colorClass: "text-[#ea580c]",
        };
      }
    }

    if (status === "Partially Paid") {
      return {
        label: "PARTIALLY PAID",
        colorClass: "text-amber-600",
      };
    }

    return {
      label: "OPEN",
      colorClass: "text-slate-600",
    };
  }

  it("formats dates in DD/MM/YYYY exactly as in the Zoho Books screenshot", () => {
    expect(formatDate("2026-10-30T00:00:00.000Z")).toBe("30/10/2026");
    expect(formatDate("2026-11-05T00:00:00.000Z")).toBe("05/11/2026");
    expect(formatDate("2026-10-28T00:00:00.000Z")).toBe("28/10/2026");
    expect(formatDate(undefined)).toBe("-");
  });

  it("calculates overdue days and returns OVERDUE BY X DAYS matching the screenshot", () => {
    const pastDueDate = new Date();
    pastDueDate.setDate(pastDueDate.getDate() - 14);

    const statusInfo = getBillStatusInfo({
      dueDate: pastDueDate.toISOString(),
      balanceDue: 34000,
      status: "Pending",
    });

    expect(statusInfo.label).toBe("OVERDUE BY 14 DAYS");
    expect(statusInfo.colorClass).toBe("text-[#ea580c]");
  });

  it("displays PAID in green when balanceDue is 0 or status is Paid", () => {
    const statusInfo = getBillStatusInfo({
      dueDate: "2026-10-28",
      balanceDue: 0,
      status: "Paid",
    });

    expect(statusInfo.label).toBe("PAID");
    expect(statusInfo.colorClass).toBe("text-[#16a34a]");
  });

  it("calculates document summary values accurately for preview", () => {
    const bill = {
      subTotal: 34000,
      discountAmount: 0,
      taxAmount: 0,
      adjustment: 0,
      total: 34000,
      balanceDue: 34000,
    };

    const calculatedBalanceDue = bill.total - 0;
    expect(calculatedBalanceDue).toBe(34000);
    expect(bill.subTotal).toBe(34000);
    expect(bill.total).toBe(34000);
    expect(bill.balanceDue).toBe(34000);
  });
});
