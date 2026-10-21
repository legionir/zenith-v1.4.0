// packages/scheduler/src/scheduler-schedule.ts
//
// ثبت Effect در صف (scheduleEffect/schedule/nextTick/setEffectDisposal) —
// استخراج مکانیکی از scheduler.ts، بدون تغییر رفتار (#40).

import { deprecate } from '@zenith/errors';
import { normalizePriority, Priority, type PriorityInput } from './scheduler-priority';
import { _sched, queue, effectDisposalMap } from './scheduler-state';
import { flushQueue } from './scheduler-flush';


/**
 * ثبت یک Effect در صف برای اجرا در microtask بعدی.
 *
 * @param effectFn تابع Effect.
 * @param priority اولویت Effect.
 * @param disposed callback اختیاری — اگر true برگرداند، task اجرا نمی‌شود.
 */
export function scheduleEffect(
  effectFn: () => void,
  priority: PriorityInput = Priority.normal,
  disposed?: () => boolean,
): void {
  const normalizedPriority = normalizePriority(priority);

  // اگر disposed callback مستقیماً پاس داده نشده، از WeakMap بخوان
  const disposedCb = disposed ?? effectDisposalMap.get(effectFn);

  const existing = queue.get(effectFn);
  if (existing) {
    // اولویت بالاتر (عدد پایین‌تر) را حفظ کن
    if (normalizedPriority < existing.priority) {
      existing.priority = normalizedPriority;
    }
    if (disposedCb) existing.disposed = disposedCb;
    return;
  }

  queue.set(effectFn, {
    fn: effectFn,
    priority: normalizedPriority,
    seq: _sched.insertSeq++,
    createdAt: Date.now(),
    disposed: disposedCb,
  });

  const adapter = _customAdapter.current;
  if (adapter) {
    adapter.schedule(flushQueue);
    return;
  }

  if (!_sched.isFlushing && !_sched.flushPromise) {
    _sched.flushPromise = Promise.resolve().then(flushQueue);
  }
}

/**
 * @deprecated #117 — یک نام مبنا برای ثبت Effect: `scheduleEffect`.
 * `schedule` تنها یک alias سازگار است که یک‌بار ZEN-DEPR-025 هشدار می‌دهد و
 * به `scheduleEffect` delegate می‌کند (حذف در ۲.۰ — DEC-026).
 */
export function schedule(
  effectFn: () => void,
  priority: PriorityInput = Priority.normal,
  disposed?: () => boolean,
): void {
  deprecate('ZEN-DEPR-025', 'schedule()', 'scheduleEffect()');
  scheduleEffect(effectFn, priority, disposed);
}

/**
 * ثبت callback disposed برای یک Effect function.
 *
 * این تابع توسط @zenith/state/effect.ts فراخوانی می‌شود تا scheduler
 * بداند یک Effect dispose شده و نباید اجرا شود.
 */
export function setEffectDisposal(effectFn: () => void, disposed: () => boolean): void {
  effectDisposalMap.set(effectFn, disposed);
  const task = queue.get(effectFn);
  if (task) {
    task.disposed = disposed;
  }
}

/**
 * Schedule callback after current flush cycle with idle priority.
 */
export function nextTick(fn: () => void): void {
  scheduleEffect(fn, Priority.idle);
}
