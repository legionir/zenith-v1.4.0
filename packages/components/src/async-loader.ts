// packages/components/src/async-loader.ts
//
// FEATURE (v1.2.0): Async Component Loader.
//
// Loads component definitions from remote URLs (lazy-loaded components) with
// an in-memory TTL+maxSize cache. Used by `zen-component` definitions with a
// `src` attribute and by `<zen-async-component>`-style tags that want
// runtime fetching.
//
// Public API:
//   - loadComponent(src): Promise<HTMLTemplateElement>
//   - processAsyncComponent(el, context, processChildren, disposes)
//   - clearComponentCache(): void
//   - configureComponentCache(opts): void
//
// XSS safety:
//   - `escapeHTML` is exported for tests and used internally when surfacing
//     error messages inside elements. The fetched HTML is parsed via
//     DOMParser into a detached document and only the <template> node is
//     extracted — never innerHTML'd directly into the live DOM.
//
// SSR safety:
//   - When `fetch` is unavailable (Node SSR), `loadComponent` rejects with a
//     clear error and `processAsyncComponent` renders a fallback message.
//   - DOM mutations are guarded with `typeof document` checks.

import { registerComponent } from './registry';
// #144: سه کش دستی (Map + timestamp + eviction) به @zenith/cache (L0) مهاجرت
// کرد: entryهای template با ttl/maxSize (LRU)، رجیستری dedupe با پاک‌سازی در
// settle، و errorCache با ttl=۳۰s. هویت خطاها دست‌نخورده می‌ماند (این‌جا
// getOrLoad استفاده نشده تا AbortError همان AbortError بماند).
import { createCache, type Cache } from '@zenith/cache';

/**
 * Cache entry for a loaded component.
 */
export interface CacheEntry {
  /** The fetched HTML source. */
  html: string;
  /** Parsed template element (extracted from the HTML). */
  template: HTMLTemplateElement;
  /** Timestamp (ms) when the entry was stored. */
  storedAt: number;
}

/**
 * Cache configuration. Override via `configureComponentCache`.
 */
export interface ComponentCacheConfig {
  /** Time-to-live in ms. Entries older than this are evicted on read. */
  ttl: number;
  /** Maximum number of entries. LRU eviction when exceeded. */
  maxSize: number;
}

let cacheConfig: ComponentCacheConfig = {
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 64,
};

// #144: ttl/maxSize/LRU به @zenith/cache سپرده شده؛ storedAt صرفاً برای
// سازگاری شکل CacheEntry (export عمومی) در entry می‌ماند.
let templateCache: Cache<CacheEntry> = createCache<CacheEntry>({
  ttl: cacheConfig.ttl,
  maxSize: cacheConfig.maxSize,
});
// رجیستری dedupe (در-flight promise؛ settle ⇒ delete — مثل قبل).
const inflightCache = createCache<Promise<HTMLTemplateElement>>({ ttl: 'never', maxSize: 64 });

// FIX (v1.2.8): P2-5 — errorCache for recently-failed URLs.
//
// Previously, when a URL failed (404, network error, malformed HTML, etc.),
// the failure was not cached. Every subsequent render of the same
// <zen-async-component src="..."> would re-fetch the URL and re-fail —
// producing a thundering-herd of pointless requests for a known-bad URL
// (e.g. a missing component during a deploy storm). Worse, in a list of
// 100 items all pointing to the same broken component, 100 concurrent
// fetches would fire even though the first one already failed.
//
// The errorCache stores the failure for 30 seconds. While an entry exists,
// loadComponent throws immediately without re-fetching. After 30s the
// entry expires and the URL is retried (in case the failure was transient
// — e.g. a server restart). The 30s window is short enough that a real
// fix (redeploy) takes effect quickly, but long enough to break
// thundering herds.
const ERROR_CACHE_TTL_MS = 30_000;
// #144: ttl خود entry (=۳۰s) + انقضای lazy ⇒ delete دستی لازم نیست.
interface ErrorCacheEntry {
  error: Error;
  storedAt: number;
}
const errorCache = createCache<ErrorCacheEntry>({ ttl: ERROR_CACHE_TTL_MS, maxSize: 64 });

