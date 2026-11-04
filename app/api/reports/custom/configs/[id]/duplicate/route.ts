import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { CustomReport } from "@/models";

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return respondError("Invalid report ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to duplicate report.", 401);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    const original = await CustomReport.findOne({
      _id: new Types.ObjectId(id),
      organizationId: orgObjId,
    });

    if (!original) {
      return respondError("Report not found to duplicate.", 404);
    }

    const duplicated = await CustomReport.create({
      organizationId: orgObjId,
      userId: session.user.id && isValidObjectId(session.user.id) ? new Types.ObjectId(session.user.id) : undefined,
      name: `Copy of ${original.name}`,
      description: original.description ? `(Duplicate) ${original.description}` : "",
      module: original.module,
      columns: original.columns,
      filters: original.filters,
      sort: original.sort,
      groupBy: original.groupBy,
      runCount: 0,
      lastRunAt: undefined,
    });

    return NextResponse.json({
      ok: true,
      id: String((duplicated as unknown as { _id: Types.ObjectId })._id),
      report: duplicated,
      message: `Duplicated as "Copy of ${original.name}".`,
    });
  } catch (error: unknown) {
    return respondError(error instanceof Error ? error.message : "Failed to duplicate report.", 500);
  }
}
