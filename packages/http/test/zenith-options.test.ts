import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, request, clearHttpCache, addRequestInterceptor } from '../src';

describe('@zenith/http — zenith: {...} options sub-object & RequestInit isolation (#54)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearHttpCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('never leaks Zenith-specific keys or CacheConfig object into fetch(url, init)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: async () => ({ ok: true }),
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await request('/users', {
      method: 'GET',
      credentials: 'include',
      zenith: {
        baseURL: 'https://api.example.com',
        timeout: 5000,
        retry: { maxAttempts: 1, initialDelay: 10 },
        cache: { enabled: false, ttl: 1000 },
        tags: ['users'],
        skipInterceptors: false,
      },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0]!;
    expect(calledUrl).toBe('https://api.example.com/users');
    expect(calledInit.method).toBe('GET');
    expect(calledInit.credentials).toBe('include');

    // None of the Zenith keys or non-string cache object may leak into fetchInit
    expect('zenith' in calledInit).toBe(false);
    expect('baseURL' in calledInit).toBe(false);
    expect('timeout' in calledInit).toBe(false);
    expect('retry' in calledInit).toBe(false);
    expect('tags' in calledInit).toBe(false);
    expect('skipInterceptors' in calledInit).toBe(false);
    expect('cache' in calledInit).toBe(false);
  });

  it('supports native RequestCache string alongside zenith.cache object without conflict', async () => {
    let callCount = 0;
    const fetchSpy = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ callCount }),
      };
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const first = await http.get<{ callCount: number }>('https://api.example.com/items', {
      cache: 'no-store',
      zenith: {
        cache: { enabled: true, ttl: 30000, key: 'items-cache' },
        tags: ['items'],
      },
    });
    expect(first.data).toEqual({ callCount: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]![1].cache).toBe('no-store');

    // Second request hits Zenith in-memory cache without calling fetch again
    const second = await http.get<{ callCount: number }>('https://api.example.com/items', {
      cache: 'no-store',
      zenith: {
        cache: { enabled: true, ttl: 30000, key: 'items-cache' },
      },
    });
    expect(second.data).toEqual({ callCount: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Invalidating tag clears Zenith cache
    clearHttpCache(['items']);
    const third = await http.get<{ callCount: number }>('https://api.example.com/items', {
      cache: 'no-store',
      zenith: {
        cache: { enabled: true, ttl: 30000, key: 'items-cache' },
      },
    });
    expect(third.data).toEqual({ callCount: 2 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('honors zenith.skipInterceptors and zenith.retry', async () => {
    const interceptorSpy = vi.fn((cfg) => cfg);
    const removeInterceptor = addRequestInterceptor(interceptorSpy);

    let attempts = 0;
    const fetchSpy = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        return {
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers(),
          json: async () => ({ error: 'busy' }),
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ ok: true }),
      };
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    try {
      const res = await request('https://api.example.com/retry-test', {
        zenith: {
          skipInterceptors: true,
          retry: {
            maxAttempts: 2,
            initialDelay: 5,
            backoffMultiplier: 1,
            retryOn: [503],
          },
        },
      });
      expect(res.data).toEqual({ ok: true });
      expect(attempts).toBe(2);
      expect(interceptorSpy).not.toHaveBeenCalled();
    } finally {
      removeInterceptor();
    }
  });
});
