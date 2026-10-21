import { afterEach, expect, it, vi } from 'vitest';
import { clearScheduler, flushSync } from '@zenith/scheduler';
import { createRoot, signal, watch } from '../src';
import { captureWatchValue, equalWatchValue } from '../src/watch-values';
afterEach(() => clearScheduler());
it('accepts the declared structural readable root without requiring a hidden brand or setter', () => {
  createRoot(dispose => {
    const source = signal(1), received: number[] = [];
    watch({ get: () => source.get() }, value => received.push(value), { immediate: true });
    try { source.set(2); flushSync(); expect(received).toEqual([1, 2]); }
    finally { dispose(); }
  });
});
it('deep-tracks nested signals without replacing the typed callback payload with an unwrapped clone', () => {
  createRoot(dispose => {
    const nested = signal(1), payload = { nested, label: 'one' }, source = signal(payload);
    const calls: unknown[][] = [];
    watch(source, (next, previous) => { expect(next.nested.get()).toBeTypeOf('number'); calls.push([next, previous]); }, { deep: true, immediate: true });
    try {
      expect(calls[0]?.[0]).toBe(payload); nested.set(2); flushSync();
      expect(calls).toHaveLength(2); expect(calls[1]?.[0]).toBe(payload); expect(calls[1]?.[1]).toBe(payload);
    } finally { dispose(); }
  });
});
it('supports cyclic, bigint, function and symbol field snapshots without JSON serialization', () => {
  createRoot(dispose => {
    const key = Symbol('field'), nested = signal(1), toJSON = vi.fn(() => { throw new Error('must not stringify'); });
    const payload: { amount: bigint; nested: typeof nested; self?: unknown; toJSON: typeof toJSON; [key]: undefined } = { amount: 1n, nested, toJSON, [key]: undefined };
    payload.self = payload;
    const source = signal(payload), cb = vi.fn(); watch(source, cb, { deep: true });
    try { nested.set(2); flushSync(); expect(cb).toHaveBeenCalledTimes(1); expect(cb.mock.calls[0]?.[0]).toBe(payload); expect(toJSON).not.toHaveBeenCalled(); }
    finally { dispose(); }
  });
});
it('keeps class prototypes and methods on callback values instead of promising methods on a plain clone', () => {
  createRoot(dispose => {
    class Data { constructor(readonly value: number) {} read() { return this.value; } }
    const first = new Data(1), second = new Data(2), source = signal(first), received: Data[] = [];
    watch(source, next => received.push(next), { deep: true, immediate: true });
    try { source.set(second); flushSync(); expect(received[0]).toBe(first); expect(received[1]).toBe(second); expect(received[1]?.read()).toBe(2); }
    finally { dispose(); }
  });
});
it('retains prior raw value identity for immutable replacements and releases nested tracking on stop', () => {
  createRoot(dispose => {
    const a = { nested: signal(1) }, b = { nested: signal(2) }, source = signal(a), cb = vi.fn();
    const stop = watch(source, cb, { deep: true });
    try {
      source.set(b); flushSync(); expect(cb.mock.calls[0]?.[0]).toBe(b); expect(cb.mock.calls[0]?.[1]).toBe(a);
      expect(a.nested.subscriberCount).toBe(0); expect(b.nested.subscriberCount).toBe(1);
      stop(); expect(b.nested.subscriberCount).toBe(0);
    } finally { stop(); dispose(); }
  });
});
it('bounds virtual deep graphs and conservatively reports indeterminate snapshots as changed', () => {
  const virtual = (): object => new Proxy({}, { ownKeys: () => ['next'], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }), get: (_target, key) => key === 'next' ? virtual() : undefined });
  const a = captureWatchValue(virtual()), b = captureWatchValue(virtual());
  expect(equalWatchValue(a, b)).toBe(false);
});
it('does not invoke a new callback when the preceding callback cleanup disposes the owner', () => {
  createRoot(dispose => {
    const source = signal(1), cb = vi.fn();
    watch(source, (value, previous, cleanup) => { cb(value, previous); cleanup(dispose); }, { immediate: true });
    expect(cb).toHaveBeenCalledTimes(1); source.set(2); flushSync();
    expect(cb).toHaveBeenCalledTimes(1); expect(source.subscriberCount).toBe(0);
  });
});
it('stops deep traversal when a getter disposes the owning watch', () => {
  createRoot(dispose => {
    const later = vi.fn(() => 2);
    const payload = { get first() { dispose(); return 1; }, get second() { return later(); } };
    const source = signal(payload), cb = vi.fn();
    watch(source, cb, { deep: true, immediate: true });
    expect(later).not.toHaveBeenCalled(); expect(cb).not.toHaveBeenCalled(); expect(source.subscriberCount).toBe(0);
  });
});
