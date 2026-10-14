import { describe, it, expect, vi } from 'vitest';
import { signal, watch, createAsync, asyncComputed, batch } from '../src/index';
import { flushSync } from '@zenith/scheduler';

describe('@zenith/state watch() and createAsync() / asyncComputed() (#122, #123)', () => {
  it('watches signal, getter, and tuple sources with oldValue/newValue, untrack in cb, immediate, once, and onCleanup (#122)', () => {
    const count = signal(1);
    const other = signal(100);
    const log: Array<[number, number | undefined]> = [];
    const cleanups: number[] = [];

    const stop = watch(
      count,
      (next, prev, onCleanup) => {
        // Reading `other` inside callback must NOT be tracked
        void other.get();
        log.push([next, prev]);
        onCleanup(() => cleanups.push(next));
      },
      { immediate: true },
    );

    expect(log).toEqual([[1, undefined]]);

    // Mutating `other` does not trigger `watch`
    other.set(200);
    flushSync();
    expect(log).toEqual([[1, undefined]]);

    count.set(2);
    flushSync();
    expect(log).toEqual([
      [1, undefined],
      [2, 1],
    ]);
    expect(cleanups).toEqual([1]);

    // Batch coalesces updates
    batch(() => {
      count.set(3);
      count.set(4);
    });
    flushSync();
    expect(log).toEqual([
      [1, undefined],
      [2, 1],
      [4, 2],
    ]);
    expect(cleanups).toEqual([1, 2]);

    stop();
    expect(cleanups).toEqual([1, 2, 4]);

    // After dispose, further updates do not fire
    count.set(99);
    flushSync();
    expect(log.length).toBe(3);

    // `once: true` disposes automatically after first change
    const sOnce = signal('a');
    const onceCalls: string[] = [];
    watch(
      sOnce,
      (val) => {
        onceCalls.push(val);
      },
      { once: true },
    );
    sOnce.set('b');
    flushSync();
    sOnce.set('c');
    flushSync();
    expect(onceCalls).toEqual(['b']);
  });

  it('prevents out-of-order race conditions and aborts previous in-flight requests in createAsync / asyncComputed (#123)', async () => {
    const queryId = signal(1);
    const abortedIds: number[] = [];
    const resolvers = new Map<number, (val: string) => void>();

    const userAsync = createAsync<string>(
      ({ signal: abortSignal }) => {
        const id = queryId.get();
        abortSignal.addEventListener('abort', () => {
          abortedIds.push(id);
        });
        return new Promise<string>((resolve) => {
          resolvers.set(id, resolve);
        });
      },
      { initial: 'init' },
    );

    expect(userAsync.get()).toBe('init');
    expect(userAsync.loading.get()).toBe(true);

    // Trigger second request before first resolves
    queryId.set(2);
    flushSync();
    expect(abortedIds).toEqual([1]);

    // Resolve the newer request (#2) first, then the stale request (#1)
    resolvers.get(2)!('User #2');
    await Promise.resolve();
    await Promise.resolve();
    expect(userAsync.get()).toBe('User #2');
    expect(userAsync.loading.get()).toBe(false);

    // Stale request #1 resolving late must NOT overwrite 'User #2'
    resolvers.get(1)!('Stale User #1');
    await Promise.resolve();
    await Promise.resolve();
    expect(userAsync.get()).toBe('User #2');

    // Error handling
    const errSpy = vi.fn();
    const failing = asyncComputed(
      async () => {
        throw new Error('network boom');
      },
      { onError: errSpy },
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(failing.error.get()).toBeInstanceOf(Error);
    expect(failing.loading.get()).toBe(false);
    expect(errSpy).toHaveBeenCalledTimes(1);

    userAsync.dispose();
    failing.dispose();
  });
});
