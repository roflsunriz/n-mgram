import { resolvePageImage, type ResolvedPageImage } from '../api/client';

const MAX_MEMORY_CACHE_ENTRIES = 96;
const MAX_MEMORY_CACHE_BYTES = 160 * 1024 * 1024;
const PERSISTENT_CACHE_NAME = 'n-mgram-page-images-v1';
const MAX_PERSISTENT_CACHE_ENTRIES = 240;
const MAX_PERSISTENT_CACHE_BYTES = 384 * 1024 * 1024;
const CACHE_SIZE_HEADER = 'x-n-mgram-size';
const CACHE_ACCESSED_HEADER = 'x-n-mgram-accessed';

interface MemoryCacheEntry {
  url: string;
  blocked: boolean;
  source?: string;
  revoke?: () => void;
  byteLength: number;
  references: number;
  lastUsed: number;
  stale: boolean;
}

export interface AcquiredPageImage {
  blocked: boolean;
  source?: string;
  release: () => void;
}

const memoryCache = new Map<string, MemoryCacheEntry>();
const inFlightLoads = new Map<string, Promise<MemoryCacheEntry>>();
const persistentStores = new Map<string, Promise<void>>();
const persistentInvalidations = new Map<string, Promise<void>>();
let persistentWrites = 0;

export async function acquirePageImage(
  url: string,
  signal: AbortSignal,
): Promise<AcquiredPageImage> {
  if (signal.aborted) throw abortError();

  let entry = memoryCache.get(url);
  if (!entry || entry.stale) {
    entry = await waitForPageImage(getOrCreatePageLoad(url), signal);
  }
  if (signal.aborted) throw abortError();

  entry.references += 1;
  entry.lastUsed = Date.now();
  evictMemoryCache(entry);
  let released = false;

  return {
    blocked: entry.blocked,
    source: entry.source,
    release: () => {
      if (released) return;
      released = true;
      entry.references = Math.max(0, entry.references - 1);
      entry.lastUsed = Date.now();
      if (entry.stale && entry.references === 0) entry.revoke?.();
      evictMemoryCache();
    },
  };
}

export function invalidatePageImageCache(url: string): void {
  const entry = memoryCache.get(url);
  if (entry) retireMemoryEntry(entry);
  const invalidation = invalidatePersistentPage(url).finally(() => {
    if (persistentInvalidations.get(url) === invalidation) persistentInvalidations.delete(url);
  });
  persistentInvalidations.set(url, invalidation);
}

export async function clearPageImageCache(): Promise<void> {
  for (const entry of memoryCache.values()) retireMemoryEntry(entry);
  memoryCache.clear();
  await Promise.allSettled([...persistentStores.values(), ...persistentInvalidations.values()]);
  if (typeof globalThis.caches !== 'undefined') {
    try {
      await globalThis.caches.delete(PERSISTENT_CACHE_NAME);
    } catch {
      // Cache Storage is opportunistic; memory caching remains available.
    }
  }
}

export function getPageImageCacheStats() {
  return {
    entries: memoryCache.size,
    bytes: [...memoryCache.values()].reduce((total, entry) => total + entry.byteLength, 0),
    inFlight: inFlightLoads.size,
  };
}

function getOrCreatePageLoad(url: string): Promise<MemoryCacheEntry> {
  const current = inFlightLoads.get(url);
  if (current) return current;

  const load = loadPageImage(url)
    .then((result) => {
      const existing = memoryCache.get(url);
      if (existing && !existing.stale) {
        result.revoke?.();
        return existing;
      }
      const entry: MemoryCacheEntry = {
        url,
        blocked: result.blocked,
        source: result.source,
        revoke: result.revoke,
        byteLength: result.byteLength ?? result.blob?.size ?? 0,
        references: 0,
        lastUsed: Date.now(),
        stale: false,
      };
      memoryCache.set(url, entry);
      if (!result.blocked && result.blob) void storePersistentPage(url, result.blob);
      return entry;
    })
    .finally(() => inFlightLoads.delete(url));
  inFlightLoads.set(url, load);
  return load;
}

async function loadPageImage(url: string): Promise<ResolvedPageImage> {
  await persistentInvalidations.get(url);
  const persistent = await loadPersistentPage(url);
  if (persistent) return persistent;
  return resolvePageImage(url, new AbortController().signal);
}

