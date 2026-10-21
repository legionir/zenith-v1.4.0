import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resetDeprecationWarnings } from '@zenith/errors';
import { setHostPrinter } from '../../errors/src/internal';
import { applyStrategy, cacheFirst, cacheOnly, cacheThenNetwork, networkFirst, staleWhileRevalidate } from '../src/strategies';
let stopPrinter: () => void;
let warnings: string[];
const request = new Request('https://example.test/api');
beforeEach(() => {
  warnings = []; resetDeprecationWarnings();
  stopPrinter = setHostPrinter((_level, title) => { warnings.push(title); });
  vi.stubGlobal('__ZENITH_DEV__', true);
  const entries = new Map<string, Map<string, Response>>();
  vi.stubGlobal('caches', { open: vi.fn(async (name: string) => {
    let cache = entries.get(name); if (!cache) { cache = new Map(); entries.set(name, cache); }
    const owned = cache;
    return { match: async (input: Request) => owned.get(input.url)?.clone(), put: async (input: Request, response: Response) => { owned.set(input.url, response.clone()); } };
  }) });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('fresh')));
});
afterEach(() => { stopPrinter(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('supports canonical strategy forms without compatibility warnings', async () => {
  const config = { cacheName: 'api' };
  expect(await (await cacheFirst(request, config)).text()).toBe('fresh');
  expect(await (await cacheOnly(request, config)).text()).toBe('fresh');
  expect(await (await networkFirst(request, config)).text()).toBe('fresh');
  expect(await (await staleWhileRevalidate(request, config)).text()).toBe('fresh');
  expect(await (await applyStrategy('cacheFirst', request, config)).text()).toBe('fresh');
  expect(warnings.filter(message => message.includes('ZEN-DEPR-'))).toEqual([]);
});
it('warns once for the deprecated overload, not again through its internal dispatch', async () => {
  await applyStrategy('cacheFirst', request, 'api'); await applyStrategy('cacheFirst', request, 'api');
  expect(warnings.filter(message => message.includes('ZEN-DEPR-082'))).toHaveLength(1);
  expect(warnings.some(message => message.includes('ZEN-DEPR-079'))).toBe(false);
});
it('keeps cached response and background update callback separate', async () => {
  await cacheFirst(request, { cacheName: 'api' });
  vi.mocked(fetch).mockResolvedValueOnce(new Response('updated'));
  let resolveUpdate!: (value: string) => void;
  const update = new Promise<string>(resolve => { resolveUpdate = resolve; });
  const cached = await cacheThenNetwork(request, { cacheName: 'api', onUpdate: response => { void response.text().then(resolveUpdate); } });
  expect(await cached.text()).toBe('fresh'); expect(await update).toBe('updated');
});
it('validates config before opening a cache or starting network work', async () => {
  await expect(networkFirst(request, { cacheName: 'api', timeout: -1 })).rejects.toThrow();
  await expect(cacheFirst(request, { cacheName: 'api', extra: true } as never)).rejects.toThrow();
  expect(caches.open).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
it('keeps empty legacy cache names through dispatch without adding canonical validation', async () => {
  expect(await (await applyStrategy('cacheFirst', request, '')).text()).toBe('fresh');
  expect(caches.open).toHaveBeenCalledWith('');
  await expect(cacheFirst(request, { cacheName: '' })).rejects.toThrow();
});
