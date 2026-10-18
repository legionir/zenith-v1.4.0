import { afterEach, expect, it, vi } from 'vitest';
import { clearFetchCache, getCachedData, setCachedData, invalidateFetchCache } from '../src';
afterEach(() => { clearFetchCache(); vi.useRealTimers(); });
it('preserves data identity, age boundary, and caller-defined tags in the options form', () => {
  vi.useFakeTimers(); vi.setSystemTime(1000);
  const data = { id: 1 }; setCachedData('/users/1', data, { tags: ['users'] });
  expect(getCachedData('/users/1', { ttl: 20 })).toBe(data);
  vi.advanceTimersByTime(20); expect(getCachedData('/users/1', { ttl: 20 })).toBeNull();
  setCachedData('/users/1', data, { tags: ['users'] }); invalidateFetchCache('users');
  expect(getCachedData('/users/1', { ttl: 100 })).toBeNull();
});
it('retains numeric TTL and tags-array compatibility, including legacy infinite TTL', () => {
  const data = ['one']; setCachedData('/legacy', data, ['legacy']);
  expect(getCachedData('/legacy', Infinity)).toBe(data);
  expect(getCachedData('/legacy', -1)).toBeNull();
  invalidateFetchCache('legacy'); expect(getCachedData('/legacy', Infinity)).toBeNull();
});
it('rejects invalid canonical config before mutating a cache entry', () => {
  setCachedData('/existing', 1);
  expect(() => setCachedData('/existing', 2, { tags: 'not-an-array' } as never)).toThrow();
  expect(getCachedData('/existing', { ttl: 1000 })).toBe(1);
  expect(() => getCachedData('/existing', { ttl: -1 })).toThrow();
  expect(() => getCachedData('/existing', { ttl: 100, extra: true } as never)).toThrow();
});
