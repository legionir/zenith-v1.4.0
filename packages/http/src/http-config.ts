// packages/http/src/http-config.ts
//
// ادغام/اعتبارسنجی آپشن‌ها و کانفیگ پیش‌فرض — استخراج مکانیکی از http.ts
// بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { httpRequestOptions } from './http-options';
import type { HttpRequestOptions } from './http-types';
import { setDefaultConfig } from './http-state';

export function mergeAndValidateHttpOptions(
  base: HttpRequestOptions,
  override: unknown,
): HttpRequestOptions {
  if (override === undefined || override === null) {
    return httpRequestOptions.resolve(base);
  }
  if (typeof override !== 'object' || Array.isArray(override)) {
    return httpRequestOptions.resolve(override);
  }
  const raw = override as Record<string, unknown>;
  const zenithRaw =
    raw.zenith !== undefined &&
    raw.zenith !== null &&
    typeof raw.zenith === 'object' &&
    !Array.isArray(raw.zenith)
      ? (raw.zenith as Record<string, unknown>)
      : undefined;

  const baseCacheObj =
    typeof base.cache === 'object' && base.cache !== null ? base.cache : base.zenith?.cache;

  const isStringCache = typeof raw.cache === 'string';
  if (isStringCache) {
    fetchRequestCacheOptions.resolve({ cache: raw.cache });
  }

  const candidate: Record<string, unknown> = {
    ...base,
    ...raw,
  };
  if (isStringCache) {
    candidate.cache = baseCacheObj ?? { enabled: false, ttl: 60000 };
  }
  if (zenithRaw) {
    if (zenithRaw.baseURL !== undefined) candidate.baseURL = zenithRaw.baseURL;
    if (zenithRaw.timeout !== undefined) candidate.timeout = zenithRaw.timeout;
    if (zenithRaw.tags !== undefined) candidate.tags = zenithRaw.tags;
    if (zenithRaw.skipInterceptors !== undefined) {
      candidate.skipInterceptors = zenithRaw.skipInterceptors;
    }
  }
  const effectiveRetry = zenithRaw?.retry ?? raw.retry;
  if (
    effectiveRetry !== undefined &&
    effectiveRetry !== null &&
    typeof effectiveRetry === 'object' &&
    !Array.isArray(effectiveRetry)
  ) {
    candidate.retry = { ...base.retry, ...(effectiveRetry as Record<string, unknown>) };
  }
  if (
    raw.cache !== undefined &&
    raw.cache !== null &&
    typeof raw.cache === 'object' &&
    !Array.isArray(raw.cache)
  ) {
    candidate.cache = {
      ...baseCacheObj,
      ...(raw.cache as Record<string, unknown>),
    };
  }
  if (
    zenithRaw?.cache !== undefined &&
    zenithRaw.cache !== null &&
    typeof zenithRaw.cache === 'object' &&
    !Array.isArray(zenithRaw.cache)
  ) {
    const mergedZenithCache = {
      ...baseCacheObj,
      ...(zenithRaw.cache as Record<string, unknown>),
    };
    candidate.zenith = {
      ...zenithRaw,
      cache: mergedZenithCache,
    };
    if (!isStringCache) {
      candidate.cache = mergedZenithCache;
    }
  }
  const resolved = httpRequestOptions.resolve(candidate);
  if (isStringCache) {
    return {
      ...resolved,
      cache: raw.cache as RequestCache,
    };
  }
  return resolved;
}

/**
 * Set default configuration for all HTTP requests.
 *
 * #116 cleanup protocol: تنظیمات «ثبت» محسوب می‌شود؛ خروجی یک `Cleanup`
 * idempotent است که مقدار قبلی defaultConfig را بازمی‌گرداند.
 * #52: اعتبارسنجی در مرز ورودی با `httpRequestOptions`.
 */
export function setHttpConfig(config: Partial<HttpRequestOptions>): () => void {
  const next = mergeAndValidateHttpOptions(defaultConfig, config);
  const previous = defaultConfig;
  setDefaultConfig(next);
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    setDefaultConfig(previous);
  };
}

/**
 * Get current default HTTP configuration
 */
export function getHttpConfig(): HttpRequestOptions {
  return { ...defaultConfig };
}
