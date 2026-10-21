import { afterEach, expect, it, vi } from 'vitest';
import { clearScheduler, flushSync } from '@zenith/scheduler';
import {
  Computed, computed, createAsync, createOwner, createRoot, disposeOwner, effect,
  getOwner, onCleanup, onEffectError, setOwner, setSignalObserver, signal, watch,
} from '../src';

afterEach(() => { clearScheduler(); onEffectError(null); setOwner(null); });

it('restores outer dependency tracking and owner after nested effects and computeds', () => {
  createRoot(dispose => {
    const parent = getOwner(), left = signal(1), right = signal(2), source = signal(3);
    const derived = computed(() => source.get() * 2);
    let runs = 0;
    effect(() => {
      left.get();
      const owner = getOwner();
      effect(() => source.get());
      expect(getOwner()).toBe(owner);
      derived.get(); right.get(); runs++;
    });
    try {
      expect(getOwner()).toBe(parent);
      expect(left.subscriberCount).toBe(1); expect(right.subscriberCount).toBe(1);
      // One computed tracker plus one current nested effect, not the outer effect.
      expect(source.subscriberCount).toBe(2);
      right.set(4); flushSync(); expect(runs).toBe(2);
      expect(source.subscriberCount).toBe(2);
      dispose(); expect(source.subscriberCount).toBe(0);
    } finally { dispose(); }
  });
});

it('distinguishes detached null from inherited ownership and rejects dead children', () => {
  createRoot(dispose => {
    const parent = getOwner()!, child = createOwner(), detached = createOwner(null);
    try {
      expect(child.parent).toBe(parent); expect(detached.parent).toBeNull();
      dispose();
      const dead = createOwner(parent);
      expect(dead.disposed).toBe(true); expect(dead.parent).toBeNull();
      const fn = vi.fn(); effect(fn, { owner: parent }); expect(fn).not.toHaveBeenCalled();
      expect(parent.children.size).toBe(0); expect(detached.disposed).toBe(false);
    } finally { disposeOwner(detached); dispose(); }
  });
});

it('late and throwing root disposal never overwrites a different ambient owner', () => {
  const disposeFirst = createRoot(dispose => { onCleanup(() => { throw new Error('teardown'); }); return dispose; });
  createRoot(dispose => {
    const owner = getOwner();
    try {
      disposeFirst(); expect(getOwner()).toBe(owner);
      expect(() => createRoot(() => { throw new Error('startup'); })).toThrow('startup');
      expect(getOwner()).toBe(owner);
    } finally { dispose(); }
  });
});

it('isolates teardown reads from the caller and runs remaining callbacks after a failure', () => {
  const source = signal(0), cleanupRead = signal(0), called = vi.fn();
  const stop = createRoot(dispose => {
    onCleanup(() => { cleanupRead.get(); throw new Error('cleanup'); });
    onCleanup(called); return dispose;
  });
  createRoot(dispose => {
    try {
      effect(() => { source.get(); stop(); });
      expect(cleanupRead.subscriberCount).toBe(0); expect(called).toHaveBeenCalledTimes(1);
    } finally { dispose(); }
  });
});

it('initializes exactly once, tracks only its actual sources and creates no placeholder signal', () => {
  createRoot(dispose => {
    const source = signal(2), compute = vi.fn(() => source.get() * 2);
    const created = vi.fn(), off = setSignalObserver({ onCreate: created });
    const value = computed(compute);
    try {
      expect(created).not.toHaveBeenCalled(); expect(compute).not.toHaveBeenCalled();
      effect(() => value.get());
      expect(compute).toHaveBeenCalledTimes(1); expect(created).toHaveBeenCalledTimes(1);
      expect(source.subscriberCount).toBe(1); expect(value.subscriberCount).toBe(1);
      source.set(3); flushSync(); expect(compute).toHaveBeenCalledTimes(2); expect(value.peek()).toBe(6);
    } finally { dispose(); off(); }
  });
});

it('rethrows an initial failure unchanged, cleans its graph and permits a later retry', () => {
  createRoot(dispose => {
    const source = signal(2), error = new Error('first'), routed = vi.fn();
    let fail = true; const value = computed(() => { source.get(); if (fail) throw error; return 4; });
    const off = onEffectError(routed);
    try {
      let received: unknown; try { value.get(); } catch (failure) { received = failure; }
      expect(received).toBe(error); expect(routed).not.toHaveBeenCalled();
      expect(source.subscriberCount).toBe(0);
      fail = false; expect(value.get()).toBe(4); expect(source.subscriberCount).toBe(1);
    } finally { off(); dispose(); }
  });
});

it('does not turn thrown undefined or circular initialization into a fictitious value', () => {
  createRoot(dispose => {
    const undefinedValue = computed<number>(() => { throw undefined; });
    let caught = false; try { undefinedValue.get(); } catch (error) { caught = true; expect(error).toBeUndefined(); }
    const circular: Computed<number> = new Computed(() => circular.get());
    try { expect(caught).toBe(true); expect(() => circular.get()).toThrow(/circular/i); }
    finally { dispose(); }
  });
});

it('disposes initialized and unread computed values terminally, including queued work', () => {
  createRoot(dispose => {
    const source = signal(1), compute = vi.fn(() => source.get());
    const read = computed(compute), unread = computed(compute);
    expect(read.get()).toBe(1); source.set(2); dispose(); flushSync();
    expect(source.subscriberCount).toBe(0); expect(compute).toHaveBeenCalledTimes(1);
    expect(read.get()).toBe(1); expect(() => unread.get()).toThrow(/disposed/i);
    read.dispose(); unread.dispose(); expect(compute).toHaveBeenCalledTimes(1);
  });
});

