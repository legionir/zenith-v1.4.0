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

// #115 (DEC-031): مسیر واحد انتشار خطا — hub در @zenith/errors (dependency
// مستقیم؛ مجاز چون errors هیچ وابستگی ندارد و چرخه‌ای نمی‌سازد).
import { ZenithError, emitError, isErrorRouted, deprecate } from '@zenith/errors';

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
 * حداقل زمان قبل از اعمال Aging (میلی‌ثانیه).
 */
const AGING_THRESHOLD = 1000;

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
 * #75: Global singleton scheduler state keyed via Symbol.for so dual ESM/CJS loads
 * of @zenith/scheduler share the same queue, flush lock, and disposal map.
 */
const SCHEDULER_STATE_SYMBOL = Symbol.for('zenith.scheduler.state.v1');

interface GlobalSchedulerSingleton {
  queue: Map<() => void, Task>;
  insertSeq: number;
  isFlushing: boolean;
  flushPromise: Promise<void> | null;
  effectDisposalMap: WeakMap<() => void, () => boolean>;
  afterFlushCallbacks: Array<() => void>;
  customAdapter: { current: SchedulerAdapter | null };
  hooks: SchedulerHooks | null;
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

const _sched = /* @__PURE__ */ getSchedulerSingleton();
const queue = _sched.queue;
const effectDisposalMap = _sched.effectDisposalMap;
const afterFlushCallbacks = _sched.afterFlushCallbacks;

/**
 * محاسبه‌ی اولویت مؤثر با Aging.
 *
 * taskهای قدیمی‌تر اولویت عددی کمتری می‌گیرند (یعنی اولویت بالاتر)
 * تا از starvation جلوگیری شود. حداقل مقدار ۰ (urgent) است.
 */
function getEffectivePriority(task: Task): number {
  const age = Date.now() - task.createdAt;
  if (age < AGING_THRESHOLD) return task.priority;
  return Math.max(
    0,
    task.priority - Math.floor(((age - AGING_THRESHOLD) * PRIORITY_AGING_RATE) / 1000),
  );
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
 * اجرای تمام Taskهای موجود در صف.
 */
function flushQueue(): void {
  if (_sched.isFlushing) return;
  _sched.isFlushing = true;
  let iterations = 0;
  let hitMaxIterations = false;

  try {
    while (queue.size > 0) {
      if (++iterations > MAX_FLUSH_ITERATIONS) {
        // #115: از طریق hub (دیگر console.error مستقیم نیست).
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
          // #115 (DEC-031): انتشار از طریق hub (@zenith/errors)؛ no console.* مستقیم.
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
  queue.clear();
  _sched.isFlushing = false;
  _sched.flushPromise = null;
  _sched.insertSeq = 0;
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
