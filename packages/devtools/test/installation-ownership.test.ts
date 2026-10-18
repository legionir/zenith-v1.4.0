// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearRegistry, signal } from '@zenith/state';
import { setEffectContextStore, type EffectContext } from '@zenith/state/internal';
import { cleanupDevtools, initDevTools, isDevtoolsHookInstalled } from '../src';

function published(): object {
  const hook: unknown = Reflect.get(window, '__ZENITH__');
  if (hook !== null && (typeof hook === 'object' || typeof hook === 'function')) return hook;
  throw new Error('No actual published hook');
}
function call(hook: object, name: string, ...args: unknown[]): unknown {
  const method: unknown = Reflect.get(hook, name);
  if (typeof method !== 'function') throw new Error(`Missing ${name}`);
  return Reflect.apply(method, hook, args);
}
beforeEach(() => { setEffectContextStore(null); cleanupDevtools(); clearRegistry(); vi.stubGlobal('__ZENITH_DEVTOOLS__', true); });
afterEach(() => { setEffectContextStore(null); cleanupDevtools(); clearRegistry(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('owns only its own listeners and leaves foreign cleanup handlers untouched', () => {
  const foreign = vi.fn(), handlers = [foreign]; Reflect.set(window, '__zenCleanupHandlers', handlers);
  try {
    initDevTools(); cleanupDevtools(); expect(foreign).not.toHaveBeenCalled(); expect(Reflect.get(window, '__zenCleanupHandlers')).toBe(handlers);
  } finally { Reflect.deleteProperty(window, '__zenCleanupHandlers'); }
});
it('preserves an external replacement and revokes retained old hook methods on cleanup', () => {
  initDevTools(); const old = published(), external = { owner: 'external' };
  Reflect.set(window, '__ZENITH__', external); cleanupDevtools();
  expect(Reflect.get(window, '__ZENITH__')).toBe(external); expect(isDevtoolsHookInstalled()).toBe(false);
  call(old, 'addStaticFor', 'late', { expr: 'private', itemCount: 1 }); expect(call(old, 'getStaticFors')).toEqual([]);
  Reflect.deleteProperty(window, '__ZENITH__'); initDevTools(); const next = published(); expect(next).not.toBe(old);
  call(old, 'recordCacheHit', 'must not enter new install'); expect(call(next, 'getCacheStats')).toMatchObject({ hits: 0 });
});
it('stops subscriptions on pagehide and allows a still-live hook to be reused', () => {
  initDevTools(); const hook = published(), source = signal(0); let calls = 0;
  const cleanup: unknown = call(hook, 'onStateChange', () => { calls++; });
  try {
    source.set(1); expect(calls).toBe(1); window.dispatchEvent(new Event('pagehide')); source.set(2); expect(calls).toBe(1);
    expect(isDevtoolsHookInstalled()).toBe(true);
    if (typeof cleanup === 'function') Reflect.apply(cleanup, undefined, []);
  } finally { source.dispose(); }
});
it('registers visibility cleanup on the captured Document and releases listeners on repeated installs', () => {
  const add = vi.spyOn(document, 'addEventListener'), remove = vi.spyOn(document, 'removeEventListener');
  initDevTools(); initDevTools(); expect(add.mock.calls.filter(args => args[0] === 'visibilitychange')).toHaveLength(1);
  cleanupDevtools(); cleanupDevtools(); expect(remove.mock.calls.filter(args => args[0] === 'visibilitychange')).toHaveLength(1);
});
it('supports new options and positional compatibility without sharing mutable metadata snapshots', () => {
  initDevTools(); const hook = published(); expect(Reflect.get(hook, 'graphProtocolVersion')).toBe(2);
  call(hook, 'addStaticFor', 'new', { expr: '$new', itemCount: 1 }); call(hook, 'addStaticFor', 'old', '$old', 2);
  call(hook, 'recordResourceDestroy', 'new', { url: '/new', stack: 'trace' }); call(hook, 'recordResourceDestroy', 'old', '/old', 'legacy');
  expect(call(hook, 'getStaticFors')).toMatchObject([{ id: 'new', expr: '$new' }, { id: 'old', itemCount: 2 }]);
  const snapshot = call(hook, 'getStaticFors'); if (Array.isArray(snapshot)) snapshot.pop(); expect(call(hook, 'getStaticFors')).toHaveLength(2);
  expect(call(hook, 'getDestroyedResources')).toHaveLength(2);
});
it('bounds long-lived diagnostic metadata', () => {
  initDevTools(); const hook = published();
  for (let index = 0; index < 1005; index++) {
    call(hook, 'addStaticFor', String(index), { expr: String(index), itemCount: index });
    call(hook, 'recordResourceDestroy', String(index), { url: `/${index}` });
    call(hook, 'recordCacheMiss', String(index)); call(hook, 'recordSSRStore', String(index));
  }
  expect(call(hook, 'getStaticFors')).toHaveLength(1000); expect(call(hook, 'getDestroyedResources')).toHaveLength(1000);
  expect(call(hook, 'getCacheStats')).toMatchObject({ uniqueExpressions: 1000 }); expect(call(hook, 'getActiveSSRStores')).toHaveLength(1000);
});
it('cannot mutate, subscribe to or clear outside tools from a muted native host scope', () => {
  initDevTools(); const hook = published(); call(hook, 'addStaticFor', 'outside', { expr: 'outside', itemCount: 1 });
  const host: EffectContext = { owner: null, activeEffect: null, activeCleanupRegistration: null, globalObservation: false };
  setEffectContextStore(() => host);
  call(hook, 'addStaticFor', 'private', { expr: 'secret', itemCount: 1 }); call(hook, 'recordCacheHit', 'secret');
  expect(call(hook, 'getStaticFors')).toEqual([]); expect(call(hook, 'getDependencyGraph')).toMatchObject({ nodes: [], edges: [] });
  cleanupDevtools(); initDevTools(); expect(isDevtoolsHookInstalled()).toBe(false);
  setEffectContextStore(null); expect(isDevtoolsHookInstalled()).toBe(true);
  expect(call(hook, 'getStaticFors')).toMatchObject([{ id: 'outside' }]); expect(call(hook, 'getCacheStats')).toMatchObject({ hits: 0 });
});

it('rolls back only its own publication when lifecycle setup fails', () => {
  const add = vi.spyOn(document, 'addEventListener').mockImplementation(type => { if (type === 'visibilitychange') throw new Error('setup'); });
  expect(() => initDevTools()).not.toThrow(); expect(isDevtoolsHookInstalled()).toBe(false); expect(Reflect.get(window, '__ZENITH__')).toBeUndefined(); add.mockRestore();
});
it('keeps subscribed callbacks silent after external replacement, before explicit teardown', () => {
  initDevTools(); const hook = published(), source = signal(0); let calls = 0;
  call(hook, 'onStateChange', () => { calls++; }); Reflect.set(window, '__ZENITH__', { replacement: true });
  source.set(1); expect(calls).toBe(0); source.dispose(); cleanupDevtools(); Reflect.deleteProperty(window, '__ZENITH__');
});
