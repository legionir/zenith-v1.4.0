// packages/errors/src/global-reset.ts
//
// #118 — رجیستری «ریست سراسری» (DEC-032/#118، جای‌گیری در DEC-036 §پیوست ب).
//
// هر پکیجی که وضعیت سراسری دارد (رجیستری action/component/store/…، صف
// اعلان‌ها، زمان‌بند) پاک‌سازی خودش را اینجا ثبت می‌کند تا
// `resetForTesting()` (@zenith/testing) همه را یک‌جا صدا بزند — بدون
// وابستگی معکوس از L4 به همهٔ پکیج‌ها.
//
// چرا در `@zenith/errors`؟ این تنها پکیج L0 با **صفر وابستگی** است که همهٔ
// پکیج‌های دارای وضعیت سراسری از قبل به آن وابسته‌اند؛ نگه‌داشتنش در
// `@zenith/shared` بودجهٔ ≤۲KB آن را می‌شکست (SPEC §۲.۱ / #141).
//
// Dual-package hazard (#46/DEC-018): اگر دو نسخهٔ `@zenith/errors` هم‌زمان در
// یک پروسه بارگذاری شوند (نصب تکراری/hoist ناهمگون)، دو ماژول دو `Set` جدا
// می‌ساختند و `resetForTesting()` نیمی از وضعیت سراسری را پاک نمی‌کرد. به
// همین دلیل رجیستری روی `globalThis` با کلید `Symbol.for('zenith.globalReset')`
// نگه داشته می‌شود: هر نسخه‌ای همان Set را می‌بیند (تست:
// `packages/errors/test/global-reset.test.ts`).
//
// هوک‌ها باید idempotent باشند و ترتیب اجرا تضمین نمی‌شود؛ خطای یک هوک اجرای
// بقیه را متوقف نمی‌کند (پاک‌سازی تست نباید خودش تست را بشکند).

/**
 * نوع پاک‌سازی: هم‌ساختار `Cleanup` در `@zenith/shared` (DEC-032).
 *
 * محلی است چون `@zenith/errors` عمداً **صفر وابستگی** دارد (بدون هیچ یال به
 * پکیج دیگر، حتی L0)؛ برابری این تایپ با `Cleanup` در
 * `packages/shared/test/types.test-d.ts` به‌صورت type-level تست می‌شود.
 */
type Cleanup = () => void;

/** امضای هوک پاک‌سازی سراسری (idempotent، بدون آرگومان). */
/** @public */
export type GlobalResetHook = () => void;

/**
 * کلید رجیستری روی `globalThis` — با `Symbol.for` تا دو نسخهٔ هم‌زمانِ پکیج
 * یک رجیستری ببینند (dual-package hazard؛ #46/DEC-018).
 */
const REGISTRY_KEY: unique symbol = Symbol.for('zenith.globalReset') as typeof REGISTRY_KEY;

/** شکل globalThis با اسلات رجیستری (بدون `any`). */
interface GlobalResetHost {
  [REGISTRY_KEY]?: Set<GlobalResetHook>;
}

/**
 * رجیستری مشترک (روی globalThis، نه در ماژول) — همان Set برای همهٔ نسخه‌ها.
 *
 * @returns مجموعهٔ هوک‌های ثبت‌شدهٔ فرایند جاری.
 */
function registry(): Set<GlobalResetHook> {
  const host = globalThis as GlobalResetHost;
  const existing = host[REGISTRY_KEY];
  if (existing) return existing;
  const created = new Set<GlobalResetHook>();
  host[REGISTRY_KEY] = created;
  return created;
}

/**
 * ثبت یک هوک پاک‌سازی سراسری.
 *
 * هوک باید **idempotent** باشد (چند بار صدا زدنش خطا نسازد) و ترتیب اجرا
 * تضمین نمی‌شود. برای رجیستری‌هایی که `clearXInternal` دارند:
 *
 * ```ts
 * export function clearActionsInternal(): void { actions.clear(); }
 * /* @__PURE__ * / onGlobalReset(clearActionsInternal);
 * ```
 *
 * @param hook تابع پاک‌سازی سراسری.
 * @returns `Cleanup` که فقط همان هوک را حذف می‌کند (idempotent؛ صدازدن دوباره
 *          بی‌اثر است) و بدون آرگومان قابل صدا زدن است.
 */
/** @public */
export function onGlobalReset(hook: GlobalResetHook): Cleanup {
  const hooks = registry();
  hooks.add(hook);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    hooks.delete(hook);
  };
}

/**
 * اجرای همهٔ هوک‌های ثبت‌شده (ترتیب پایدار نیست؛ هر هوک در try/catch جدا).
 *
 * @returns تعداد هوک‌هایی که **موفق** اجرا شدند (هوک خطادار شمرده نمی‌شود).
 */
/** @public */
export function runGlobalResets(): number {
  let succeeded = 0;
  for (const hook of [...registry()]) {
    try {
      hook();
      succeeded++;
    } catch {
      // خطای یک هوک اجرای بقیه را متوقف نمی‌کند (#118).
    }
  }
  return succeeded;
}
