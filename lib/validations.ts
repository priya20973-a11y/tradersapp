import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(2),
  contactPerson: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(8).optional(),
  gstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .optional()
    .or(z.literal("")),
  state: z.string().min(2).optional(),
  openingBalance: z.number().min(0).default(0),
  creditLimit: z.number().min(0).default(0),
});

export const invoiceSchema = z.object({
  customer: z.string().min(2),
  invoiceNumber: z.string().min(3),
  dueDate: z.string().optional(),
  subtotal: z.number().min(0),
  discount: z.number().min(0).default(0),
  taxRate: z.number().min(0).default(0),
  shipping: z.number().min(0).default(0),
  amountPaid: z.number().min(0).default(0),
});

export const paymentSchema = z.object({
  invoiceNumber: z.string().min(3),
  amount: z.number().min(1),
  method: z.enum(["Cash", "Bank", "UPI", "Cheque"]),
});
