import { NextResponse } from "next/server";
import { getTradingScope, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { SalesDocument, TraderProfile } from "@/models";
import { Types } from "mongoose";

function csvCell(value: unknown) {
  const rawText = String(value ?? "");
  const text = /^[\s]*[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scopeResult = await getTradingScope(
      url.searchParams.get("organizationId") ?? undefined,
      "financial-export",
    );
    if ("response" in scopeResult) return scopeResult.response;
    const organizationId = scopeResult.scope.organizationId;
    const traders = await TraderProfile.find({ organizationId }).sort({ legalBusinessName: 1 }).lean();
    const balances = await SalesDocument.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), type: "Invoice" } },
      { $group: { _id: "$customerId", total: { $sum: "$total" }, paid: { $sum: "$amountPaid" }, credited: { $sum: "$creditedAmount" } } },
    ]);
    const balanceMap = new Map(
      balances.map((row: { _id: Types.ObjectId; total: number; paid: number; credited: number }) => [
        row._id.toString(),
        Number(row.total ?? 0) - Number(row.paid ?? 0) - Number(row.credited ?? 0),
      ]),
    );
    const header = [
      "Trader code", "Legal business name", "Trade name", "Roles", "Status", "KYC status",
      "GSTIN", "PAN", "City", "State", "Credit limit", "Receivable", "Payable",
    ];
    const rows = traders.map((trader) => [
      trader.traderCode,
      trader.legalBusinessName,
      trader.tradeName,
      trader.roles.join(", "),
      trader.tradingStatus,
      trader.kycStatus,
      trader.gstin,
      trader.pan,
      trader.billingAddress?.city,
      trader.billingAddress?.state,
      trader.creditLimit,
      Number(trader.openingReceivable ?? 0) + (trader.customerId ? balanceMap.get(String(trader.customerId)) ?? 0 : 0),
      trader.openingPayable,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="traders.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}
