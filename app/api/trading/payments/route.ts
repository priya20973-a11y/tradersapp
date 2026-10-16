import { randomUUID } from "node:crypto";
import { isValidObjectId, startSession, Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getTradingScope, recordTradingAudit, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { paymentAllocationTotal } from "@/lib/trading-calculations";
import { SalesDocument, TraderPayment, TraderProfile } from "@/models";

class PaymentConflictError extends Error {}

const paymentSchema = z.object({
  organizationId: z.string().refine(isValidObjectId).optional(),
  traderId: z.string().refine(isValidObjectId),
  direction: z.enum(["Receipt", "Payment"]),
  paymentDate: z.coerce.date().optional(),
  method: z.enum(["Cash", "Bank", "UPI", "Cheque", "RTGS", "NEFT"]),
  amount: z.coerce.number().positive().max(1_000_000_000),
  allocations: z.array(z.object({
    targetType: z.literal("Invoice"),
    targetId: z.string().refine(isValidObjectId),
    amount: z.coerce.number().positive().max(1_000_000_000),
  })).max(100).default([]),
  referenceNumber: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

function balanceStatus(amountPaid: number, total: number, creditedAmount: number) {
  if (amountPaid >= total - creditedAmount - 0.000001) return "Paid";
  return amountPaid > 0 ? "Partly paid" : "Sent";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scopeResult = await getTradingScope(
      url.searchParams.get("organizationId") ?? undefined,
      "trader-ledger",
    );
    if ("response" in scopeResult) return scopeResult.response;
    const filter: Record<string, unknown> = { organizationId: scopeResult.scope.organizationId };
    const traderId = url.searchParams.get("traderId");
    if (traderId && isValidObjectId(traderId)) filter.traderId = traderId;
    const payments = await TraderPayment.find(filter)
      .populate({ path: "traderId", select: "traderCode legalBusinessName" })
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(500)
      .lean();
    return NextResponse.json({ payments });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof startSession>> | undefined;
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Submit valid JSON data." }, { status: 400 });
    }
    const parsed = paymentSchema.safeParse(payload);
    if (!parsed.success) return NextResponse.json({ error: "Check the payment details and try again.", issues: parsed.error.issues }, { status: 400 });
    const input = parsed.data;
    if (input.direction === "Payment" && input.allocations.length > 0) {
      return NextResponse.json({ error: "Supplier payments can only be recorded as advances until purchase bills and their allocations are configured." }, { status: 400 });
    }
    let allocatedAmount: number;
    try {
      allocatedAmount = paymentAllocationTotal(input.amount, input.allocations.map((allocation) => allocation.amount));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid payment allocations." }, { status: 400 });
    }
    const seenInvoiceIds = new Set<string>();
    for (const allocation of input.allocations) {
      if (seenInvoiceIds.has(allocation.targetId)) {
        return NextResponse.json({ error: "Allocate to each invoice only once per payment." }, { status: 400 });
      }
      seenInvoiceIds.add(allocation.targetId);
    }
    const requestedOrganizationId = input.organizationId ??
      (typeof payload === "object" && payload !== null && "organizationId" in payload ? String(payload.organizationId) : undefined);
    const scopeResult = await getTradingScope(requestedOrganizationId, "record-trading-payments");
    if ("response" in scopeResult) return scopeResult.response;
    const organizationId = scopeResult.scope.organizationId;
    const existing = await TraderPayment.findOne({ organizationId, idempotencyKey: input.idempotencyKey }).lean();
    if (existing) {
      const sameAllocations = existing.allocations.length === input.allocations.length &&
        input.allocations.every((allocation) => existing.allocations.some((saved) =>
          saved.targetType === allocation.targetType &&
          String(saved.targetId) === allocation.targetId &&
          saved.amount === allocation.amount,
        ));
      if (
        String(existing.traderId) !== input.traderId ||
        existing.direction !== input.direction ||
        existing.amount !== input.amount ||
        existing.method !== input.method ||
        !sameAllocations
      ) {
        return NextResponse.json({ error: "This idempotency key was already used for a different payment." }, { status: 409 });
      }
      return NextResponse.json({ ok: true, replayed: true, id: String(existing._id) });
    }
    const trader = await TraderProfile.findOne({
      _id: input.traderId,
      organizationId,
      tradingStatus: "Active",
    });
    if (!trader) return NextResponse.json({ error: "Select an active trader from this organization." }, { status: 400 });
    if (input.direction === "Receipt" && !trader.roles.includes("Buyer")) {
      return NextResponse.json({ error: "Receipts can only be recorded for a buyer trader." }, { status: 400 });
    }
    if (input.direction === "Payment" && !trader.roles.some((role) => ["Seller", "Consignment Owner"].includes(role))) {
      return NextResponse.json({ error: "Payments can only be recorded for a seller or consignment owner." }, { status: 400 });
    }
    if (input.allocations.length && !trader.customerId) {
      return NextResponse.json({ error: "This buyer has no linked customer account for invoice allocation." }, { status: 400 });
    }

    session = await startSession();
    const transactionSession = session;
    let paymentId = "";
    let receiptNumber = "";
    await transactionSession.withTransaction(async () => {
      const replay = await TraderPayment.findOne({ organizationId, idempotencyKey: input.idempotencyKey }).session(transactionSession);
      if (replay) {
        if (String(replay.traderId) !== input.traderId || replay.amount !== input.amount || replay.direction !== input.direction) {
          throw new PaymentConflictError("This idempotency key was already used for a different payment.");
        }
        paymentId = String(replay._id);
        receiptNumber = "replayed";
        return;
      }
      for (const allocation of input.allocations) {
        const invoice = await SalesDocument.findOne({
          _id: allocation.targetId,
          organizationId,
          type: "Invoice",
          customerId: trader.customerId,
          status: { $ne: "Draft" },
        }).session(transactionSession);
        if (!invoice) throw new PaymentConflictError("An allocated invoice is missing, still a draft, or belongs to another trader.");
        const currentPaid = Number(invoice.amountPaid ?? 0);
        const creditedAmount = Number(invoice.creditedAmount ?? 0);
        const invoiceTotal = Number(invoice.total ?? 0);
        if (allocation.amount > invoiceTotal - creditedAmount - currentPaid + 0.000001) {
          throw new PaymentConflictError(`Allocation exceeds the outstanding balance on invoice ${invoice.number}.`);
        }
        const nextPaid = currentPaid + allocation.amount;
        const updated = await SalesDocument.updateOne(
          { _id: invoice._id, organizationId, amountPaid: currentPaid, creditedAmount },
          { $set: { amountPaid: nextPaid, status: balanceStatus(nextPaid, invoiceTotal, creditedAmount) } },
          { session: transactionSession },
        );
        if (updated.modifiedCount !== 1) throw new PaymentConflictError("Invoice balance changed; refresh and try the payment again.");
      }

      paymentId = new Types.ObjectId().toString();
      receiptNumber = `TRP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const [payment] = await TraderPayment.create([{
        organizationId,
        traderId: trader._id,
        direction: input.direction,
        paymentDate: input.paymentDate,
        method: input.method,
        amount: input.amount,
        unallocatedAmount: Math.max(0, input.amount - allocatedAmount),
        allocations: input.allocations.map((allocation) => ({
          targetType: allocation.targetType,
          targetId: allocation.targetId,
          amount: allocation.amount,
        })),
        referenceNumber: input.referenceNumber,
        notes: input.notes,
        status: "Posted",
        idempotencyKey: input.idempotencyKey,
        actorId: scopeResult.scope.actorId,
      }], { session: transactionSession });
      paymentId = String(payment._id);

      if (input.direction === "Receipt" && trader.customerId) {
        const firstInvoice = input.allocations.length
          ? await SalesDocument.findOne({
          _id: input.allocations[0].targetId,
          organizationId,
          type: "Invoice",
        }).session(transactionSession)
          : null;
        await SalesDocument.create([{
            organizationId,
            type: "Payment Received",
            number: receiptNumber,
            customerId: trader.customerId,
            relatedDocumentId: firstInvoice?._id,
            status: "Posted",
            issueDate: input.paymentDate ?? new Date(),
            total: input.amount,
            amountPaid: 0,
            creditedAmount: 0,
            method: ["Cash", "Bank", "UPI", "Cheque"].includes(input.method)
              ? input.method as "Cash" | "Bank" | "UPI" | "Cheque"
              : "Bank",
            referenceNumber: input.referenceNumber,
            notes: input.notes,
          }], { session: transactionSession });
      }
      await recordTradingAudit({
        organizationId,
        actorId: scopeResult.scope.actorId,
        action: input.direction === "Receipt" ? "trader.payment.received" : "trader.payment.made",
        entityType: "TraderPayment",
        entityId: paymentId,
        changes: {
          traderId: input.traderId,
          direction: input.direction,
          amount: input.amount,
          allocatedAmount,
          allocationCount: input.allocations.length,
          method: input.method,
        },
        session: transactionSession,
      });
    });
    return NextResponse.json({ ok: true, id: paymentId, receiptNumber: receiptNumber === "replayed" ? undefined : receiptNumber }, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "This payment or receipt number already exists. Retry with the same idempotency key." }, { status: 409 });
    }
    if (error instanceof Error && /Transaction numbers are only allowed|transactions are not supported|replica set/i.test(error.message)) {
      return NextResponse.json({ error: "Payment allocation requires MongoDB transactions. Configure MongoDB as a replica set or Atlas cluster." }, { status: 503 });
    }
    return tradingDatabaseUnavailable(error);
  } finally {
    await session?.endSession();
  }
}
