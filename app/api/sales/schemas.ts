import { isValidObjectId } from "mongoose";
import { z } from "zod";

export type DocumentType =
  | "Quote"
  | "Sales Order"
  | "Invoice"
  | "Recurring Invoice"
  | "Delivery Challan"
  | "Payment Received"
  | "Credit Note";

export const paymentMethods = ["Cash", "Bank", "UPI", "Cheque"] as const;
export const frequencyOptions = ["Weekly", "Monthly", "Quarterly", "Yearly"] as const;

export const createSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("Customer"),
    name: z.string().trim().min(2).max(120),
    customerType: z.enum(["Business", "Individual"]).default("Business"),
    salutation: z.string().trim().max(20).optional(),
    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    companyName: z.string().trim().max(160).optional(),
    contactPerson: z.string().trim().max(160).optional(),
    email: z.union([z.email(), z.literal("")]).optional(),
    phone: z.string().trim().max(30).optional(),
    mobile: z.string().trim().max(30).optional(),
    gstin: z.string().trim().toUpperCase().max(20).optional(),
    pan: z.string().trim().toUpperCase().max(10).optional(),
    state: z.string().trim().max(100).optional(),
    customerLanguage: z.string().trim().max(50).default("English"),
    currency: z.string().trim().max(10).default("INR"),
    openingBalance: z.coerce.number().min(0).max(1_000_000_000).default(0),
    paymentTerms: z.string().trim().max(100).default("Due on Receipt"),
    allowPortal: z.boolean().default(false),
    billingAddress: z
      .object({
        attention: z.string().trim().max(120).optional(),
        street: z.string().trim().max(250).optional(),
        city: z.string().trim().max(100).optional(),
        state: z.string().trim().max(100).optional(),
        postalCode: z.string().trim().max(20).optional(),
        country: z.string().trim().max(100).optional(),
      })
      .optional(),
    shippingAddress: z
      .object({
        attention: z.string().trim().max(120).optional(),
        street: z.string().trim().max(250).optional(),
        city: z.string().trim().max(100).optional(),
        state: z.string().trim().max(100).optional(),
        postalCode: z.string().trim().max(20).optional(),
        country: z.string().trim().max(100).optional(),
      })
      .optional(),
    contactPersons: z
      .array(
        z.object({
          name: z.string().trim().max(120),
          email: z.union([z.email(), z.literal("")]).optional(),
          phone: z.string().trim().max(30).optional(),
          mobile: z.string().trim().max(30).optional(),
        }),
      )
      .max(20)
      .default([]),
    customFields: z
      .array(
        z.object({
          label: z.string().trim().max(80),
          value: z.string().trim().max(250),
        }),
      )
      .max(30)
      .default([]),
    reportingTags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
    remarks: z.string().trim().max(2000).optional(),
  }),
  z.object({
    type: z.enum(["Quote", "Sales Order", "Invoice"]),
    customerId: z.string().refine(isValidObjectId),
    organizationId: z.string().optional(),
    total: z.coerce.number().min(0).max(1_000_000_000),
    number: z.string().trim().max(50).optional(),
    referenceNumber: z.string().trim().max(100).optional(),
    issueDate: z.string().optional(),
    dueDate: z.string().optional(),
    expiryDate: z.string().optional(),
    expectedShipmentDate: z.string().optional(),
    paymentTerms: z.string().trim().max(100).optional(),
    deliveryMethod: z.string().trim().max(100).optional(),
    status: z.string().trim().max(50).optional(),
    salesperson: z.string().trim().max(100).optional(),
    projectName: z.string().trim().max(120).optional(),
    subject: z.string().trim().max(500).optional(),
    customerNotes: z.string().trim().max(2000).optional(),
    termsAndConditions: z.string().trim().max(3000).optional(),
    subTotal: z.coerce.number().min(0).optional(),
    discount: z.coerce.number().min(0).optional(),
    discountType: z.enum(["percent", "amount"]).optional(),
    taxType: z.enum(["TDS", "TCS", "GST"]).optional(),
    taxName: z.string().trim().max(120).optional(),
    taxRate: z.coerce.number().min(0).optional(),
    taxAmount: z.coerce.number().optional(),
    tdsTcsType: z.enum(["TDS", "TCS", "None"]).optional(),
    tdsTcsName: z.string().trim().max(120).optional(),
    tdsTcsRate: z.coerce.number().min(0).optional(),
    tdsTcsAmount: z.coerce.number().optional(),
    adjustment: z.coerce.number().optional(),
    items: z
      .array(
        z.object({
          itemId: z.string().optional(),
          name: z.string().trim().min(1),
          description: z.string().trim().optional(),
          quantity: z.coerce.number().min(0),
          rate: z.coerce.number().min(0),
          amount: z.coerce.number().min(0),
        }),
      )
      .optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
  z.object({
    type: z.literal("Recurring Invoice"),
    customerId: z.string().refine(isValidObjectId),
    total: z.coerce.number().positive().max(1_000_000_000),
    frequency: z.enum(frequencyOptions),
    nextRunDate: z.iso.date(),
    notes: z.string().trim().max(1000).optional(),
  }),
  z.object({
    type: z.literal("Delivery Challan"),
    customerId: z.string().refine(isValidObjectId),
    relatedDocumentId: z.string().refine(isValidObjectId).optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
  z.object({
    type: z.literal("Payment Received"),
    relatedDocumentId: z.string().refine(isValidObjectId),
    total: z.coerce.number().positive().max(1_000_000_000),
    method: z.enum(paymentMethods),
    referenceNumber: z.string().trim().max(100).optional(),
  }),
  z.object({
    type: z.literal("Credit Note"),
    relatedDocumentId: z.string().refine(isValidObjectId),
    total: z.coerce.number().positive().max(1_000_000_000),
    notes: z.string().trim().max(1000).optional(),
  }),
]);

export const transitionSchema = z.object({
  documentId: z.string().refine(isValidObjectId),
  status: z.string(),
});

export const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("convert-quote"), documentId: z.string().refine(isValidObjectId) }),
  z.object({ action: z.literal("invoice-from-order"), documentId: z.string().refine(isValidObjectId) }),
  z.object({ action: z.literal("generate-recurring"), documentId: z.string().refine(isValidObjectId) }),
]);
