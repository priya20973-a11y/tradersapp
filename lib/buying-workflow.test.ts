import { describe, expect, it } from "vitest";
import { canAccessRole } from "./auth-roles";
import { isBuyerAdmin } from "./buying-access";
import {
  canSubmitOffer,
  canAcceptOffer,
  canRejectOffer,
  canWithdrawOffer,
  canCancelRequest,
  resolveRequestStatusAfterOfferSubmission,
  resolveRequestStatusAfterAccept,
  resolveRequestStatusAfterWithdrawal,
  type BuyingRequestStatus,
  type RequestOfferStatus,
} from "./buying-workflow";

describe("Role-based Access for Find Buyers and Buying Requests", () => {
  it("grants Buyer role permissions to manage requests and accept/reject offers but not submit offers", () => {
    expect(canAccessRole("Buyer", "view-buyers")).toBe(true);
    expect(canAccessRole("Buyer", "view-buying-requests")).toBe(true);
    expect(canAccessRole("Buyer", "manage-buying-requests")).toBe(true);
    expect(canAccessRole("Buyer", "accept-reject-offers")).toBe(true);
    expect(canAccessRole("Buyer", "submit-offers")).toBe(false);
    expect(canAccessRole("Buyer", "manage-my-offers")).toBe(false);
  });

  it("grants Seller role permissions to discover requests and submit/manage offers but not manage requests", () => {
    expect(canAccessRole("Seller", "view-buyers")).toBe(true);
    expect(canAccessRole("Seller", "view-buying-requests")).toBe(true);
    expect(canAccessRole("Seller", "submit-offers")).toBe(true);
    expect(canAccessRole("Seller", "manage-my-offers")).toBe(true);
    expect(canAccessRole("Seller", "manage-buying-requests")).toBe(false);
    expect(canAccessRole("Seller", "accept-reject-offers")).toBe(false);
  });

  it("grants Super Admin and Organization Owner full access", () => {
    expect(canAccessRole("Super Admin", "manage-buying-requests")).toBe(true);
    expect(canAccessRole("Super Admin", "submit-offers")).toBe(true);
    expect(canAccessRole("Organization Owner", "accept-reject-offers")).toBe(true);
    expect(canAccessRole("Organization Owner", "view-buyers")).toBe(true);
    expect(canAccessRole("Administrator", "manage-buying-requests")).toBe(true);
  });

  it("grants Sales and Purchase managers appropriate trading access", () => {
    expect(canAccessRole("Purchase Manager", "manage-buying-requests")).toBe(true);
    expect(canAccessRole("Purchase Manager", "accept-reject-offers")).toBe(true);
    expect(canAccessRole("Sales Manager", "submit-offers")).toBe(true);
    expect(canAccessRole("Sales Manager", "manage-my-offers")).toBe(true);
    expect(canAccessRole("Sales Executive", "submit-offers")).toBe(true);
  });

  describe("Buyer Management Permissions", () => {
    it("allows Admins to add, edit, and manage buyers (manage-buyers) and view buyers (view-buyers)", () => {
      // Admin roles: Super Admin, Organization Owner, Administrator
      expect(canAccessRole("Super Admin", "manage-buyers")).toBe(true);
      expect(canAccessRole("Super Admin", "view-buyers")).toBe(true);
      expect(canAccessRole("Organization Owner", "manage-buyers")).toBe(true);
      expect(canAccessRole("Organization Owner", "view-buyers")).toBe(true);
      expect(canAccessRole("Administrator", "manage-buyers")).toBe(true);
      expect(canAccessRole("Administrator", "view-buyers")).toBe(true);
    });

    it("restricts all non-admin roles and User accounts from adding or editing buyers (manage-buyers is false)", () => {
      const nonAdminRoles = [
        "Purchase Manager",
        "Sales Manager",
        "Sales Executive",
        "Accountant",
        "Inventory Manager",
        "Read-Only Auditor",
        "Buyer",
        "Seller",
        "User",
      ];

      for (const role of nonAdminRoles) {
        expect(canAccessRole(role, "manage-buyers")).toBe(false);
      }
    });

    it("allows all non-admin roles and User accounts to view buyers and buyer details (view-buyers is true)", () => {
      const nonAdminRoles = [
        "Purchase Manager",
        "Sales Manager",
        "Sales Executive",
        "Accountant",
        "Inventory Manager",
        "Read-Only Auditor",
        "Buyer",
        "Seller",
        "User",
      ];

      for (const role of nonAdminRoles) {
        expect(canAccessRole(role, "view-buyers")).toBe(true);
      }
    });

    it("verifies isBuyerAdmin correctly distinguishes admin users from non-admin / user accounts", () => {
      // Admin users
      expect(isBuyerAdmin({ id: "admin", role: "Super Admin" })).toBe(true);
      expect(isBuyerAdmin({ id: "user-1", role: "Super Admin" })).toBe(true);
      expect(isBuyerAdmin({ id: "user-2", role: "Administrator" })).toBe(true);
      expect(isBuyerAdmin({ id: "user-3", role: "Organization Owner" })).toBe(true);
      expect(isBuyerAdmin({ id: "user-admin", role: "admin" })).toBe(true);

      // Non-admin / user accounts
      expect(isBuyerAdmin({ id: "user-4", role: "Purchase Manager" })).toBe(false);
      expect(isBuyerAdmin({ id: "user-5", role: "Sales Manager" })).toBe(false);
      expect(isBuyerAdmin({ id: "user-6", role: "Accountant" })).toBe(false);
      expect(isBuyerAdmin({ id: "user-7", role: "Buyer" })).toBe(false);
      expect(isBuyerAdmin({ id: "user-8", role: "Seller" })).toBe(false);
      expect(isBuyerAdmin({ id: "user-9", role: "Inventory Manager" })).toBe(false);
      expect(isBuyerAdmin({ id: "user-10", role: "Read-Only Auditor" })).toBe(false);
      expect(isBuyerAdmin({ id: "user-11", role: "User" })).toBe(false);
      expect(isBuyerAdmin(null)).toBe(false);
      expect(isBuyerAdmin(undefined)).toBe(false);
    });

    it("validates role-based authorization rules for buyer APIs and actions", () => {
      // Helper simulating backend role authorization
      function authorizeBuyerAction(
        user: { id?: string; role?: string },
        action: "create" | "edit" | "delete" | "view",
      ): { authorized: boolean; statusCode: number } {
        const isAdmin = isBuyerAdmin(user);
        const role = user.role || "";

        if (action === "view") {
          const canView = canAccessRole(role, "view-buyers");
          return canView ? { authorized: true, statusCode: 200 } : { authorized: false, statusCode: 403 };
        }

        // For create, edit, delete: requires manage-buyers permission AND isAdmin
        const hasManagePermission = canAccessRole(role, "manage-buyers");
        if (!hasManagePermission || !isAdmin) {
          return { authorized: false, statusCode: 403 };
        }

        return { authorized: true, statusCode: 200 };
      }

      // Admin accounts: authorized for create, edit, delete, and view
      const adminUsers = [
        { id: "admin", role: "Super Admin" },
        { id: "admin-2", role: "Administrator" },
        { id: "admin-3", role: "Organization Owner" },
      ];

      for (const admin of adminUsers) {
        expect(authorizeBuyerAction(admin, "create")).toEqual({ authorized: true, statusCode: 200 });
        expect(authorizeBuyerAction(admin, "edit")).toEqual({ authorized: true, statusCode: 200 });
        expect(authorizeBuyerAction(admin, "delete")).toEqual({ authorized: true, statusCode: 200 });
        expect(authorizeBuyerAction(admin, "view")).toEqual({ authorized: true, statusCode: 200 });
      }

      // User accounts: only authorized for view; create, edit, delete return 403
      const standardUsers = [
        { id: "user-account-1", role: "User" },
        { id: "user-account-2", role: "Purchase Manager" },
        { id: "user-account-3", role: "Sales Executive" },
        { id: "user-account-4", role: "Buyer" },
        { id: "user-account-5", role: "Seller" },
        { id: "user-account-6", role: "Accountant" },
      ];

      for (const standardUser of standardUsers) {
        expect(authorizeBuyerAction(standardUser, "create")).toEqual({ authorized: false, statusCode: 403 });
        expect(authorizeBuyerAction(standardUser, "edit")).toEqual({ authorized: false, statusCode: 403 });
        expect(authorizeBuyerAction(standardUser, "delete")).toEqual({ authorized: false, statusCode: 403 });
        expect(authorizeBuyerAction(standardUser, "view")).toEqual({ authorized: true, statusCode: 200 });
      }
    });
  });
});

