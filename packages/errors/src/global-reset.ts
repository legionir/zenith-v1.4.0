// packages/shared/src/global-reset.ts
//
// #118 — رجیستری «ریست سراسری» (DEC-035/#118).
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
// هوک‌ها باید idempotent باشند و ترتیب اجرا تضمین نمی‌شود؛ خطای یک هوک اجرای
// بقیه را متوقف نمی‌کند (پاک‌سازی تست نباید خودش تست را بشکند).

/** نوع minimal برای پرهیز از وابستگی بین‌پکیجی در L0 (هم‌معنای `Cleanup`). */
type Cleanup = () => void;

/** امضای هوک پاک‌سازی سراسری. */
export type GlobalResetHook = () => void;

const hooks = new Set<GlobalResetHook>();

/**
 * ثبت یک هوک پاک‌سازی سراسری.
 *
 * @param hook تابع پاک‌سازی idempotent.
 * @returns `Cleanup` که فقط همان هوک را حذف می‌کند.
 */
export function onGlobalReset(hook: GlobalResetHook): Cleanup {
  hooks.add(hook);
  return () => void hooks.delete(hook);
}

/**
 * اجرای همهٔ هوک‌های ثبت‌شده.
 * @returns تعداد هوک‌های موفق (هوک خطادار شمرده نمی‌شود).
 */
export function runGlobalResets(): number {
  let n = 0;
  for (const hook of [...hooks]) {
    try {
      hook();
      n++;
    } catch {
      // ignore
    }
  }
  return n;
}
