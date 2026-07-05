// packages/components/src/async-loader.ts
//
// FEATURE (v1.2.0): Async Component Loader.
//
// Loads component definitions from remote URLs (lazy-loaded components) with
// an in-memory TTL+maxSize cache.
import { registerComponent } from './registry.js';
let cacheConfig = {
    ttl: 5 * 60 * 1000,
    maxSize: 64,
};
const cache = new Map();
const inflight = new Map();
// FIX (v1.2.8): P2-5 — errorCache for recently-failed URLs.
//
// Previously, when a URL failed (404, network error, malformed HTML, etc.),
// the failure was not cached. Every subsequent render of the same
// <zen-async-component src="..."> would re-fetch the URL and re-fail —
// producing a thundering-herd of pointless requests for a known-bad URL
// (e.g. a missing component during a deploy storm).
//
// The errorCache stores the failure for 30 seconds. While an entry exists,
// loadComponent throws immediately without re-fetching. After 30s the
// entry expires and the URL is retried (in case the failure was transient).
const ERROR_CACHE_TTL_MS = 30000;
const errorCache = new Map();
/**
 * Configure the component cache (TTL + maxSize).
 */
export function configureComponentCache(opts) {
    cacheConfig = { ...cacheConfig, ...opts };
    if (cache.size > cacheConfig.maxSize) {
        const keys = Array.from(cache.keys());
        for (let i = 0; i < keys.length - cacheConfig.maxSize; i++) {
            cache.delete(keys[i]);
        }
    }
}
/**
 * Clear the entire component cache.
 */
export function clearComponentCache() {
    cache.clear();
    inflight.clear();
    // FIX (v1.2.8): P2-5 — also clear the errorCache.
    errorCache.clear();
}
/**
 * Escape HTML special characters for safe insertion into textContent /
 * innerHTML.
 */
export function escapeHTML(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/**
 * Load a component definition from a remote URL.
 */
export async function loadComponent(src) {
    if (!src) {
        throw new Error('[Zenith async-loader] src is required.');
    }
    // FIX (v1.2.8): P2-5 — Check the errorCache first. If this URL recently
    // failed (within ERROR_CACHE_TTL_MS), re-throw the cached error
    // immediately without re-fetching. Prevents thundering-herd re-fetches
    // of known-bad URLs.
    const errEntry = errorCache.get(src);
    if (errEntry) {
        const age = Date.now() - errEntry.storedAt;
        if (age < ERROR_CACHE_TTL_MS) {
            throw errEntry.error;
        }
        errorCache.delete(src);
    }
    const entry = cache.get(src);
    if (entry) {
        const age = Date.now() - entry.storedAt;
        if (age < cacheConfig.ttl) {
            return entry.template;
        }
        cache.delete(src);
    }
    const existing = inflight.get(src);
    if (existing)
        return existing;
    const promise = (async () => {
        if (typeof fetch !== 'function') {
            throw new Error('[Zenith async-loader] fetch is not available (SSR?).');
        }
        if (typeof DOMParser !== 'function') {
            throw new Error('[Zenith async-loader] DOMParser is not available (SSR?).');
        }
        const res = await fetch(src);
        if (!res.ok) {
            throw new Error(`[Zenith async-loader] Failed to fetch "${src}": ${res.status} ${res.statusText}`);
        }
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tpl = doc.querySelector('template');
        if (!tpl) {
            throw new Error(`[Zenith async-loader] No <template> found in "${src}".`);
        }
        const cloned = tpl.cloneNode(true);
        cache.set(src, {
            html,
            template: cloned,
            storedAt: Date.now(),
        });
        if (cache.size > cacheConfig.maxSize) {
            const keys = Array.from(cache.keys());
            const evictCount = keys.length - cacheConfig.maxSize;
            for (let i = 0; i < evictCount; i++) {
                cache.delete(keys[i]);
            }
        }
        return cloned;
    })();
    inflight.set(src, promise);
    try {
        return await promise;
    }
    catch (err) {
        // FIX (v1.2.8): P2-5 — Cache the failure so subsequent calls within
        // ERROR_CACHE_TTL_MS throw immediately without re-fetching.
        const cachedError = err instanceof Error
            ? new Error(err.message)
            : new Error(String(err));
        errorCache.set(src, {
            error: cachedError,
            storedAt: Date.now(),
        });
        throw err;
    }
    finally {
        inflight.delete(src);
    }
}
/**
 * Process an element that loads its content from a remote component URL.
 */
export function processAsyncComponent(el, context, processChildren) {
    const src = el.getAttribute('src');
    if (!src) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('[Zenith async-loader] <zen-async-component> without src attribute.');
        }
        return () => { };
    }
    el.setAttribute('data-zenith-async-state', 'loading');
    const localDisposes = [];
    loadComponent(src)
        .then((template) => {
        el.removeAttribute('data-zenith-async-state');
        const clone = template.content.cloneNode(true);
        if (typeof el.appendChild === 'function') {
            el.appendChild(clone);
        }
        const tagName = el.getAttribute('data-name');
        if (tagName && typeof registerComponent === 'function') {
            try {
                registerComponent(tagName, template);
            }
            catch {
                // Already registered — ignore.
            }
        }
        try {
            processChildren(el, context, localDisposes);
        }
        catch (err) {
            if (typeof console !== 'undefined' && console.error) {
                console.error('[Zenith async-loader] processChildren failed:', err);
            }
        }
    })
        .catch((err) => {
        el.setAttribute('data-zenith-async-state', 'error');
        if (typeof el.innerHTML !== 'undefined') {
            el.innerHTML = `<div class="zenith-async-error">${escapeHTML(err.message || String(err))}</div>`;
        }
    });
    return () => {
        for (const d of localDisposes) {
            try { d(); } catch { /* noop */ }
        }
        localDisposes.length = 0;
    };
}
//# sourceMappingURL=async-loader.js.map
