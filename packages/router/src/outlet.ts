// packages/router/src/outlet.ts
//
// پردازشگر <zen-router> — فاز ۸ + Route Cache + Prefetch (فاز ۵ بحرانی).
//
// بهبودها:
//   - Route Cache: صفحات fetch شده در حافظه نگه داشته می‌شوند.
//   - Prefetch Engine: لینک‌های zen-link روی hover prefetch می‌شوند.
//   - Stale Check: صفحات cache شده بعد از staleTime دوباره fetch می‌شوند.

import { effect } from '@zenith/state';
import { routeSignal, findMatchingRoute, setRouteParams, registerRouterCleanup } from './router';

interface RouteDefinition { path: string; src: string; }
interface FetchResult { ok: boolean; html: string; status: number; }

// ── Route Cache (BUG-RTR-04: Proper LRU) ──
interface CacheEntry { html: string; }
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * BUG-RTR-04 (v1.3.0): Proper LRU cache using Map insertion order.
 *
 * Previously the cache used a plain Map<string, CacheEntry> with a
 * timestamp field. When the cache exceeded MAX_ROUTE_CACHE_SIZE (50),
 * it scanned *every* entry (O(n)) to find the oldest one by timestamp
 * and evicted a single entry. This had two problems:
 *   1. O(n) eviction — wasteful when n reaches the cap on every insert.
 *   2. LRU semantics were broken: frequently accessed entries could
 *      be evicted if they happened to have an old timestamp, because
 *      `get()` did not update the timestamp.
 *
 * The fix uses `delete + set` on every `get()` to move the accessed
 * entry to the *end* of the Map's insertion-order linked list. Eviction
 * then removes the *first* key (Map.prototype.keys().next().value),
 * which is the least-recently-used entry — O(1).
 *
 * The `timestamp` field is no longer needed on CacheEntry because LRU
 * ordering is tracked purely by Map key order. Stale checking still
 * uses a separate timestamp Map.
 */
class LRUCache<V> {
  private _map = new Map<string, V>();
  private _timestamps = new Map<string, number>();
  private _maxSize: number;

  constructor(maxSize: number) {
    this._maxSize = maxSize;
  }

  get size(): number { return this._map.size; }

  has(key: string): boolean { return this._map.has(key); }

  get(key: string): V | undefined {
    if (!this._map.has(key)) return undefined;
    // Move to end (most-recently-used position) by delete+set
    const value = this._map.get(key)!;
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    // If key already exists, delete first so re-insert lands at end
    if (this._map.has(key)) {
      this._map.delete(key);
    }
    this._map.set(key, value);
    this._timestamps.set(key, Date.now());
    // Evict least-recently-used (first key) when over capacity
    if (this._map.size > this._maxSize) {
      const lruKey = this._map.keys().next().value;
      if (lruKey !== undefined) {
        this._map.delete(lruKey);
        this._timestamps.delete(lruKey);
      }
    }
  }

  getTimestamp(key: string): number | undefined {
    return this._timestamps.get(key);
  }

  delete(key: string): void {
    this._map.delete(key);
    this._timestamps.delete(key);
  }

  clear(): void {
    this._map.clear();
    this._timestamps.clear();
  }
}

const routeCache = new LRUCache<CacheEntry>(50 /* MAX_ROUTE_CACHE_SIZE */);

function readRouteDefinitions(el: HTMLElement): RouteDefinition[] {
  const routeEls = Array.from(el.querySelectorAll('zen-route'));
  const routes: RouteDefinition[] = [];
  for (const routeEl of routeEls) {
    const path = routeEl.getAttribute('path') || '';
    const src = routeEl.getAttribute('src') || '';
    if (path && src) routes.push({ path, src });
  }
  return routes;
}

