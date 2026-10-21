import type { EffectSubscriber } from './effect-subscriber';
// packages/state/src/effect.ts
//
// ماژول Effect: مسئول ردیابی وابستگی‌ها و اجرای مجدد توابع واکنش‌گرا.
//
// یک Effect در واقع یک "تابع جانبی" (Side Effect) است که به Signalها وابسته است.
// هر زمان که یکی از Signalهای وابسته تغییر کند، این تابع دوباره اجرا می‌شود.
//
// مثال:
//   effect(() => {
//     logger.debug(count.get());  // هر بار که count تغییر کند، این خط دوباره اجرا می‌شود.
//   });
//
// نکته‌ی کلیدی:
// قبل از هر اجرا، باید وابستگی‌های قبلی پاک شوند تا از "Zombie Effects"
// (افکت‌هایی که به سیگنال‌های قدیمی چسبیده‌اند) جلوگیری شود.
// همچنین، صف پاکسازی هر Effect مستقل از سایر Effectها مدیریت می‌شود
// تا در حضور چندین Effect همزمان، تداخلی پیش نیاید.
//
// ── Bug Fix #2: Priority Queue Integration ──
//
// قبلاً effect() هیچ پارامتر priority نداشت و همیشه با 'normal' صف می‌شد.
// این یعنی Priority Queue یک API منزوی بود. حالا effect() یک پارامتر
// اختیاری priority می‌پذیرد که به scheduleEffect پاس داده می‌شود.
//
// برای اتصال خودکار به event handlers، effect() همچنین اولویت را در
// تابع runEffect ذخیره می‌کند تا signal.set() بداند با چه اولویتی
// schedule کند.

// BUG-05 FIX (v1.3.0): Context functions از ماژول مجزای context.ts
// برای شکستن circular dependency با signal.ts.
import {
  createOwner,
  disposeOwner,
  _getMutableContext,
  _bindToEffectContext,
  type Owner,
  // #141 — یک منبع حقیقت برای type تابع پاکسازی در state: context.CleanupFn
  // (معادل ساختاری `Cleanup` در @zenith/shared؛ از import مستقیم shared خودداری
  // شده چون publish state نباید یال جدید state→shared بگیرد — همان دلیلی که
  // MaybeSignal هم در index.ts alias محلی است).
  type CleanupFn,
} from './context';
import { Priority, setEffectDisposal } from '@zenith/scheduler';
import { emitError } from './error';
import { _getStateRuntime } from './runtime-state';
// #115 (DEC-031): علامت routed تا scheduler خطای rethrowشدهٔ effect را دوباره
// emit نکند (history تکراری نشود).
import { markErrorRouted } from '@zenith/errors';

/**
 * IMP-07 (v1.3.0): Global error handler برای Effectها.
 *
 * اگر تنظیم شده باشد، خطاهای Effectها به جای throw شدن، به این handler
 * فرستاده می‌شوند و Effect از گراف واکنش‌گرا خارج می‌شود (بدون اینکه
 * بقیه اپلیکیشن را خراب کند).
 */
const runtime = _getStateRuntime();

/**
 * IMP-07 (v1.3.0): تنظیم Error Boundary برای Effectها.
 *
 * مشابه Vue's `onErrorCaptured` یا React Error Boundary.
 * اگر تنظیم شود، خطاهای Effectها به جای throw شدن، به این handler
 * داده می‌شوند و Effect به‌طور خودکار از گراف حذف می‌شود.
 *
 * @param handler تابع handler یا null برای پاک کردن.
 * @returns #116 cleanup protocol: یک `Cleanup` idempotent که اگر هنوز همین
 *           handler فعال باشد، آن را پاک می‌کند (handler=null بدون اثر قبلی).
 * @public
 */
export function onEffectError(
  handler: ((err: unknown, effect: EffectSubscriber) => void) | null,
): () => void {
  const registration = { handler };
  runtime.effectError = registration;
  let cleared = false;
  return () => {
    if (cleared) return;
    cleared = true;
    if (runtime.effectError === registration) runtime.effectError = null;
    registration.handler = null;
  };
}

