import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '@zenith/runtime-core';
import { defineStore, useStorePlugin } from '../src';
const apps: ReturnType<typeof createApp>[] = [];
afterEach(() => { for (const app of apps.splice(0)) app.dispose(); vi.unstubAllGlobals(); });
it('captures store-default plugins in one App and releases all throwing/successful plugins', () => {
  const first = createApp(), second = createApp(); apps.push(first, second); const install = vi.fn(); const stop = vi.fn();
  first.run(() => useStorePlugin(() => { install(); return stop; }));
  const use = defineStore('same', { state: () => ({ count: 0 }) });
  const a = first.run(use), b = second.run(use); expect(a).not.toBe(b); expect(install).toHaveBeenCalledOnce();
  first.dispose(); expect(stop).toHaveBeenCalledOnce(); expect(second.run(use)).toBe(b);
});
it('does not restore a previous SSR App\'s fallback-memory persistence', () => {
  vi.stubGlobal('localStorage', undefined); const first = createApp(), second = createApp(); apps.push(first, second);
  const use = defineStore('request-state', { state: () => ({ name: 'initial' }), persist: true });
  first.run(() => { const store = use(); store.state.name = 'private-first-request'; store.dispose(); });
  expect(second.run(use).state.name).toBe('initial');
});
it('continues teardown after a failing plugin cleanup', () => {
  const app = createApp(); apps.push(app); const stop = vi.fn();
  const store = app.run(defineStore('cleanup', { state: () => ({ count: 0 }) }));
  store.use(() => stop); store.use(() => () => { throw new Error('cleanup'); });
  expect(() => store.dispose()).toThrow(); expect(stop).toHaveBeenCalledOnce(); expect(app.registries.stores.has('cleanup')).toBe(false);
});
it('rolls back a failed initial plugin installation without registering a half-built store', () => {
  const app = createApp(); apps.push(app); const stop = vi.fn();
  app.run(() => { useStorePlugin(() => stop); useStorePlugin(() => { throw new Error('install'); }); });
  expect(() => app.run(defineStore('broken', { state: () => ({ count: 0 }) }))).toThrow(); expect(stop).toHaveBeenCalledOnce(); expect(app.registries.stores.has('broken')).toBe(false);
});
it('does not retain a cleanup returned after reentrant store disposal', () => {
  const app = createApp(); apps.push(app); const store = app.run(defineStore('reentrant', { state: () => ({ count: 0 }) })); const stop = vi.fn();
  store.use(() => { store.dispose(); return stop; }); expect(stop).toHaveBeenCalledOnce(); app.dispose(); expect(stop).toHaveBeenCalledOnce();
});
it('refuses prototype-mutating persistence/patch keys but preserves Date values', () => {
  const app = createApp(); apps.push(app); const store = app.run(defineStore('safe-patch', { state: () => ({ nested: { count: 0 }, date: new Date(0) }) })); const prototype = Object.getPrototypeOf(store.state);
  store.$patch(JSON.parse('{"__proto__":{"polluted":true},"nested":{"constructor":{"prototype":{"polluted":true}},"count":2}}'));
  expect(Object.getPrototypeOf(store.state)).toBe(prototype); expect(Object.hasOwn(store.state.nested, 'constructor')).toBe(false); expect(store.state.nested.count).toBe(2);
  const replacement = new Date(1000); store.$patch({ date: replacement }); expect(store.state.date).toBeInstanceOf(Date);
});
it('preserves deep proxy identity through aliases and cycles without class-instance brand errors', () => {
  const app = createApp(); apps.push(app); const shared = { count: 0 }; const raw = { first: shared, second: shared, self: undefined as unknown, date: new Date(0) }; raw.self = raw;
  const store = app.run(defineStore('aliases', { state: () => raw })); const changed = vi.fn(); store.$subscribe(changed);
  expect(store.state.first).toBe(store.state.second); expect(store.state.self).toBe(store.state); store.state.second.count++; expect(changed).toHaveBeenCalledOnce(); expect(store.state.first.count).toBe(1); expect(store.state.date.getTime()).toBe(0);
});
