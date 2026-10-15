// #27 core tests for @zenith/state — signal / computed / effect / batch / cleanup.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  signal,
  computed,
  effect,
  batch,
  untrack,
  createRoot,
  onCleanup,
  onEffectError,
  setCurrentPriority,
  getCurrentPriority,
  setSignalObserver,
  getSignalObserver,
} from '@zenith/state';
import { notifySignalName, notifySignalDispose } from '../src/observer';
import { flushSync, clearScheduler, hasPendingEffects, Priority } from '@zenith/scheduler';

beforeEach(() => clearScheduler());

describe('signal', () => {
  it('reads and writes values', () => {
    const n = signal(1);
    expect(n.get()).toBe(1);
    n.set(5);
    expect(n.get()).toBe(5);
  });

  it('does not notify when value is unchanged (Object.is)', () => {
    const n = signal(1);
    let runs = 0;
    effect(() => {
      n.get();
      runs++;
    });
    flushSync();
    expect(runs).toBe(1);
    n.set(1); // same
    flushSync();
    expect(runs).toBe(1);
    n.set(NaN);
    n.set(NaN);
    flushSync();
    // first NaN != 1 triggers once, second NaN is Object.is-equal → no re-run
    expect(runs).toBe(2);
  });

  it('readonly signals throw on set', () => {
    const r = signal(1, { readonly: true });
    expect(() => r.set(2)).toThrow(/readonly/i);
  });
});

describe('computed', () => {
  it('derives from signals and updates lazily', () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.get() + b.get());
    expect(sum.get()).toBe(5);
    a.set(10);
    // computed re-evaluates through its inner tracking effect, which runs via
    // the scheduler (microtask batching). Flush to observe the update.
    flushSync();
    expect(sum.get()).toBe(13);
  });

  it('is readonly (no set exposed at runtime type)', () => {
    const a = signal(1);
    const c = computed(() => a.get() * 2);
    expect((c as any).set).toBeUndefined();
    expect(c.get()).toBe(2);
  });
});

describe('effect', () => {
  it('runs immediately, then on dependency change via scheduler', () => {
    const n = signal(0);
    const seen: number[] = [];
    effect(() => seen.push(n.get()));
    flushSync();
    expect(seen).toEqual([0]);
    n.set(1);
    expect(hasPendingEffects()).toBe(true); // scheduled, not yet run
    flushSync();
    expect(seen).toEqual([0, 1]);
  });

  it('dedupes multiple sets into one run (microtask batching)', () => {
    const n = signal(0);
    let runs = 0;
    effect(() => {
      n.get();
      runs++;
    });
    flushSync();
    runs = 0;
    n.set(1);
    n.set(2);
    n.set(3);
    flushSync();
    expect(runs).toBe(1);
  });

  it('untrack avoids subscribing', () => {
    const n = signal(0);
    let runs = 0;
    effect(() => {
      untrack(() => n.get());
      runs++;
    });
    flushSync();
    expect(runs).toBe(1);
    n.set(9);
    flushSync();
    expect(runs).toBe(1); // did not re-subscribe
  });

  it('dispose stops future runs and cleans up', () => {
    const n = signal(0);
    let cleanupRan = 0;
    let runs = 0;
    const dispose = effect(() => {
      onCleanup(() => {
        cleanupRan++;
      });
      n.get();
      runs++;
    });
    flushSync();
    expect(runs).toBe(1);
    dispose();
    n.set(1);
    flushSync();
    expect(runs).toBe(1);
    expect(cleanupRan).toBeGreaterThanOrEqual(1);
  });
});

describe('batch', () => {
  it('defers effect runs until batch completes', () => {
    const a = signal(1);
    const b = signal(2);
    const pairs: Array<[number, number]> = [];
    effect(() => pairs.push([a.get(), b.get()]));
    flushSync();
    pairs.length = 0;
    batch(() => {
      a.set(10);
      b.set(20);
      // within batch, effect should not have re-run yet with partial state
    });
    flushSync();
    expect(pairs).toEqual([[10, 20]]);
  });
});

describe('createRoot', () => {
  it('dispose tears down owned effects', () => {
    const n = signal(0);
    let runs = 0;
    let disposeFn!: () => void;
    createRoot((dispose) => {
      disposeFn = dispose;
      effect(() => {
        n.get();
        runs++;
      });
    });
    flushSync();
    expect(runs).toBe(1);
    disposeFn();
    n.set(1);
    flushSync();
    expect(runs).toBe(1);
  });
});

describe('effect priority, error handling, and SignalObserver (#29)', () => {
  it('supports setCurrentPriority, string/enum priority options, and onEffectError', () => {
    const prev = setCurrentPriority('urgent');
    expect(getCurrentPriority()).toBe(Priority.urgent);
    setCurrentPriority(prev);
    expect(getCurrentPriority()).toBe(Priority.normal);

    const s = signal(0);
    let urgentRuns = 0;
    const disposeUrgent = effect(
      () => {
        s.get();
        urgentRuns++;
      },
      'high' as unknown as Priority,
    );
    expect(urgentRuns).toBe(1);
    disposeUrgent();

    const caught: string[] = [];
    const localCaught: string[] = [];
    const clearHandler = onEffectError((err) => {
      caught.push(err instanceof Error ? err.message : String(err));
    });

    effect(
      () => {
        onCleanup(() => {});
        throw new Error('effect-boom');
      },
      {
        priority: 'normal',
        onError: (e) => localCaught.push(e.message),
      },
    );

    expect(caught).toEqual(['effect-boom']);
    expect(localCaught).toEqual(['effect-boom']);
    clearHandler();
    clearHandler(); // idempotent
  });

  it('notifies registered SignalObserver on signal creation and updates and disposes computed', () => {
    const events: string[] = [];
    const unsub = setSignalObserver({
      onCreate(_sig, name) {
        events.push(`create:${name ?? 'anon'}`);
      },
      onChange(_sig, oldValue, newValue) {
        events.push(`change:${String(oldValue)}->${String(newValue)}`);
      },
      onDispose() {
        events.push('dispose');
      },
      onName(_sig, name) {
        events.push(`name:${name}`);
      },
    });
    expect(getSignalObserver()).not.toBeNull();

    const count = signal(10);
    notifySignalName(count, 'counter');
    count.set(20);
    notifySignalDispose(count);
    expect(events).toEqual(['create:anon', 'name:counter', 'change:10->20', 'dispose']);

    const doubled = computed(() => count.get() * 2);
    expect(doubled.get()).toBe(40);
    (doubled as unknown as { dispose: () => void }).dispose();

    unsub();
    unsub(); // idempotent
    expect(getSignalObserver()).toBeNull();
  });
});
