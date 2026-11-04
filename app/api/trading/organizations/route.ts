import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { tradingDatabaseUnavailable } from "@/lib/trading-access";
import { Organization } from "@/models";
import { AppError } from "@/lib/errors";

export async function GET(request: Request) {
  let authUser;
  try {
    authUser = await requirePermission("view-traders", request);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const organizations = authUser.id === "admin"
      ? await Organization.find({ status: "active" }).select("_id name").sort({ name: 1 }).lean()
      : authUser.organizationId
        ? await Organization.find({ _id: authUser.organizationId, status: "active" }).select("_id name").lean()
        : [];
    return NextResponse.json(
      {
        organizations: organizations.map((organization) => ({ id: String(organization._id), name: organization.name })),
        isAdmin: authUser.id === "admin",
      },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        },
      },
    );
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}
