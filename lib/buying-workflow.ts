export type BuyingRequestStatus =
  | "Pending"
  | "Approved"
  | "Open"
  | "In Progress"
  | "Offers Received"
  | "Accepted"
  | "Rejected"
  | "Fulfilled"
  | "Closed"
  | "Cancelled";

export type RequestOfferStatus = "Pending" | "Accepted" | "Rejected" | "Withdrawn";

export function canSubmitOffer(
  requestStatus: BuyingRequestStatus,
  isBuyerOfRequest: boolean,
  isAdmin = false,
): { allowed: boolean; reason?: string } {
  if (requestStatus === "Pending") {
    return {
      allowed: false,
      reason: "Buying request is pending admin approval and cannot accept offers yet.",
    };
  }
  if (!["Approved", "Open", "Offers Received", "In Progress"].includes(requestStatus)) {
    return {
      allowed: false,
      reason: `Buying request is ${requestStatus.toLowerCase()} and cannot accept new offers.`,
    };
  }
  if (isBuyerOfRequest && !isAdmin) {
    return {
      allowed: false,
      reason: "Buyers cannot submit offers on their own buying requests.",
    };
  }
  return { allowed: true };
}

export function canAcceptOffer(
  requestStatus: BuyingRequestStatus,
  offerStatus: RequestOfferStatus,
  isBuyerOfRequest: boolean,
  isAdmin = false,
): { allowed: boolean; reason?: string } {
  if (!isBuyerOfRequest && !isAdmin) {
    return {
      allowed: false,
      reason: "Only the buyer who created this request can accept an offer.",
    };
  }
  if (!["Open", "Offers Received", "In Progress"].includes(requestStatus)) {
    return {
      allowed: false,
      reason: `Cannot accept offer because request is already ${requestStatus.toLowerCase()}.`,
    };
  }
  if (offerStatus !== "Pending") {
    return {
      allowed: false,
      reason: `Cannot accept an offer that is already ${offerStatus.toLowerCase()}.`,
    };
  }
  return { allowed: true };
}

export function canRejectOffer(
  offerStatus: RequestOfferStatus,
  isBuyerOfRequest: boolean,
  isAdmin = false,
): { allowed: boolean; reason?: string } {
  if (!isBuyerOfRequest && !isAdmin) {
    return {
      allowed: false,
      reason: "Only the buyer who created this request can reject an offer.",
    };
  }
  if (offerStatus !== "Pending") {
    return {
      allowed: false,
      reason: `Cannot reject an offer that is already ${offerStatus.toLowerCase()}.`,
    };
  }
  return { allowed: true };
}

export function canWithdrawOffer(
  offerStatus: RequestOfferStatus,
  isSellerOfOffer: boolean,
  isAdmin = false,
): { allowed: boolean; reason?: string } {
  if (!isSellerOfOffer && !isAdmin) {
    return {
      allowed: false,
      reason: "Only the seller who submitted this offer can withdraw it.",
    };
  }
  if (offerStatus !== "Pending") {
    return {
      allowed: false,
      reason: `Cannot withdraw an offer that is already ${offerStatus.toLowerCase()}.`,
    };
  }
  return { allowed: true };
}

export function canCancelRequest(
  requestStatus: BuyingRequestStatus,
  isBuyerOfRequest: boolean,
  isAdmin = false,
): { allowed: boolean; reason?: string } {
  if (!isBuyerOfRequest && !isAdmin) {
    return {
      allowed: false,
      reason: "Only the request owner can cancel this buying request.",
    };
  }
  if (["Cancelled", "Fulfilled"].includes(requestStatus)) {
    return {
      allowed: false,
      reason: `Cannot cancel a request that is already ${requestStatus.toLowerCase()}.`,
    };
  }
  return { allowed: true };
}

export function resolveRequestStatusAfterOfferSubmission(
  currentStatus: BuyingRequestStatus,
): BuyingRequestStatus {
  if (currentStatus === "Open" || currentStatus === "Approved") return "Offers Received";
  return currentStatus;
}

export function resolveRequestStatusAfterAccept(): BuyingRequestStatus {
  return "Accepted";
}

export function resolveRequestStatusAfterWithdrawal(
  remainingPendingCount: number,
  currentStatus: BuyingRequestStatus,
): BuyingRequestStatus {
  if (remainingPendingCount === 0 && currentStatus === "Offers Received") {
    return "Open";
  }
  return currentStatus;
}
