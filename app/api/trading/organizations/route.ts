import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions, canAccessRole } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { tradingDatabaseUnavailable } from "@/lib/trading-access";
import { Organization } from "@/models";

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Sign in to access trading." }, { status: 401 });
  if (!canAccessRole(user.role, "view-traders")) {
    return NextResponse.json({ error: "You do not have permission to view trading data." }, { status: 403 });
  }
  try {
    await connectToDatabase();
    const organizations = user.id === "admin"
      ? await Organization.find({ status: "active" }).select("_id name").sort({ name: 1 }).lean()
      : user.organizationId
        ? await Organization.find({ _id: user.organizationId, status: "active" }).select("_id name").lean()
        : [];
    return NextResponse.json({
      organizations: organizations.map((organization) => ({ id: String(organization._id), name: organization.name })),
      isAdmin: user.id === "admin",
    });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}
