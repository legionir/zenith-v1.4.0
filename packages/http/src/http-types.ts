// packages/http/src/http-types.ts
//
// تایپ‌های عمومی @zenith/http — استخراج مکانیکی از http.ts بدون تغییر
// رفتار (#40، code-first: نوشته‌شده، اجرا نشده).


// ============================================================
// Types & Interfaces
// ============================================================

/** #129: رویداد پیشرفت آپلود یا دانلود HTTP. */
export interface HttpProgressEvent {
  loaded: number;
  total: number;
  percent: number;
}

export interface ZenithHttpOptions {
  /** Base URL prepended to relative paths */
  baseURL?: string;
  /** Request timeout in ms (0 = no timeout) */
  timeout?: number;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Cache configuration */
  cache?: CacheConfig;
  /** Tags for cache invalidation */
  tags?: string[];
  /** Skip global interceptors for this request */
  skipInterceptors?: boolean;
  /** #129: قلاب گزارش پیشرفت آپلود */
  onUploadProgress?: (event: HttpProgressEvent) => void;
  /** #129: قلاب گزارش پیشرفت دانلود */
  onDownloadProgress?: (event: HttpProgressEvent) => void;
  /** #129: پیاده‌سازی سفارشی `fetch` برای تست یا محیط‌های خاص */
  fetchImpl?: typeof fetch;
}

const REQUEST_CACHE_VALUES = [
  'default',
  'no-store',
  'reload',
  'no-cache',
  'force-cache',
  'only-if-cached',
] as const;

const REQUEST_INIT_ALLOWLIST: ReadonlyArray<keyof RequestInit> = Object.freeze([
  'method',
  'headers',
  'body',
  'mode',
  'credentials',
  'cache',
  'redirect',
  'referrer',
  'referrerPolicy',
  'integrity',
  'keepalive',
  'signal',
  'priority',
  'window',
]);

// #54: Zenith-specific options live under `zenith?: ZenithHttpOptions` so standard
// `RequestInit['cache']` (`RequestCache`) and `zenith.cache` (`CacheConfig`) do not collide.
// Top-level Zenith fields remain supported as deprecated aliases for backward compatibility.
export interface HttpRequestOptions extends Omit<RequestInit, 'cache'> {
  /** #54: Namespace for Zenith-specific HTTP options */
  zenith?: ZenithHttpOptions;
  /**
   * Standard Fetch `RequestCache` mode (`'no-store'`, `'reload'`, ...) OR
   * legacy Zenith `CacheConfig` object (prefer `zenith: { cache: ... }`).
   */
  cache?: CacheConfig | RequestCache;
  /** @deprecated Prefer `zenith.baseURL` (#54) */
  baseURL?: string;
  /** @deprecated Prefer `zenith.timeout` (#54) */
  timeout?: number;
  /** @deprecated Prefer `zenith.retry` (#54) */
  retry?: RetryConfig;
  /** @deprecated Prefer `zenith.tags` (#54) */
  tags?: string[];
  /** @deprecated Prefer `zenith.skipInterceptors` (#54) */
  skipInterceptors?: boolean;
  /** #129: قلاب گزارش پیشرفت آپلود */
  onUploadProgress?: (event: HttpProgressEvent) => void;
  /** #129: قلاب گزارش پیشرفت دانلود */
  onDownloadProgress?: (event: HttpProgressEvent) => void;
  /** #129: پیاده‌سازی سفارشی `fetch` برای تست */
  fetchImpl?: typeof fetch;
}

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay between retries in ms */
  initialDelay?: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** HTTP status codes that should trigger a retry */
  retryOn?: number[];
}

export interface CacheConfig {
  /** Enable caching for this request */
  enabled?: boolean;
  /** Time-to-live in ms */
  ttl?: number;
  /** Cache key (defaults to URL + method) */
  key?: string;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: HttpRequestOptions;
}

export interface HttpError extends Error {
  status?: number;
  statusText?: string;
  data?: unknown;
  config?: HttpRequestOptions;
}

export type RequestInterceptor = (
  config: HttpRequestOptions,
) => HttpRequestOptions | Promise<HttpRequestOptions>;

export type ResponseInterceptor = (response: HttpResponse) => HttpResponse | Promise<HttpResponse>;

export type ErrorInterceptor = (error: HttpError) => void | Promise<void>;