it('refuses to publish an inner signal when its computation disposes its owner', () => {
  createRoot(dispose => {
    const value = computed(() => { dispose(); return 1; });
    expect(() => value.get()).toThrow(/disposed/i);
    expect(value.subscriberCount).toBe(0);
  });
});

it('releases failed effect children, subscriptions and ambient context even with a boundary', () => {
  createRoot(dispose => {
    const owner = getOwner(), source = signal(0), cleanup = vi.fn(), boundary = vi.fn();
    const off = onEffectError(boundary);
    try {
      effect(() => { effect(() => source.get()); onCleanup(cleanup); throw new Error('failure'); });
      expect(getOwner()).toBe(owner); expect(source.subscriberCount).toBe(0);
      expect(cleanup).toHaveBeenCalledTimes(1); expect(boundary).toHaveBeenCalledTimes(1);
    } finally { off(); dispose(); }
  });
});

it('runs watch callback cleanup on parent disposal and does not leak immediate-once subscriptions', () => {
  createRoot(dispose => {
    const source = signal(1), cleanup = vi.fn(), once = vi.fn();
    watch(source, (_next, _old, register) => register(cleanup), { immediate: true });
    watch(source, once, { immediate: true, once: true });
    expect(source.subscriberCount).toBe(1); expect(once).toHaveBeenCalledTimes(1);
    dispose(); expect(cleanup).toHaveBeenCalledTimes(1); expect(source.subscriberCount).toBe(0);
  });
});

it('owns async cancellation through its parent and ignores work that resolves after teardown', async () => {
  let resolve!: (value: number) => void;
  let abortSignal!: AbortSignal;
  const resource = createRoot(dispose => {
    const value = createAsync<number>(({ signal }) => { abortSignal = signal; return new Promise(done => { resolve = done; }); });
    return { value, dispose };
  });
  resource.dispose(); expect(abortSignal.aborted).toBe(true);
  resolve(8); await Promise.resolve(); await Promise.resolve();
  expect(resource.value.get()).toBeUndefined(); expect(resource.value.loading.peek()).toBe(false);
  await resource.value.refresh(); expect(resource.value.get()).toBeUndefined();
});

it('starts a deferred async tracker on refresh and retains dependency updates thereafter', async () => {
  const source = signal(1), run = vi.fn(() => source.get() * 2);
  const resource = createRoot(dispose => ({ value: createAsync(run, { immediate: false }), dispose }));
  try {
    expect(run).not.toHaveBeenCalled(); expect(source.subscriberCount).toBe(0);
    await resource.value.refresh(); expect(resource.value.get()).toBe(2); expect(source.subscriberCount).toBe(1);
    source.set(2); flushSync(); await Promise.resolve(); expect(resource.value.get()).toBe(4);
    await resource.value.refresh(); expect(source.subscriberCount).toBe(1);
  } finally { resource.dispose(); }
});

it('does not acquire observer reads as computed dependencies on creation or update', () => {
  createRoot(dispose => {
    const source = signal(1), unrelated = signal(0), compute = vi.fn(() => source.get());
    const off = setSignalObserver({ onCreate: value => { value.get(); unrelated.get(); }, onChange: value => { value.get(); unrelated.get(); } });
    const derived = computed(compute);
    try {
      expect(derived.get()).toBe(1); source.set(2); flushSync(); expect(derived.get()).toBe(2);
      // source.set() is outside an effect; the computed's own writes must also
      // isolate native observer reads from its tracking effect.
      expect(unrelated.subscriberCount).toBe(0); expect(derived.subscriberCount).toBe(0);
      unrelated.set(1); flushSync(); expect(compute).toHaveBeenCalledTimes(2);
    } finally { dispose(); off(); }
  });
});

it('does not leave async loading stuck when a current computation rejects with AbortError', async () => {
  const error = Object.assign(new Error('cancelled'), { name: 'AbortError' });
  const resource = createAsync<number>(() => Promise.reject(error), { immediate: false });
  try {
    await resource.refresh(); expect(resource.loading.peek()).toBe(false); expect(resource.error.peek()).toBeNull();
  } finally { resource.dispose(); }
});

it('restores the caller when an effect throws without a global error boundary', () => {
  createRoot(dispose => {
    const owner = getOwner(), failure = new Error('raw failure');
    try {
      expect(() => effect(() => { throw failure; })).toThrow(failure);
      expect(getOwner()).toBe(owner); expect(owner?.children.size).toBe(0);
    } finally { dispose(); }
  });
});

it('does not retain dependencies read after an effect synchronously disposes its own parent', () => {
  createRoot(dispose => {
    const source = signal(1);
    effect(() => { dispose(); source.get(); });
    expect(source.subscriberCount).toBe(0); source.set(2); flushSync();
    expect(source.subscriberCount).toBe(0);
  });
});

it('does not run the next body if a previous child cleanup disposes its parent', () => {
  createRoot(dispose => {
    const trigger = signal(0), body = vi.fn();
    effect(() => { trigger.get(); effect(() => onCleanup(dispose)); body(); });
    expect(body).toHaveBeenCalledTimes(1); trigger.set(1); flushSync();
    expect(body).toHaveBeenCalledTimes(1); expect(trigger.subscriberCount).toBe(0);
    dispose();
  });
});

it('uses the native callback receiver and actual ordered watch values without widening them', () => {
  createRoot(dispose => {
    const first = signal('one'), second = signal(1);
    const calls: unknown[][] = [];
    watch([first, second], function (this: unknown, value, previous, cleanup) {
      calls.push([this, value, previous, typeof cleanup]);
    }, { immediate: true });
    try {
      second.set(2); flushSync();
      expect(calls).toEqual([[undefined, ['one', 1], undefined, 'function'], [undefined, ['one', 2], ['one', 1], 'function']]);
    } finally { dispose(); }
  });
});
