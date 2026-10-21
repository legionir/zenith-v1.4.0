// packages/scheduler/src/scheduler-flush.ts
//
// اجرای صف (flushQueue/flushSync)، شمارش، پاک‌سازی و afterFlush —
// استخراج مکانیکی از scheduler.ts، بدون تغییر رفتار (#40).

import { ZenithError, emitError, isErrorRouted, deprecate, onGlobalReset } from '@zenith/errors';
import { normalizePriority, MAX_FLUSH_ITERATIONS, type PriorityInput } from './scheduler-priority';
import { _sched, queue, afterFlushCallbacks, getEffectivePriority } from './scheduler-state';


/**
 * اجرای تمام Taskهای موجود در صف.
 */
export function flushQueue(): void {
  if (_sched.isFlushing) return;
  _sched.isFlushing = true;
  let iterations = 0;
  let hitMaxIterations = false;

  try {
    while (queue.size > 0) {
      if (++iterations > MAX_FLUSH_ITERATIONS) {
        // #115: از طریق hub (دیگر چاپ مستقیم در کنسول نیست).
        emitError(
          new ZenithError({
            code: 'ZEN-905',
            category: 'Runtime',
            message: `[Zenith Scheduler] Infinite loop detected after ${MAX_FLUSH_ITERATIONS} iterations. Clearing queue to prevent browser freeze. Pending effects are discarded.`,
            context: { source: 'scheduler', iterations },
          }),
        );
        queue.clear();
        hitMaxIterations = true;
        break;
      }

      // حذف taskهای disposed
      for (const [key, task] of queue) {
        if (task.disposed?.()) {
          queue.delete(key);
        }
      }
      if (queue.size === 0) break;

      // مرتب‌سازی بر اساس اولویت مؤثر (صعودی = عدد پایین‌تر = اولویت بالاتر)
      const tasks = Array.from(queue.values()).sort((a, b) => {
        const diff = getEffectivePriority(a) - getEffectivePriority(b);
        if (diff !== 0) return diff;
        return a.seq - b.seq;
      });
      queue.clear();

      for (const task of tasks) {
        if (task.disposed?.()) continue;
        try {
          task.fn();
        } catch (error) {
          // #115 (DEC-031): انتشار از طریق hub (@zenith/errors)؛ بدون چاپ مستقیم در کنسول.
          // اگر خطا خودش از effect آمده (effect قبلاً emit کرده و rethrow کرده)،
          // دوباره emit نمی‌کنیم (markErrorRouted). Scheduler hook فقط observer است.
          if (!isErrorRouted(error)) {
            emitError(
              error instanceof ZenithError
                ? error
                : new ZenithError({
                    code: 'ZEN-906',
                    category: 'Runtime',
                    message: error instanceof Error ? error.message : String(error),
                    cause: error,
                    context: { source: 'scheduler' },
                  }),
            );
          }
          if (_sched.hooks?.onError) {
            try {
              _sched.hooks.onError(task.fn, error);
            } catch {
              /* ignore hook error */
            }
          }
        }
      }
    }
  } finally {
    _sched.isFlushing = false;
    _sched.flushPromise = null;

    const cbs = afterFlushCallbacks.splice(0);
    for (const cb of cbs) {
      try {
        cb();
      } catch (e) {
        // #115: مسیر واحد hub.
        emitError(
          e instanceof ZenithError
            ? e
            : new ZenithError({
                code: 'ZEN-905',
                category: 'Runtime',
                message: e instanceof Error ? e.message : String(e),
                cause: e,
                context: { source: 'scheduler.afterFlush' },
              }),
        );
      }
    }

    if (hitMaxIterations) {
      // Queue already cleared above
    } else {
      queue.clear();
    }
  }
}

/**
 * اجرای اجباری و Synchronous صف.
 */
export function flushSync(): void {
  if (_sched.isFlushing) return;
  const adapter = _customAdapter.current;
  if (adapter) {
    adapter.flush();
    return;
  }
  flushQueue();
}

/**
 * بررسی اینکه آیا Taskهای در انتظار وجود دارد.
 */
export function hasPendingEffects(): boolean {
  return queue.size > 0;
}

/**
 * تعداد Taskهای در انتظار.
 */
export function pendingEffectCount(): boolean extends never ? never : number {
  return queue.size;
}

/**
 * تعداد Taskهای در انتظار در یک اولویت مشخص.
 */
export function pendingEffectsByPriority(priority: PriorityInput): number {
  const normalized = normalizePriority(priority);
  let count = 0;
  for (const task of queue.values()) {
    if (task.priority === normalized) count++;
  }
  return count;
}

/**
 * پاکسازی کامل Scheduler.
 */
export function clearScheduler(): void {
  deprecate('ZEN-DEPR-063', 'clearScheduler', 'resetForTesting() (@zenith/testing)');
  clearSchedulerInternal();
}

/**
 * #118: پاک‌سازی داخلی بدون هشدار (هوک ریست سراسری).
 */
export function clearSchedulerInternal(): void {
  queue.clear();
  _sched.isFlushing = false;
  _sched.flushPromise = null;
  _sched.insertSeq = 0;
  afterFlushCallbacks.length = 0;
}

/* @__PURE__ */ onGlobalReset(clearSchedulerInternal);

/**
 * ثبت callback بعد از flush.
 */
export function afterFlush(cb: () => void): () => void {
  afterFlushCallbacks.push(cb);
  return () => {
    const idx = afterFlushCallbacks.indexOf(cb);
    if (idx !== -1) {
      afterFlushCallbacks.splice(idx, 1);
    }
  };
}
