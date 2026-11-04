import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";

/**
 * GET /api/health
 *
 * Returns application and database health status.
 * Intentionally returns NO sensitive information (no connection strings, no env values).
 * Safe to expose publicly (used by load balancers / monitoring).
 */
export async function GET(): Promise<NextResponse> {
  const start = Date.now();

  // ── Database ping ──────────────────────────────────────────────────────────
  let dbStatus: "ok" | "degraded" | "error" = "error";
  let dbLatencyMs: number | null = null;
  let dbReadyState: number | null = null;

  try {
    await connectToDatabase();
    const dbStart = Date.now();
    // Lightweight ping — does not scan any collection
    await mongoose.connection.db?.command({ ping: 1 });
    dbLatencyMs = Date.now() - dbStart;
    dbReadyState = mongoose.connection.readyState;
    dbStatus = dbReadyState === 1 ? "ok" : "degraded";
  } catch {
    dbStatus = "error";
  }

  const totalLatencyMs = Date.now() - start;
  const overall = dbStatus === "ok" ? "ok" : "degraded";
  const httpStatus = overall === "ok" ? 200 : 503;

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      latencyMs: totalLatencyMs,
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          readyState: dbReadyState,
        },
      },
      // Intentionally minimal version info — no internal paths or secrets
      version: process.env.npm_package_version ?? "unknown",
      environment: process.env.NODE_ENV ?? "unknown",
    },
    { status: httpStatus },
  );
}
