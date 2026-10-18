import { afterEach, expect, expectTypeOf, it } from 'vitest';
import { Signal, effect } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { routeSignal, type RouteState } from '../src';
import { runWithRoute, runWithRouteSync } from '../src/node';
import { browserRouteSignal, getCurrentRouteSignal } from '../src/route-state';
afterEach(() => browserRouteSignal.set({ path: '/', params: {} }));
it('is backed by a real Signal and supplies the entire declared public contract', () => {
  expectTypeOf(routeSignal).toEqualTypeOf<Signal<RouteState>>(); expect(routeSignal).toBeInstanceOf(Signal); routeSignal.set({ path: '/a', params: {} }); routeSignal.update(value => ({ ...value, path: '/b' })); expect(routeSignal.peek().path).toBe('/b'); expect(routeSignal.get().path).toBe('/b'); expect('addSubscriber' in routeSignal).toBe(false);
});
it('resolves extracted methods at invocation time and restores nested scopes', () => {
  const get = routeSignal.get, set = routeSignal.set, peek = routeSignal.peek;
  runWithRouteSync('/outer', () => { set({ path: '/updated', params: { id: '1' } }); runWithRouteSync('/inner', () => expect(get().path).toBe('/inner')); expect(peek()).toEqual({ path: '/updated', params: { id: '1' } }); }); expect(get()).toEqual({ path: '/', params: {} });
});
it('tracks and releases the actual selected signal rather than a synthetic facade node', () => {
  runWithRouteSync('/owned', () => {
    const selected = getCurrentRouteSignal(), values: string[] = [], stop = effect(() => { values.push(routeSignal.get().path); });
    try { expect(selected.subscriberCount).toBe(1); routeSignal.update(value => ({ ...value, path: '/next' })); flushSync(); expect(values).toEqual(['/owned', '/next']); } finally { stop(); } expect(selected.subscriberCount).toBe(0);
  });
});
it('isolates 100 overlapping async scopes including rejection and releases their subscribers', async () => {
  const selected: Signal<RouteState>[] = [];
  await Promise.all(Array.from({ length: 100 }, (_, id) => runWithRoute(`/request-${id}`, async () => {
    const current = getCurrentRouteSignal(); selected.push(current); effect(() => { routeSignal.get(); }); await Promise.resolve(); expect(routeSignal.peek().path).toBe(`/request-${id}`); if (id % 2) throw new Error('fixture');
  }).catch(error => { expect(error.message).toBe('fixture'); })));
  expect(new Set(selected).size).toBe(100); expect(selected.every(value => value.subscriberCount === 0)).toBe(true); expect(browserRouteSignal.peek().path).toBe('/');
});
