// packages/logger/src/levels.ts
//
// #143 — رتبه‌بندی سطوح + پیش‌فرض dev/prod (SPEC §۲.۳).
import type { LogLevel, LogRecordLevel } from './types';

// آرایهٔ مرتب = رتبه (اندیس)؛ silent بالاترین ⇒ هیچ‌چیز از فیلترش رد نمی‌شود.
const ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];

/** آیا ورودی در سطح `record` از فیلتر `threshold` رد می‌شود؟ */
export function passesLevel(threshold: LogLevel, record: LogRecordLevel): boolean {
  return ORDER.indexOf(record) >= ORDER.indexOf(threshold);
}

/**
 * سطح پیش‌فرض: dev ⇒ `'debug'`؛ prod ⇒ `'warn'` (SPEC §۲.۳).
 * همان فلگ `__ZENITH_DEV__ === false` که errors/#47 و auth/#62 استفاده
 * می‌کنند؛ فقط مقدار صریح `false` حالت prod است (مطابق errors).
 */
export function defaultLevel(): LogLevel {
  // globalThis در ES2020+ همیشه هست (هدف DEC-027: node ≥18.19/مرورگرهای
  // مدرن) ⇒ typeof guard اضافی؛ فقط مقادیر صریح `false` حالت prod است.
  return globalThis.__ZENITH_DEV__ !== false ? 'debug' : 'warn';
}
