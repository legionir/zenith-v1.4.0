// packages/state/src/index.ts
//
// نقطه ورود عمومی پکیج `state` — تمام APIهای سطح عمومی از اینجا export می‌شوند.
//
// استفاده در سایر پکیج‌ها یا اپلیکیشن:
//   import { signal, effect, computed, batch } from '@zenith/state';
//
// این فایل باید بسیار کم‌حجم باشد و فقط exportها را شامل شود.
// تمام منطق در فایل‌های داخلی (signal.ts, effect.ts, ...) قرار دارد.

export { signal, Signal, untrack, type ReadonlySignal } from './signal';
// #141: import type-only برای alias محلی MaybeSignal (پایین همین فایل).
import type { Readable } from './readable';
// BUG-22 FIX (v1.2.2): export setEffectContextStore و EffectContext برای SSR.
// BUG-05 FIX (v1.3.0): Re-export از ./context برای شکستن circular dependency.
export {
  setEffectContextStore,
  type EffectContext,
  createOwner,
  disposeOwner,
  getOwner,
  setOwner,
  onCleanup,
  type Owner,
} from './context';
// IMP-07 (v1.3.0): export onEffectError برای Error Boundary.
export {
  effect,
  getEffectPriority,
  setCurrentPriority,
  getCurrentPriority,
  onEffectError,
  type EffectFn,
  type EffectOptions,
} from './effect';
export { computed, Computed } from './computed';
// #187 FIX: brand و type-guard برای مقادیر واکنش‌گرای قابل‌خواندن (Signal/Computed).
export { isReadable, isWritable, ZENITH_READABLE, type Readable } from './readable';
// #141 / DEC-021 — «مقدار یا ظرف خواندنی» با نام قراردادی SPEC:
//   MaybeSignal ≡ MaybeReactive در @zenith/shared (بند ۲.۱).
//   عمداً **local alias** است نه import از shared: state یک singleton
//   publish‌شده است و هر یال واقعی/تایپی state→shared در dist (d.ts) به
//   dependency اعلام‌نشده در نصب تمیز peer-single-instance (#46) منجر می‌شد.
//   هر دو تعریف ساختاراً یکی‌اند (`T | { get(): T }`) و تست نوعِ
//   packages/shared/test/types.test-d.ts همین هم‌ارزی دوطرفه را قفل می‌کند.
export type MaybeSignal<T> = T | Readable<T>;
export { createRoot } from './root';
export { batch } from './batch';
export {
  onError,
  emitError,
  errorBoundary,
  getErrorHistory,
  clearErrorHistory,
  setDevMode,
  isDevMode,
} from './error';
export type { ZenithError, ErrorHandler, ErrorSeverity, ErrorCategory } from './error';

// ── Bug Fix #2: Re-export Priority از scheduler ──
// این به کاربران اجازه می‌دهد priority را به effect() پاس دهند:
//   import { effect, Priority } from '@zenith/state';
//   effect(() => updateDOM(), Priority.urgent);
export { Priority } from '@zenith/scheduler';

// ── فاز ۱۰: State Registry (برای DevTools) ──
export {
  registerSignal,
  recordStateChange,
  getAllSignals,
  getSignalInfo,
  getStateTimeline,
  onStateChange,
  nameSignal,
  clearRegistry,
  type SignalInfo,
  type StateChange,
} from './registry';
