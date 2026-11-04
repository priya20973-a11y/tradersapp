import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { BuyingRequest, Organization } from "@/models";

function isAdminToken(token: { id?: string; role?: string } | null) {
  if (!token) return false;
  return token.id === "admin" || token.role === "Super Admin";
}

export async function GET(request: Request) {
  try {
    let token = await getToken({ req: request as Parameters<typeof getToken>[0]["req"], secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const session = await getServerSession(authOptions).catch(() => null);
      if (session?.user) {
        token = { id: session.user.id, role: session.user.role };
      }
    }
    if (!token || !isAdminToken(token)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    await connectToDatabase();

    const url = new URL(request.url);
    const adminStatus = url.searchParams.get("adminStatus") || "Pending";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));

    const filter: Record<string, unknown> = {};
    if (adminStatus === "Pending") {
      filter.$or = [
        { adminStatus: "Pending" },
        { status: "Pending" },
        { adminStatus: { $exists: false }, status: { $ne: "Approved" } },
      ];
    } else if (adminStatus === "Approved") {
      filter.$or = [
        { adminStatus: "Approved" },
        { status: "Approved" },
      ];
    } else if (adminStatus !== "all") {
      filter.adminStatus = adminStatus;
    }

    const [requests, total] = await Promise.all([
      BuyingRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BuyingRequest.countDocuments(filter),
    ]);

    // Fetch org names
    const orgIds = [...new Set(requests.map((r) => String(r.organizationId)))];
    const orgs = await Organization.find({ _id: { $in: orgIds } })
      .select("_id name tradeName")
      .lean();
    const orgMap = new Map(orgs.map((o) => [String(o._id), (((o as unknown as { tradeName?: string }).tradeName || o.name) as string)]));

    const formatted = requests.map((r) => ({
      id: String(r._id),
      requestId: r.requestId,
      organizationId: String(r.organizationId),
      organizationName: orgMap.get(String(r.organizationId)) || "Unknown",
      commodity: r.commodity,
      requiredQuantity: r.requiredQuantity,
      unit: r.unit,
      targetPrice: r.targetPrice ?? null,
      deliveryLocation: r.deliveryLocation,
      requiredDeliveryDate: r.requiredDeliveryDate,
      buyerName: r.buyerName,
      buyerCompany: r.buyerCompany,
      status: r.status || "Pending",
      adminStatus: (r as unknown as { adminStatus?: string }).adminStatus || (r.status === "Approved" ? "Approved" : "Pending"),
      offersCount: r.offersCount ?? 0,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({
      requests: formatted,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET /api/admin/buying-requests error:", error);
    return NextResponse.json({ error: "Failed to load buying requests" }, { status: 500 });
  }
}
