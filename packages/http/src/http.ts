/**
 * @zenith/http - Advanced HTTP integration for Zenith
 *
 * Features:
 *   - Request/response interceptors
 *   - Smart retry with exponential backoff
 *   - Response caching (memory + TTL)
 *   - Request timeout & cancellation
 *   - Centralized error handling
 */

import { signal } from '@zenith/state';
import { emitError } from '@zenith/state';

// ============================================================
// Types & Interfaces
// ============================================================

// `cache` is redefined below as a Zenith CacheConfig object, which conflicts
// with the RequestCache string union in RequestInit, so it is omitted here.
export interface HttpRequestOptions extends Omit<RequestInit, 'cache'> {
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

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: HttpRequestOptions;
}

export interface HttpError extends Error {
  status?: number;
  statusText?: string;
  data?: any;
  config?: HttpRequestOptions;
}

export type RequestInterceptor = (
  config: HttpRequestOptions
) => HttpRequestOptions | Promise<HttpRequestOptions>;

export type ResponseInterceptor = (
  response: HttpResponse
) => HttpResponse | Promise<HttpResponse>;

export type ErrorInterceptor = (error: HttpError) => void | Promise<void>;

// ============================================================
// Internal State
// ============================================================

const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];
const errorInterceptors: ErrorInterceptor[] = [];
const cacheStore = new Map<string, { data: any; expiresAt: number }>();
const pendingRequests = new Map<string, AbortController>();

let defaultConfig: HttpRequestOptions = {
  timeout: 30000,
  retry: {
    maxAttempts: 3,
    initialDelay: 500,
    backoffMultiplier: 2,
    retryOn: [408, 429, 500, 502, 503, 504]
  },
  cache: {
    enabled: false,
    ttl: 60000
  }
};

// ============================================================
// Configuration & Interceptors
// ============================================================

/**
 * Set default configuration for all HTTP requests
 */
export function setHttpConfig(config: Partial<HttpRequestOptions>): void {
  defaultConfig = { ...defaultConfig, ...config };
}

/**
 * Get current default HTTP configuration
 */
export function getHttpConfig(): HttpRequestOptions {
  return { ...defaultConfig };
}

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
 * Clear cached responses, optionally filtered by tags
 */
export function clearCache(tags?: string[]): void {
  if (!tags) {
    cacheStore.clear();
    return;
  }
  // Simple tag-based invalidation (tags stored in key prefix)
  for (const key of Array.from(cacheStore.keys())) {
    if (tags.some(tag => key.includes(`__tag:${tag}`))) {
      cacheStore.delete(key);
    }
  }
}

// ============================================================
// Core Request Function
// ============================================================

/**
 * Make an HTTP request with full feature support
 */
export async function request<T = any>(
  url: string,
  options: HttpRequestOptions = {}
): Promise<HttpResponse<T>> {
  // Merge with defaults
  const config: HttpRequestOptions = {
    ...defaultConfig,
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...defaultConfig.headers,
      ...options.headers
    }
  };

  // Prepend base URL
  const fullUrl = config.baseURL && !url.startsWith('http')
    ? `${config.baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
    : url;

  // Run request interceptors
  if (!config.skipInterceptors) {
    for (const interceptor of requestInterceptors) {
      Object.assign(config, await interceptor(config));
    }
  }

  // Check cache
  const cacheKey = config.cache?.key || `${config.method || 'GET'}:${fullUrl}`;
  if (config.cache?.enabled) {
    const cached = cacheStore.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        data: cached.data,
        status: 200,
        statusText: 'OK (from cache)',
        headers: new Headers(),
        config
      };
    }
  }

  // Setup abort controller for timeout & cancellation
  const abortController = new AbortController();
  config.signal = abortController.signal;
  pendingRequests.set(cacheKey, abortController);

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  if (config.timeout && config.timeout > 0) {
    timeoutId = setTimeout(() => abortController.abort(), config.timeout);
  }

  // Strip Zenith-specific options; `fetch` only understands RequestInit.
  const {
    baseURL: _baseURL,
    timeout: _timeout,
    retry: _retry,
    cache: _cache,
    tags: _tags,
    skipInterceptors: _skipInterceptors,
    ...fetchInit
  } = config as HttpRequestOptions & Record<string, unknown>;

  try {
    const response = await fetch(fullUrl, fetchInit as RequestInit);

    // Handle HTTP errors
    if (!response.ok) {
      const error: HttpError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.statusText = response.statusText;
      error.config = config;
      try { error.data = await response.json(); } catch { /* ignore */ }

      // Run error interceptors
      for (const interceptor of errorInterceptors) {
        await interceptor(error);
      }

      emitError({
        message: error.message,
        category: 'runtime',
        severity: 'error',
        recoverable: true,
        context: { url, status: error.status }
      });

      throw error;
    }

    // Parse response
    const responseData = await response.json();

    let httpResponse: HttpResponse<T> = {
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config
    };

    // Run response interceptors
    if (!config.skipInterceptors) {
      for (const interceptor of responseInterceptors) {
        httpResponse = await interceptor(httpResponse);
      }
    }

    // Store in cache
    if (config.cache?.enabled) {
      const ttl = config.cache.ttl || 60000;
      cacheStore.set(cacheKey, {
        data: httpResponse.data,
        expiresAt: Date.now() + ttl
      });
    }

    return httpResponse;
  } catch (err) {
    // Retry logic
    const retryConfig = config.retry;
    if (retryConfig?.maxAttempts && retryConfig.maxAttempts > 0) {
      const status = (err as HttpError).status;
      const shouldRetry = !status || (retryConfig.retryOn || []).includes(status);

      if (shouldRetry) {
        const remainingAttempts = retryConfig.maxAttempts - 1;
        const delay = (retryConfig.initialDelay || 500) *
          Math.pow(retryConfig.backoffMultiplier || 2,
            (retryConfig.maxAttempts - remainingAttempts - 1));

        await new Promise(r => setTimeout(r, delay));

        return request<T>(url, {
          ...config,
          retry: { ...retryConfig, maxAttempts: remainingAttempts }
        });
      }
    }

    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    pendingRequests.delete(cacheKey);
  }
}

// ============================================================
// Convenience Methods
// ============================================================

export const http = {
  get: <T = any>(url: string, options?: HttpRequestOptions) =>
    request<T>(url, { ...options, method: 'GET' }),

  post: <T = any>(url: string, data?: any, options?: HttpRequestOptions) =>
    request<T>(url, { ...options, method: 'POST', body: JSON.stringify(data) }),

  put: <T = any>(url: string, data?: any, options?: HttpRequestOptions) =>
    request<T>(url, { ...options, method: 'PUT', body: JSON.stringify(data) }),

  patch: <T = any>(url: string, data?: any, options?: HttpRequestOptions) =>
    request<T>(url, { ...options, method: 'PATCH', body: JSON.stringify(data) }),

  delete: <T = any>(url: string, options?: HttpRequestOptions) =>
    request<T>(url, { ...options, method: 'DELETE' }),

  /** Create a reactive resource that auto-updates on refetch */
  resource: <T = any>(url: string, options?: HttpRequestOptions) => {
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

    refetch();

    return { data, loading, error, refetch };
  }
};

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
