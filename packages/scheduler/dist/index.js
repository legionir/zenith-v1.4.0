// packages/scheduler/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/scheduler`.
//
// استفاده در state:
//   import { scheduleEffect, flushSync } from '@zenith/scheduler';
//
// استفاده در تست‌ها:
//   import { flushSync, hasPendingEffects } from '@zenith/scheduler';
// BUG-15 FIX (v1.2.2): afterFlush اکنون export می‌شود.
export { scheduleEffect, flushSync, hasPendingEffects, pendingEffectCount, pendingEffectsByPriority, clearScheduler, afterFlush, configureScheduler, } from './scheduler.js';
//# sourceMappingURL=index.js.map