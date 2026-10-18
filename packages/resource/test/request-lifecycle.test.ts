import { afterEach, expect, it, vi } from 'vitest';
import { Resource } from '../src';
const resources: Resource<unknown>[] = [];
function resource() { const value = new Resource<unknown>({ url: '/items', retryCount: 0 }); resources.push(value); return value; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
afterEach(() => { for (const value of resources.splice(0)) value.dispose(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('joins identical in-flight reads before changing the active cancellation controller', async () => {
  const response = deferred<Response>(); const fetcher = vi.fn(() => response.promise); vi.stubGlobal('fetch', fetcher); const value = resource();
  const first = value.list(); const second = value.list(); expect(fetcher).toHaveBeenCalledTimes(1);
  response.resolve(Response.json([{ id: 1 }])); const results = await Promise.all([first, second]); expect(results.every(result => result.success)).toBe(true); expect(value.data).toEqual([{ id: 1 }]);
});
it('ignores a late non-cooperative response after a newer forced read', async () => {
  const old = deferred<Response>(); const fresh = deferred<Response>(); const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise); vi.stubGlobal('fetch', fetcher); const value = resource();
  const first = value.list(true); const second = value.list(true); fresh.resolve(Response.json(['fresh'])); await second; old.resolve(Response.json(['stale'])); expect(await first).toMatchObject({ success: false, error: 'aborted' }); expect(value.data).toEqual(['fresh']); expect(value.loading).toBe(false);
});
it('invalidates an in-flight generation when reset is called', async () => {
  const response = deferred<Response>(); vi.stubGlobal('fetch', vi.fn(() => response.promise)); const value = resource(); const request = value.list(); value.reset(); response.resolve(Response.json(['late'])); expect(await request).toMatchObject({ success: false, error: 'aborted' }); expect(value.data).toBeNull(); expect(value.loading).toBe(false);
});
it('does not reuse a list cache entry for a different entity URL', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json([{ id: 1 }])).mockResolvedValueOnce(Response.json({ id: 2 })); vi.stubGlobal('fetch', fetcher); const value = resource(); await value.list(); expect(await value.read(2)).toMatchObject({ data: { id: 2 } }); expect(fetcher).toHaveBeenCalledTimes(2);
});
it('cancels retry backoff immediately when its owner disposes', async () => {
  vi.useFakeTimers(); const fetcher = vi.fn().mockRejectedValue(new TypeError('network unavailable')); vi.stubGlobal('fetch', fetcher); const value = new Resource({ url: '/retry', retryCount: 2, retryDelay: 10000 }); resources.push(value); const request = value.list();
  await vi.advanceTimersByTimeAsync(0); expect(vi.getTimerCount()).toBeGreaterThan(0); value.dispose(); expect(await request).toMatchObject({ success: false, error: 'aborted' }); expect(vi.getTimerCount()).toBe(0); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('encodes a caller-provided entity id as one path segment', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 'a/b' })); vi.stubGlobal('fetch', fetcher); const value = resource(); await value.read('a/b?secret=not-a-query'); expect(fetcher.mock.calls[0]?.[0]).toBe('/items/a%2Fb%3Fsecret%3Dnot-a-query');
});
it('clears loading for a successful empty response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 }))); const value = resource(); expect(await value.list()).toMatchObject({ success: true }); expect(value.loading).toBe(false); expect(value.error).toBeNull();
});
it('serializes caller JSON once rather than encoding its JSON string again', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 1 })); vi.stubGlobal('fetch', fetcher); const value = resource(); const toJSON = vi.fn(() => ({ created: '2026-10-17' }));
  await value.create({ toJSON }); expect(toJSON).toHaveBeenCalledOnce(); expect(fetcher.mock.calls[0]?.[1]?.body).toBe('{"created":"2026-10-17"}');
});
it('settles a non-serializable request body without starting transport', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); const value = resource(); const circular: Record<string, unknown> = {}; circular.self = circular;
  expect(await value.create(circular)).toMatchObject({ success: false }); expect(fetcher).not.toHaveBeenCalled();
});
it('does not let an old queued rejection roll back state after reset', async () => {
  const value = resource(); let reject!: (reason: unknown) => void; const pending = new Promise<never>((_, fail) => { reject = fail; }); const rollback = vi.fn(), next = vi.fn(async () => ({ success: true }));
  value.enqueueMutation(() => pending, rollback); value.reset(); value.enqueueMutation(next); reject(new Error('old operation')); 
  await Promise.resolve(); await Promise.resolve(); expect(next).toHaveBeenCalledOnce(); expect(rollback).not.toHaveBeenCalled();
});
it('does not retain queued operations or DOM callbacks registered after disposal', () => {
  const value = resource(); value.dispose(); const operation = vi.fn(async () => ({ success: true })), domRelease = vi.fn();
  value.enqueueMutation(operation); const stop = value.registerDOMCleanup(domRelease); expect(operation).not.toHaveBeenCalled(); expect(domRelease).toHaveBeenCalledOnce(); stop(); value.dispose(); expect(domRelease).toHaveBeenCalledOnce();
});
it('releases independent DOM registration tokens without deleting a later registration', () => {
  const value = resource(); const callback = vi.fn(); const first = value.registerDOMCleanup(callback); const second = value.registerDOMCleanup(callback);
  first(); first(); value.dispose(); expect(callback).toHaveBeenCalledOnce(); second();
});
it('does not let an old DOM cleanup token unregister a replacement after explicit unregister', () => {
  const value = resource(); const callback = vi.fn(); const old = value.registerDOMCleanup(callback); value.unregisterDOMCleanup(callback); value.registerDOMCleanup(callback); old(); value.dispose(); expect(callback).toHaveBeenCalledOnce();
});
it('continues disposal after a throwing DOM callback and does not retain its timer', () => {
  vi.useFakeTimers(); const value = resource(); value.startAutoRefresh(1000); const next = vi.fn();
  value.registerDOMCleanup(() => { throw new Error('DOM cleanup failed'); }); value.registerDOMCleanup(next);
  expect(() => value.dispose()).toThrow('DOM cleanup failed'); expect(next).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0); expect(() => value.dispose()).not.toThrow();
});
it('does not resurrect a Resource from a reset called during its own DOM teardown', () => {
  vi.useFakeTimers(); const value = resource(); const operation = vi.fn(async () => ({ success: true }));
  value.registerDOMCleanup(() => { value.reset(); value.startAutoRefresh(1000); }); value.dispose(); value.enqueueMutation(operation);
  expect(operation).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  value.reset(); value.enqueueMutation(operation); expect(operation).toHaveBeenCalledOnce();
});
