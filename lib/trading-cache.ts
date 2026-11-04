/**
 * Client-side in-memory cache and request deduplicator for /api/trading/organizations.
 * Prevents redundant database queries and waterfalls when navigating across trading tabs
 * (warehouses, stock lots, traders).
 */

export type OrganizationOption = {
  id: string;
  name: string;
};

export type TradingOrganizationsResponse = {
  organizations: OrganizationOption[];
  isAdmin: boolean;
};

let cachedOrganizations: {
  data: TradingOrganizationsResponse;
  timestamp: number;
} | null = null;

let inFlightPromise: Promise<TradingOrganizationsResponse> | null = null;
const DEFAULT_TTL_MS = 60_000; // 60 seconds

export async function getCachedTradingOrganizations(
  options: { force?: boolean; ttlMs?: number } = {},
): Promise<TradingOrganizationsResponse> {
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();

  // Return fresh cache if available
  if (!options.force && cachedOrganizations && now - cachedOrganizations.timestamp < ttl) {
    return cachedOrganizations.data;
  }

  // Deduplicate concurrent requests
  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const response = await fetch("/api/trading/organizations");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to load organizations.");
      }
      const result: TradingOrganizationsResponse = {
        organizations: data.organizations || [],
        isAdmin: Boolean(data.isAdmin),
      };
      cachedOrganizations = { data: result, timestamp: Date.now() };
      return result;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

export function invalidateTradingOrganizationsCache(): void {
  cachedOrganizations = null;
  inFlightPromise = null;
}
