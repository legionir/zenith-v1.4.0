// packages/http/src/http-options.ts
//
// اسکیماها و پیش‌فرض‌های اعتبارسنجی @zenith/http (#52) — استخراج مکانیکی
// از http.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { s, defineOptions, type Schema } from '@zenith/schema';
import type {
  CacheConfig,
  HttpProgressEvent,
  HttpRequestOptions,
  RetryConfig,
} from './http-types';


// ============================================================
// Options Schemas & Defaults (#52)
// ============================================================

export const retryConfigOptions = defineOptions<Required<RetryConfig>>(
  'RetryConfig',
  s.object({
    maxAttempts: s.default(s.number({ int: true, min: 0 }), 3),
    initialDelay: s.default(s.duration({ min: 0 }), 500),
    backoffMultiplier: s.default(s.number({ min: 1 }), 2),
    retryOn: s.default(
      s.array(s.number({ int: true, min: 100, max: 599 })),
      [408, 429, 500, 502, 503, 504],
    ),
  }),
);

export const RETRY_CONFIG_DEFAULTS = retryConfigOptions.DEFAULTS;
export const retryConfigSchema = retryConfigOptions.schema;
export const resolveRetryConfig = (cfg?: unknown): Required<RetryConfig> =>
  retryConfigOptions.resolve(cfg);

export const cacheConfigOptions = defineOptions<CacheConfig>(
  'CacheConfig',
  s.object({
    enabled: s.default(s.boolean(), false),
    ttl: s.default(s.duration({ min: 0 }), 60000),
    key: s.optional(s.string({ min: 1 })),
  }),
);

export const CACHE_CONFIG_DEFAULTS = cacheConfigOptions.DEFAULTS;
export const cacheConfigSchema = cacheConfigOptions.schema;
export const resolveCacheConfig = (cfg?: unknown): CacheConfig => cacheConfigOptions.resolve(cfg);

export const zenithHttpOptionsSchema = s.object({
  baseURL: s.optional(s.string()),
  timeout: s.optional(s.duration({ min: 0 })),
  retry: s.optional(retryConfigOptions.schema),
  cache: s.optional(cacheConfigOptions.schema),
  tags: s.optional(s.array(s.string({ min: 1 }))),
  skipInterceptors: s.optional(s.boolean()),
  onUploadProgress: s.optional(s.fn() as unknown as Schema<(event: HttpProgressEvent) => void>),
  onDownloadProgress: s.optional(s.fn() as unknown as Schema<(event: HttpProgressEvent) => void>),
  fetchImpl: s.optional(s.fn() as unknown as Schema<typeof fetch>),
});

export const httpRequestOptions = defineOptions<HttpRequestOptions>(
  'HttpRequestOptions',
  s.object({
    zenith: s.optional(zenithHttpOptionsSchema),
    baseURL: s.optional(s.string()),
    timeout: s.default(s.duration({ min: 0 }), 30000),
    retry: s.default(retryConfigOptions.schema, {
      maxAttempts: 3,
      initialDelay: 500,
      backoffMultiplier: 2,
      retryOn: [408, 429, 500, 502, 503, 504],
    }),
    cache: s.default(cacheConfigOptions.schema, {
      enabled: false,
      ttl: 60000,
    }),
    tags: s.optional(s.array(s.string({ min: 1 }))),
    skipInterceptors: s.default(s.boolean(), false),
    onUploadProgress: s.optional(s.fn() as unknown as Schema<(event: HttpProgressEvent) => void>),
    onDownloadProgress: s.optional(s.fn() as unknown as Schema<(event: HttpProgressEvent) => void>),
    fetchImpl: s.optional(s.fn() as unknown as Schema<typeof fetch>),
    // Standard RequestInit fields
    method: s.optional(s.string({ min: 1 })),
    headers: s.optional(
      s.custom<HeadersInit>((v) => typeof v === 'object' && v !== null, 'HeadersInit'),
    ),
    body: s.optional(s.custom<BodyInit | null>(() => true, 'BodyInit | null')),
    mode: s.optional(s.enum(['cors', 'no-cors', 'same-origin', 'navigate'] as const)),
    credentials: s.optional(s.enum(['omit', 'same-origin', 'include'] as const)),
    redirect: s.optional(s.enum(['follow', 'error', 'manual'] as const)),
    referrer: s.optional(s.string()),
    referrerPolicy: s.optional(s.string() as unknown as Schema<ReferrerPolicy>),
    integrity: s.optional(s.string()),
    keepalive: s.optional(s.boolean()),
    signal: s.optional(
      s.custom<AbortSignal | null>(
        (v) => v === null || (typeof v === 'object' && 'aborted' in (v as object)),
        'AbortSignal | null',
      ),
    ),
    priority: s.optional(s.enum(['high', 'low', 'auto'] as const)),
    window: s.optional(s.custom<null>((v) => v === null, 'null')),
  }),
);

export const HTTP_REQUEST_OPTIONS_DEFAULTS = httpRequestOptions.DEFAULTS;
export const httpRequestOptionsSchema = httpRequestOptions.schema;
export const resolveHttpRequestOptions = (opts?: unknown): HttpRequestOptions =>
  httpRequestOptions.resolve(opts);