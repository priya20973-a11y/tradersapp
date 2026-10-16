import { NextResponse } from "next/server";
import { getTradingScope, tradingDatabaseUnavailable } from "@/lib/trading-access";
import { AuditEvent } from "@/models";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scopeResult = await getTradingScope(
      url.searchParams.get("organizationId") ?? undefined,
      "view-audit-logs",
    );
    if ("response" in scopeResult) return scopeResult.response;
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
    const filter: Record<string, unknown> = { organizationId: scopeResult.scope.organizationId };
    const entityType = url.searchParams.get("entityType")?.slice(0, 50);
    const action = url.searchParams.get("action")?.slice(0, 80);
    if (entityType) filter.entityType = entityType;
    if (action) filter.action = { $regex: action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const [events, total] = await Promise.all([
      AuditEvent.find(filter).sort({ occurredAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditEvent.countDocuments(filter),
    ]);
    return NextResponse.json({
      events: events.map((event) => ({
        id: String(event._id),
        actorId: event.actorId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        changes: event.changes,
        occurredAt: event.occurredAt,
      })),
      page,
      limit,
      total,
    });
  } catch (error) {
    return tradingDatabaseUnavailable(error);
  }
}
