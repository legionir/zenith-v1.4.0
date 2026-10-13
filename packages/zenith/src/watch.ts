// packages/zenith/src/watch.ts
//
// Reactive watcher helper for `zenith` and `zenith/core` (#149, SPEC §2.9).

import { effect, untrack, type ReadonlySignal } from '@zenith/state';
import { isReadable, type Cleanup, type Readable } from '@zenith/shared';

export interface WatchOptions {
  /** Execute callback immediately with current value on registration (default: false) */
  immediate?: boolean;
}

export type WatchSource<T> = Readable<T> | ReadonlySignal<T> | (() => T);

/**
 * Watch a reactive source (`Signal`, `Computed`, `Readable`, or getter function)
 * and invoke `callback(nextValue, prevValue)` inside `untrack` whenever it changes.
 * Returns a `Cleanup` function that stops the watcher.
 */
export function watch<T>(
  source: WatchSource<T>,
  callback: (value: T, oldValue: T | undefined) => void | Cleanup,
  options?: WatchOptions,
): Cleanup {
  const read =
    typeof source === 'function'
      ? source
      : isReadable(source)
        ? () => (source as Readable<T>).get()
        : () => source as T;
  let initialized = false;
  let prevValue: T | undefined;
  let activeCleanup: Cleanup | void;

  const stop = effect(() => {
    const nextValue = read();
    if (!initialized) {
      initialized = true;
      prevValue = nextValue;
      if (options?.immediate) {
        activeCleanup = untrack(() => callback(nextValue, undefined));
      }
      return;
    }
    if (Object.is(nextValue, prevValue)) return;
    const old = prevValue;
    prevValue = nextValue;
    if (typeof activeCleanup === 'function') {
      try {
        activeCleanup();
      } catch {
        // swallow cleanup errors
      }
      activeCleanup = undefined;
    }
    activeCleanup = untrack(() => callback(nextValue, old));
  });

  return () => {
    if (typeof activeCleanup === 'function') {
      try {
        activeCleanup();
      } catch {
        // ignore
      }
      activeCleanup = undefined;
    }
    stop();
  };
}
