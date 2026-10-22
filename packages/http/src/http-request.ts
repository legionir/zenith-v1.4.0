// packages/http/src/http-request.ts
//
// تابع request و facade aral — استخراج مکانیکی از http.ts بدون تغییر
// رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { signal, emitError } from '@zenith/state';
import { ZenithError } from '@zenith/errors';
import { mergeAndValidateHttpOptions } from './http-config';
import {
  REQUEST_INIT_ALLOWLIST,
  type CacheConfig,
  type HttpError,
  type HttpRequestOptions,
  type HttpResponse,
  type ZenithHttpOptions,
} from './http-types';
import {
  _mockFetchImpl,
  defaultConfig,
  errorInterceptors,
  httpCache,
  pendingRequests,
  requestInterceptors,
  responseInterceptors,
} from './http-state';

// ============================================================
// Core Request Function
// ============================================================

/**
 * Make an HTTP request with full feature support
 */
export async function request<T = unknown>(
  url: string,
  options: HttpRequestOptions = {},
): Promise<HttpResponse<T>> {
  // #52 — Validate and merge with defaults at entry boundary
  const resolved = mergeAndValidateHttpOptions(defaultConfig, options);
  const config: HttpRequestOptions = {
    ...resolved,
    headers: {
      'Content-Type': 'application/json',
      ...(defaultConfig.headers as Record<string, string> | undefined),
      ...(resolved.headers as Record<string, string> | undefined),
    },
  };

  // Resolve Zenith-specific options from `config.zenith` first, falling back to top-level (#54)
  const zenithOpts: ZenithHttpOptions = {
    baseURL: config.zenith?.baseURL ?? config.baseURL,
    timeout: config.zenith?.timeout ?? config.timeout,
    retry: config.zenith?.retry ?? config.retry,
    cache:
      config.zenith?.cache ??
      (typeof config.cache === 'object' && config.cache !== null ? config.cache : undefined),
    tags: config.zenith?.tags ?? config.tags,
    skipInterceptors: config.zenith?.skipInterceptors ?? config.skipInterceptors,
  };

  // Prepend base URL
  const fullUrl =
    zenithOpts.baseURL && !url.startsWith('http')
      ? `${zenithOpts.baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
      : url;

  // Run request interceptors
  if (!zenithOpts.skipInterceptors) {
    for (const interceptor of requestInterceptors) {
      Object.assign(config, await interceptor(config));
    }
  }

  const effectiveCacheConfig: CacheConfig | undefined =
    config.zenith?.cache ??
    (typeof config.cache === 'object' && config.cache !== null ? config.cache : zenithOpts.cache);
  const effectiveTags = config.zenith?.tags ?? config.tags ?? zenithOpts.tags;
  const effectiveTimeout = config.zenith?.timeout ?? config.timeout ?? zenithOpts.timeout;
  const effectiveRetry = config.zenith?.retry ?? config.retry ?? zenithOpts.retry;
  const effectiveSkipInterceptors =
    config.zenith?.skipInterceptors ?? config.skipInterceptors ?? zenithOpts.skipInterceptors;

  // Check cache
  const cacheKey = effectiveCacheConfig?.key || `${config.method || 'GET'}:${fullUrl}`;
  if (effectiveCacheConfig?.enabled) {
    const cached = httpCache.get(cacheKey);
    if (cached) {
      return {
        // Same unchecked caller-declared generic boundary as a fresh response.
        data: cached.data as T,
        status: 200,
        statusText: 'OK (from cache)',
        headers: new Headers(),
        config,
      };
    }
  }

  // Setup abort controller for timeout & cancellation + caller AbortSignal (#129)
  const callerSignal = options.signal ?? config.signal ?? null;
  if (callerSignal?.aborted) {
    throw new ZenithError({
      code: 'ZEN-1600',
      category: 'Network',
      message: `HTTP request to "${fullUrl}" was aborted before start.`,
      suggestion: 'وضعیت AbortController/AbortSignal ارسال‌شده را بررسی کنید.',
      context: { url: fullUrl },
    });
  }

  const abortController = new AbortController();
  const onCallerAbort = () => abortController.abort();
  if (callerSignal) {
    callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }
  config.signal = abortController.signal;
  pendingRequests.set(cacheKey, abortController);

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  if (effectiveTimeout && effectiveTimeout > 0) {
    timeoutId = setTimeout(() => abortController.abort(), effectiveTimeout);
  }

  const onUploadProgress =
    config.zenith?.onUploadProgress ?? config.onUploadProgress ?? defaultConfig.onUploadProgress;
  const onDownloadProgress =
    config.zenith?.onDownloadProgress ??
    config.onDownloadProgress ??
    defaultConfig.onDownloadProgress;
  const effectiveFetch: typeof fetch =
    config.zenith?.fetchImpl ??
    config.fetchImpl ??
    defaultConfig.fetchImpl ??
    _mockFetchImpl ??
    fetch;

  // #54 — Build `fetchInit` strictly from the RequestInit allowlist so no Zenith-only
  // keys (`zenith`, `baseURL`, `timeout`, `retry`, `tags`, `skipInterceptors`, or
  // `cache` when it is a `CacheConfig` object) ever leak into `fetch()`.
  const fetchInit: RequestInit = {};
  const rawConfig = config as Record<string, unknown>;
  for (const key of REQUEST_INIT_ALLOWLIST) {
    const value = rawConfig[key];
    if (value === undefined) continue;
    if (key === 'cache') {
      if (typeof value === 'string') {
        fetchInit.cache = value as RequestCache;
      }
      continue;
    }
    (fetchInit as Record<string, unknown>)[key] = value;
  }

  try {
    if (onUploadProgress && fetchInit.body != null) {
      const encoded =
        typeof fetchInit.body === 'string'
          ? new TextEncoder().encode(fetchInit.body)
          : fetchInit.body instanceof Uint8Array
            ? fetchInit.body
            : null;
      const totalBytes = encoded ? encoded.byteLength : 100;
      const half = Math.max(1, Math.floor(totalBytes / 2));
      onUploadProgress({
        loaded: half,
        total: totalBytes,
        percent: Math.round((half / totalBytes) * 100),
      });
      onUploadProgress({
        loaded: totalBytes,
        total: totalBytes,
        percent: 100,
      });
    }

    const response = await effectiveFetch(fullUrl, fetchInit);

    // Handle HTTP errors
    if (!response.ok) {
      const error: HttpError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.statusText = response.statusText;
      error.config = config;
      try {
        error.data = await response.json();
      } catch {
        /* ignore */
      }

      // Run error interceptors
      for (const interceptor of errorInterceptors) {
        await interceptor(error);
      }

      emitError({
        message: error.message,
        category: 'runtime',
        severity: 'error',
        recoverable: true,
        context: { url, status: error.status },
      });

      throw error;
    }

    // Parse response (with streaming download progress when requested — #129)
    let responseData: unknown;
    if (onDownloadProgress && response.body && typeof response.body.getReader === 'function') {
      const contentLengthHeader = response.headers?.get?.('content-length');
      const totalHeader = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.byteLength;
          const total = totalHeader > 0 ? totalHeader : loaded;
          onDownloadProgress({
            loaded,
            total,
            percent: Math.min(100, Math.round((loaded / total) * 100)),
          });
        }
      }
      const merged = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      if (loaded === 0) {
        onDownloadProgress({ loaded: 0, total: 0, percent: 100 });
      }
      const text = new TextDecoder().decode(merged);
      responseData = text ? JSON.parse(text) : null;
    } else {
      responseData = await response.json();
      if (onDownloadProgress) {
        const approx = JSON.stringify(responseData ?? '').length;
        onDownloadProgress({ loaded: approx, total: approx, percent: 100 });
      }
    }

    let httpResponse: HttpResponse<T> = {
      data: responseData as T,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config,
    };

    // Run response interceptors
    if (!effectiveSkipInterceptors) {
      for (const interceptor of responseInterceptors) {
        // Legacy interceptors can replace payloads; their output is not a decoder for T.
        httpResponse = await interceptor(httpResponse) as HttpResponse<T>;
      }
    }

    // Store in cache (TTL + tags per entry; lazy expiry in @zenith/cache)
    if (effectiveCacheConfig?.enabled) {
      const ttl = effectiveCacheConfig.ttl || 60000;
      httpCache.set(cacheKey, { data: httpResponse.data }, { ttl, tags: effectiveTags });
    }

    return httpResponse;
  } catch (err) {
    if (callerSignal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
      throw new ZenithError({
        code: 'ZEN-1600',
        category: 'Network',
        message: `HTTP request to "${fullUrl}" was aborted.`,
        suggestion: 'وضعیت AbortSignal یا مهلت timeout درخواست را بررسی کنید.',
        cause: err instanceof Error ? err : undefined,
        context: { url: fullUrl },
      });
    }
    // Retry logic
    const retryConfig = effectiveRetry;
    if (retryConfig?.maxAttempts && retryConfig.maxAttempts > 0) {
      const status = (err as HttpError).status;
      const shouldRetry = !status || (retryConfig.retryOn || []).includes(status);

      if (shouldRetry) {
        const remainingAttempts = retryConfig.maxAttempts - 1;
        const delay =
          (retryConfig.initialDelay || 500) *
          Math.pow(
            retryConfig.backoffMultiplier || 2,
            retryConfig.maxAttempts - remainingAttempts - 1,
          );

        await new Promise((r) => setTimeout(r, delay));

        const nextRetry = { ...retryConfig, maxAttempts: remainingAttempts };
        return request<T>(url, {
          ...config,
          retry: nextRetry,
          ...(config.zenith ? { zenith: { ...config.zenith, retry: nextRetry } } : {}),
        });
      }
    }

    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (callerSignal) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
    pendingRequests.delete(cacheKey);
  }
}

// ============================================================
// Convenience Methods
// ============================================================

export const http = {
  get: <T = unknown>(url: string, options?: HttpRequestOptions) =>
    request<T>(url, { ...options, method: 'GET' }),

  post: <T = unknown>(url: string, data?: unknown, options?: HttpRequestOptions) =>
    request<T>(url, { ...options, method: 'POST', body: JSON.stringify(data) }),

  put: <T = unknown>(url: string, data?: unknown, options?: HttpRequestOptions) =>
    request<T>(url, { ...options, method: 'PUT', body: JSON.stringify(data) }),

  patch: <T = unknown>(url: string, data?: unknown, options?: HttpRequestOptions) =>
    request<T>(url, { ...options, method: 'PATCH', body: JSON.stringify(data) }),

  delete: <T = unknown>(url: string, options?: HttpRequestOptions) =>
    request<T>(url, { ...options, method: 'DELETE' }),

  /** Create a reactive resource that auto-updates on refetch */
  resource: <T = unknown>(url: string, options?: HttpRequestOptions) => {
    const data = signal<T | null>(null);
    const loading = signal(false);
    const error = signal<HttpError | null>(null);

    async function refetch() {
      loading.set(true);
      error.set(null);
      try {
        const res = await http.get<T>(url, options);
        data.set(res.data);
      } catch (e) {
        error.set(e as HttpError);
      } finally {
        loading.set(false);
      }
    }

    void refetch();

    return { data, loading, error, refetch };
  },
};
