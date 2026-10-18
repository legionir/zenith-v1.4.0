import { AsyncLocalStorage } from 'node:async_hooks';
import { afterEach, expect, it } from 'vitest';
import { clearScheduler, flushSync } from '@zenith/scheduler';
import {
  Computed, createOwner, createRoot, disposeOwner, effect, getOwner, onCleanup,
  setOwner, signal,
} from '../src';
import { setEffectContextStore, type EffectContext } from '@zenith/state/internal';

const context = (): EffectContext => ({ owner: null, activeEffect: null, activeCleanupRegistration: null });
afterEach(() => { clearScheduler(); setEffectContextStore(null); setOwner(null); });

it('inherits and cleans up from the provider owner, without overwriting the fallback owner', () => {
  const outside = createOwner(null); setOwner(outside);
  const request = context(); setEffectContextStore(() => request);
  const root = createOwner(null); setOwner(root);
  const child = createOwner(); let cleaned = 0; let cleanupOwner: ReturnType<typeof getOwner> = null;
  expect(child.parent).toBe(root); expect(request.owner).toBe(root);
  onCleanup(() => { cleaned++; cleanupOwner = getOwner(); });
  disposeOwner(root); expect(cleaned).toBe(1); expect(cleanupOwner).toBe(root); expect(child.disposed).toBe(true);
  setOwner(null); setEffectContextStore(null);
  expect(getOwner()).toBe(outside); disposeOwner(outside); setOwner(null);
});

it('runs queued effects and late disposers in the captured provider context', () => {
  const left = context(), right = context(); let selected = left;
  setEffectContextStore(() => selected);
  const leftRoot = createOwner(null); setOwner(leftRoot);
  const source = signal(0); const reads: number[] = []; const cleanedParents: Array<ReturnType<typeof getOwner> | undefined> = [];
  const stop = effect(() => {
    expect(getOwner()?.parent).toBe(leftRoot);
    expect(left.activeEffect).not.toBeNull(); expect(right.activeEffect).toBeNull();
    reads.push(source.get());
    onCleanup(() => { cleanedParents.push(getOwner()?.parent); });
  });
  selected = right; const rightRoot = createOwner(null); setOwner(rightRoot);
  source.set(1); flushSync();
  expect(reads).toEqual([0, 1]); expect(getOwner()).toBe(rightRoot);
  expect(right.activeEffect).toBeNull(); expect(left.owner).toBe(leftRoot);
  stop(); expect(source.subscriberCount).toBe(0); expect(getOwner()).toBe(rightRoot);
  expect(cleanedParents).toEqual([leftRoot, leftRoot]);
  disposeOwner(leftRoot); expect(getOwner()).toBe(rightRoot); disposeOwner(rightRoot); setOwner(null);
});

it('initializes a lazy computed in its producer context but subscribes the caller context', () => {
  const left = context(), right = context(); let selected = left;
  setEffectContextStore(() => selected);
  const leftRoot = createOwner(null); setOwner(leftRoot); const source = signal(2);
  const derived = new Computed(() => {
    expect(getOwner()?.parent?.parent).toBe(leftRoot); return source.get() * 3;
  });
  selected = right; const rightRoot = createOwner(null); setOwner(rightRoot);
  const values: number[] = []; const stop = effect(() => { values.push(derived.get()); });
  source.set(4); flushSync(); expect(values).toEqual([6, 12]);
  expect(getOwner()).toBe(rightRoot); expect(derived.subscriberCount).toBe(1);
  disposeOwner(leftRoot); expect(source.subscriberCount).toBe(0);
  expect(derived.get()).toBe(12); stop(); disposeOwner(rightRoot); setOwner(null);
});

