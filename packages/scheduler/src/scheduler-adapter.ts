// packages/scheduler/src/scheduler-adapter.ts
//
// آداپتور و هوک‌های scheduler — استخراج مکانیکی از scheduler.ts،
// بدون تغییر رفتار (#40).

import { _sched } from './scheduler-state';
import { AGING_THRESHOLD } from './scheduler-priority';


// ── SchedulerAdapter ──

export interface SchedulerAdapter {
  schedule(fn: () => void): void;
  flush(): void;
}

export const _customAdapter: { current: SchedulerAdapter | null } = _sched.customAdapter;

export function configureScheduler(adapter: SchedulerAdapter | null): void {
  _customAdapter.current = adapter;
}

// ── Debug/Trace hooks ──

export interface SchedulerHooks {
  onEffectScheduled?: (effect: () => void, priority: Priority) => void;
  onEffectExecuted?: (effect: () => void, priority: Priority, durationMs: number) => void;
  onFlushStart?: () => void;
  onFlushEnd?: (effectsCount: number, durationMs: number) => void;
  onError?: (effect: () => void, error: unknown) => void;
}

export function setSchedulerHooks(hooks: SchedulerHooks | null): void {
  _sched.hooks = hooks;
}

export function getSchedulerHooks(): SchedulerHooks | null {
  return _sched.hooks;
}

// ── scheduleMicrotask ──

export function scheduleMicrotask(fn: () => void): Promise<void> {
  return Promise.resolve().then(fn);
}

// Export threshold for testing and configuration
export { AGING_THRESHOLD as schedulerAgingThreshold };
