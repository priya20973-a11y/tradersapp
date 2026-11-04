/**
 * Client-side in-memory cache and request deduplicator for /api/sales.
 * Prevents redundant server hops and duplicate database queries when navigating
 * between sales submodules (customers, quotes, orders, invoices, etc.).
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const salesCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const DEFAULT_TTL_MS = 30_000; // 30 seconds cache freshness

export async function fetchCachedSales<T = unknown>(
  query: string = "",
  options: { force?: boolean; ttlMs?: number } = {},
): Promise<T> {
  const cacheKey = query.trim();
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();

  // 1. Check existing fresh cache entry
  if (!options.force) {
    const cached = salesCache.get(cacheKey);
    if (cached && now - cached.timestamp < ttl) {
      return cached.data as T;
    }
  }

  // 2. Deduplicate concurrent in-flight requests
  const existingPromise = inFlightRequests.get(cacheKey);
  if (existingPromise) {
    return existingPromise as Promise<T>;
  }

  // 3. Perform network fetch
  const url = `/api/sales${cacheKey ? (cacheKey.startsWith("?") ? cacheKey : `?${cacheKey}`) : ""}`;
  const fetchPromise = (async () => {
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to load sales data.");
      }
      salesCache.set(cacheKey, { data, timestamp: Date.now() });
      return data as T;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Invalidate the sales cache after mutations (create, update, status change).
 */
export function invalidateSalesCache(): void {
  salesCache.clear();
  inFlightRequests.clear();
}
