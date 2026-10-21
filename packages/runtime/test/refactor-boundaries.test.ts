// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { registerAction } from '@zenith/actions';
import { routeSignal } from '@zenith/router';
import { logger } from '@zenith/logger';
import { Zen, ZEN_START_OPTIONS_DEFAULTS, resolveZenStartOptions } from '../src';
import { Zen as Singleton } from '../src/zen';
import { ZEN_START_OPTIONS_DEFAULTS as Defaults, resolveZenStartOptions as Resolve } from '../src/options';
import { createPerformanceMonitor } from '../src/performance';
import { createFlush } from '../src/flush';
import type { ZenithReloadGlobal, ZenithRootElement } from '../src/host-types';

vi.mock('../src/auth-api', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/auth-api')>();
  return { ...actual, initAuth: vi.fn(async () => {}) };
});
const roots: HTMLElement[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) Zen.stop(root);
  Zen.perf.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = '';
});
function root(): ZenithRootElement {
  const element = document.createElement('main'); document.body.append(element); roots.push(element); return element;
}
it('keeps the singleton/options identities through the public facade', () => {
  expect(Zen).toBe(Singleton); expect(Zen.action.register).toBe(registerAction); expect(Zen.route).toBe(routeSignal);
  expect(ZEN_START_OPTIONS_DEFAULTS).toBe(Defaults); expect(resolveZenStartOptions).toBe(Resolve);
});
it('keeps synchronous DOM binding and root-owned delegation/disposal', () => {
  const element = root(), count = signal(1);
  element.innerHTML = '<span zen-text="$count"></span>';
  Zen.start(element, { count }, { devtools: false, ssr: { preloadState: false } });
  expect(element.textContent).toBe('1'); expect(element.__zenithDelegationTeardown).toBeTypeOf('function');
  expect(element.__zenithDisposes?.length).toBeGreaterThan(0);
  count.set(2); Zen.flushSync(); expect(element.textContent).toBe('2');
  Zen.stop(element); expect(element.__zenithDelegationTeardown).toBeUndefined(); expect(element.__zenithDisposes).toBeUndefined();
  count.set(3); Zen.flushSync(); expect(element.textContent).toBe('2'); count.dispose();
});
it('resolves extracted methods against the same singleton and preserves HMR state identity', () => {
  const element = root(), state = { value: signal('old') };
  element.innerHTML = '<span zen-text="$value"></span>';
  const start = Zen.start; start(element, state, { devtools: false, ssr: { preloadState: false } });
  const reload = (globalThis as ZenithReloadGlobal).__ZENITH_RELOAD__;
  const stopSpy = vi.spyOn(Zen, 'stop'), startSpy = vi.spyOn(Zen, 'start');
  expect(reload).toBeTypeOf('function'); reload?.('component.html');
  expect(stopSpy).toHaveBeenCalledWith(element); expect(startSpy).toHaveBeenCalledWith(element, state);
  state.value.dispose();
});
it('preserves plugin options identity, synchronous installation and singleton deduplication', () => {
  const options = { payload: {} };
  const install = vi.fn(); const name = 'runtime-boundary-sync';
  expect(Zen.use({ name, install }, options)).toBe(Zen);
  expect(install).toHaveBeenCalledOnce(); expect(install).toHaveBeenCalledWith(Zen, options);
  Zen.use({ name, install }, { payload: 'ignored' }); expect(install).toHaveBeenCalledOnce(); expect(Zen.plugins()).toContain(name);
});
it('does not retain a failed plugin installation and permits a synchronous retry', () => {
  vi.spyOn(logger, 'error').mockImplementation(() => {});
  const name = 'runtime-boundary-retry', install = vi.fn().mockImplementationOnce(() => { throw new Error('install'); });
  Zen.use({ name, install }); expect(Zen.plugins()).not.toContain(name);
  Zen.use({ name, install }); expect(install).toHaveBeenCalledTimes(2); expect(Zen.plugins()).toContain(name);
});
it('keeps cloak insertion idempotent and dispatches CSS through the live API', () => {
  vi.spyOn(Zen, 'cloakCSS').mockReturnValue('[zen-cloak] { visibility: hidden; }');
  try {
    expect(Zen.__injectCloakStyle()).toBe(true); expect(Zen.__injectCloakStyle()).toBe(false);
    expect(document.getElementById('zenith-cloak-style')?.textContent).toBe('[zen-cloak] { visibility: hidden; }');
  } finally { Zen.__removeCloakStyle(); }
  expect(document.getElementById('zenith-cloak-style')).toBeNull();
});
it('preserves root-validation messages rather than leaking helper names', () => {
  expect(() => Zen.start(null as unknown as HTMLElement)).toThrow('[Zen.start] Root element is required.');
});
it('keeps monitor histories and flush latches isolated between factory instances', () => {
  vi.stubGlobal('__ZENITH_DEV__', true);
  const first = createPerformanceMonitor(), second = createPerformanceMonitor();
  first.mark('one'); expect(first.measure('one')?.name).toBe('one'); expect(second.getReport()).toEqual([]);
  const report = first.getReport(); first.clear(); expect(report).toEqual([]); expect(first.measure('one')).toBeUndefined();
  expect(createFlush()).not.toBe(createFlush());
});