async function fetchPage(src: string, signal?: AbortSignal): Promise<FetchResult> {
  try {
    // FIX (v1.2.7): pass AbortSignal to fetch so navigating away mid-flight
    // actually cancels the network request, instead of letting it complete
    // and then discarding the result via the loadId check.
    const res = await fetch(src, signal ? { signal } : undefined);
    if (!res.ok) return { ok: false, html: '', status: res.status };
    const html = await res.text();
    // Cache the result
    // BUG-RTR-04 (v1.3.0): LRUCache now handles eviction internally (O(1)),
    // removing the least-recently-used entry when the cache exceeds capacity.
    // Previously this was O(n) scanning all entries for the lowest timestamp,
    // which both caused latency spikes and evicted the wrong entries
    // (timestamp-only vs actual recency-of-access).
    routeCache.set(src, { html });
    return { ok: true, html, status: res.status };
  } catch (err) {
    // FIX (v1.2.7): silently ignore AbortError — it is expected when the
    // user navigates again before the previous fetch completes.
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, html: '', status: 0 };
    }
    console.error(`[Zenith Router] Failed to fetch "${src}":`, err);
    return { ok: false, html: '', status: 0 };
  }
}

async function fetchPageCached(src: string, signal?: AbortSignal): Promise<FetchResult> {
  const cached = routeCache.get(src);
  if (cached) {
    // BUG-RTR-04 (v1.3.0): Timestamp is stored separately in the LRU cache.
    const entryTime = routeCache.getTimestamp(src) ?? Date.now();
    const age = Date.now() - entryTime;
    if (age < DEFAULT_STALE_TIME) {
      return { ok: true, html: cached.html, status: 200 };
    }
    // Stale — re-fetch in background, return cached for now.
    fetchPage(src); // fire and forget — updates cache
    return { ok: true, html: cached.html, status: 200 };
  }
  return fetchPage(src, signal);
}

function cleanupCurrentContent(el: HTMLElement, disposes: (() => void)[]): void {
  for (const d of disposes) { try { d(); } catch (err) { console.error('[Zenith Router] Dispose error:', err); } }
  disposes.length = 0;
  el.innerHTML = '';
}

// ── Prefetch Engine ──
const prefetchedUrls = new Set<string>();

export function prefetchRoute(src: string): void {
  if (prefetchedUrls.has(src)) return;
  prefetchedUrls.add(src);
  // Fetch and cache silently
  fetchPage(src).catch(() => {});
}

// Setup prefetch on zen-link hover
let prefetchInstalled = false;
// BUG-RTR-03 (v1.3.0): Store handler reference so we can removeEventListener
// during cleanupRouter(). Without this the mouseover listener survives on
// the document after HMR or page teardown, leaking DOM references.
let _prefetchMouseoverHandler: ((e: MouseEvent) => void) | null = null;
export function installPrefetch(): void {
  if (prefetchInstalled) return;
  if (typeof document === 'undefined') return;
  prefetchInstalled = true;

  _prefetchMouseoverHandler = (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    const link = target.closest('[zen-link]') as HTMLElement | null;
    if (!link) return;
    const path = link.getAttribute('zen-link') || link.getAttribute('href');
    if (!path) return;
    // Find matching route src and prefetch
    // We can't access routes here, so we use a global registry
    const src = routeSrcRegistry.get(path);
    if (src) prefetchRoute(src);
  };
  document.addEventListener('mouseover', _prefetchMouseoverHandler, { passive: true });
}

// Registry: path → src (for prefetch)
const routeSrcRegistry = new Map<string, string>();

