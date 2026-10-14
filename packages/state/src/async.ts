// packages/state/src/async.ts
//
// #123 — createAsync / asyncComputed: سیگنال مشتق ناهمگام با مدیریت
// loading / error / data، لغو خودکار درخواست قبلی با AbortSignal و محافظت
// کامل در برابر race condition پاسخ‌های نامرتب.

import { signal, untrack, type ReadonlySignal } from './signal';
import { effect } from './effect';
import { ZENITH_READABLE } from './readable';

export interface AsyncComputeContext {
  /** سیگنال لغو که با تغییر وابستگی یا dispose شدن، abort می‌شود. */
  readonly signal: AbortSignal;
}

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

  const dataSig = signal<T | undefined>(initial);
  const loadingSig = signal<boolean>(immediate);
  const errorSig = signal<unknown>(null);

  let runVersion = 0;
  let activeController: AbortController | null = null;
  let disposed = false;

  const abortCurrent = () => {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  };

  const execute = (): Promise<T | undefined> => {
    if (disposed) return Promise.resolve(dataSig.peek());
    abortCurrent();
    const version = ++runVersion;
    const controller = new AbortController();
    activeController = controller;

    untrack(() => {
      loadingSig.set(true);
      errorSig.set(null);
      if (!keepPrevious && version > 1) {
        dataSig.set(initial);
      }
    });

    let rawResult: Promise<T> | T;
    try {
      // اجرای همگام بخش اول fn برای ثبت وابستگی‌های سیگنال در effect
      rawResult = fn({ signal: controller.signal });
    } catch (syncErr) {
      untrack(() => {
        if (version === runVersion && !disposed) {
          errorSig.set(syncErr);
          loadingSig.set(false);
          onError?.(syncErr);
        }
      });
      return Promise.resolve(dataSig.peek());
    }

    const p = Promise.resolve(rawResult).then(
      (resolved) => {
        if (version !== runVersion || disposed || controller.signal.aborted) {
          return dataSig.peek();
        }
        dataSig.set(resolved);
        loadingSig.set(false);
        return resolved;
      },
      (err) => {
        if (version !== runVersion || disposed || controller.signal.aborted || isAbortError(err)) {
          return dataSig.peek();
        }
        errorSig.set(err);
        loadingSig.set(false);
        onError?.(err);
        return dataSig.peek();
      },
    );

    return p;
  };

  let firstRun = true;
  const stopEffect = effect(() => {
    if (disposed) return;
    if (firstRun && !immediate) {
      firstRun = false;
      return;
    }
    firstRun = false;
    void execute();
  });

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    abortCurrent();
    loadingSig.set(false);
    stopEffect();
  };

  return {
    [ZENITH_READABLE]: true,
    data: dataSig,
    loading: loadingSig,
    error: errorSig,
    get: () => dataSig.get(),
    refresh: () => execute(),
    abort: () => {
      abortCurrent();
      loadingSig.set(false);
    },
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
