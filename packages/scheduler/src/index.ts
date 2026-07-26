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
  schedule,
  setEffectDisposal,
  flushSync,
  nextTick,
  hasPendingEffects,
  pendingEffectCount,
  pendingEffectsByPriority,
  clearScheduler,
  afterFlush,
  scheduleMicrotask,
  configureScheduler,
  setSchedulerHooks,
  getSchedulerHooks,
  Priority,
  type PriorityInput,
  type SchedulerAdapter,
  type SchedulerHooks,
} from './scheduler';
