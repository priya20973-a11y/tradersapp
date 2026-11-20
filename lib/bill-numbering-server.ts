import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { DocumentSequence, PurchaseBill } from "@/models";
import {
  escapeRegex,
  extractBillNumberPart,
  findNextAvailableBillNumber,
  formatBillNumber,
} from "./bill-numbering";

/**
 * Peeks and returns the next available unique Bill number for an organization
 * without advancing the sequence in database.
 * Derives initial sequence from existing bills if DocumentSequence is not yet present.
 */
export async function peekNextBillNumber(
  organizationId: string | Types.ObjectId,
): Promise<{
  billNumber: string;
  nextNumber: number;
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

  const prefix = "BILL-";
  const padding = 4;

  // Retrieve existing bills with BILL- prefix for this organization
  const existingBills = await PurchaseBill.find({
    $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
    billNumber: { $regex: `^${escapeRegex(prefix)}`, $options: "i" },
  })
    .select("billNumber")
    .lean()
    .catch(() => []);

  const existingSet = new Set(existingBills.map((b) => b.billNumber));

  // Check DocumentSequence
  const seqDoc = await DocumentSequence.findOne({
    $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
    modelName: "Purchase Bill",
  })
    .select("nextNumber")
    .lean()
    .catch(() => null);

  let candidateNumber = 1;
  if (seqDoc && typeof (seqDoc as Record<string, unknown>).nextNumber === "number") {
    candidateNumber = (seqDoc as Record<string, unknown>).nextNumber as number;
  } else {
    // Derive candidate from existing bills if sequence document does not yet exist
    let maxUsed = 0;
    for (const b of existingBills) {
      const part = extractBillNumberPart(b.billNumber, prefix);
      if (part !== null && part > maxUsed) {
        maxUsed = part;
      }
    }
    candidateNumber = maxUsed + 1;
  }

  const { billNumber, allocatedNumber } = findNextAvailableBillNumber(
    prefix,
    candidateNumber,
    padding,
    existingSet,
  );

  return {
    billNumber,
    nextNumber: allocatedNumber,
    prefix,
    padding,
  };
}

/**
 * Atomically allocates the next sequential, guaranteed-unique Bill number
 * for an organization. Avoids collisions against existing bills and updates
 * DocumentSequence atomically to prevent duplicates during concurrent requests.
 */
export async function allocateNextBillNumber(
  organizationId: string | Types.ObjectId,
): Promise<{
  billNumber: string;
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

  const prefix = "BILL-";
  const padding = 4;

  // Retrieve existing bills to prevent collision
  const existingBills = await PurchaseBill.find({
    $or: [{ organizationId: orgObjId }, { organizationId: String(orgObjId) }],
    billNumber: { $regex: `^${escapeRegex(prefix)}`, $options: "i" },
  })
    .select("billNumber")
    .lean()
    .catch(() => []);

  const existingSet = new Set(existingBills.map((b) => b.billNumber));

  // Determine highest used bill number if sequence doesn't exist
  let maxUsed = 0;
  for (const b of existingBills) {
    const part = extractBillNumberPart(b.billNumber, prefix);
    if (part !== null && part > maxUsed) {
      maxUsed = part;
    }
  }

  // Atomically increment or initialize DocumentSequence
  const seqDoc = await DocumentSequence.findOneAndUpdate(
    { organizationId: orgObjId, modelName: "Purchase Bill" },
    {
      $inc: { nextNumber: 1 },
      $setOnInsert: {
        prefix,
        modelName: "Purchase Bill",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  let rawAllocated = Number((seqDoc as Record<string, unknown>)?.nextNumber) || 1;

  // If the sequence was behind existing bills, ensure candidate is at least maxUsed + 1
  if (rawAllocated <= maxUsed) {
    rawAllocated = maxUsed + 1;
  }

  // Run collision avoidance to ensure candidate does not exist
  const { billNumber, allocatedNumber } = findNextAvailableBillNumber(
    prefix,
    rawAllocated,
    padding,
    existingSet,
  );

  // If collision avoidance pushed candidate ahead of DocumentSequence.nextNumber, update it
  if (allocatedNumber >= rawAllocated) {
    await DocumentSequence.updateOne(
      { organizationId: orgObjId, modelName: "Purchase Bill" },
      { $set: { nextNumber: allocatedNumber + 1 } },
    ).catch(() => null);
  }

  return {
    billNumber,
    allocatedNumber,
    prefix,
    padding,
  };
}
