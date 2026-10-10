// packages/router/src/outlet.ts
//
// پردازشگر <zen-router> — فاز ۸ + Route Cache + Prefetch (فاز ۵ بحرانی).
//
// بهبودها:
//   - Route Cache: صفحات fetch شده در حافظه نگه داشته می‌شوند.
//   - Prefetch Engine: لینک‌های zen-link روی hover prefetch می‌شوند.
//   - Stale Check: صفحات cache شده بعد از staleTime دوباره fetch می‌شوند.

import { effect } from '@zenith/state';
import { createCache } from '@zenith/cache';
import { routeSignal, findMatchingRoute, setRouteParams, registerRouterCleanup } from './router';

interface RouteDefinition {
  path: string;
  src: string;
}
interface FetchResult {
  ok: boolean;
  html: string;
  status: number;
}

// ── Route Cache ──
// #144: کلاس LRU دستی این فایل (BUG-RTR-04) حذف شد و @zenith/cache (L0،
// policy='lru'، maxSize=50) جایش آمد. استمپ زمانیِ stale-check در Map
// جداگانه می‌ماند چون @zenith/cache استمپ per-entry بیرونی ندارد (contract
// SPEC §۲.۴ فقط ttl/isStale می‌دهد؛ ttl برای stale همیشگی نمی‌شود چون
// stale-refetch باید fire-and-forget باشد نه حذف lazy).
interface CacheEntry {
  html: string;
}
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes
const _routeTimestamps = new Map<string, number>();
const routeCache = createCache<CacheEntry>({
  ttl: 'never',
  maxSize: 50,
  // استمپ‌ها هم با eviction پاک شوند تا Map بی‌نمو نشود (تست نشت #144).
  onEvict: (key) => {
    _routeTimestamps.delete(key);
  },
});

/** استمپ ذخیره تازه را ثبت می‌کند (رفتار stale قدیمی بدون تغییر). */
function markRouteFresh(src: string): void {
  _routeTimestamps.set(src, Date.now());
}

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
    // Cache the result — #144: eviction LRU داخل @zenith/cache (O(1)).
    routeCache.set(src, { html });
    markRouteFresh(src);
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
    const entryTime = _routeTimestamps.get(src) ?? Date.now();
    const age = Date.now() - entryTime;
    if (age < DEFAULT_STALE_TIME) {
      return { ok: true, html: cached.html, status: 200 };
    }
    // Stale — re-fetch in background, return cached for now.
    void fetchPage(src); // fire and forget — updates cache
    return { ok: true, html: cached.html, status: 200 };
  }
  return fetchPage(src, signal);
}

function cleanupCurrentContent(el: HTMLElement, disposes: (() => void)[]): void {
  for (const d of disposes) {
    try {
      d();
    } catch (err) {
      console.error('[Zenith Router] Dispose error:', err);
    }
  }
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
  if (routes.length === 0) {
    console.warn('[Zenith Router] No routes found.');
    return;
  }

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
      try {
        currentAbort.abort();
      } catch {
        /* ignore */
      }
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
      const entryTime = _routeTimestamps.get(route.src) ?? Date.now();
      if (Date.now() - entryTime > DEFAULT_STALE_TIME) {
        void (async () => {
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

    void (async () => {
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
      try {
        currentAbort.abort();
      } catch {
        /* ignore */
      }
      currentAbort = null;
    }
    cleanupCurrentContent(el, currentDisposes);
    disposeEffect();
  });
}

/** Clear route cache (for HMR or manual refresh). */
export function clearRouteCache(): void {
  routeCache.clear();
  _routeTimestamps.clear();
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
