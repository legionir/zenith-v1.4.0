// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createRoot, effect, signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { setEffectContextStore, type EffectContext } from '@zenith/state/internal';
import { trackDirective } from '../src/walker-telemetry';
afterEach(() => { setEffectContextStore(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); Reflect.deleteProperty(window, '__ZENITH__'); });
function publish(hook: object) { Reflect.set(window, '__ZENITH__', hook); }
it('keeps real receivers and legacy arity when a foreign hook has no options protocol marker', () => {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const hook = Object.fromEntries(['addDirective', 'addEffect', 'addDom', 'recordWrite', 'recordDomUpdate', 'addSignal', 'recordRead'].map(name => [name,
    function(this: object, ...args: unknown[]) { expect(this).toBe(hook); calls.push({ name, args }); },
  ]));
  publish(hook); trackDirective(document.createElement('b'), { directiveType: 'zen-text', expression: '$value + $value' });
  expect(calls.find(call => call.name === 'addDirective')?.args).toHaveLength(4);
  expect(calls.filter(call => call.name === 'addSignal')).toHaveLength(1); expect(calls.find(call => call.name === 'addSignal')?.args).toEqual(['value', 'value', undefined]);
});
it('uses the canonical graph options only when native protocol two is advertised', () => {
  const addDirective = vi.fn(), addSignal = vi.fn(); publish({ graphProtocolVersion: 2, addDirective, addSignal, addEffect() {}, addDom() {}, recordWrite() {}, recordDomUpdate() {}, recordRead() {} });
  trackDirective(document.createElement('b'), { directiveType: 'zen-text', expression: '$value' });
  expect(addDirective.mock.calls[0]).toHaveLength(2); expect(addDirective.mock.calls[0]?.[1]).toMatchObject({ directiveType: 'zen-text', expression: '$value' });
  expect(addSignal).toHaveBeenCalledWith('value', { name: 'value', value: undefined });
});
it('contains throwing global/member getters and partial hooks without disrupting callers', () => {
  Object.defineProperty(window, '__ZENITH__', { configurable: true, get() { throw new Error('discovery'); } });
  expect(() => trackDirective(document.createElement('b'), { directiveType: 'zen-text', expression: '$x' })).not.toThrow();
  Reflect.deleteProperty(window, '__ZENITH__'); publish({ get addDirective() { throw new Error('member'); } });
  expect(() => trackDirective(document.createElement('b'), { directiveType: 'zen-text', expression: '$x' })).not.toThrow();
});
it('does not track diagnostic native getters or callbacks inside the binding effect', () => {
  const dependency = signal(0); publish({ get addDirective() { dependency.get(); return () => { dependency.get(); }; } });
  createRoot(dispose => {
    let runs = 0; effect(() => { runs++; trackDirective(document.createElement('b'), { directiveType: 'zen-text', expression: '$x' }); });
    try { expect(dependency.subscriberCount).toBe(0); dependency.set(1); flushSync(); expect(runs).toBe(1); }
    finally { dispose(); dependency.dispose(); }
  });
});
it('does not even discover a browser hook when the native request policy is muted', () => {
  let reads = 0; Object.defineProperty(window, '__ZENITH__', { configurable: true, get() { reads++; return {}; } });
  const host: EffectContext = { owner: null, activeEffect: null, activeCleanupRegistration: null, globalObservation: false }; setEffectContextStore(() => host);
  trackDirective(document.createElement('b'), { directiveType: 'zen-text', expression: 'private' }); expect(reads).toBe(0);
});

it('bounds native hook reentry for the same actual element', () => {
  const element = document.createElement('b'), input = { directiveType: 'zen-text', expression: '$x' }; let calls = 0;
  publish({ addDirective() { calls++; trackDirective(element, input); } });
  trackDirective(element, input); expect(calls).toBe(1);
});
it('shares weak element identities and monotonic IDs across duplicate source module loads', async () => {
  const captured: unknown[] = []; publish({ addDirective(id: unknown) { captured.push(id); } });
  const first = document.createElement('b'), second = document.createElement('b'); trackDirective(first, { directiveType: 'zen-text', expression: '$x' });
  vi.resetModules(); const duplicate = await import('../src/walker-telemetry');
  duplicate.trackDirective(second, { directiveType: 'zen-text', expression: '$x' }); duplicate.trackDirective(first, { directiveType: 'zen-text', expression: '$x' });
  expect(captured).toHaveLength(3); expect(captured[0]).not.toBe(captured[1]); expect(captured[0]).toBe(captured[2]);
});
