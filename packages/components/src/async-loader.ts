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


import { developerError, resourceHttpError, ZenithError, ErrorCode } from '@zenith/errors';
import {
  cacheConfig,
  errorCache,
  inflightCache,
  templateCache,
} from './async-cache';

export interface LoadComponentOptions {
  signal?: AbortSignal;
  timeout?: number;
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
  signalOrOptions?: AbortSignal | LoadComponentOptions,
): Promise<HTMLTemplateElement> {
  if (!src) {
    throw developerError('async-loader: src is required.', ErrorCode.INTERNAL_DEVELOPER_ERROR);
  }

  const callerSignal =
    signalOrOptions && 'aborted' in signalOrOptions ? signalOrOptions : signalOrOptions?.signal;
  const timeoutMs =
    signalOrOptions && !('aborted' in signalOrOptions) && signalOrOptions.timeout !== undefined
      ? signalOrOptions.timeout
      : cacheConfig.timeout;

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
      throw new ZenithError({
        code: ErrorCode.RESOURCE_HTTP_ERROR,
        category: 'Network',
        message: 'async-loader: fetch is not available (SSR?).',
        suggestion: 'در SSR از @zenith/ssr یا loader دستی استفاده کنید.',
      });
    }
    if (typeof DOMParser !== 'function') {
      throw new ZenithError({
        code: ErrorCode.RUNTIME_COMPONENT_NOT_FOUND,
        category: 'Runtime',
        message: 'async-loader: DOMParser is not available (SSR?).',
        suggestion: 'async-loader فقط در مرورگر کار می‌کند.',
      });
    }

    // #15 FIX: اعمال timeout قابل‌پیکربندی با AbortController و تایمر سقف‌دار
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onCallerAbort = (): void => {
      controller?.abort();
    };
    if (callerSignal) {
      if (callerSignal.aborted) {
        controller?.abort();
      } else {
        callerSignal.addEventListener('abort', onCallerAbort, { once: true });
      }
    }
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        controller?.abort();
      }, timeoutMs);
    }

    let res: Response;
    try {
      const fetchPromise = fetch(src, controller ? { signal: controller.signal } : undefined);
      if (timeoutMs > 0) {
        res = await Promise.race([
          fetchPromise,
          new Promise<never>((_resolve, reject) => {
            const checkTimeout = setTimeout(() => {
              timedOut = true;
              controller?.abort();
              reject(
                new ZenithError({
                  code: ErrorCode.RESOURCE_HTTP_ERROR,
                  category: 'Network',
                  message: `async-loader: Timed out loading component "${src}" after ${timeoutMs}ms.`,
                }),
              );
            }, timeoutMs);
            void fetchPromise.then(
              () => clearTimeout(checkTimeout),
              () => clearTimeout(checkTimeout),
            );
          }),
        ]);
      } else {
        res = await fetchPromise;
      }
    } catch (err) {
      if (timedOut) {
        throw new ZenithError({
          code: ErrorCode.RESOURCE_HTTP_ERROR,
          category: 'Network',
          message: `async-loader: Timed out loading component "${src}" after ${timeoutMs}ms.`,
        });
      }
      throw err;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);
    }
    if (!res.ok) {
      throw resourceHttpError(src, res.status, res.statusText);
    }
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tpl = doc.querySelector('template');
    if (!tpl) {
      throw developerError(
        `async-loader: No <template> found in "${src}".`,
        ErrorCode.COMPONENT_SLOT_NOT_FOUND,
      );
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
