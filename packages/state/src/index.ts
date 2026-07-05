// packages/state/src/index.ts
//
// نقطه ورود عمومی پکیج `state` — تمام APIهای سطح عمومی از اینجا export می‌شوند.
//
// استفاده در سایر پکیج‌ها یا اپلیکیشن:
//   import { signal, effect, computed, batch } from '@zenith/state';
//
// این فایل باید بسیار کم‌حجم باشد و فقط exportها را شامل شود.
// تمام منطق در فایل‌های داخلی (signal.ts, effect.ts, ...) قرار دارد.

export { signal, Signal, untrack } from './signal';
// BUG-22 FIX (v1.2.2): export setEffectContextStore و EffectContext برای SSR.
// BUG-05 FIX (v1.3.0): Re-export از ./context برای شکستن circular dependency.
export { setEffectContextStore, type EffectContext } from './context';
// IMP-07 (v1.3.0): export onEffectError برای Error Boundary.
export { effect, getEffectPriority, setCurrentPriority, getCurrentPriority, onEffectError } from './effect';
export { computed, Computed } from './computed';
export { batch } from './batch';

// ── Bug Fix #2: Re-export Priority type از scheduler ──
// این به کاربران اجازه می‌دهد priority را به effect() پاس دهند:
//   import { effect } from '@zenith/state';
//   import type { Priority } from '@zenith/state';
//   effect(() => updateDOM(), 'urgent');
export type { Priority } from '@zenith/scheduler';

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
