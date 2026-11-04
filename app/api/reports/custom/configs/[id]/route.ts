import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { CustomReport } from "@/models";
import { REPORT_MODULES } from "@/lib/custom-reports/modules";

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// GET single saved report configuration
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return respondError("Invalid report ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to access report.", 401);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);
    const report = await CustomReport.findOne({
      _id: new Types.ObjectId(id),
      organizationId: orgObjId,
    }).lean();

    if (!report) {
      return respondError("Saved report configuration not found.", 404);
    }

    return NextResponse.json({
      ok: true,
      report: {
        id: String(report._id),
        name: report.name,
        description: report.description || "",
        module: report.module,
        columns: report.columns || [],
        filters: report.filters || {},
        sort: report.sort || { field: "createdAt", direction: "desc" },
        groupBy: report.groupBy || "",
        lastRunAt: report.lastRunAt,
        runCount: report.runCount || 0,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      },
    });
  } catch (error: unknown) {
    return respondError(error instanceof Error ? error.message : "Failed to fetch report.", 500);
  }
}

// PUT update saved report configuration
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return respondError("Invalid report ID.", 400);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to update report.", 401);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return respondError("Valid JSON payload required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    const report = await CustomReport.findOne({
      _id: new Types.ObjectId(id),
      organizationId: orgObjId,
    });

    if (!report) {
      return respondError("Saved report configuration not found.", 404);
    }

    if (payload.name) report.name = String(payload.name).trim();
    if (payload.description !== undefined) report.description = String(payload.description).trim();
    if (typeof payload.module === "string") {
      const targetModule = REPORT_MODULES.find((entry) => entry.id === payload.module);
      if (targetModule) report.module = targetModule.id;
    }
    if (Array.isArray(payload.columns)) report.columns = payload.columns as typeof report.columns;
    if (payload.filters) report.filters = payload.filters as typeof report.filters;
    if (payload.sort) report.sort = payload.sort as typeof report.sort;
    if (payload.groupBy !== undefined) report.groupBy = payload.groupBy as string;
    if (payload.incrementRun) {
      report.runCount = (report.runCount || 0) + 1;
      report.lastRunAt = new Date();
    }

    await report.save();

    return NextResponse.json({
      ok: true,
      id: String(report._id),
      message: "Report configuration updated.",
    });
  } catch (error: unknown) {
    return respondError(error instanceof Error ? error.message : "Failed to update report.", 500);
  }
}

// DELETE saved report configuration
export async function DELETE(
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
      return respondError("Sign in to delete report.", 401);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    const result = await CustomReport.deleteOne({
      _id: new Types.ObjectId(id),
      organizationId: orgObjId,
    });

    if (result.deletedCount === 0) {
      return respondError("Saved report configuration not found.", 404);
    }

    return NextResponse.json({
      ok: true,
      message: "Report configuration deleted successfully.",
    });
  } catch (error: unknown) {
    return respondError(error instanceof Error ? error.message : "Failed to delete report.", 500);
  }
}
