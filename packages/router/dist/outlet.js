// packages/router/src/outlet.ts
//
// پردازشگر <zen-router> — فاز ۸ + Route Cache + Prefetch (فاز ۵ بحرانی).
//
// بهبودها:
//   - Route Cache: صفحات fetch شده در حافظه نگه داشته می‌شوند.
//   - Prefetch Engine: لینک‌های zen-link روی hover prefetch می‌شوند.
//   - Stale Check: صفحات cache شده بعد از staleTime دوباره fetch می‌شوند.
import { effect } from '@zenith/state';
import { routeSignal, findMatchingRoute, setRouteParams } from './router.js';
const routeCache = new Map();
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes
// FIX (v1.2.3): MAX_ROUTE_CACHE_SIZE — جلوگیری از رشد بی‌نهایت cache.
const MAX_ROUTE_CACHE_SIZE = 50;
function readRouteDefinitions(el) {
    const routeEls = Array.from(el.querySelectorAll('zen-route'));
    const routes = [];
    for (const routeEl of routeEls) {
        const path = routeEl.getAttribute('path') || '';
        const src = routeEl.getAttribute('src') || '';
        if (path && src)
            routes.push({ path, src });
    }
    return routes;
}
async function fetchPage(src, signal) {
    try {
        // FIX (v1.2.7): pass AbortSignal to fetch so navigating away mid-flight
        // actually cancels the network request.
        const res = await fetch(src, signal ? { signal } : undefined);
        if (!res.ok)
            return { ok: false, html: '', status: res.status };
        const html = await res.text();
        // Cache the result
        // FIX (v1.2.3): evict oldest entry اگر cache از MAX_ROUTE_CACHE_SIZE بزرگ‌تر شد.
        if (routeCache.size >= MAX_ROUTE_CACHE_SIZE) {
            let oldestKey = null;
            let oldestTs = Infinity;
            for (const [k, v] of routeCache) {
                if (v.timestamp < oldestTs) {
                    oldestTs = v.timestamp;
                    oldestKey = k;
                }
            }
            if (oldestKey)
                routeCache.delete(oldestKey);
        }
        routeCache.set(src, { html, timestamp: Date.now() });
        return { ok: true, html, status: res.status };
    }
    catch (err) {
        // FIX (v1.2.7): silently ignore AbortError — it is expected when the
        // user navigates again before the previous fetch completes.
        if (err instanceof Error && err.name === 'AbortError') {
            return { ok: false, html: '', status: 0 };
        }
        console.error(`[Zenith Router] Failed to fetch "${src}":`, err);
        return { ok: false, html: '', status: 0 };
    }
}
async function fetchPageCached(src, signal) {
    const cached = routeCache.get(src);
    if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < DEFAULT_STALE_TIME) {
            return { ok: true, html: cached.html, status: 200 };
        }
        // Stale — re-fetch in background, return cached for now.
        fetchPage(src); // fire and forget — updates cache
        return { ok: true, html: cached.html, status: 200 };
    }
    return fetchPage(src, signal);
}
function cleanupCurrentContent(el, disposes) {
    for (const d of disposes) {
        try {
            d();
        }
        catch (err) {
            console.error('[Zenith Router] Dispose error:', err);
        }
    }
    disposes.length = 0;
    el.innerHTML = '';
}
// ── Prefetch Engine ──
const prefetchedUrls = new Set();
export function prefetchRoute(src) {
    if (prefetchedUrls.has(src))
        return;
    prefetchedUrls.add(src);
    // Fetch and cache silently
    fetchPage(src).catch(() => { });
}
// Setup prefetch on zen-link hover
let prefetchInstalled = false;
export function installPrefetch() {
    if (prefetchInstalled)
        return;
    if (typeof document === 'undefined')
        return;
    prefetchInstalled = true;
    document.addEventListener('mouseover', (e) => {
        const target = e.target;
        if (!target)
            return;
        const link = target.closest('[zen-link]');
        if (!link)
            return;
        const path = link.getAttribute('zen-link') || link.getAttribute('href');
        if (!path)
            return;
        // Find matching route src and prefetch
        // We can't access routes here, so we use a global registry
        const src = routeSrcRegistry.get(path);
        if (src)
            prefetchRoute(src);
    }, { passive: true });
}
// Registry: path → src (for prefetch)
const routeSrcRegistry = new Map();
export function processRouter(el, processChildren, parentDisposes) {
    const routes = readRouteDefinitions(el);
    if (routes.length === 0) {
        console.warn('[Zenith Router] No routes found.');
        return;
    }
    // Register route srcs for prefetch
    for (const r of routes) {
        if (r.path !== '**')
            routeSrcRegistry.set(r.path, r.src);
    }
    // Install prefetch listener
    installPrefetch();
    el.innerHTML = '';
    const currentDisposes = [];
    let currentLoadId = 0;
    // FIX (v1.2.7): AbortController for lazy-loading race. When a new
    // navigation starts, the previous in-flight fetch is aborted so its
    // response cannot overwrite the newer route's content.
    let currentAbort = null;
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
                processChildren(child, currentDisposes);
            }
            // Re-fetch in background if stale
            if (Date.now() - cached.timestamp > DEFAULT_STALE_TIME) {
                (async () => {
                    const result = await fetchPage(route.src, signal);
                    if (loadId !== currentLoadId)
                        return;
                    if (result.ok && result.html !== cached.html) {
                        cleanupCurrentContent(el, currentDisposes);
                        el.innerHTML = result.html;
                        for (const child of Array.from(el.children)) {
                            processChildren(child, currentDisposes);
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
            if (loadId !== currentLoadId)
                return;
            cleanupCurrentContent(el, currentDisposes);
            if (!result.ok) {
                el.innerHTML = `<div class="zen-router-error"><h1>Error ${result.status}</h1></div>`;
                return;
            }
            el.innerHTML = result.html;
            for (const child of Array.from(el.children)) {
                processChildren(child, currentDisposes);
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
export function clearRouteCache() {
    routeCache.clear();
    prefetchedUrls.clear();
}
//# sourceMappingURL=outlet.js.map