// packages/state/src/async.ts
//
// #123 — createAsync / asyncComputed: سیگنال مشتق ناهمگام با مدیریت
// loading / error / data، لغو خودکار درخواست قبلی با AbortSignal و محافظت
// کامل در برابر race condition پاسخ‌های نامرتب.

import { signal, untrack, type ReadonlySignal } from './signal';
import { effect } from './effect';
import { createOwner, disposeOwner, getOwner, _getMutableContext, _bindToEffectContext } from './context';
import { emitError } from './error';
import { developerError } from '@zenith/errors';
import { ZENITH_READABLE } from './readable';

/** @public */
export interface AsyncComputeContext {
  /** سیگنال لغو که با تغییر وابستگی یا dispose شدن، abort می‌شود. */
  readonly signal: AbortSignal;
}

/** @public */
export interface AsyncOptions<T> {
  /** مقدار اولیهٔ `data` پیش از اولین resolve. */
  initial?: T;
  /** حفظ مقدار قبلی `data` هنگام بارگذاری مجدد (پیش‌فرض: `true`). */
  keepPrevious?: boolean;
  /** اجرای فوری در زمان ساخت (پیش‌فرض: `true`). */
  immediate?: boolean;
  /** کالبک اختیاری هنگام بروز خطا (به‌جز AbortError). */
  onError?: (error: unknown) => void;
}

/** @public */
export interface AsyncSignal<T> {
  readonly [ZENITH_READABLE]: true;
  /** سیگنال مقدار فعلی. */
  readonly data: ReadonlySignal<T | undefined>;
  /** سیگنال وضعیت بارگذاری. */
  readonly loading: ReadonlySignal<boolean>;
  /** سیگنال خطای آخرین اجرا (یا `null`). */
  readonly error: ReadonlySignal<unknown>;
  /** خواندن مستقیم مقدار فعلی (`data.get()`). */
  get(): T | undefined;
  /** اجرای مجدد دستی و بازگرداندن Promise نتیجه. */
  refresh(): Promise<T | undefined>;
  /** لغو درخواست در حال انجام فعلی. */
  abort(): void;
  /** توقف کامل اثر واکنش‌گرا و لغو درخواست فعال. */
  dispose(): void;
  [Symbol.dispose](): void;
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  return (err as { name?: string }).name === 'AbortError';
}

/**
 * #123: ساخت سیگنال ناهمگام واکنش‌گرا با محافظت در برابر race condition و پشتیبانی از AbortSignal.
 *
 * @public
 */
export function createAsync<T>(
  fn: (ctx: AsyncComputeContext) => Promise<T> | T,
  options: AsyncOptions<T> = {},
): AsyncSignal<T> {
  const { initial, keepPrevious = true, immediate = true, onError } = options;

  const executionContext = _getMutableContext();
  const owner = createOwner(getOwner());
  if (owner.disposed) throw developerError('Cannot create async state under a disposed owner');
  const ownedSignal = <V>(value: V) => {
    try {
      if (owner.disposed) throw developerError('Cannot create async state under a disposed owner');
      const state = signal(value);
      if (owner.disposed) {
        state.dispose(); throw developerError('Async state owner was disposed during initialization');
      }
      owner.cleanup.add(() => state.dispose());
      return state;
    } catch (error) { disposeOwner(owner); throw error; }
  };
  const dataSig = ownedSignal<T | undefined>(initial);
  const loadingSig = ownedSignal(immediate);
  const errorSig = ownedSignal<unknown>(null);

  let runVersion = 0;
  let activeController: AbortController | null = null;
  let disposed: boolean = owner.disposed;
  let stopEffect: (() => void) | undefined;

  const abortCurrent = () => {
    if (activeController) {
      const controller = activeController;
      activeController = null;
      untrack(() => controller.abort());
    }
  };

  const execute = (): Promise<T | undefined> => {
    if (disposed) return Promise.resolve(dataSig.peek());
    abortCurrent();
    if (disposed || owner.disposed) return Promise.resolve(dataSig.peek());
    const version = ++runVersion;
    const controller = new AbortController();
    activeController = controller;
    const current = () => version === runVersion && !disposed && !controller.signal.aborted;

    untrack(() => {
      loadingSig.set(true);
      if (!current()) return;
      errorSig.set(null);
      if (current() && !keepPrevious && version > 1) {
        dataSig.set(initial);
      }
    });

    if (!current()) return Promise.resolve(dataSig.peek());
    let rawResult: Promise<T> | T;
    try {
      // اجرای همگام بخش اول fn برای ثبت وابستگی‌های سیگنال در effect
      rawResult = fn({ signal: controller.signal });
    } catch (syncErr) {
      untrack(() => {
        if (current()) {
          errorSig.set(syncErr);
          if (current()) loadingSig.set(false);
          if (current()) onError?.(syncErr);
        }
      });
      if (activeController === controller) activeController = null;
      return Promise.resolve(dataSig.peek());
    }

    const p = Promise.resolve(rawResult).then(
      (resolved) => {
        if (activeController === controller) activeController = null;
        if (!current()) return dataSig.peek();
        dataSig.set(resolved);
        if (current()) loadingSig.set(false);
        return resolved;
      },
      (err) => {
        if (activeController === controller) activeController = null;
        if (!current()) return dataSig.peek();
        if (isAbortError(err)) { loadingSig.set(false); return dataSig.peek(); }
        errorSig.set(err);
        if (current()) loadingSig.set(false);
        if (current()) onError?.(err);
        return dataSig.peek();
      },
    );

    return p;
  };

  owner.cleanup.add(() => {
    disposed = true; runVersion++;
    abortCurrent(); loadingSig.set(false);
    stopEffect = undefined;
  });

  const refreshInContext = (): Promise<T | undefined> => {
    if (disposed || owner.disposed) return Promise.resolve(dataSig.peek());
    stopEffect?.(); stopEffect = undefined;
    let request: Promise<T | undefined> = Promise.resolve(dataSig.peek());
    const stop = effect(() => {
      request = execute();
      // Preserve explicit refresh rejection while observing background failures
      // from user error hooks/native observers (not ordinary compute failures).
      void request.catch(error => emitError({ message: error instanceof Error ? error.message : String(error), category: 'reactivity', severity: 'error', stack: error instanceof Error ? error.stack : undefined }));
    }, { owner });
    if (disposed) stop(); else stopEffect = stop;
    return request;
  };
  let refresh: () => Promise<T | undefined>;
  let abort: () => void;
  try {
    refresh = _bindToEffectContext(executionContext, refreshInContext);
    abort = _bindToEffectContext(executionContext, () => {
      if (disposed) return;
      runVersion++;
      abortCurrent();
      loadingSig.set(false);
    });
    if (owner.disposed) throw developerError('Async state owner was disposed during initialization');
  } catch (error) { disposeOwner(owner); throw error; }
  if (immediate) {
    try { void refresh(); }
    catch (error) { disposeOwner(owner); throw error; }
  }
  const dispose = () => disposeOwner(owner);

  return {
    [ZENITH_READABLE]: true,
    data: dataSig,
    loading: loadingSig,
    error: errorSig,
    get: () => dataSig.get(),
    refresh,
    abort,
    dispose,
    [Symbol.dispose]: dispose,
  };
}

/**
 * #123: نام مستعار `createAsync` برای سازگاری با الگوی `asyncComputed`.
 *
 * @public
 */
export const asyncComputed = createAsync;
