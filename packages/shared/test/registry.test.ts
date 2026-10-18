import { expect, it, vi } from 'vitest';
import { createReferenceRegistry, createScopedRegistry, registerRegistryOwnerProvider } from '../src';
it('binds cleanup to an exact registration, even with the same value', () => {
  const registry = createReferenceRegistry<object>(); const object = {}; const stale = registry.register('x', object); const current = registry.register('x', object); stale(); expect(registry.get('x')).toBe(object); current(); current(); expect(registry.has('x')).toBe(false);
});
it('captures teardown before an owner changes and does not merge fallback values', () => {
  const registry = createScopedRegistry<object>('resources'); const fallback = {}; registry.set('global', fallback);
  const owned = createReferenceRegistry<unknown>(); const releaseProvider = registerRegistryOwnerProvider(() => ({ registries: { resources: owned }, addCleanup: vi.fn() }));
  const value = {}; const release = registry.register('private', value); expect(registry.get('global')).toBeUndefined(); releaseProvider(); release(); expect(owned.list()).toEqual([]); expect(registry.get('global')).toBe(fallback); registry.clear();
});
it('prioritizes App context over request context independently of installation order', () => {
  const app = createReferenceRegistry<unknown>(); const request = createReferenceRegistry<unknown>();
  const appOff = registerRegistryOwnerProvider(() => ({ registries: { stores: app }, addCleanup: vi.fn() }), { priority: 100 });
  const requestOff = registerRegistryOwnerProvider(() => ({ registries: { stores: request }, addCleanup: vi.fn() }));
  const store = createScopedRegistry<object>('stores'); store.set('x', {}); expect(app.has('x')).toBe(true); expect(request.has('x')).toBe(false); appOff(); store.set('y', {}); expect(request.has('y')).toBe(true); requestOff();
});
