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

// ─── Decoded Data Cache (IndexedDB) ─────────────────────────────
// Caches fully decoded instance arrays so page reloads skip decompress + decode.

const IDB_NAME = "whichvm-decoded-v1";
const IDB_STORE = "instances";
const IDB_TTL = DEFAULT_TTL; // same 6-hour TTL
const DECODED_INDEX_KEY = "whichvm-decoded-keys";

let idbPromise: Promise<IDBDatabase> | null = null;

function openDecodedDB(): Promise<IDBDatabase> {
  if (idbPromise) return idbPromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }

  idbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      idbPromise = null;
      reject(request.error);
    };
  });

  return idbPromise;
}

/**
 * Synchronously check if decoded data exists for a key (uses localStorage index).
 * This allows components to initialize `isLoading = false` without async.
 */
export function isDecodedCached(key: string): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    const raw = localStorage.getItem(DECODED_INDEX_KEY);
    if (!raw) return false;
    const index: Record<string, number> = JSON.parse(raw);
    const ts = index[key];
    if (!ts) return false;
    return Date.now() - ts < IDB_TTL;
  } catch {
    return false;
  }
}

function markDecodedCached(key: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(DECODED_INDEX_KEY);
    const index: Record<string, number> = raw ? JSON.parse(raw) : {};
    index[key] = Date.now();
    localStorage.setItem(DECODED_INDEX_KEY, JSON.stringify(index));
  } catch {}
}

/**
 * Get decoded instances from IndexedDB. Returns null on miss or expiry.
 */
export async function getDecodedInstances(key: string): Promise<any[] | null> {
  try {
    const db = await openDecodedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const request = store.get(key);
      request.onsuccess = () => {
        const entry = request.result;
        if (!entry || !entry.data) {
          resolve(null);
          return;
        }
        // Check TTL
        if (entry.timestamp && Date.now() - entry.timestamp > IDB_TTL) {
          resolve(null);
          return;
        }
        resolve(entry.data);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Store decoded instances in IndexedDB for instant access on reload.
 * Non-blocking — fire-and-forget.
 */
export function setDecodedInstances(key: string, data: any[]): void {
  openDecodedDB()
    .then((db) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.put({ data, timestamp: Date.now() }, key);
      markDecodedCached(key);
    })
    .catch(() => {});
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
  } catch {}
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

  // Clear IndexedDB decoded cache
  try {
    if (typeof indexedDB !== "undefined") {
      indexedDB.deleteDatabase(IDB_NAME);
      idbPromise = null;
    }
  } catch {}

  // Clear decoded cache index
  try {
    localStorage.removeItem(DECODED_INDEX_KEY);
  } catch {}

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(FILTER_STATE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}
