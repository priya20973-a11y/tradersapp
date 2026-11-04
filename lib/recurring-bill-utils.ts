import { z } from "zod";
import { formatDateOnly } from "./bill-utils";

export const REPEAT_FREQUENCIES = [
  { label: "Week", value: "Week", daysDescription: "Every 7 days" },
  { label: "2 Weeks", value: "2 Weeks", daysDescription: "Every 14 days" },
  { label: "Month", value: "Month", daysDescription: "Every month on the same day" },
  { label: "2 Months", value: "2 Months", daysDescription: "Every 2 months" },
  { label: "3 Months", value: "3 Months", daysDescription: "Every quarter" },
  { label: "6 Months", value: "6 Months", daysDescription: "Twice a year" },
  { label: "Year", value: "Year", daysDescription: "Annually on the same date" },
] as const;

export type RepeatFrequency = typeof REPEAT_FREQUENCIES[number]["value"];

export const recurringBillItemSchema = z.object({
  itemId: z.any().optional(),
  name: z.string().trim().min(1, "Item name is required"),
  description: z.string().default(""),
  account: z.string().default("Cost of Goods Sold"),
  quantity: z.coerce.number().min(0.001, "Quantity must be greater than 0").default(1),
  rate: z.coerce.number().min(0, "Rate must be 0 or positive").default(0),
  taxRate: z.coerce.number().default(0),
  customerId: z.any().optional(),
  customerName: z.string().default(""),
  amount: z.coerce.number().default(0),
});

export const recurringBillSchema = z.object({
  profileName: z.string().trim().min(1, "Profile Name is required"),
  vendorId: z.string().trim().min(1, "Vendor is required"),
  vendorName: z.string().trim().min(1, "Vendor name is required"),
  repeatEvery: z.enum(["Week", "2 Weeks", "Month", "2 Months", "3 Months", "6 Months", "Year"]).default("Month"),
  startDate: z.string().min(1, "Start Date is required"),
  endsOn: z.string().optional().default(""),
  neverExpires: z.boolean().default(true),
  paymentTerms: z.string().default("Due on Receipt"),
  accountsPayable: z.string().default("Accounts Payable"),
  items: z.array(recurringBillItemSchema).min(1, "At least one item is required"),
  discount: z.coerce.number().default(0),
  discountType: z.enum(["percent", "amount"]).default("percent"),
  taxType: z.enum(["GST", "TDS", "None"]).default("GST"),
  taxRate: z.coerce.number().default(0),
  adjustment: z.coerce.number().default(0),
  notes: z.string().default(""),
  termsAndConditions: z.string().default(""),
  status: z.enum(["Active", "Paused", "Expired"]).default("Active"),
});

export type RecurringBillInput = z.infer<typeof recurringBillSchema>;

export interface RecurringBillRequestMetadata {
  organizationId?: string;
  nextBillDate?: string;
}

export function readRecurringBillRequestMetadata(
  payload: unknown,
): RecurringBillRequestMetadata {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {};
  }

  const record = payload as Record<string, unknown>;
  return {
    ...(typeof record.organizationId === "string"
      ? { organizationId: record.organizationId }
      : {}),
    ...(typeof record.nextBillDate === "string"
      ? { nextBillDate: record.nextBillDate }
      : {}),
  };
}

/**
 * Calculates the next recurrence date given a base date and frequency.
 * Returns ISO date string YYYY-MM-DD.
 */
export function calculateNextBillDate(baseDateStrOrObj: string | Date, repeatEvery: string): string {
  if (!baseDateStrOrObj) return "";
  let base: Date;
  if (typeof baseDateStrOrObj === "string") {
    const parts = baseDateStrOrObj.split("T")[0].split("-").map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      return "";
    }
    base = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    base = new Date(baseDateStrOrObj);
  }

  if (isNaN(base.getTime())) return "";

  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());

  switch (repeatEvery) {
    case "Week":
      next.setDate(next.getDate() + 7);
      break;
    case "2 Weeks":
      next.setDate(next.getDate() + 14);
      break;
    case "Month": {
      const origDay = base.getDate();
      next.setMonth(next.getMonth() + 1);
      // Handle end of month rollover (e.g., Jan 31 -> Feb 28)
      if (next.getDate() < origDay) {
        next.setDate(0);
      }
      break;
    }
    case "2 Months": {
      const origDay = base.getDate();
      next.setMonth(next.getMonth() + 2);
      if (next.getDate() < origDay) {
        next.setDate(0);
      }
      break;
    }
    case "3 Months": {
      const origDay = base.getDate();
      next.setMonth(next.getMonth() + 3);
      if (next.getDate() < origDay) {
        next.setDate(0);
      }
      break;
    }
    case "6 Months": {
      const origDay = base.getDate();
      next.setMonth(next.getMonth() + 6);
      if (next.getDate() < origDay) {
        next.setDate(0);
      }
      break;
    }
    case "Year": {
      const origDay = base.getDate();
      next.setFullYear(next.getFullYear() + 1);
      if (next.getDate() < origDay) {
        next.setDate(0);
      }
      break;
    }
    default:
      next.setMonth(next.getMonth() + 1);
  }

  return formatDateOnly(next);
}

/**
 * Checks whether a recurring profile is due for execution.
 */
export function isProfileDue(profile: {
  status: string;
  nextBillDate: Date | string;
  endsOn?: Date | string | null;
  neverExpires?: boolean;
}, asOfDate: Date = new Date()): boolean {
  if (profile.status !== "Active") return false;
  const targetDateStr = typeof profile.nextBillDate === "string"
    ? profile.nextBillDate.split("T")[0]
    : formatDateOnly(new Date(profile.nextBillDate));

  const asOfStr = formatDateOnly(asOfDate);
  if (targetDateStr > asOfStr) return false;

  // Check expiration
  if (!profile.neverExpires && profile.endsOn) {
    const endsOnStr = typeof profile.endsOn === "string"
      ? profile.endsOn.split("T")[0]
      : formatDateOnly(new Date(profile.endsOn));
    if (targetDateStr > endsOnStr) return false;
  }

  return true;
}
