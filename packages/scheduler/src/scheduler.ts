// packages/scheduler/src/scheduler.ts
//
// موتور Scheduler — قلب بهینه‌سازی فاز ۷.
//
// مشکل:
//   بدون Scheduler، وقتی یک Signal.set() فراخوانی می‌شود، تمام Effectهای
//   وابسته بلافاصله (Synchronous) اجرا می‌شوند. اگر در یک تابع ۱۰ Signal
//   را تغییر دهید، DOM شما ۱۰ بار آپدیت می‌شود — که بسیار کند است.
//
// راه‌حل:
//   به‌جای اجرای مستقیم Effectها، آن‌ها را در یک صف (Queue) قرار می‌دهیم.
//   سپس یک Microtask (از طریق Promise.resolve().then) ثبت می‌کنیم تا در
//   پایان تیک فعلی Event Loop، تمام Effectهای صف را یکجا اجرا کند.
//
//   چون از Set استفاده می‌کنیم، هر Effect فقط یک بار در صف قرار می‌گیرد،
//   حتی اگر چند Signal مختلف آن را trigger کنند.
//
//   این مکانیزم جایگزین 手動 batch() می‌شود — batching به‌صورت خودکار
//   توسط Microtask اتفاق می‌افتد.
//
// ── Priority Queue with Aging (v1.4.0) ──
//
//   Scheduler از پنج سطح اولویت پشتیبانی می‌کند:
//     • urgent (۰): کارهای حیاتی — قبل از رندر بعدی
//     • high   (۱): کارهای مهم — آپدیت‌های حیاتی DOM
//     • normal (۲): آپدیت‌های DOM معمولی (zen-text, zen-if, ...)
//     • low    (۳): کارهای کم‌اهمیت
//     • idle   (۴): analytics، logging، pre-render
//
//   ترتیب اجرا در یک flush: urgent → high → normal → low → idle.
//   Aging: taskهای قدیمی‌تر اولویتشان به تدریج افزایش می‌یابد تا از
//   گرسنگی (starvation) جلوگیری شود.

/**
 * سطح اولویت یک Effect — عدد پایین‌تر = اولویت بالاتر.
 */
export enum Priority {
  urgent = 0,
  high = 1,
  normal = 2,
  low = 3,
  idle = 4,
}

/**
 * ورودی اولویت — هم enum و هم رشته‌ی legacy پشتیبانی می‌شود.
 */
export type PriorityInput = Priority | 'urgent' | 'high' | 'normal' | 'low' | 'idle';

const PRIORITY_STRING_MAP: Record<string, Priority> = {
  urgent: Priority.urgent,
  high: Priority.high,
  normal: Priority.normal,
  low: Priority.low,
  idle: Priority.idle,
};

/**
 * نرخ Aging — هر چند ثانیه یک اولویت بالا می‌رود.
 */
const PRIORITY_AGING_RATE = 0.5;

/**
 * حداکثر تعداد Effectهای مجاز در یک flush.
 */
const MAX_FLUSH_ITERATIONS = 100;

/**
 * تبدیل ورودی اولویت به عدد.
 */
function normalizePriority(p: PriorityInput): Priority {
  if (typeof p === 'number') return p;
  return PRIORITY_STRING_MAP[p] ?? Priority.normal;
}

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
 * صف Taskها — Map برای deduplication.
 */
const queue: Map<() => void, Task> = new Map();

/**
 * شمارنده‌ی monotonic برای حفظ ترتیب ثبت.
 */
let insertSeq = 0;

/**
 * آیا در حال flush هستیم؟
 */
let isFlushing = false;

/**
 * Promise microtask فعلی.
 */
let flushPromise: Promise<void> | null = null;

/**
 * WeakMap برای ثبت callback disposed مربوط به هر Effect.
 */
const effectDisposalMap = new WeakMap<() => void, () => boolean>();

/**
 * afterFlush callbacks.
 */
const afterFlushCallbacks: Array<() => void> = [];

/**
 * محاسبه‌ی اولویت مؤثر با Aging.
 *
 * taskهای قدیمی‌تر اولویت عددی کمتری می‌گیرند (یعنی اولویت بالاتر)
 * تا از starvation جلوگیری شود. حداقل مقدار ۰ (urgent) است.
 */
function getEffectivePriority(task: Task): number {
  const age = Date.now() - task.createdAt;
  return Math.max(0, task.priority - Math.floor(age * PRIORITY_AGING_RATE / 1000));
}

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
    seq: insertSeq++,
    createdAt: Date.now(),
    disposed: disposedCb,
  });

  const adapter = _customAdapter.current;
  if (adapter) {
    adapter.schedule(flushQueue);
    return;
  }

  if (!isFlushing && !flushPromise) {
    flushPromise = Promise.resolve().then(flushQueue);
  }
}

/**
 * Alias سازگار با diff — schedule همان scheduleEffect است.
 */
export const schedule = scheduleEffect;

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
 * اجرای تمام Taskهای موجود در صف.
 */
function flushQueue(): void {
  if (isFlushing) return;
  isFlushing = true;
  let iterations = 0;
  let hitMaxIterations = false;

  try {
    while (queue.size > 0) {
      if (++iterations > MAX_FLUSH_ITERATIONS) {
        console.error(
          `[Zenith Scheduler] Infinite loop detected after ${MAX_FLUSH_ITERATIONS} iterations. ` +
            `Clearing queue to prevent browser freeze. Pending effects are discarded.`,
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
          console.error('[Zenith Scheduler] Error in effect:', error);
          if (_hooks?.onError) {
            try {
              _hooks.onError(task.fn, error);
            } catch {
              /* ignore hook error */
            }
          }
        }
      }
    }
  } finally {
    isFlushing = false;
    flushPromise = null;

    const cbs = afterFlushCallbacks.splice(0);
    for (const cb of cbs) {
      try {
        cb();
      } catch (e) {
        console.error('[Scheduler] afterFlush error:', e);
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
  if (isFlushing) return;
  const adapter = _customAdapter.current;
  if (adapter) {
    adapter.flush();
    return;
  }
  flushQueue();
}

/**
 * Schedule callback after current flush cycle with idle priority.
 */
export function nextTick(fn: () => void): void {
  scheduleEffect(fn, Priority.idle);
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
export function pendingEffectCount(): number {
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
  queue.clear();
  isFlushing = false;
  flushPromise = null;
  insertSeq = 0;
  afterFlushCallbacks.length = 0;
}

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

// ── SchedulerAdapter ──

export interface SchedulerAdapter {
  schedule(fn: () => void): void;
  flush(): void;
}

export const _customAdapter: { current: SchedulerAdapter | null } = { current: null };

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

let _hooks: SchedulerHooks | null = null;

export function setSchedulerHooks(hooks: SchedulerHooks | null): void {
  _hooks = hooks;
}

export function getSchedulerHooks(): SchedulerHooks | null {
  return _hooks;
}

// ── scheduleMicrotask ──

export function scheduleMicrotask(fn: () => void): Promise<void> {
  return Promise.resolve().then(fn);
}
