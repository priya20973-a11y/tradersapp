import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { CustomReport, type CustomReportRecord } from "@/models";

function respondError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// GET all saved custom report configurations for current organization
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to access saved reports.", 401);
    }

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId");
    let organizationId = session.user.organizationId;
    if (session.user.id === "admin" && requestedOrgId && isValidObjectId(requestedOrgId)) {
      organizationId = requestedOrgId;
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    const reports = await CustomReport.find({ organizationId: orgObjId })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      ok: true,
      reports: reports.map((r) => ({
        id: String(r._id),
        name: r.name,
        description: r.description || "",
        module: r.module,
        columns: r.columns || [],
        filters: r.filters || {},
        sort: r.sort || { field: "createdAt", direction: "desc" },
        groupBy: r.groupBy || "",
        lastRunAt: r.lastRunAt,
        runCount: r.runCount || 0,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (error: unknown) {
    console.error("Fetch saved reports error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch saved reports.";
    return respondError(message, 500);
  }
}

// POST new custom report configuration
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return respondError("Sign in to save custom reports.", 401);
    }

    let payload: Record<string, unknown>;
    try {
      payload = await request.json();
    } catch {
      return respondError("Valid JSON payload required.", 400);
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !isValidObjectId(organizationId)) {
      return respondError("Valid organization ID is required.", 400);
    }

    const name = String(payload.name || "").trim();
    if (!name) {
      return respondError("Report name is required.", 400);
    }

    const reportModule = payload.module as CustomReportRecord["module"];
    if (!reportModule) {
      return respondError("Module selection is required.", 400);
    }

    await connectToDatabase();
    const orgObjId = new Types.ObjectId(organizationId);

    const created = (await CustomReport.create({
      organizationId: orgObjId,
      userId: session.user.id && isValidObjectId(session.user.id) ? new Types.ObjectId(session.user.id) : undefined,
      name,
      description: String(payload.description || "").trim(),
      module: reportModule,
      columns: Array.isArray(payload.columns) ? (payload.columns as CustomReportRecord["columns"]) : [],
      filters: (payload.filters as CustomReportRecord["filters"]) || {},
      sort: (payload.sort as CustomReportRecord["sort"]) || { field: "createdAt", direction: "desc" },
      groupBy: typeof payload.groupBy === "string" ? payload.groupBy : "",
      runCount: 0,
      lastRunAt: new Date(),
    })) as unknown as { _id: Types.ObjectId };

    return NextResponse.json(
      {
        ok: true,
        id: String(created._id),
        message: "Report configuration saved successfully.",
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Save custom report error:", error);
    const message = error instanceof Error ? error.message : "Failed to save report configuration.";
    return respondError(message, 500);
  }
}
