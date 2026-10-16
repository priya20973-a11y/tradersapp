import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getTradingScope, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { SalesDocument, StockLot, TraderPayment, TraderProfile, TradeDeal } from "@/models";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scopeResult = await getTradingScope(
      url.searchParams.get("organizationId") ?? undefined,
      "reports",
    );
    if ("response" in scopeResult) return scopeResult.response;
    const organizationId = new Types.ObjectId(scopeResult.scope.organizationId);
    const [traderSummary, dealsByStatus, stockByCommodity, invoiceSummary, paymentSummary] = await Promise.all([
      TraderProfile.aggregate([
        { $match: { organizationId } },
        { $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$tradingStatus", "Active"] }, 1, 0] } },
          blocked: { $sum: { $cond: [{ $eq: ["$tradingStatus", "Blocked"] }, 1, 0] } },
          pendingKyc: { $sum: { $cond: [{ $in: ["$kycStatus", ["Pending", "Not Started"]] }, 1, 0] } },
          creditOnHold: { $sum: { $cond: [{ $eq: ["$creditApprovalStatus", "On Hold"] }, 1, 0] } },
        } },
      ]),
      TradeDeal.aggregate([
        { $match: { organizationId } },
        { $group: {
          _id: "$status",
          count: { $sum: 1 },
          contractValue: { $sum: { $multiply: ["$contractedQuantity", "$agreedRate"] } },
          settledValue: { $sum: "$settledAmount" },
          estimatedCosts: { $sum: { $reduce: { input: { $ifNull: ["$estimatedCosts", []] }, initialValue: 0, in: { $add: ["$$value", "$$this.amount"] } } } },
          realizedCosts: { $sum: { $reduce: { input: { $ifNull: ["$realizedCosts", []] }, initialValue: 0, in: { $add: ["$$value", "$$this.amount"] } } } },
        } },
        { $sort: { _id: 1 } },
      ]),
      StockLot.aggregate([
        { $match: { organizationId } },
        { $group: {
          _id: { commodityItemId: "$commodityItemId", unit: "$unit" },
          lotCount: { $sum: 1 },
          physicalQuantity: { $sum: "$physicalQuantity" },
          reservedQuantity: { $sum: "$reservedQuantity" },
          damagedQuantity: { $sum: "$damagedQuantity" },
        } },
        { $sort: { physicalQuantity: -1 } },
        { $limit: 50 },
        { $lookup: { from: "items", localField: "_id.commodityItemId", foreignField: "_id", as: "commodity" } },
        { $unwind: { path: "$commodity", preserveNullAndEmptyArrays: true } },
        { $project: {
          _id: 0,
          commodity: "$commodity.name",
          sku: "$commodity.sku",
          unit: "$_id.unit",
          lotCount: 1,
          physicalQuantity: 1,
          reservedQuantity: 1,
          availableQuantity: { $subtract: ["$physicalQuantity", "$reservedQuantity"] },
          damagedQuantity: 1,
        } },
      ]),
      SalesDocument.aggregate([
        { $match: { organizationId, type: "Invoice", status: { $ne: "Draft" } } },
        { $group: {
          _id: null,
          invoiceCount: { $sum: 1 },
          invoiced: { $sum: "$total" },
          received: { $sum: "$amountPaid" },
          credited: { $sum: "$creditedAmount" },
          overdue: { $sum: { $cond: [
            { $and: [{ $ne: ["$dueDate", null] }, { $lt: ["$dueDate", new Date()] }, { $gt: ["$total", { $add: ["$amountPaid", "$creditedAmount"] }] }] },
            { $max: [0, { $subtract: ["$total", { $add: ["$amountPaid", "$creditedAmount"] }] }] },
            0,
          ] } },
          outstanding: { $sum: { $max: [0, { $subtract: ["$total", { $add: ["$amountPaid", "$creditedAmount"] }] }] } },
        } },
      ]),
      TraderPayment.aggregate([
        { $match: { organizationId, status: "Posted" } },
        { $group: {
          _id: "$direction",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
          unallocated: { $sum: "$unallocatedAmount" },
        } },
      ]),
    ]);
    return NextResponse.json({
      traders: traderSummary[0] ?? { total: 0, active: 0, blocked: 0, pendingKyc: 0, creditOnHold: 0 },
      dealsByStatus,
      stockByCommodity,
      invoices: invoiceSummary[0] ?? { invoiceCount: 0, invoiced: 0, received: 0, credited: 0, outstanding: 0, overdue: 0 },
      tradingPayments: paymentSummary,
      notice: "Deal value, trading payments and stock balances are operational summaries and are not double-entry ledger postings.",
    });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}