export function processRouter(
  el: HTMLElement,
  processChildren: (node: HTMLElement, disposes: (() => void)[]) => void,
  parentDisposes: (() => void)[],
): void {
  const routes = readRouteDefinitions(el);
  if (routes.length === 0) { console.warn('[Zenith Router] No routes found.'); return; }

  // Register route srcs for prefetch
  for (const r of routes) {
    if (r.path !== '**') routeSrcRegistry.set(r.path, r.src);
  }

  // Install prefetch listener
  installPrefetch();

  el.innerHTML = '';
  const currentDisposes: (() => void)[] = [];
  let currentLoadId = 0;
  // FIX (v1.2.7): AbortController for lazy-loading race. When a new
  // navigation starts, the previous in-flight fetch is aborted so its
  // response cannot overwrite the newer route's content.
  let currentAbort: AbortController | null = null;

  const disposeEffect = effect(() => {
    const routeState = routeSignal.get();
    const currentPath = routeState.path;
    const match = findMatchingRoute(routes, currentPath);

    if (!match) {
      cleanupCurrentContent(el, currentDisposes);
      el.innerHTML = '<div class="zen-router-404"><h1>404</h1><p>Route not found.</p></div>';
      return;
    }

    const { route, params } = match;
    const currentParams = routeSignal.get().params;
    if (JSON.stringify(currentParams) !== JSON.stringify(params)) {
      setRouteParams(params);
      return;
    }

    const loadId = ++currentLoadId;
    // FIX (v1.2.7): abort the previous in-flight fetch before starting a
    // new one. The signal is forwarded to fetchPageCached → fetchPage → fetch.
    if (currentAbort) {
      try { currentAbort.abort(); } catch { /* ignore */ }
    }
    currentAbort = new AbortController();
    const signal = currentAbort.signal;

    cleanupCurrentContent(el, currentDisposes);

    // Check cache first — if cached, render immediately (no loading flash)
    const cached = routeCache.get(route.src);
    if (cached) {
      el.innerHTML = cached.html;
      for (const child of Array.from(el.children)) {
        processChildren(child as HTMLElement, currentDisposes);
      }
      // Re-fetch in background if stale
      // BUG-RTR-04 (v1.3.0): Timestamp is stored separately in the LRU cache.
      const entryTime = routeCache.getTimestamp(route.src) ?? Date.now();
      if (Date.now() - entryTime > DEFAULT_STALE_TIME) {
        (async () => {
          const result = await fetchPage(route.src, signal);
          if (loadId !== currentLoadId) return;
          if (result.ok && result.html !== cached.html) {
            cleanupCurrentContent(el, currentDisposes);
            el.innerHTML = result.html;
            for (const child of Array.from(el.children)) {
              processChildren(child as HTMLElement, currentDisposes);
            }
          }
        })();
      }
      return;
    }

    // Not cached — show loading
    el.innerHTML = '<div class="zen-router-loading">Loading...</div>';

    (async () => {
      const result = await fetchPageCached(route.src, signal);
      if (loadId !== currentLoadId) return;
      cleanupCurrentContent(el, currentDisposes);
      if (!result.ok) {
        el.innerHTML = `<div class="zen-router-error"><h1>Error ${result.status}</h1></div>`;
        return;
      }
      el.innerHTML = result.html;
      for (const child of Array.from(el.children)) {
        processChildren(child as HTMLElement, currentDisposes);
      }
    })();
  });

  parentDisposes.push(() => {
    // FIX (v1.2.7): abort any in-flight fetch on teardown too.
    if (currentAbort) {
      try { currentAbort.abort(); } catch { /* ignore */ }
      currentAbort = null;
    }
    cleanupCurrentContent(el, currentDisposes);
    disposeEffect();
  });
}

/** Clear route cache (for HMR or manual refresh). */
export function clearRouteCache(): void {
  routeCache.clear();
  prefetchedUrls.clear();
  // BUG-RTR-03 (v1.3.0): Also clean up prefetch mouseover handler
  // so that teardown does not leave a stale listener on the document.
  if (_prefetchMouseoverHandler && typeof document !== 'undefined') {
    document.removeEventListener('mouseover', _prefetchMouseoverHandler);
    _prefetchMouseoverHandler = null;
    prefetchInstalled = false;
  }
}

// BUG-RTR-03 (v1.3.0): Register cleanup callbacks with the router so that
// cleanupRouter() properly tears down everything outlet.ts has set up.
try {
  registerRouterCleanup(() => {
    clearRouteCache();
    routeSrcRegistry.clear();
  });
} catch {
  // registerRouterCleanup may not be exported in all build configs
}
