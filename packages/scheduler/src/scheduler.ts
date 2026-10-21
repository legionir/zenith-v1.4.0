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

export { Priority, type PriorityInput } from './scheduler-priority';
export { registerSchedulerInstance, resetSchedulerInstanceTrackingForTesting } from './scheduler-state';
export * from './scheduler-schedule';
export { flushSync, hasPendingEffects, pendingEffectCount, pendingEffectsByPriority, clearScheduler, clearSchedulerInternal, afterFlush } from './scheduler-flush';
export * from './scheduler-adapter';
