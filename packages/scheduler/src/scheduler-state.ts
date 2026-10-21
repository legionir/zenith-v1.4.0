// packages/scheduler/src/scheduler-state.ts
//
// state سراسری singleton و ثبت نمونه — استخراج مکانیکی از scheduler.ts،
// بدون تغییر رفتار (#40).

import { AGING_THRESHOLD, PRIORITY_AGING_RATE, type Priority } from './scheduler-priority';
import type { SchedulerHooks } from './scheduler-adapter';


/**
 * یک Task در صف Scheduler.
 */
interface Task {
  fn: () => void;
  priority: Priority;
  seq: number;
  createdAt: number;
  disposed?: () => boolean;
}

/**
 * #75: Global singleton scheduler state keyed via Symbol.for so dual ESM/CJS loads
 * of @zenith/scheduler share the same queue, flush lock, and disposal map.
 */
const SCHEDULER_STATE_SYMBOL = Symbol.for('zenith.scheduler.state.v1');
const SCHEDULER_MODULE_TOKEN = {};

interface GlobalSchedulerSingleton {
  queue: Map<() => void, Task>;
  insertSeq: number;
  isFlushing: boolean;
  flushPromise: Promise<void> | null;
  effectDisposalMap: WeakMap<() => void, () => boolean>;
  afterFlushCallbacks: Array<() => void>;
  customAdapter: { current: SchedulerAdapter | null };
  hooks: SchedulerHooks | null;
  moduleTokens?: Set<object>;
  warnedDuplicate?: boolean;
}

/**
 * #34: Register a module instance of @zenith/scheduler and emit a one-time ZEN-0201
 * warning if more than one copy is loaded in the same runtime.
 */
export function registerSchedulerInstance(token: object = SCHEDULER_MODULE_TOKEN): number {
  const g = globalThis as unknown as Record<symbol, GlobalSchedulerSingleton | undefined>;
  const instance = g[SCHEDULER_STATE_SYMBOL] ?? getSchedulerSingleton();
  instance.moduleTokens ??= new Set([SCHEDULER_MODULE_TOKEN]);
  instance.moduleTokens.add(token);
  const count = instance.moduleTokens.size;
  if (count > 1 && !instance.warnedDuplicate) {
    instance.warnedDuplicate = true;
    emitError({
      code: 'ZEN-0201',
      category: 'Runtime',
      severity: 'warning',
      message:
        `[Zenith] ZEN-0201: Multiple instances of @zenith/scheduler detected (${count} copies). ` +
        'Run "npm ls @zenith/scheduler" to deduplicate.',
    });
  }
  return count;
}

export function resetSchedulerInstanceTrackingForTesting(): void {
  const instance = getSchedulerSingleton();
  instance.moduleTokens = new Set([SCHEDULER_MODULE_TOKEN]);
  instance.warnedDuplicate = false;
}

function getSchedulerSingleton(): GlobalSchedulerSingleton {
  const g = globalThis as unknown as Record<symbol, GlobalSchedulerSingleton | undefined>;
  let instance = g[SCHEDULER_STATE_SYMBOL];
  if (!instance) {
    instance = {
      queue: new Map(),
      insertSeq: 0,
      isFlushing: false,
      flushPromise: null,
      effectDisposalMap: new WeakMap(),
      afterFlushCallbacks: [],
      customAdapter: { current: null },
      hooks: null,
    };
    g[SCHEDULER_STATE_SYMBOL] = instance;
  }
  return instance;
}

export const _sched = /* @__PURE__ */ getSchedulerSingleton();
export const queue = _sched.queue;
export const effectDisposalMap = _sched.effectDisposalMap;
export const afterFlushCallbacks = _sched.afterFlushCallbacks;

/**
 * محاسبه‌ی اولویت مؤثر با Aging.
 *
 * taskهای قدیمی‌تر اولویت عددی کمتری می‌گیرند (یعنی اولویت بالاتر)
 * تا از starvation جلوگیری شود. حداقل مقدار ۰ (urgent) است.
 */
export function getEffectivePriority(task: Task): number {
  const age = Date.now() - task.createdAt;
  if (age < AGING_THRESHOLD) return task.priority;
  return Math.max(
    0,
    task.priority - Math.floor(((age - AGING_THRESHOLD) * PRIORITY_AGING_RATE) / 1000),
  );
}
