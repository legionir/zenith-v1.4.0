import { flushSync } from '@zenith/scheduler';

/** @public */
export interface FakeTimersController {
  now: () => number;
  advanceTimersByTime: (ms: number) => void;
  runAllTimers: () => void;
  restore: () => void;
  dispose: () => void;
}

/**
 * #137: تایمرهای مصنوعی یکپارچه با `flushSync()` زمان‌بند Zenith برای تست‌های قطعی.
 * @public
 */
export function useFakeTimers(initialNow = 1_700_000_000_000): FakeTimersController {
  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;
  let currentTime = initialNow;
  let nextTimerId = 1;
  let restored = false;

  const queue: Array<{ id: number; due: number; fn: () => void }> = [];

  const fakeSetTimeout = (fn: (...args: unknown[]) => unknown, delay = 0, ...args: unknown[]): number => {
    const id = nextTimerId++;
    queue.push({
      id,
      due: currentTime + Math.max(0, Number(delay) || 0),
      fn: () => fn(...args),
    });
    queue.sort((a, b) => a.due - b.due || a.id - b.id);
    return id;
  };

  const fakeClearTimeout = (id: unknown): void => {
    const idx = queue.findIndex((t) => t.id === Number(id));
    if (idx !== -1) queue.splice(idx, 1);
  };

  // Runtime numeric handles are intentional: this helper does not fabricate a
  // Node Timeout object, ref()/unref(), or timers/promises.__promisify__ support.
  // Reflect installs a runtime replacement without lying about its static type.
  if (!Reflect.set(globalThis, 'setTimeout', fakeSetTimeout)) throw new TypeError('Cannot replace setTimeout');
  try {
    if (!Reflect.set(globalThis, 'clearTimeout', fakeClearTimeout)) throw new TypeError('Cannot replace clearTimeout');
  } catch (error) {
    globalThis.setTimeout = origSetTimeout;
    throw error;
  }

  const advanceTimersByTime = (ms: number): void => {
    const target = currentTime + Math.max(0, ms);
    while (queue.length > 0 && queue[0]!.due <= target) {
      const next = queue.shift()!;
      currentTime = next.due;
      next.fn();
      flushSync();
    }
    currentTime = target;
    flushSync();
  };

  const runAllTimers = (): void => {
    let guard = 0;
    while (queue.length > 0 && guard++ < 10_000) {
      const next = queue.shift()!;
      currentTime = Math.max(currentTime, next.due);
      next.fn();
      flushSync();
    }
    flushSync();
  };

  const restore = (): void => {
    if (restored) return;
    restored = true;
    queue.length = 0;
    globalThis.setTimeout = origSetTimeout;
    globalThis.clearTimeout = origClearTimeout;
  };

  return {
    now: () => currentTime,
    advanceTimersByTime,
    runAllTimers,
    restore,
    dispose: restore,
  };
}
