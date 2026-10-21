// #52 — اعتبارسنجی گزینه‌های @zenith/http در مرز ورودی (HttpRequestOptions / RetryConfig / CacheConfig)
import { describe, it, expect, beforeEach } from 'vitest';
import { ZenithError } from '@zenith/errors';
import {
  setHttpConfig,
  getHttpConfig,
  request,
  HTTP_REQUEST_OPTIONS_DEFAULTS,
  RETRY_CONFIG_DEFAULTS,
  CACHE_CONFIG_DEFAULTS,
  resolveHttpRequestOptions,
  resolveRetryConfig,
  resolveCacheConfig,
} from '../src/index';

function catchError(fn: () => unknown): ZenithError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ZenithError);
    return err as ZenithError;
  }
  throw new Error('Expected function to throw ZenithError');
}

async function catchAsyncError(fn: () => Promise<unknown>): Promise<ZenithError> {
  try {
    await fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ZenithError);
    return err as ZenithError;
  }
  throw new Error('Expected async function to reject with ZenithError');
}

describe('@zenith/http options validation (#52)', () => {
  beforeEach(() => {
    setHttpConfig(HTTP_REQUEST_OPTIONS_DEFAULTS);
  });

  it('exports frozen DEFAULTS for HttpRequestOptions, RetryConfig, and CacheConfig', () => {
    expect(Object.isFrozen(HTTP_REQUEST_OPTIONS_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(RETRY_CONFIG_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(CACHE_CONFIG_DEFAULTS)).toBe(true);

    expect(resolveRetryConfig()).toEqual({
      maxAttempts: 3,
      initialDelay: 500,
      backoffMultiplier: 2,
      retryOn: [408, 429, 500, 502, 503, 504],
    });
    expect(resolveCacheConfig()).toEqual({
      enabled: false,
      ttl: 60000,
    });
    expect(resolveHttpRequestOptions().timeout).toBe(30000);
  });

  it('validates RetryConfig and CacheConfig constraints (ZEN-1001 / ZEN-1002 / ZEN-1004)', () => {
    const negAttempts = catchError(() => resolveRetryConfig({ maxAttempts: -1 }));
    expect(negAttempts.code).toBe('ZEN-1004');
    expect((negAttempts.details as any).path).toBe('maxAttempts');

    const badStatus = catchError(() => resolveRetryConfig({ retryOn: [999] }));
    expect(badStatus.code).toBe('ZEN-1004');
    expect((badStatus.details as any).path).toBe('retryOn.0');

    const negTtl = catchError(() => resolveCacheConfig({ ttl: -100 }));
    expect(negTtl.code).toBe('ZEN-1004');
    expect((negTtl.details as any).path).toBe('ttl');

    const unknownCacheKey = catchError(() => resolveCacheConfig({ maxAge: 1000 }));
    expect(unknownCacheKey.code).toBe('ZEN-1002');
    expect((unknownCacheKey.details as any).path).toBe('maxAge');
  });

  it('validates setHttpConfig and request() at the entry boundary', async () => {
    const negTimeout = catchError(() => setHttpConfig({ timeout: -5 }));
    expect(negTimeout.code).toBe('ZEN-1004');
    expect((negTimeout.details as any).path).toBe('timeout');

    const nestedRetryErr = catchError(() => setHttpConfig({ retry: { backoffMultiplier: 0.5 } }));
    expect(nestedRetryErr.code).toBe('ZEN-1004');
    expect((nestedRetryErr.details as any).path).toBe('retry.backoffMultiplier');

    const unknownOptErr = catchError(() => setHttpConfig({ timout: 1000 } as any));
    expect(unknownOptErr.code).toBe('ZEN-1002');
    expect((unknownOptErr.details as any).path).toBe('timout');

    const reqErr = await catchAsyncError(() =>
      request('/api/items', { cache: { enabled: 'yes' as any } }),
    );
    expect(reqErr.code).toBe('ZEN-1001');
    expect((reqErr.details as any).path).toBe('cache.enabled');

    const cleanup = setHttpConfig({ timeout: 5000, retry: { maxAttempts: 1 } });
    expect(getHttpConfig().timeout).toBe(5000);
    expect(getHttpConfig().retry?.maxAttempts).toBe(1);
    cleanup();
    expect(getHttpConfig().timeout).toBe(30000);
  });
});