describe("Complete Buying Request -> Seller Offer -> Buyer Acceptance Workflow", () => {
  it("allows seller to submit offer on Open request and transitions request to Offers Received", () => {
    const initialStatus: BuyingRequestStatus = "Open";
    const isBuyerOfRequest = false;

    const offerEligibility = canSubmitOffer(initialStatus, isBuyerOfRequest);
    expect(offerEligibility.allowed).toBe(true);

    const newRequestStatus = resolveRequestStatusAfterOfferSubmission(initialStatus);
    expect(newRequestStatus).toBe("Offers Received");
  });

  it("prevents buyer from submitting an offer on their own request", () => {
    const isBuyerOfRequest = true;
    const offerEligibility = canSubmitOffer("Open", isBuyerOfRequest, false);
    expect(offerEligibility.allowed).toBe(false);
    expect(offerEligibility.reason).toContain("cannot submit offers on their own");
  });

  it("prevents submitting offers on Accepted, Fulfilled, or Cancelled requests", () => {
    expect(canSubmitOffer("Accepted", false).allowed).toBe(false);
    expect(canSubmitOffer("Fulfilled", false).allowed).toBe(false);
    expect(canSubmitOffer("Cancelled", false).allowed).toBe(false);
  });

  it("allows buyer to accept pending offer and transitions request to Accepted", () => {
    const requestStatus: BuyingRequestStatus = "Offers Received";
    const offerStatus: RequestOfferStatus = "Pending";
    const isBuyerOfRequest = true;

    const acceptEligibility = canAcceptOffer(requestStatus, offerStatus, isBuyerOfRequest);
    expect(acceptEligibility.allowed).toBe(true);

    const nextStatus = resolveRequestStatusAfterAccept();
    expect(nextStatus).toBe("Accepted");
  });

  it("prevents non-buyer and unauthorized users from accepting or rejecting offers", () => {
    const isBuyerOfRequest = false;
    expect(canAcceptOffer("Offers Received", "Pending", isBuyerOfRequest, false).allowed).toBe(false);
    expect(canRejectOffer("Pending", isBuyerOfRequest, false).allowed).toBe(false);
  });

  it("simulates full multi-offer acceptance cycle with competing offers auto-rejection", () => {
    // 1. Buyer creates request
    let requestStatus: BuyingRequestStatus = "Open";
    let acceptedOfferId: string | null = null;
    const offers = [
      { id: "off-1", sellerId: "seller-A", price: 2900, status: "Pending" as RequestOfferStatus },
      { id: "off-2", sellerId: "seller-B", price: 2850, status: "Pending" as RequestOfferStatus },
    ];

    // 2. Both sellers submit offers
    requestStatus = resolveRequestStatusAfterOfferSubmission(requestStatus);
    expect(requestStatus).toBe("Offers Received");

    // 3. Buyer chooses better offer (seller-B at 2850)
    const selectedOffer = offers.find((o) => o.id === "off-2")!;
    const canAccept = canAcceptOffer(requestStatus, selectedOffer.status, true);
    expect(canAccept.allowed).toBe(true);

    // Accept selected offer
    selectedOffer.status = "Accepted";
    acceptedOfferId = selectedOffer.id;
    requestStatus = resolveRequestStatusAfterAccept();

    // Auto-reject competing offers
    offers.forEach((o) => {
      if (o.id !== selectedOffer.id && o.status === "Pending") {
        o.status = "Rejected";
      }
    });

    // 4. Verify outcomes
    expect(requestStatus).toBe("Accepted");
    expect(acceptedOfferId).toBe("off-2");
    expect(offers[0].status).toBe("Rejected");
    expect(offers[1].status).toBe("Accepted");

    // Further offers cannot be submitted on an Accepted request
    expect(canSubmitOffer(requestStatus, false).allowed).toBe(false);
  });

  it("allows seller to withdraw their pending offer and reverts request to Open if no offers remain", () => {
    const isSellerOfOffer = true;
    expect(canWithdrawOffer("Pending", isSellerOfOffer).allowed).toBe(true);

    // Reverts to Open if 0 pending offers remain
    const revertedStatus = resolveRequestStatusAfterWithdrawal(0, "Offers Received");
    expect(revertedStatus).toBe("Open");

    // Keeps Offers Received if other offers still exist
    const keptStatus = resolveRequestStatusAfterWithdrawal(1, "Offers Received");
    expect(keptStatus).toBe("Offers Received");
  });

  it("prevents withdrawing an offer that is already accepted or rejected", () => {
    expect(canWithdrawOffer("Accepted", true).allowed).toBe(false);
    expect(canWithdrawOffer("Rejected", true).allowed).toBe(false);
  });

  it("enforces cancellation rules: only owner can cancel and cancelled request cannot be cancelled again", () => {
    expect(canCancelRequest("Open", true).allowed).toBe(true);
    expect(canCancelRequest("Open", false, false).allowed).toBe(false);
    expect(canCancelRequest("Cancelled", true).allowed).toBe(false);
    expect(canCancelRequest("Fulfilled", true).allowed).toBe(false);
  });
});