/**
 * Configure the component cache (TTL + maxSize).
 *
 * @example
 *   configureComponentCache({ ttl: 60_000, maxSize: 128 });
 */
export function configureComponentCache(opts: Partial<ComponentCacheConfig>): void {
  const prev = { ...cacheConfig, ...opts };
  if (prev.ttl !== cacheConfig.ttl || prev.maxSize !== cacheConfig.maxSize) {
    cacheConfig = prev;
    // ttl/maxSize در @zenith_cache زمان ساخت خوانده می‌شوند ⇒ نمونهٔ تازه با
    // انتقال entryهای زنده (peek ⇒ بدون تغییر آمار/ترتگی). trim داخلی
    // همان «evict anything that no longer fits» قدیمی است.
    const old = templateCache;
    templateCache = createCache<CacheEntry>({ ttl: prev.ttl, maxSize: prev.maxSize });
    for (const key of old.keys()) {
      const entry = old.peek(key);
      if (entry !== undefined) templateCache.set(key, entry);
    }
    old.dispose();
  }
}

/**
 * Clear the entire component cache. Useful in tests and HMR.
 */
export function clearComponentCache(): void {
  templateCache.clear();
  inflightCache.clear();
  // FIX (v1.2.8): P2-5 — also clear the errorCache.
  errorCache.clear();
}

/**
 * Escape HTML special characters for safe insertion into textContent /
 * innerHTML. Used when surfacing error messages inside elements.
 */
export function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Load a component definition from a remote URL. Cached per `src` with a
 * TTL and maxSize. Concurrent calls for the same URL share a single in-flight
 * promise.
 *
 * BUG-COM-02 (v1.3.0): Added optional AbortSignal for fetch cancellation.
 * Pass a signal from an AbortController to cancel the fetch mid-flight
 * (e.g. when the host element is removed from the DOM before the load
 * completes). If the signal aborts, the promise rejects with an AbortError.
 *
 * @param src    URL pointing to an HTML file containing a <template>.
 * @param signal Optional AbortSignal to cancel the fetch.
 * @returns The parsed <template> element.
 */
export async function loadComponent(
  src: string,
  signal?: AbortSignal,
): Promise<HTMLTemplateElement> {
  if (!src) {
    throw new Error('[Zenith async-loader] src is required.');
  }

  // FIX (v1.2.8): P2-5 — Check the errorCache first. If this URL recently
  // failed (within ERROR_CACHE_TTL_MS), re-throw the cached error
  // immediately without re-fetching. This prevents thundering-herd
  // re-fetches of known-bad URLs. #144: ttl entry = ۳۰s و انقضای lazy ⇒
  // بعد از پنجره، peek مقدار undefined می‌دهد و URL retry می‌شود.
  const errEntry = errorCache.peek(src);
  if (errEntry) {
    throw errEntry.error;
  }

  // Check the cache. #144: انقضای ttl داخل @zenith/cache (lazy)؛ get روی
  // entry منقضی‌شده undefined می‌دهد و eviction را انجام می‌دهد.
  const entry = templateCache.get(src);
  if (entry) {
    return entry.template;
  }

  // De-duplicate concurrent fetches.
  const existing = inflightCache.peek(src);
  if (existing) return existing;

  const promise = (async () => {
    if (typeof fetch !== 'function') {
      throw new Error('[Zenith async-loader] fetch is not available (SSR?).');
    }
    if (typeof DOMParser !== 'function') {
      throw new Error('[Zenith async-loader] DOMParser is not available (SSR?).');
    }
    const res = await fetch(src, signal ? { signal } : undefined);
    if (!res.ok) {
      throw new Error(
        `[Zenith async-loader] Failed to fetch "${src}": ${res.status} ${res.statusText}`,
      );
    }
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tpl = doc.querySelector('template');
    if (!tpl) {
      throw new Error(`[Zenith async-loader] No <template> found in "${src}".`);
    }

    // Store in cache (cloned so the cached template is independent).
    const cloned = tpl.cloneNode(true) as HTMLTemplateElement;
    templateCache.set(src, {
      html,
      template: cloned,
      storedAt: Date.now(),
    });
    // LRU eviction: داخل @zenith/cache (maxSize از cacheConfig).

    return cloned;
  })();

  // #144: `set` مقدار (promise) را برمی‌گرداند ⇒ void برای no-floating-promises.
  void inflightCache.set(src, promise);
  try {
    return await promise;
  } catch (err) {
    // FIX (v1.2.8): P2-5 — Cache the failure so subsequent calls within
    // ERROR_CACHE_TTL_MS throw immediately without re-fetching. This
    // breaks thundering-herd patterns for known-bad URLs. We clone the
    // error so the cached copy doesn't carry a stale stack trace from
    // the original throw site (which could confuse debuggers).
    const cachedError = err instanceof Error ? new Error(err.message) : new Error(String(err));
    errorCache.set(src, {
      error: cachedError,
      storedAt: Date.now(),
    });
    throw err;
  } finally {
    inflightCache.delete(src);
  }
}

