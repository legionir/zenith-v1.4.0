import { afterEach, expect, it } from 'vitest';
import { createRoot, effect, signal } from '@zenith/state';
import { clearScheduler, flushSync } from '@zenith/scheduler';
import {
  clearDevtoolsRegistryInternal, getAllSignals, getTimeline, hook, installDevtoolsCore,
  nameSignal, onStateChange, recordStateChange, registerSignal,
} from '../src';

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); clearDevtoolsRegistryInternal(); clearScheduler(); });
function enabled() { const core = installDevtoolsCore({ enabled: true }); cleanups.push(() => core.dispose()); }

it('inspects actual readonly/getter-only objects without inventing a writable class', () => {
  enabled(); const value = { id: 'real' }; const source = { get: () => value };
  const id = registerSignal(source); nameSignal(source, 'getter-only');
  const info = getAllSignals().find(entry => entry.id === id);
  expect(info?.signalRef.deref()).toBe(source); expect(info?.name).toBe('getter-only');
});

it('does not track getter-only inspection or diagnostic listeners inside another effect', () => {
  enabled(); const dependency = signal(1), changed = signal(0);
  const view = { get: () => dependency.get() }; let runs = 0;
  const off = onStateChange(() => { dependency.get(); }); cleanups.push(off);
  createRoot(dispose => {
    effect(() => { runs++; registerSignal(view); recordStateChange(changed, 0, 1); });
    try { expect(dependency.subscriberCount).toBe(0); dependency.set(2); flushSync(); expect(runs).toBe(1); }
    finally { dispose(); dependency.dispose(); changed.dispose(); }
  });
});

it('bounds recursive inspection and drops a record invalidated by native getter reset', () => {
  enabled(); let reads = 0;
  const recursive = { get: (): number => { reads++; expect(registerSignal(recursive)).toBe(''); return 1; } };
  expect(registerSignal(recursive)).not.toBe(''); expect(reads).toBe(1);
  clearDevtoolsRegistryInternal();
  const resetting = { get: () => { clearDevtoolsRegistryInternal(); return 'stale'; } };
  expect(registerSignal(resetting)).toBe(''); expect(getAllSignals()).toEqual([]);
});

it('does not let stale listener cleanup or capture/reset reentry resurrect a timeline', () => {
  enabled(); const source = signal(0), seen: unknown[] = [];
  const callback = (change: { newValue: unknown }) => { seen.push(change.newValue); };
  const old = onStateChange(callback); clearDevtoolsRegistryInternal();
  const current = onStateChange(callback); cleanups.push(old, current); old();
  recordStateChange(source, 0, 1); expect(seen).toEqual([1]);
  const resetting = { get secret() { clearDevtoolsRegistryInternal(); return 'do not retain'; } };
  expect(recordStateChange(source, 1, resetting)).toBeUndefined(); expect(getTimeline()).toEqual([]);
  source.dispose();
});

it('does not let hook callbacks attach dependencies or run newly added callbacks in the same event', () => {
  enabled(); const dependency = signal(1);
  const calls: string[] = []; let added = false;
  cleanups.push(hook.on('custom:read', () => {
    dependency.get(); calls.push('first');
    if (!added) { added = true; cleanups.push(hook.on('custom:read', () => { calls.push('later'); })); }
  }));
  createRoot(dispose => {
    let runs = 0; effect(() => { runs++; hook.emit('custom:read', { actual: true }); });
    try { expect(calls).toEqual(['first']); expect(dependency.subscriberCount).toBe(0); dependency.set(2); flushSync(); expect(runs).toBe(1); }
    finally { dispose(); dependency.dispose(); }
  });
});

it('does not publish a name for a record reset by its create hook', () => {
  enabled(); const names: unknown[] = [];
  cleanups.push(hook.on('signal:name', event => { names.push(event); }));
  cleanups.push(hook.on('signal:create', () => { clearDevtoolsRegistryInternal(); }));
  nameSignal({ get: () => 'stale name' }, 'retired');
  expect(names).toEqual([]); expect(getAllSignals()).toEqual([]);
});

it('snapshots getter-only capabilities without tracking the active effect', async () => {
  enabled(); const { snapshot } = await import('../src'); const dependency = signal(1);
  registerSignal({ get: () => dependency.get() });
  createRoot(dispose => {
    let runs = 0; effect(() => { runs++; snapshot(); });
    try { expect(dependency.subscriberCount).toBe(0); dependency.set(2); flushSync(); expect(runs).toBe(1); }
    finally { dispose(); dependency.dispose(); }
  });
});

it('can inspect the same actual raw Signal again after native disposal without reusing a dead ID', () => {
  enabled(); const source = signal(1), before = registerSignal(source);
  source.dispose(); expect(getAllSignals().some(info => info.id === before)).toBe(false);
  const next = registerSignal(source); expect(next).not.toBe(before);
  source.set(2); expect(getAllSignals().find(info => info.id === next)?.value).toBe(2);
  source.dispose();
});
