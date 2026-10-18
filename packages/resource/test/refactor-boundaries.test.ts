import { afterEach, expect, it, vi } from 'vitest';
import { Resource, createResource, getResource, registerResource, resetResourceRegistry } from '../src';
import { Resource as Engine } from '../src/engine';
import { Resource as Facade } from '../src/resource';
import { createResource as Create } from '../src/registry';
import { createCacheKey } from '../src/cache-key';
const owners: Resource<unknown>[] = [];
afterEach(() => { for (const owner of owners.splice(0)) owner.dispose(); resetResourceRegistry(); vi.unstubAllGlobals(); });
it('retains one constructor and factory through the root and compatibility facade', () => {
  expect(Resource).toBe(Engine); expect(Facade).toBe(Engine); expect(createResource).toBe(Create);
  const resource = createResource('factory-boundary', { url: '/items' });
  expect(resource).toBeInstanceOf(Engine); expect(getResource('factory-boundary')).toBe(resource);
});
it('preserves canonical body identity, array order and missing-body distinction', () => {
  expect(createCacheKey({ method: 'POST', url: '/items', body: { b: 2, a: { z: 3, y: 4 } } }))
    .toBe(createCacheKey({ method: 'POST', url: '/items', body: { a: { y: 4, z: 3 }, b: 2 } }));
  expect(createCacheKey({ method: 'POST', url: '/items', body: [1, 2] })).not.toBe(createCacheKey({ method: 'POST', url: '/items', body: [2, 1] }));
  expect(createCacheKey({ method: 'POST', url: '/items' })).not.toBe(createCacheKey({ method: 'POST', url: '/items', body: null }));
});
it('uses original owner identity for every registration release during disposal', () => {
  const resource = new Resource({ url: '/items' }); owners.push(resource);
  const first = registerResource('first-boundary', resource), second = registerResource('second-boundary', resource);
  resource.dispose(); expect(getResource('first-boundary')).toBeUndefined(); expect(getResource('second-boundary')).toBeUndefined();
  first(); second(); resource.dispose();
});
it('forwards a revived signal rather than holding a disposed signal in helpers', async () => {
  const resource = new Resource({ url: '/items', retryCount: 0 }); owners.push(resource);
  const original = resource.signal; resource.dispose(); resource.reset();
  expect(resource.signal).not.toBe(original); const revived = resource.signal;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(['revived'])));
  expect(await resource.list()).toMatchObject({ success: true, data: ['revived'] });
  expect(resource.signal).toBe(revived); expect(revived.get().data).toEqual(['revived']);
  resource.reset(); expect(resource.signal).toBe(revived); expect(revived.get().data).toBeNull();
});
it('does not retain data/controller generations across a reset made during transport', async () => {
  let resolve!: (value: Response) => void;
  const response = new Promise<Response>(done => { resolve = done; });
  const fetcher = vi.fn().mockReturnValueOnce(response).mockResolvedValueOnce(Response.json(['new'])); vi.stubGlobal('fetch', fetcher);
  const resource = new Resource({ url: '/items', retryCount: 0 }); owners.push(resource);
  const pending = resource.list(); resource.reset(); await resource.list(); resolve(Response.json(['old']));
  expect(await pending).toMatchObject({ success: false, error: 'aborted' }); expect(resource.data).toEqual(['new']);
});
