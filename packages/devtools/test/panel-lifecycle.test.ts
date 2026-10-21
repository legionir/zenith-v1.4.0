import { afterEach, expect, it, vi } from 'vitest';
import { createRoot, effect, signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { setEffectContextStore, type EffectContext } from '@zenith/state/internal';
import { runGlobalResets } from '@zenith/errors';
import { devtoolsAPI, registerPanelSignal, recordPanelStateChange, registerEffect, markEffectActive, markEffectDisposed } from '../src';
afterEach(() => { setEffectContextStore(null); devtoolsAPI.disable(); vi.unstubAllGlobals(); });
it('uses distinct subscriptions for identical callbacks and clears dormant disabled subscriptions', () => {
  const calls: unknown[] = [], callback = (value: unknown) => { calls.push(value); };
  const dormant = devtoolsAPI.subscribeToSignals(callback); devtoolsAPI.disable(); devtoolsAPI.enable();
  registerPanelSignal({ get: () => 0 }); expect(calls).toEqual([]); dormant();
  const old = devtoolsAPI.subscribeToSignals(callback); devtoolsAPI.disable(); devtoolsAPI.enable();
  const current = devtoolsAPI.subscribeToSignals(callback); old(); registerPanelSignal({ get: () => 1 }); expect(calls).toHaveLength(1); current();
});
it('does not capture reactive dependencies through readers or listeners', () => {
  devtoolsAPI.enable(); const dependency = signal(0), view = { get: () => dependency.get() };
  const stop = devtoolsAPI.subscribeToSignals(() => { dependency.get(); });
  createRoot(dispose => {
    let runs = 0; effect(() => { runs++; registerPanelSignal(view); });
    try { expect(dependency.subscriberCount).toBe(0); dependency.set(1); flushSync(); expect(runs).toBe(1); }
    finally { stop(); dispose(); dependency.dispose(); }
  });
});
it('bounds reader and listener reentry and discards captures invalidated by disable/re-enable', () => {
  devtoolsAPI.enable(); let reads = 0;
  const recursive = { get: () => { reads++; registerPanelSignal(recursive); return 1; } }; registerPanelSignal(recursive);
  expect(reads).toBe(1); let notifications = 0;
  const stop = devtoolsAPI.subscribeToSignals(() => { notifications++; registerPanelSignal({ get: () => 'nested' }); });
  registerPanelSignal({ get: () => 2 }); expect(notifications).toBe(1); stop();
  devtoolsAPI.disable(); devtoolsAPI.enable(); registerPanelSignal({ get: () => { devtoolsAPI.disable(); devtoolsAPI.enable(); return 'stale'; } });
  expect(devtoolsAPI.getSignals()).toEqual([]);
});
it('isolates callback metadata, defers additions and stops an invalidated event dispatch', () => {
  devtoolsAPI.enable(); registerPanelSignal({ get: () => 0 }); const id = devtoolsAPI.getSignals()[0]!.id;
  const seen: unknown[] = []; let added = false; const cleanups: Array<() => void> = [];
  cleanups.push(devtoolsAPI.subscribeToStateChanges(change => {
    if (!added) { added = true; cleanups.push(devtoolsAPI.subscribeToStateChanges(next => { seen.push(next.newValue); })); }
    change.newValue = 'mutated callback copy';
  }));
  recordPanelStateChange(id, { oldValue: 0, newValue: 1 }); expect(seen).toEqual([]); expect(devtoolsAPI.getStateTimeline()[0]?.newValue).toBe(1);
  recordPanelStateChange(id, { oldValue: 1, newValue: 2 }); expect(seen).toEqual([2]);
  for (const stop of cleanups) stop();
  devtoolsAPI.subscribeToStateChanges(() => { devtoolsAPI.disable(); devtoolsAPI.enable(); });
  devtoolsAPI.subscribeToStateChanges(() => { seen.push('must not run'); });
  recordPanelStateChange(id, { oldValue: 2, newValue: 3 }); expect(seen).toEqual([2]); expect(devtoolsAPI.getStateTimeline()).toEqual([]);
});
it('does not expose mutable effect metadata or reactivate disposed effects', () => {
  devtoolsAPI.enable(); const id = registerEffect(1), dependencies = ['source']; markEffectActive(id, dependencies); dependencies.push('external');
  const info = devtoolsAPI.getEffect(id); info?.dependencies.push('mutated'); expect(devtoolsAPI.getEffect(id)?.dependencies).toEqual(['source']);
  markEffectDisposed(id); markEffectActive(id, ['revived']); expect(devtoolsAPI.getEffect(id)).toMatchObject({ active: false, disposed: true, dependencies: [] });
});
it('bounds signal/effect/timeline records without retaining native readable objects', () => {
  devtoolsAPI.enable(); for (let index = 0; index < 1005; index++) { registerPanelSignal({ get: () => index }); registerEffect(index); }
  expect(devtoolsAPI.getStats()).toMatchObject({ totalSignals: 1000 }); expect(devtoolsAPI.getEffects()).toHaveLength(1000);
  for (let index = 0; index < 505; index++) recordPanelStateChange('event', { oldValue: index, newValue: index + 1 });
  expect(devtoolsAPI.getStateTimeline(1000)).toHaveLength(500); expect(devtoolsAPI.getStateTimeline(0)).toEqual([]);
});
it('respects muted scopes without disabling the outside API or retaining private subscriptions', () => {
  devtoolsAPI.enable(); registerPanelSignal({ get: () => 'outside' }); let calls = 0;
  const host: EffectContext = { owner: null, activeEffect: null, activeCleanupRegistration: null, globalObservation: false }; setEffectContextStore(() => host);
  const stop = devtoolsAPI.subscribeToSignals(() => { calls++; }); devtoolsAPI.disable(); registerPanelSignal({ get: () => 'secret' });
  expect(devtoolsAPI.enabled).toBe(false); expect(devtoolsAPI.getSignals()).toEqual([]); expect(registerEffect(1)).toBe('');
  setEffectContextStore(null); expect(devtoolsAPI.enabled).toBe(true); expect(devtoolsAPI.getSignals().map(info => info.value)).toEqual(['outside']);
  registerPanelSignal({ get: () => 'new outside' }); expect(calls).toBe(0); stop();
});
it('keeps deprecated raw payload arity distinct from canonical options-shaped data', () => {
  devtoolsAPI.enable(); const old = { oldValue: 'opaque', newValue: 'also opaque' };
  recordPanelStateChange('id', old, undefined); expect(devtoolsAPI.getStateTimeline()[0]?.oldValue).toBe(old);
  expect(() => recordPanelStateChange('id', { oldValue: 1, newValue: 2 })).not.toThrow();
});

it('clears native panel data and callback references on explicit process reset without disabling capture', () => {
  devtoolsAPI.enable(); registerPanelSignal({ get: () => 'retired' }); let calls = 0;
  const stop = devtoolsAPI.subscribeToSignals(() => { calls++; }); runGlobalResets();
  expect(devtoolsAPI.enabled).toBe(true); expect(devtoolsAPI.getSignals()).toEqual([]);
  registerPanelSignal({ get: () => 'new epoch' }); expect(calls).toBe(0); stop();
});

it('honors explicit global disabling without evaluating submitted readers', () => {
  devtoolsAPI.enable(); vi.stubGlobal('__ZENITH_DEVTOOLS__', false); let reads = 0;
  registerPanelSignal({ get: () => { reads++; return 'ignored'; } }); expect(reads).toBe(0); expect(devtoolsAPI.getSignals()).toEqual([]);
});
