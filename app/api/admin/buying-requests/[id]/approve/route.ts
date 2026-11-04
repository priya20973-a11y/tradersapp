import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { BuyingRequest, AuditEvent } from "@/models";

function isAdminToken(token: { id?: string; role?: string } | null) {
  if (!token) return false;
  return token.id === "admin" || token.role === "Super Admin";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid buying request ID" }, { status: 400 });
    }

    let token: { id?: string; role?: string } | null = await getToken({ req: request as Parameters<typeof getToken>[0]["req"], secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const session = await getServerSession(authOptions).catch(() => null);
      if (session?.user) {
        const user = session.user as { id?: string; role?: string };
        token = { id: user.id, role: user.role };
      }
    }
    if (!token || !isAdminToken(token)) {
      return NextResponse.json(
        { error: "Admin access required. Only administrators can approve buying requests." },
        { status: 403 },
      );
    }

    await connectToDatabase();

    const existingReq = await BuyingRequest.findById(id);
    if (!existingReq) {
      return NextResponse.json({ error: "Buying request not found" }, { status: 404 });
    }

    const currentAdminStatus = (existingReq as unknown as { adminStatus?: string }).adminStatus;
    const isAlreadyApproved = currentAdminStatus === "Approved" || existingReq.status === "Approved";
    if (isAlreadyApproved) {
      return NextResponse.json(
        { error: "This buying request has already been approved." },
        { status: 409 },
      );
    }

    await BuyingRequest.findByIdAndUpdate(id, {
      $set: {
        adminStatus: "Approved",
        status: "Approved",
      },
    });

    // Record audit event
    try {
      await AuditEvent.create({
        organizationId: existingReq.organizationId,
        actorId: String(token.id),
        action: "buying_request.admin_approved",
        entityType: "BuyingRequest",
        entityId: id,
        changes: {
          adminStatus: "Approved",
          status: "Approved",
          previousStatus: existingReq.status || "Pending",
        },
        occurredAt: new Date(),
      });
    } catch (auditErr) {
      console.error("Failed to record admin approval audit:", auditErr);
    }

    return NextResponse.json({
      ok: true,
      message: `Buying request ${(existingReq as unknown as { requestId: string }).requestId} has been approved successfully.`,
    });
  } catch (error) {
    console.error("POST /api/admin/buying-requests/[id]/approve error:", error);
    return NextResponse.json({ error: "Failed to approve buying request" }, { status: 500 });
  }
}

