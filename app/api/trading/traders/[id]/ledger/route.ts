import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { getTradingScope, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { invoiceOutstanding } from "@/lib/trading-calculations";
import { SalesDocument, TraderPayment, TraderProfile, TradeDeal } from "@/models";

type LedgerEntry = {
  date: Date;
  reference: string;
  type: string;
  debit: number;
  credit: number;
  description: string;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: "Trader not found." }, { status: 404 });
    const url = new URL(request.url);
    const scopeResult = await getTradingScope(
      url.searchParams.get("organizationId") ?? undefined,
      "trader-ledger",
    );
    if ("response" in scopeResult) return scopeResult.response;
    const organizationId = scopeResult.scope.organizationId;
    const trader = await TraderProfile.findOne({ _id: id, organizationId }).lean();
    if (!trader) return NextResponse.json({ error: "Trader not found." }, { status: 404 });

    const [documents, payments, deals] = await Promise.all([
      trader.customerId
        ? SalesDocument.find({
          organizationId,
          customerId: trader.customerId,
          type: { $in: ["Invoice", "Credit Note", "Payment Received"] },
          status: { $ne: "Draft" },
        }).sort({ issueDate: 1 }).limit(1000).lean()
        : Promise.resolve([]),
      TraderPayment.find({ organizationId, traderId: id, status: "Posted" }).sort({ paymentDate: 1 }).limit(1000).lean(),
      TradeDeal.find({
        organizationId,
        $or: [{ buyerTraderId: id }, { sellerTraderId: id }],
        status: { $nin: ["Cancelled", "Settled"] },
      }).select("dealReference dealType buyerTraderId sellerTraderId contractedQuantity agreedRate settledAmount status").limit(1000).lean(),
    ]);
    const entries: LedgerEntry[] = [];
    for (const document of documents) {
      if (document.type === "Payment Received" && document.number.startsWith("TRP-")) continue;
      if (document.type === "Invoice") {
        entries.push({
          date: document.issueDate,
          reference: document.number,
          type: "Invoice",
          debit: Number(document.total ?? 0),
          credit: 0,
          description: `Invoice balance: ${document.status}`,
        });
      } else if (document.type === "Credit Note") {
        entries.push({
          date: document.issueDate,
          reference: document.number,
          type: "Credit note",
          debit: 0,
          credit: Number(document.total ?? 0),
          description: "Sales credit adjustment",
        });
      } else {
        entries.push({
          date: document.issueDate,
          reference: document.number,
          type: "Receipt",
          debit: 0,
          credit: Number(document.total ?? 0),
          description: document.method ? `Receipt · ${document.method}` : "Customer receipt",
        });
      }
    }
    for (const payment of payments) {
      entries.push({
        date: payment.paymentDate,
        reference: payment.referenceNumber || String(payment._id),
        type: payment.direction,
        debit: payment.direction === "Payment" ? payment.amount : 0,
        credit: payment.direction === "Receipt" ? payment.amount : 0,
        description: `${payment.method}${payment.unallocatedAmount > 0 ? ` · advance ${payment.unallocatedAmount}` : ""}`,
      });
    }
    entries.sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime());
    let runningBalance = Number(trader.openingReceivable ?? 0) - Number(trader.openingPayable ?? 0);
    const datedEntries = entries.map((entry) => {
      runningBalance += entry.debit - entry.credit;
      return { ...entry, runningBalance };
    });

    const today = Date.now();
    const ageing = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
    const invoiceDocuments = documents.filter((document) => document.type === "Invoice");
    for (const invoice of invoiceDocuments) {
      const balance = invoiceOutstanding(Number(invoice.total ?? 0), Number(invoice.amountPaid ?? 0), Number(invoice.creditedAmount ?? 0));
      const overdueDays = invoice.dueDate
        ? Math.floor((today - new Date(invoice.dueDate).getTime()) / 86_400_000)
        : -1;
      if (overdueDays < 1) ageing.current += balance;
      else if (overdueDays <= 30) ageing.days1to30 += balance;
      else if (overdueDays <= 60) ageing.days31to60 += balance;
      else if (overdueDays <= 90) ageing.days61to90 += balance;
      else ageing.over90 += balance;
    }

    const openDealExposure = deals.reduce((sum, deal) => {
      const amount = Number(deal.contractedQuantity ?? 0) * Number(deal.agreedRate ?? 0);
      return sum + Math.max(0, amount - Number(deal.settledAmount ?? 0));
    }, 0);
    const receiptAdvances = payments
      .filter((payment) => payment.direction === "Receipt")
      .reduce((sum, payment) => sum + Number(payment.unallocatedAmount ?? 0), 0);
    const supplierAdvances = payments
      .filter((payment) => payment.direction === "Payment")
      .reduce((sum, payment) => sum + Number(payment.unallocatedAmount ?? 0), 0);
    const invoiceOutstandingTotal = invoiceDocuments.reduce((sum, invoice) =>
      sum + invoiceOutstanding(Number(invoice.total ?? 0), Number(invoice.amountPaid ?? 0), Number(invoice.creditedAmount ?? 0)), 0);
    const receivable = Number(trader.openingReceivable ?? 0) + invoiceOutstandingTotal - receiptAdvances;

    return NextResponse.json({
      trader: {
        id: String(trader._id),
        traderCode: trader.traderCode,
        legalBusinessName: trader.legalBusinessName,
        openingReceivable: Number(trader.openingReceivable ?? 0),
        openingPayable: Number(trader.openingPayable ?? 0),
        creditLimit: Number(trader.creditLimit ?? 0),
      },
      balances: {
        receivable,
        payable: Number(trader.openingPayable ?? 0),
        supplierAdvances,
        receiptAdvances,
        openDealExposure,
        availableCredit: Math.max(0, Number(trader.creditLimit ?? 0) - receivable),
      },
      ageing,
      openInvoices: invoiceDocuments
        .map((invoice) => ({
          id: String(invoice._id),
          number: invoice.number,
          dueDate: invoice.dueDate ?? null,
          total: Number(invoice.total ?? 0),
          outstanding: invoiceOutstanding(Number(invoice.total ?? 0), Number(invoice.amountPaid ?? 0), Number(invoice.creditedAmount ?? 0)),
        }))
        .filter((invoice) => invoice.outstanding > 0),
      entries: datedEntries,
      notice: "Ledger is derived from trader opening balances, invoices, credit notes and recorded receipts/payments; it is not a double-entry general ledger.",
    });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}