/**
 * Signature of the walker-supplied `processChildren` callback. Mirrors the
 * shape used by `processComponent` in `./processor.ts`.
 */
export type AsyncProcessChildren = (
  el: HTMLElement,
  context: Record<string, any>,
  disposes: (() => void)[],
) => void;

/**
 * Process an element that loads its content from a remote component URL.
 *
 * The element must carry a `src` attribute pointing to an HTML file with a
 * `<template>`. While loading, a `data-zenith-async-state="loading"`
 * attribute is set on the element. On success, the template content is
 * cloned into the element and `processChildren` is called to bind it. On
 * failure, an error message is rendered inside the element.
 *
 * @param el              The host element.
 * @param context         The current reactive context.
 * @param processChildren Walker-supplied callback for binding the loaded subtree.
 * BUG-COM-02 (v1.3.0): The returned dispose function now aborts the
 * in-flight fetch via AbortController, preventing stale registrations
 * and memory leaks when the host element is removed from the DOM before
 * the load finishes.
 *
 * @returns Dispose function — aborts in-flight fetch and cleans up.
 */
export function processAsyncComponent(
  el: HTMLElement,
  context: Record<string, any>,
  processChildren: AsyncProcessChildren,
): () => void {
  const src = el.getAttribute('src');
  if (!src) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[Zenith async-loader] <zen-async-component> without src attribute.');
    }
    return () => {};
  }

  el.setAttribute('data-zenith-async-state', 'loading');

  const localDisposes: (() => void)[] = [];

  // BUG-COM-02 (v1.3.0): AbortController to cancel the fetch on dispose.
  const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;

  // Kick off the load asynchronously.
  loadComponent(src, abortController?.signal)
    .then((template) => {
      el.removeAttribute('data-zenith-async-state');
      // Clone the template content into the host element.
      const clone = template.content.cloneNode(true);
      if (typeof el.appendChild === 'function') {
        el.appendChild(clone);
      }
      // Optionally register the component by its tag name so future
      // <tag-name> uses don't need to re-fetch.
      const tagName = el.getAttribute('data-name');
      if (tagName && typeof registerComponent === 'function') {
        try {
          registerComponent(tagName, template);
        } catch {
          // Already registered — ignore.
        }
      }
      try {
        processChildren(el, context, localDisposes);
      } catch (err) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[Zenith async-loader] processChildren failed:', err);
        }
      }
    })
    .catch((err: Error) => {
      el.setAttribute('data-zenith-async-state', 'error');
      if (typeof el.innerHTML !== 'undefined') {
        el.innerHTML = `<div class="zenith-async-error">${escapeHTML(err.message || String(err))}</div>`;
      }
    });

  // BUG-COM-02 (v1.3.0): The returned dispose function aborts any
  // in-flight fetch and then cleans up local disposes. Previously
  // the fetch would complete and register the component even after
  // the host element was removed — now it's cancelled at the HTTP
  // level.
  return () => {
    if (abortController) {
      try {
        abortController.abort();
      } catch {
        /* noop */
      }
    }
    for (const d of localDisposes) {
      try {
        d();
      } catch {
        /* noop */
      }
    }
    localDisposes.length = 0;
  };
}