it('keeps provider scopes independent across 100 interleaved native async requests', async () => {
  const storage = new AsyncLocalStorage<EffectContext>();
  setEffectContextStore(() => storage.getStore() ?? null);
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  const owners = new Set<object>();
  await Promise.all(Array.from({ length: 100 }, (_, index) => storage.run(context(), async () => {
    const owner = createOwner(null); setOwner(owner); owners.add(owner);
    const child = createOwner(); let cleanups = 0; let cleanupOwner: ReturnType<typeof getOwner> = null;
    onCleanup(() => { cleanupOwner = getOwner(); cleanups++; });
    if (index === 99) release();
    await ready; await Promise.resolve();
    expect(getOwner()).toBe(owner); expect(child.parent).toBe(owner);
    disposeOwner(owner); expect(child.disposed).toBe(true); expect(cleanups).toBe(1); expect(cleanupOwner).toBe(owner);
    setOwner(null);
  })));
  expect(owners.size).toBe(100); expect(getOwner()).toBeNull();
});

it('restores the root creation context even if a synchronous provider changes inside the body', () => {
  const left = context(), right = context(); let selected = left;
  setEffectContextStore(() => selected);
  const leftOwner = createOwner(null); setOwner(leftOwner);
  createRoot(dispose => { selected = right; expect(getOwner()).not.toBe(leftOwner); dispose(); });
  expect(getOwner()).toBeNull(); expect(left.owner).toBe(leftOwner); expect(right.owner).toBeNull();
  selected = left; disposeOwner(leftOwner); setOwner(null);
});

it('does not attach owners or effects when a host binding fails or kills the parent', () => {
  const request = context(); setEffectContextStore(() => request);
  const parent = createOwner(null); setOwner(parent);
  request.bind = () => { throw new Error('bind failed'); };
  expect(() => createOwner()).toThrow('bind failed'); expect(parent.children.size).toBe(0);
  expect(() => effect(() => {})).toThrow('bind failed'); expect(parent.children.size).toBe(0);
  request.bind = callback => { disposeOwner(parent); return callback; };
  const dead = createOwner(); expect(dead.disposed).toBe(true); expect(dead.parent).toBeNull();
  expect(parent.children.size).toBe(0); setOwner(null);
});

it('releases a child when binding the effect body fails after its owner was attached', () => {
  const request = context(); setEffectContextStore(() => request);
  const parent = createOwner(null); setOwner(parent); let bindings = 0;
  request.bind = callback => {
    if (++bindings === 2) throw new Error('effect body binding failed');
    return callback;
  };
  expect(() => effect(() => {})).toThrow('effect body binding failed');
  expect(parent.children.size).toBe(0); expect(getOwner()).toBe(parent);
  disposeOwner(parent); setOwner(null);
});

it('does not repopulate an effect owner after the host binder disposes it during registration', () => {
  const request = context(); setEffectContextStore(() => request);
  const parent = createOwner(null); setOwner(parent); let bindings = 0, calls = 0;
  let child: ReturnType<typeof createOwner> | undefined;
  request.bind = callback => {
    if (++bindings === 2) { child = [...parent.children][0]; disposeOwner(parent); }
    return callback;
  };
  const stop = effect(() => { calls++; }); stop();
  expect(calls).toBe(0); expect(child).toMatchObject({ disposed: true });
  expect(child?.cleanup.size).toBe(0); expect(parent.children.size).toBe(0); setOwner(null);
});

it('does not repopulate a lazy computed owner disposed by its host binder', () => {
  const request = context(); setEffectContextStore(() => request);
  const parent = createOwner(null); setOwner(parent); let bindings = 0, calls = 0;
  let child: ReturnType<typeof createOwner> | undefined;
  request.bind = callback => {
    if (++bindings === 2) { child = [...parent.children][0]; disposeOwner(parent); }
    return callback;
  };
  const derived = new Computed(() => { calls++; return 1; });
  expect(() => derived.get()).toThrow('disposed'); expect(calls).toBe(0);
  expect(child?.cleanup.size).toBe(0); expect(parent.children.size).toBe(0); setOwner(null);
});
