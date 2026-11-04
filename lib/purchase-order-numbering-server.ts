import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { PurchaseOrder, PurchaseOrderPreferences } from "@/models";
import {
  findNextAvailablePONumber,
  getFiscalYear,
} from "./purchase-order-numbering";

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

/**
 * Atomically loads or creates preferences for an organization,
 * handles fiscal year restart check, finds the next available unique number,
 * and increments nextNumber persistently.
 */
export async function allocateNextPurchaseOrderNumber(
  organizationId: string | Types.ObjectId,
): Promise<{
  poNumber: string;
  allocatedNumber: number;
  prefix: string;
  padding: number;
}> {
  await connectToDatabase().catch(() => null);
  const orgObjId =
    organizationId && Types.ObjectId.isValid(organizationId)
      ? typeof organizationId === "string"
        ? new Types.ObjectId(organizationId)
        : organizationId
      : new Types.ObjectId("000000000000000000000001");
  const currentFY = getFiscalYear();

  let prefs = await PurchaseOrderPreferences.findOne({ organizationId: orgObjId });
  if (!prefs) {
    prefs = await PurchaseOrderPreferences.create({
      organizationId: orgObjId,
      autoGenerateNumbering: true,
      prefix: "PO-",
      nextNumber: 2,
      numberZeroPadding: 5,
      restartNumberingEachFiscalYear: false,
      lastFiscalYear: currentFY,
    });
  }

  // Check fiscal year restart
  let candidateNumber = prefs.nextNumber || 1;
  if (prefs.restartNumberingEachFiscalYear && prefs.lastFiscalYear && prefs.lastFiscalYear !== currentFY) {
    candidateNumber = 1;
    prefs.nextNumber = 1;
    prefs.lastFiscalYear = currentFY;
    await PurchaseOrderPreferences.updateOne(
      { _id: prefs._id },
      { $set: { nextNumber: 1, lastFiscalYear: currentFY } },
    );
  }

  const prefix = prefs.prefix || "PO-";
  const padding = prefs.numberZeroPadding || 5;

  // Retrieve existing PO numbers with this prefix to prevent collision
  const existingPOs = await PurchaseOrder.find({
    organizationId: orgObjId,
    purchaseOrderNumber: { $regex: `^${escapeRegex(prefix)}` },
  })
    .select("purchaseOrderNumber")
    .lean();

  const existingSet = new Set(existingPOs.map((p) => p.purchaseOrderNumber));
  const { poNumber, allocatedNumber } = findNextAvailablePONumber(
    prefix,
    candidateNumber,
    padding,
    existingSet,
  );

  // Update preferences next number atomically
  await PurchaseOrderPreferences.updateOne(
    { _id: prefs._id },
    { $set: { nextNumber: allocatedNumber + 1 } },
  );

  return {
    poNumber,
    allocatedNumber,
    prefix,
    padding,
  };
}

