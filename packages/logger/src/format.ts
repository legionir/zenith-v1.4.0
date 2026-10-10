// packages/logger/src/format.ts
//
// #143 — فرمت پیش‌فرض SPEC §۲.۳: `[zen:scope] CODE: message`
// (بخش ` CODE:` فقط وقتی code وجود دارد چاپ می‌شود). برای ورودی‌های دارای
// suggestion، آن هم به‌عنوان سطر دوم افزوده می‌شود (SPEC بند «خطا»:
// logger.error(zenithError) باید «کد، پیام و suggestion را چاپ» کند).
import type { LogEntry } from './types';

/** فرمت متنی پیش‌فرض همهٔ لاگرها (خروجی در `entry.text`). */
export function entryText(entry: LogEntry): string {
  const code = entry.code ? ` ${entry.code}:` : '';
  const sug = entry.suggestion ? `\n  ↳ ${entry.suggestion}` : '';
  return `[${entry.scope}]${code} ${entry.message}${sug}`;
}
