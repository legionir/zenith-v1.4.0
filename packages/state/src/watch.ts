// packages/state/src/watch.ts
//
// #122 — watch(source, cb, options): واکنش به تغییر یک یا چند منبع مشخص
// بدون ردیابی سیگنال‌های خوانده‌شده در بدنهٔ callback (untrack).

import { effect } from './effect';
import { onCleanup, _getMutableContext, _bindToEffectContext } from './context';
import { untrack } from './signal';
import type { Readable } from './readable';
import { captureWatchValue, equalWatchValue, type WatchValueSnapshot } from './watch-values';
import { Priority } from '@zenith/scheduler';

/** @public */
export type WatchSource<T = unknown> = Readable<T> | (() => T);

/** @public */
export type WatchCleanupRegistrar = (cleanupFn: () => void) => void;

/** @public */
export type WatchCallback<V = unknown, OV = V | undefined> = (
  newValue: V,
  oldValue: OV,
  onCleanup: WatchCleanupRegistrar,
) => void;

/** @public */
export interface WatchOptions {
  /** اجرای فوری callback در زمان ثبت با مقدار اولیه (`oldValue = undefined`). */
  immediate?: boolean;
  /** زمان اجرای اثر: `'pre'` (پیش‌فرض)، `'post'` یا `'sync'`. */
  flush?: 'pre' | 'post' | 'sync';
  /** پیمایش عمیق آبجکت/آرایه برای تشخیص تغییرات درونی. */
  deep?: boolean;
  /** توقف خودکار پس از اولین فراخوانی callback. */
  once?: boolean;
}

function readSource<T>(src: WatchSource<T>): T {
  return typeof src === 'function' ? src() : src.get();
}

function hasChanged(a: unknown, b: unknown, isMulti: boolean): boolean {
  if (isMulti && Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return true;
    return false;
  }
  return !Object.is(a, b);
}

/**
 * #122: نظارت بر تغییر یک سیگنال، تابع getter یا آرایه‌ای از منابع واکنش‌گرا.
 *
 * @public
 */
export function watch<T>(
  source: WatchSource<T>,
  cb: WatchCallback<T, T | undefined>,
  options?: WatchOptions,
): () => void;
/** @public */
export function watch<T extends readonly WatchSource<unknown>[]>(
  sources: [...T],
  cb: WatchCallback<
    { [K in keyof T]: T[K] extends WatchSource<infer V> ? V : never },
    { [K in keyof T]: T[K] extends WatchSource<infer V> ? V : never } | undefined
  >,
  options?: WatchOptions,
): () => void;
export function watch(
  source: WatchSource<unknown> | readonly WatchSource<unknown>[],
  cb: (...args: never[]) => unknown,
  options: WatchOptions = {},
): () => void {
  const executionContext = _getMutableContext();
  const isMulti = Array.isArray(source);
  const { immediate = false, flush = 'pre', deep = false, once = false } = options;

  let initialized = false;
  let oldValue: unknown = undefined;
  let oldSnapshot: WatchValueSnapshot | undefined;
  let currentCleanup: (() => void) | null = null;
  let disposed = false;
  let stopEffect: (() => void) | null = null;

  const runCleanup = () => {
    if (currentCleanup) {
      const fn = currentCleanup;
      currentCleanup = null;
      try {
        untrack(fn);
      } catch {
        /* ignore cleanup errors */
      }
    }
  };

  const registerCleanup: WatchCleanupRegistrar = _bindToEffectContext(executionContext, (fn: () => void) => {
    if (disposed) { untrack(fn); return; }
    currentCleanup = fn;
  });
  const dispose = _bindToEffectContext(executionContext, disposeWatch);

  const getter = (): unknown => {
    const raw = isMulti
      ? (source as readonly WatchSource<unknown>[]).map((s) => readSource(s))
      : readSource(source as WatchSource<unknown>);
    return raw;
  };

  const priority =
    flush === 'sync' ? Priority.high : flush === 'post' ? Priority.low : Priority.normal;

  const invokeCallback = (nextVal: unknown, prevVal: unknown) => {
    if (disposed) return;
    runCleanup();
    if (disposed) return;
    untrack(() => {
      // The public overload correlates the source and callback. Its erased
      // invocation is native and void-returning, not a fabricated unknown-input
      // callback that would accept arbitrary data from other callers.
      Reflect.apply(cb, undefined, [nextVal, prevVal, registerCleanup]);
    });
    if (once) {
      dispose();
    }
  };

  stopEffect = effect(
    () => {
      if (disposed) return;
      if (!initialized) onCleanup(dispose);
      const nextVal = getter();
      if (disposed) return;
      const snapshot = deep ? captureWatchValue(nextVal, { isLive: () => !disposed }) : undefined;
      if (disposed) return;
      if (!initialized) {
        initialized = true;
        oldValue = nextVal; oldSnapshot = snapshot;
        if (immediate) {
          invokeCallback(nextVal, undefined);
        }
        return;
      }
      const changed = deep ? !snapshot || !oldSnapshot || !equalWatchValue(snapshot, oldSnapshot) : hasChanged(nextVal, oldValue, isMulti);
      if (changed) {
        const prev = oldValue;
        oldValue = nextVal; oldSnapshot = snapshot;
        invokeCallback(nextVal, prev);
      }
    },
    { priority },
  );

  // An immediate once callback may dispose before effect() returns its stop.
  if (disposed) { stopEffect(); stopEffect = null; }

  function disposeWatch(): void {
    if (disposed) return;
    disposed = true;
    oldValue = undefined; oldSnapshot = undefined;
    runCleanup();
    stopEffect?.();
    stopEffect = null;
  }

  return dispose;
}
