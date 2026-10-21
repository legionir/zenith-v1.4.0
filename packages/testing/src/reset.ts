import { resetDeprecationWarnings, clearErrorHistory, runGlobalResets } from '@zenith/errors';

const _testingResetHooks = new Set<() => void>();

/**
 * #118: ثبت یک هوک پاکسازی سراسری برای فراخوانی در `resetForTesting()`.
 * @public
 */
export function registerTestingReset(fn: () => void): () => void {
  _testingResetHooks.add(fn);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    _testingResetHooks.delete(fn);
  };
}

/**
 * #118 / #137: بازنشانی یکپارچه رجیستری‌ها، هشدارهای منسوخ‌شده و تاریخچه خطاها برای تست‌ها.
 * @public
 */
export function resetForTesting(): void {
  resetDeprecationWarnings();
  clearErrorHistory();
  // #118: هوک‌هایی که پکیج‌ها خودشان در L0 ثبت کرده‌اند (رجیستری‌ها، صف
  // اعلان‌ها، زمان‌بند) — بدون وابستگی معکوس از L4 به همهٔ پکیج‌ها.
  runGlobalResets();
  for (const hook of Array.from(_testingResetHooks)) {
    try {
      hook();
    } catch {
      // ignore teardown errors
    }
  }
}
