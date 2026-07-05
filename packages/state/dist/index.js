// packages/state/src/index.ts
//
// نقطه ورود عمومی پکیج `state` — تمام APIهای سطح عمومی از اینجا export می‌شوند.
//
// استفاده در سایر پکیج‌ها یا اپلیکیشن:
//   import { signal, effect, computed, batch } from '@zenith/state';
//
// این فایل باید بسیار کم‌حجم باشد و فقط exportها را شامل شود.
// تمام منطق در فایل‌های داخلی (signal.ts, effect.ts, ...) قرار دارد.
export { signal, Signal, untrack } from './signal.js';
// BUG-22 FIX (v1.2.2): export setEffectContextStore برای SSR AsyncLocalStorage.
export { setEffectContextStore } from './signal.js';
export { effect, getEffectPriority, setCurrentPriority, getCurrentPriority } from './effect.js';
export { computed, Computed } from './computed.js';
export { batch } from './batch.js';
// ── فاز ۱۰: State Registry (برای DevTools) ──
export { registerSignal, recordStateChange, getAllSignals, getSignalInfo, getStateTimeline, onStateChange, nameSignal, clearRegistry, } from './registry.js';
//# sourceMappingURL=index.js.map