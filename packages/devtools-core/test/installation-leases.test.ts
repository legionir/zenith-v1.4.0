import { afterEach, expect, it, vi } from 'vitest';
import { getSignalObserver, signal } from '@zenith/state';
import { clearRegistry, getAllSignals, hook, installDevtoolsCore } from '../src';

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); clearRegistry(); vi.unstubAllGlobals(); });
it('does not unpublish a still-live installation when an older observer is detached first', () => {
  vi.stubGlobal('__ZENITH_DEV__', true); vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  vi.stubGlobal('__ZENITH_DEVTOOLS_HOOK__', undefined);
  const previous = getSignalObserver();
  const first = installDevtoolsCore(), second = installDevtoolsCore();
  cleanups.push(() => first.dispose(), () => second.dispose());
  const active = getSignalObserver(); first.dispose(); first.dispose();
  expect(getSignalObserver()).toBe(active); expect(Reflect.get(globalThis, '__ZENITH_DEVTOOLS_HOOK__')).toBe(hook);
  const source = signal('still observed'); cleanups.push(() => source.dispose());
  expect(getAllSignals().some(info => info.signalRef.deref() === source)).toBe(true);
  second.dispose(); expect(getSignalObserver()).toBe(previous);
  expect(Reflect.get(globalThis, '__ZENITH_DEVTOOLS_HOOK__')).not.toBe(hook);
});
it('leaves a newer external hook alone when its final local installation is disposed', () => {
  vi.stubGlobal('__ZENITH_DEV__', true); vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  vi.stubGlobal('__ZENITH_DEVTOOLS_HOOK__', undefined);
  const core = installDevtoolsCore(); cleanups.push(() => core.dispose());
  const external = { version: 'external owner' }; Reflect.set(globalThis, '__ZENITH_DEVTOOLS_HOOK__', external);
  core.dispose(); expect(Reflect.get(globalThis, '__ZENITH_DEVTOOLS_HOOK__')).toBe(external);
});

it('does not commit capture config when a newer installation rejects an incompatible hook', () => {
  vi.stubGlobal('__ZENITH_DEV__', true); vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  vi.stubGlobal('__ZENITH_DEVTOOLS_HOOK__', undefined);
  const installed = installDevtoolsCore({ enabled: true, captureValues: true }); cleanups.push(() => installed.dispose());
  Reflect.set(globalThis, '__ZENITH_DEVTOOLS_HOOK__', { version: 'incompatible' });
  expect(() => installDevtoolsCore({ enabled: true, captureValues: false })).toThrow(/ZEN-2401/);
  const source = signal({ actual: 1 }); cleanups.push(() => source.dispose());
  expect(getAllSignals().find(info => info.signalRef.deref() === source)?.value).toEqual({ actual: 1 });
});

it('does not attach reactive dependencies through installation option getters', async () => {
  const { createRoot, effect } = await import('@zenith/state');
  const { flushSync } = await import('@zenith/scheduler');
  vi.stubGlobal('__ZENITH_DEVTOOLS_HOOK__', undefined);
  const dependency = signal(0);
  createRoot(dispose => {
    let runs = 0;
    effect(() => { runs++; const core = installDevtoolsCore({ get enabled() { dependency.get(); return true; } }); cleanups.push(() => core.dispose()); });
    try { expect(dependency.subscriberCount).toBe(0); dependency.set(1); flushSync(); expect(runs).toBe(1); }
    finally { dispose(); dependency.dispose(); }
  });
});
