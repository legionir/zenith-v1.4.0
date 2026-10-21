// packages/http/src/http-state.ts
//
// state داخلی کلاینت HTTP (کش، رهگیرها، mock، کانفیگ پیش‌فرض، لغو) —
// استخراج مکانیکی از http.ts بدون تغییر رفتار (#40، code-first:
// نوشته‌شده، اجرا نشده).

import { createCache, type Cache } from '@zenith/cache';
import { deprecate } from '@zenith/errors';
import type {
  ErrorInterceptor,
  HttpRequestOptions,
  RequestInterceptor,
  ResponseInterceptor,
} from './http-types';
import { httpRequestOptions } from './http-options';


// ============================================================
// Internal State
// ============================================================

export const requestInterceptors: RequestInterceptor[] = [];
export const responseInterceptors: ResponseInterceptor[] = [];
export const errorInterceptors: ErrorInterceptor[] = [];
// #144: کش پاسخ‌ها از Map دستی به @zenith/cache منتقل شد — TTL به‌ازای هر
// ورودی با opts.ttl، برچسب‌ها با opts.tags و invalidate. انقضا lazy است
// (بدون timer ⇒ SSR-safe). wrapper { data } می‌سازیم تا پاسخ `undefined`
// با «نبود entry» اشتباه گرفته نشود.
export const httpCache: Cache<{ data: unknown }> = createCache<{ data: unknown }>({ ttl: 'never', maxSize: 200 });
export const pendingRequests = new Map<string, AbortController>();
export let _mockFetchImpl: typeof fetch | null = null;

/**
 * #129: ثبت یک تابع mock برای درخواست‌های HTTP در تست‌ها (بدون نیاز به شبکهٔ واقعی).
 * @returns تابع `Cleanup` idempotent برای حذف mock.
 */
export function mockHttp(
  handler: (
    url: string,
    init: RequestInit,
  ) =>
    | Response
    | Promise<Response>
    | { status?: number; headers?: Record<string, string>; data?: unknown },
): () => void {
  const impl: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const res = await handler(rawUrl, init ?? {});
    if (res instanceof Response) return res;
    const status = typeof res?.status === 'number' ? res.status : 200;
    const bodyText = JSON.stringify(res && 'data' in res ? res.data : (res ?? {}));
    return new Response(bodyText, {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(new TextEncoder().encode(bodyText).byteLength),
        ...(res?.headers ?? {}),
      },
    });
  };
  _mockFetchImpl = impl;
  let cleared = false;
  return () => {
    if (cleared) return;
    cleared = true;
    if (_mockFetchImpl === impl) {
      _mockFetchImpl = null;
    }
  };
}

export let defaultConfig: HttpRequestOptions = httpRequestOptions.resolve();

/**
 * Add a request interceptor (runs before each request)
 */
export function addRequestInterceptor(interceptor: RequestInterceptor): () => void {
  requestInterceptors.push(interceptor);
  return () => {
    const idx = requestInterceptors.indexOf(interceptor);
    if (idx > -1) requestInterceptors.splice(idx, 1);
  };
}

/**
 * Add a response interceptor (runs after each successful response)
 */
export function addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
  responseInterceptors.push(interceptor);
  return () => {
    const idx = responseInterceptors.indexOf(interceptor);
    if (idx > -1) responseInterceptors.splice(idx, 1);
  };
}

/**
 * Add an error interceptor (runs on each failed request)
 */
export function addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
  errorInterceptors.push(interceptor);
  return () => {
    const idx = errorInterceptors.indexOf(interceptor);
    if (idx > -1) errorInterceptors.splice(idx, 1);
  };
}

// ============================================================
// Cache Management
// ============================================================

/**
 * Clear cached responses, optionally filtered by tags.
 *
 * نام یکتا طبق کار #3 از #144 (issue نام‌های تکراری): `clearHttpCache`.
 */
export function clearHttpCache(tags?: string[]): void {
  if (!tags) {
    httpCache.clear();
    return;
  }
  httpCache.invalidate(tags);
  // سازگاری با قرارداد قدیمی http: کلیدهایی که خودشان `__tag:<x>` داشتند
  // (حالا tags واقعی هم پشتیبانی می‌شوند).
  httpCache.invalidate((key) => tags.some((tag) => key.includes(`__tag:${tag}`)));
}

/**
 * @deprecated از `clearHttpCache` استفاده کنید (ZEN-DEPR-005، #144 — رفع
 * نام تکراری cross-package). این alias در ۲.۰ حذف می‌شود (DEC-026).
 */
export function clearCache(tags?: string[]): void {
  deprecate('ZEN-DEPR-005', 'clearCache (http)', 'clearHttpCache');
  clearHttpCache(tags);
}

// ============================================================
// Cancellation
// ============================================================

/**
 * Cancel a pending request by URL or cache key
 */
export function cancelRequest(key: string): void {
  const controller = pendingRequests.get(key);
  if (controller) controller.abort();
}

/**
 * Cancel all pending requests
 */
export function cancelAllRequests(): void {
  for (const controller of pendingRequests.values()) {
    controller.abort();
  }
  pendingRequests.clear();
}

// ── #40: mutation helper ──
//
// `defaultConfig` در اصل `let` همین ماژول بود و از `setHttpConfig` (که به
// ماژول http-request رفت تا چرخهٔ import ساخته نشود) بازنویسی می‌شد. چون
// rebinding روی live binding وارداتی ESM ممنوع است، بازنویسی فقط از همین‌جا
// انجام می‌شود. رفتار عین قبل است.
/** جایگزینی کانفیگ پیش‌فرض کلاینت (فراخوانی از `setHttpConfig`). */
export function setDefaultConfig(next: HttpRequestOptions): void {
  defaultConfig = next;
}