function waitForPageImage(
  load: Promise<MemoryCacheEntry>,
  signal: AbortSignal,
): Promise<MemoryCacheEntry> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void load.then(
      (entry) => {
        signal.removeEventListener('abort', onAbort);
        if (signal.aborted) reject(abortError());
        else resolve(entry);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function evictMemoryCache(protectedEntry?: MemoryCacheEntry): void {
  let bytes = [...memoryCache.values()].reduce((total, entry) => total + entry.byteLength, 0);
  if (memoryCache.size <= MAX_MEMORY_CACHE_ENTRIES && bytes <= MAX_MEMORY_CACHE_BYTES) return;

  const candidates = [...memoryCache.values()]
    .filter((entry) => entry !== protectedEntry && entry.references === 0)
    .sort((left, right) => left.lastUsed - right.lastUsed);
  for (const entry of candidates) {
    if (memoryCache.size <= MAX_MEMORY_CACHE_ENTRIES && bytes <= MAX_MEMORY_CACHE_BYTES) break;
    bytes -= entry.byteLength;
    retireMemoryEntry(entry);
  }
}

function retireMemoryEntry(entry: MemoryCacheEntry): void {
  if (memoryCache.get(entry.url) === entry) memoryCache.delete(entry.url);
  entry.stale = true;
  if (entry.references === 0) entry.revoke?.();
}

async function loadPersistentPage(url: string): Promise<ResolvedPageImage | undefined> {
  if (typeof globalThis.caches === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return undefined;
  }
  try {
    const cache = await globalThis.caches.open(PERSISTENT_CACHE_NAME);
    const response = await cache.match(url);
    if (!response) return undefined;
    const blob = await response.blob();
    if (blob.size === 0 || !blob.type.startsWith('image/')) {
      await cache.delete(url);
      return undefined;
    }
    const source = URL.createObjectURL(blob);
    void storePersistentPage(url, blob);
    return {
      blocked: false,
      source,
      blob,
      byteLength: blob.size,
      revoke: () => URL.revokeObjectURL(source),
    };
  } catch {
    return undefined;
  }
}

async function storePersistentPage(url: string, blob: Blob): Promise<void> {
  const store = writePersistentPage(url, blob).finally(() => {
    if (persistentStores.get(url) === store) persistentStores.delete(url);
  });
  persistentStores.set(url, store);
  await store;
}

async function writePersistentPage(url: string, blob: Blob): Promise<void> {
  if (typeof globalThis.caches === 'undefined') return;
  try {
    const cache = await globalThis.caches.open(PERSISTENT_CACHE_NAME);
    await cache.put(
      url,
      new Response(blob, {
        headers: {
          'Content-Type': blob.type,
          [CACHE_SIZE_HEADER]: String(blob.size),
          [CACHE_ACCESSED_HEADER]: String(Date.now()),
        },
      }),
    );
    persistentWrites += 1;
    if (persistentWrites === 1 || persistentWrites % 16 === 0) void trimPersistentCache(cache);
  } catch {
    // Quota and WebView Cache Storage failures fall back to the bounded memory cache.
  }
}

async function invalidatePersistentPage(url: string): Promise<void> {
  await persistentStores.get(url);
  await deletePersistentPage(url);
}

async function deletePersistentPage(url: string): Promise<void> {
  if (typeof globalThis.caches === 'undefined') return;
  try {
    const cache = await globalThis.caches.open(PERSISTENT_CACHE_NAME);
    await cache.delete(url);
  } catch {
    // Nothing else is required when persistent caching is unavailable.
  }
}

async function trimPersistentCache(cache: Cache): Promise<void> {
  try {
    const requests = await cache.keys();
    const entries = await Promise.all(
      requests.map(async (request) => {
        const response = await cache.match(request);
        return {
          request,
          size: Number(response?.headers.get(CACHE_SIZE_HEADER) ?? 0),
          accessed: Number(response?.headers.get(CACHE_ACCESSED_HEADER) ?? 0),
        };
      }),
    );
    entries.sort((left, right) => left.accessed - right.accessed);
    let bytes = entries.reduce((total, entry) => total + entry.size, 0);
    let count = entries.length;
    for (const entry of entries) {
      if (count <= MAX_PERSISTENT_CACHE_ENTRIES && bytes <= MAX_PERSISTENT_CACHE_BYTES) break;
      if (await cache.delete(entry.request)) {
        count -= 1;
        bytes -= entry.size;
      }
    }
  } catch {
    // Cache maintenance is best-effort and must never block image display.
  }
}

function abortError(): DOMException {
  return new DOMException('Image load aborted', 'AbortError');
}
