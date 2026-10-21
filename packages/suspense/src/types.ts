import type { Signal, ReadonlySignal } from '@zenith/state';

/** @public */
export interface SuspenseState {
  /** آیا در حال loading است؟ */
  loading: boolean;
  /** تعداد فرزندان در حال loading. */
  pendingCount: number;
  /** آیا timeout رخ داده؟ */
  timedOut: boolean;
  /** آیا خطا رخ داده؟ */
  error: string | null;
}

/** @public */
export interface SuspenseContext {
  /** Signal وضعیت. */
  signal: Signal<SuspenseState>;
  /** ثبت شروع loading یک فرزند. */
  startLoading(id: string): void;
  /** ثبت پایان loading یک فرزند. */
  stopLoading(id: string): void;
  /** ثبت خطا. */
  reportError(err: string): void;
  /** ثبت timeout. */
  reportTimeout(): void;
  /**
   * FIX (v1.2.7): Manually reset the boundary — clears loading, timeout,
   * and error. Useful when the user clicks a "Retry" button inside the
   * timeout/error fallback.
   */
  reset(): void;
}

/** @public */
export interface SuspenseContextOptions {
  timeoutMs?: number;
  onSettle?: (settled: boolean) => void;
}

/** @public */
export interface SuspenseOptions {
  /** حداکثر زمان انتظار به میلی‌ثانیه؛ صفر یا undefined یعنی بدون timeout. */
  timeout?: number;
  /** تأخیر پیش از نمایان شدن سیگنال loading، برای جلوگیری از flicker fallback. */
  minDelay?: number;
  /** زمانی که timeout رخ می‌دهد، یک‌بار برای هر cycle بارگذاری فراخوانی می‌شود. */
  onTimeout?: () => void;
}

/** @public */
export interface SuspenseController {
  readonly signal: Signal<SuspenseState>;
  readonly loading: ReadonlySignal<boolean>;
  readonly error: ReadonlySignal<Error | null>;
  /** Promise را تا زمان resolve/reject شدن به مرز suspense متصل می‌کند. */
  track(promise: Promise<unknown>): void;
  /** callback را پس از settled شدن همه Promiseهای ردیابی‌شده اجرا می‌کند. */
  onReady(callback: () => void): () => void;
  /** callback را برای خطای Promiseهای ردیابی‌شده ثبت می‌کند. */
  onError(callback: (error: Error) => void): () => void;
  /** timeout، error و state بارگذاری را برای retry پاک می‌کند. */
  reset(): void;
  /** listenerها و timerهای ساخته‌شده توسط کنترلر را پاکسازی می‌کند. */
  dispose(): void;
}

/** @public */
export interface TrackPromiseOptions {
  suspense?: SuspenseContext | SuspenseController;
  key?: string;
  timeout?: number;
}

/** @public */
export interface WithTimeoutOptions {
  ms: number;
  message?: string;
}

/** Loading indicator state machine. @public */
export type SuspenseLoadingPhase = 'idle' | 'pending' | 'delayed-show' | 'shown';
