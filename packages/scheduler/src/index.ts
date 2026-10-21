// packages/scheduler/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/scheduler`.
//
// استفاده در state:
//   import { scheduleEffect, flushSync } from '@zenith/scheduler';
//
// استفاده در تست‌ها:
//   import { flushSync, hasPendingEffects } from '@zenith/scheduler';

/** @public */
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
  registerSchedulerInstance,
  Priority,
  type PriorityInput,
  type SchedulerAdapter,
  type SchedulerHooks,
} from './scheduler';
/** Test-only scheduler tracking reset. @internal */
export { resetSchedulerInstanceTrackingForTesting } from './scheduler';
