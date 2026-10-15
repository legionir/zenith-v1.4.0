// packages/state/src/watch.ts
//
// #122 — watch(source, cb, options): واکنش به تغییر یک یا چند منبع مشخص
// بدون ردیابی سیگنال‌های خوانده‌شده در بدنهٔ callback (untrack).

import { effect } from './effect';
import { untrack } from './signal';
import { isReadable, type Readable } from './readable';
import { Priority } from '@zenith/scheduler';

export type WatchSource<T = unknown> = Readable<T> | (() => T);

export type WatchCleanupRegistrar = (cleanupFn: () => void) => void;

export type WatchCallback<V = unknown, OV = V | undefined> = (
  newValue: V,
  oldValue: OV,
  onCleanup: WatchCleanupRegistrar,
) => void;

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
  return isReadable(src) ? src.get() : src();
}

function deepCloneAndRead(val: unknown, seen = new Set<object>()): unknown {
  if (isReadable(val)) {
    return deepCloneAndRead(val.get(), seen);
  }
  if (val === null || typeof val !== 'object') return val;
  if (seen.has(val)) return val;
  seen.add(val);
  if (Array.isArray(val)) {
    return val.map((item) => deepCloneAndRead(item, seen));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    out[k] = deepCloneAndRead(v, seen);
  }
  return out;
}

function hasChanged(a: unknown, b: unknown, isMulti: boolean, deep: boolean): boolean {
  if (deep) {
    return JSON.stringify(a) !== JSON.stringify(b);
  }
  if (isMulti && Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return true;
    }
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
  cb: WatchCallback<any, any>,
  options: WatchOptions = {},
): () => void {
  const isMulti = Array.isArray(source);
  const { immediate = false, flush = 'pre', deep = false, once = false } = options;

  let initialized = false;
  let oldValue: unknown = undefined;
  let currentCleanup: (() => void) | null = null;
  let disposed = false;
  let stopEffect: (() => void) | null = null;

  const runCleanup = () => {
    if (currentCleanup) {
      const fn = currentCleanup;
      currentCleanup = null;
      try {
        fn();
      } catch {
        /* ignore cleanup errors */
      }
    }
  };

  const registerCleanup: WatchCleanupRegistrar = (fn) => {
    currentCleanup = fn;
  };

  const getter = (): unknown => {
    const raw = isMulti
      ? (source as readonly WatchSource<unknown>[]).map((s) => readSource(s))
      : readSource(source as WatchSource<unknown>);
    return deep ? deepCloneAndRead(raw) : raw;
  };

  const priority =
    flush === 'sync' ? Priority.high : flush === 'post' ? Priority.low : Priority.normal;

  const invokeCallback = (nextVal: unknown, prevVal: unknown) => {
    if (disposed) return;
    runCleanup();
    untrack(() => {
      cb(nextVal, prevVal, registerCleanup);
    });
    if (once) {
      dispose();
    }
  };

  stopEffect = effect(
    () => {
      if (disposed) return;
      const nextVal = getter();
      if (!initialized) {
        initialized = true;
        oldValue = nextVal;
        if (immediate) {
          invokeCallback(nextVal, undefined);
        }
        return;
      }
      if (hasChanged(nextVal, oldValue, isMulti, deep)) {
        const prev = oldValue;
        oldValue = nextVal;
        invokeCallback(nextVal, prev);
      }
    },
    { priority },
  );

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    runCleanup();
    stopEffect?.();
    stopEffect = null;
  }

  return dispose;
}
