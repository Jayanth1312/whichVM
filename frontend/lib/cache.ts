const CACHE_NAME = "whichvm-data-v1";
const DEFAULT_TTL = 6 * 60 * 60 * 1000; // 6 hours

// ─── Data Cache (Cache API) ─────────────────────────────────────

export async function cachedFetch(
  url: string,
  ttlMs: number = DEFAULT_TTL,
): Promise<Response> {
  if (typeof caches === "undefined") {
    return fetch(url);
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url);

    if (cached) {
      const cachedAt = cached.headers.get("x-whichvm-cached-at");
      if (cachedAt) {
        const age = Date.now() - parseInt(cachedAt, 10);
        if (age < ttlMs) {
          return cached;
        }
      }
    }

    // Cache miss or expired — fetch from network
    const networkResponse = await fetch(url);

    if (networkResponse.ok) {
      // Clone the response so we can read it AND cache it
      const cloned = networkResponse.clone();
      const body = await cloned.arrayBuffer();

      // Re-create the response with our timestamp header
      const headers = new Headers(cloned.headers);
      headers.set("x-whichvm-cached-at", String(Date.now()));

      const cachedResponse = new Response(body, {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      });

      // Don't await — cache in background
      cache.put(url, cachedResponse).catch(() => {});
    }

    return networkResponse;
  } catch {
    // If Cache API fails for any reason, fall back to network
    return fetch(url);
  }
}

/**
 * Pre-warm the cache for a given URL (background, non-blocking).
 */
export function prefetchData(url: string): void {
  if (typeof caches === "undefined") return;
  cachedFetch(url).catch(() => {});
}

// ─── Filter State Persistence (localStorage) ────────────────────

const FILTER_STATE_PREFIX = "whichvm-filters-";

export interface PersistedFilterState {
  region?: string;
  pricing?: string;
  currency?: string;
  pricingUnit?: string;
  reservedPlan?: string;
  azureHybridBenefit?: string;
  columnFilters?: { id: string; value: unknown }[];
  sorting?: { id: string; desc: boolean }[];
  columnVisibility?: Record<string, boolean>;
  timestamp?: number;
}

function getFilterKey(provider: string): string {
  return `${FILTER_STATE_PREFIX}${provider.toLowerCase()}`;
}

export function saveFilterState(
  provider: string,
  state: PersistedFilterState,
): void {
  try {
    const key = getFilterKey(provider);
    const payload = { ...state, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
  }
}

export function loadFilterState(
  provider: string,
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000,
): PersistedFilterState | null {
  try {
    const key = getFilterKey(provider);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed: PersistedFilterState = JSON.parse(raw);
    if (parsed.timestamp && Date.now() - parsed.timestamp > maxAgeMs) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearAllCache(): Promise<void> {
  if (typeof caches !== "undefined") {
    await caches.delete(CACHE_NAME).catch(() => {});
  }

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(FILTER_STATE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}