/**
 * نوع تابع Effect.
 * @public
 */
export type EffectFn = EffectSubscriber;

/**
 * Options for effect creation.
 * @public
 */
export type EffectOptions = {
  priority?: Priority | string;
  owner?: Owner | null;
  onError?: (err: Error) => void;
};

/**
 * Metadata که به هر Effect function ضمیمه می‌شود.
 *
 * این metadata شامل priority است که توسط signal.set() خوانده می‌شود
 * تا بداند با چه اولویتی scheduleEffect را صدا بزند.
 */
const effectPriorityMap = runtime.priorities;

/**
 * اولویت پیش‌فرض فعلی برای Effectهای جدید.
 *
 * این متغیر توسط setCurrentPriority() تنظیم می‌شود و به event handlers
 * اجازه می‌دهد اولویت urgent را به‌طور خودکار به همه‌ی Effectهایی که در
 * حین اجرای آن event ساخته می‌شوند، اعمال کنند.
 *
 * مثال:
 *   setCurrentPriority('urgent');
 *   // در این block، همه‌ی effect(fn) های جدید با urgent ساخته می‌شوند.
 *   // سپس اولویت به normal برگردانده می‌شود.
 *
 * این الگو مشابه Vue's setCurrentScope است.
 */
// The default is stored on EffectContext, not on this module/format.

/**
 * تنظیم اولویت پیش‌فرض برای Effectهای جدید.
 *
 * استفاده در event handlers:
 *   import { setCurrentPriority } from '@zenith/state';
 *   setCurrentPriority('urgent');
 *   try {
 *     // ... handle event ...
 *   } finally {
 *     setCurrentPriority('normal');
 *   }
 *
 * @param priority اولویت پیش‌فرض جدید.
 * @returns اولویت قبلی (برای restore کردن).
 * @public
 */
export function setCurrentPriority(priority: Priority | string): Priority {
  const context = _getMutableContext();
  const old = context.priority ?? Priority.normal;
  // Normalize string priorities for backward compatibility
  if (typeof priority === 'string') {
    const map: Record<string, Priority> = {
      urgent: Priority.urgent,
      high: Priority.high,
      normal: Priority.normal,
      low: Priority.low,
      idle: Priority.idle,
    };
    context.priority = map[priority] ?? Priority.normal;
  } else {
    context.priority = priority;
  }
  return old;
}

/**
 * دریافت اولویت پیش‌فرض فعلی.
 * @public
 */
export function getCurrentPriority(): Priority {
  return _getMutableContext().priority ?? Priority.normal;
}

/**
 * ساخت یک Effect واکنش‌گرا.
 *
 * این تابع بلافاصله fn را اجرا می‌کند تا وابستگی‌های اولیه ثبت شوند،
 * و یک تابع Dispose برمی‌گرداند که برای از بین بردن Effect استفاده می‌شود.
 *
 * @param fn تابعی که باید واکنش‌گرا شود.
 * @param priority اولویت Effect (پیش‌فرض: 'normal').
 *                 'urgent' — قبل از رندر بعدی (state حیاتی، navigation)
 *                 'normal' — آپدیت DOM معمولی
 *                 'idle'   — analytics، logging، pre-render
 * @returns تابع Dispose برای پاکسازی کامل.
 * @public
 */
