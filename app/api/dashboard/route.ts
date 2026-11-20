import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Organization, User } from "@/models";
import {
  type DateRangePreset,
  getDashboardData,
} from "@/lib/dashboard-service";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 },
      );
    }

    await connectToDatabase();

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") || undefined;
    const range = (url.searchParams.get("range") || "all") as DateRangePreset;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;

    let organizationId = session.user.organizationId;

    // Super Admin organization resolution
    if (session.user.id === "admin") {
      if (requestedOrgId && isValidObjectId(requestedOrgId)) {
        organizationId = requestedOrgId;
      } else {
        const defaultOrg =
          (await Organization.findOne({ status: "active" }).select("_id").lean().catch(() => null)) ||
          (await Organization.findOne().select("_id").lean().catch(() => null));
        if (defaultOrg) {
          organizationId = String(defaultOrg._id);
        }
      }
    } else {
      // Regular user tenant boundary enforcement
      if (requestedOrgId && organizationId && requestedOrgId !== String(organizationId)) {
        return NextResponse.json(
          { error: "You can only access your own organization." },
          { status: 403 },
        );
      }

      if (!organizationId || !isValidObjectId(organizationId)) {
        const userDoc = await User.findById(session.user.id).select("organizationId isDeleted").lean().catch(() => null);
        if (userDoc?.organizationId) {
          organizationId = String(userDoc.organizationId);
        } else {
          const fallbackOrg = await Organization.findOne({ status: "active" }).select("_id").lean().catch(() => null);
          if (fallbackOrg) {
            organizationId = String(fallbackOrg._id);
          } else {
            return NextResponse.json(
              { error: "Your account is not linked to an organization." },
              { status: 403 },
            );
          }
        }
      }
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return NextResponse.json(
        { error: "Valid organization ID is required." },
        { status: 400 },
      );
    }

    // Verify organization exists and is active (unless super admin)
    const orgRecord = await Organization.findById(organizationId).select("status name").lean();
    if (!orgRecord) {
      return NextResponse.json(
        { error: "Organization not found." },
        { status: 404 },
      );
    }

    if (session.user.id !== "admin" && orgRecord.status === "inactive") {
      return NextResponse.json(
        { error: "Your organization is inactive. Please contact support." },
        { status: 403 },
      );
    }

    const data = await getDashboardData({
      organizationId,
      range,
      startDate,
      endDate,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to calculate dashboard data. Please try again." },
      { status: 500 },
    );
  }
}
