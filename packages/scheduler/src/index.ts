// packages/scheduler/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/scheduler`.
//
// استفاده در state:
//   import { scheduleEffect, flushSync } from '@zenith/scheduler';
//
// استفاده در تست‌ها:
//   import { flushSync, hasPendingEffects } from '@zenith/scheduler';

export {
  scheduleEffect,
  flushSync,
  hasPendingEffects,
  pendingEffectCount,
  pendingEffectsByPriority,
  clearScheduler,
  afterFlush,
  scheduleMicrotask,
  configureScheduler,
  setSchedulerHooks,
  getSchedulerHooks,
  type Priority,
  type SchedulerAdapter,
  type SchedulerHooks,
} from './scheduler';