export function effect(fn: EffectFn, options?: Priority | EffectOptions): () => void {
  const normalizePriority = (priority: Priority | string): Priority => {
    if (typeof priority === 'number') return priority;
    const named: Record<string, Priority> = { urgent: Priority.urgent, high: Priority.high, normal: Priority.normal, low: Priority.low, idle: Priority.idle };
    return named[priority] ?? Priority.normal;
  };
  let priority = getCurrentPriority();
  let parent: Owner | null | undefined;
  if (typeof options === 'number' || typeof options === 'string') priority = normalizePriority(options);
  else if (options) {
    if (options.priority !== undefined) priority = normalizePriority(options.priority);
    parent = options.owner;
  }
  const executionContext = _getMutableContext();
  const owner = createOwner(parent);
  if (owner.disposed) return () => {};
  let cleanupQueue: CleanupFn[] = [];
  const drain = (): void => {
    const pending = cleanupQueue; cleanupQueue = [];
    let failure: { error: unknown } | undefined;
    for (const cleanup of pending) {
      try { cleanup(); } catch (error) { failure ??= { error }; }
    }
    if (failure) throw failure.error;
  };
  const execute = (): void => {
    if (owner.disposed) return;
    const context = _getMutableContext();
    const previousOwner = context.owner;
    const previousEffect = context.activeEffect;
    const previousRegistration = context.activeCleanupRegistration;
    context.owner = owner;
    context.activeEffect = null;
    context.activeCleanupRegistration = null;
    try {
      // Child scopes belong to the preceding execution, not to its next run.
      for (const child of Array.from(owner.children)) disposeOwner(child);
      drain();
      if (owner.disposed) return;
      context.activeEffect = runEffect;
      context.activeCleanupRegistration = cleanup => {
        // The body can dispose its own scope and then continue synchronously.
        // Signal.get adds before registering cleanup, so unlink immediately.
        if (owner.disposed) { cleanup(); return () => {}; }
        cleanupQueue.push(cleanup); let removed = false;
        return () => {
          if (removed) return; removed = true;
          const index = cleanupQueue.indexOf(cleanup);
          if (index !== -1) cleanupQueue.splice(index, 1);
        };
      };
      fn();
    } catch (error) {
      // A failed effect cannot retain partial subscriptions or live children.
      try { drain(); } catch { /* retain the original execution failure */ }
      disposeOwner(owner);
      if (typeof options === 'object' && options.onError) options.onError(error instanceof Error ? error : new Error(String(error)));
      emitError({ message: error instanceof Error ? error.message : String(error), category: 'reactivity', severity: 'error', stack: error instanceof Error ? error.stack : undefined, context: { effectOwnerId: owner.id } });
      markErrorRouted(error);
      const handler = runtime.effectError?.handler;
      if (handler) handler(error, runEffect);
      else throw error;
    } finally {
      context.activeEffect = previousEffect;
      context.activeCleanupRegistration = previousRegistration;
      context.owner = previousOwner;
    }
  };
  let runEffect: EffectSubscriber;
  try {
    runEffect = _bindToEffectContext(executionContext, execute);
  } catch (error) {
    disposeOwner(owner);
    throw error;
  }
  if (owner.disposed) return () => {};
  owner.cleanup.add(() => {
    try { drain(); } finally { effectPriorityMap.delete(runEffect); }
  });
  effectPriorityMap.set(runEffect, priority);
  setEffectDisposal(runEffect, () => owner.disposed);
  // runEffect restores ambient tracking and ownership even on first-run failure.
  runEffect();
  return () => disposeOwner(owner);
}

/**
 * دریافت priority یک Effect.
 *
 * این تابع توسط signal.set() استفاده می‌شود تا بداند با چه اولویتی
 * scheduleEffect را صدا بزند. اگر Effect اولویت مشخصی نداشته باشد،
 * 'normal' برمی‌گرداند.
 *
 * @internal این تابع فقط برای استفاده‌ی داخلی signal.ts است.
 */
export function getEffectPriority(effectFn: EffectSubscriber): Priority {
  return effectPriorityMap.get(effectFn) ?? Priority.normal;
}

/**
 * اجرای لیستی از Effectها.
 *
 * نکته: ابتدا یک کپی از Set می‌گیریم چون ممکن است در حین اجرای یک Effect،
 * Effectهای جدیدی به subscribers اضافه یا حذف شوند.
 *
 * @param effects لیست Effectهایی که باید اجرا شوند.
 * @deprecated این تابع فقط برای backward compatibility نگه داشته شده.
 *             در فاز ۷، signal.set() از scheduleEffect استفاده می‌کند.
 */
export function triggerEffects(effects: Set<EffectSubscriber>): void {
  const toRun = [...effects];
  toRun.forEach((effect) => effect());
}
