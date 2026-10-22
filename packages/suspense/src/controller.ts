import { signal, effect, untrack, type ReadonlySignal } from '@zenith/state';
import { createSuspenseContext } from './context';
import type { SuspenseOptions, SuspenseController, SuspenseLoadingPhase } from './types';
function normalizeError(error: unknown): Error { return error instanceof Error ? error : new Error(String(error)); }
/** Stateful promise/loading controller. @public */
export function createSuspense(options: SuspenseOptions = {}): SuspenseController {
  const context = createSuspenseContext({ timeoutMs: options.timeout ?? 0 });
  const loading = signal(false);
  const error = signal<Error | null>(null);
  const readyCallbacks = new Set<() => void>();
  const errorCallbacks = new Set<(error: Error) => void>();
  const minDelay = Math.max(0, options.minDelay ?? 0);
  let loadingTimer: ReturnType<typeof setTimeout> | null = null;
  let loadingPhase: SuspenseLoadingPhase = 'idle';
  let timedOut = false;
  let disposed = false;
  let id = 0;
  // FIX (#20): شمارندهٔ نسل/چرخه — هر reset() یک چرخهٔ جدید شروع می‌کند و
  // تسویهٔ پرامیس‌های نسل قبلی نباید onReady/onError را فعال کند.
  let generation = 0;
  // FIX (#21): ردیابی هویت شیء خطای گزارش‌شده تا دو خطای متمایز با message یکسان
  // هر دو گزارش شوند و تنها یک کانال واحد گزارش وجود داشته باشد.
  let lastReportedError: Error | null = null;
  let lastExternalErrorMsg: string | null = null;

  const notifyReady = () => {
    for (const callback of [...readyCallbacks]) callback();
  };
  const notifyError = (nextError: Error) => {
    for (const callback of [...errorCallbacks]) callback(nextError);
  };

  /**
   * مسیر واحد گزارش خطا (#21):
   * ابتدا `context.reportError`، سپس `error.set(nextError)`، و در نهایت `notifyError(nextError)`.
   */
  const emitControllerError = (nextError: Error, updateContext: boolean) => {
    if (lastReportedError === nextError) return;
    lastReportedError = nextError;
    lastExternalErrorMsg = nextError.message;
    if (updateContext) {
      context.reportError(nextError.message);
    }
    error.set(nextError);
    notifyError(nextError);
  };

  const cancelDelayTimer = () => {
    if (loadingTimer !== null) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
  };

  const transitionLoadingPhase = (isLoading: boolean) => {
    if (!isLoading) {
      cancelDelayTimer();
      loadingPhase = 'idle';
      if (untrack(() => loading.get()) !== false) {
        loading.set(false);
      }
      return;
    }

    // isLoading === true:
    // idle → pending → (minDelay === 0 ? shown : delayed-show)
    if (loadingPhase === 'idle') {
      loadingPhase = 'pending';
      if (minDelay === 0) {
        loadingPhase = 'shown';
        if (untrack(() => loading.get()) !== true) {
          loading.set(true);
        }
      } else {
        loadingPhase = 'delayed-show';
        cancelDelayTimer();
        loadingTimer = setTimeout(() => {
          loadingTimer = null;
          if (!disposed && loadingPhase === 'delayed-show' && context.signal.get().loading) {
            loadingPhase = 'shown';
            loading.set(true);
          }
        }, minDelay);
      }
      return;
    }

    if (loadingPhase === 'delayed-show' && loadingTimer === null) {
      loadingTimer = setTimeout(() => {
        loadingTimer = null;
        if (!disposed && loadingPhase === 'delayed-show' && context.signal.get().loading) {
          loadingPhase = 'shown';
          loading.set(true);
        }
      }, minDelay);
    } else if (loadingPhase === 'shown' && untrack(() => loading.get()) !== true) {
      loading.set(true);
    }
  };

  const disposeStateEffect = effect(() => {
    const state = context.signal.get();

    // FIX (#22): خواندن سیگنال‌های خروجی داخل effect فقط با untrack انجام می‌شود
    // تا effect به خروجی‌های خودش (loading و error) وابسته نشود.
    const currentError = untrack(() => error.get());

    if (state.error !== null) {
      // اگر خطا مستقیماً روی context.signal تنظیم شده باشد (خارج از track)
      if (currentError === null || state.error !== lastExternalErrorMsg) {
        emitControllerError(new Error(state.error), false);
      }
    } else if (currentError !== null) {
      lastReportedError = null;
      lastExternalErrorMsg = null;
      error.set(null);
    }

    if (state.timedOut) {
      transitionLoadingPhase(false);
      if (!timedOut) {
        timedOut = true;
        options.onTimeout?.();
      }
      return;
    }

    if (state.loading) {
      transitionLoadingPhase(true);
      return;
    }

    transitionLoadingPhase(false);
    timedOut = false;
  });

  return {
    signal: context.signal,
    loading: loading as ReadonlySignal<boolean>,
    error: error as ReadonlySignal<Error | null>,
    track(promise) {
      if (disposed) return;
      const loadingId = `promise-${++id}`;
      const gen = generation; // FIX (#20): snapshot نسل این پرامیس
      context.startLoading(loadingId);
      // اگر در همان تیک پیش از اجرای effect بارگذاری جدیدی آغاز شده، فاز را همگام کن
      transitionLoadingPhase(true);

      Promise.resolve(promise).then(
        () => {
          // FIX (#20): پرامیس‌های نسل قدیمی (قبل از reset) کاملاً نادیده گرفته
          // می‌شوند؛ در غیر این صورت onReady زودهنگام و در حالی که retry هنوز
          // pending است فعال می‌شد.
          if (disposed || gen !== generation) return;
          context.stopLoading(loadingId);
          const state = context.signal.get();
          if (!state.loading) {
            transitionLoadingPhase(false);
          }
          if (!state.loading && !state.error && !state.timedOut) notifyReady();
        },
        (reason: unknown) => {
          if (disposed || gen !== generation) return;
          // FIX (#20): حذف id ردشده از loadingSet پیش از گزارش خطا؛ وگرنه id
          // کهنه در مجموعه می‌ماند و pendingCount/loading پس از آنکه سایر
          // پرامیس‌ها تسویه شدند ناسازگار (boundary گیرکرده) می‌شد.
          context.stopLoading(loadingId);
          const nextError = normalizeError(reason);
          emitControllerError(nextError, true);
          if (!context.signal.get().loading) {
            transitionLoadingPhase(false);
          }
        },
      );
    },
    onReady(callback) {
      readyCallbacks.add(callback);
      return () => readyCallbacks.delete(callback);
    },
    onError(callback) {
      errorCallbacks.add(callback);
      return () => errorCallbacks.delete(callback);
    },
    reset() {
      // FIX (#20): شروع چرخهٔ جدید؛ همهٔ پرامیس‌های در حال انتظار نسل قبل
      // بی‌اعتبار می‌شوند.
      generation++;
      lastReportedError = null;
      lastExternalErrorMsg = null;
      transitionLoadingPhase(false);
      context.reset();
      error.set(null);
      timedOut = false;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      transitionLoadingPhase(false);
      readyCallbacks.clear();
      errorCallbacks.clear();
      disposeStateEffect();
      context.reset();
    },
  };
}
