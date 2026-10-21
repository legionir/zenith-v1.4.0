// packages/schema/src/validate-reporter.ts
//
// reporter هشدار mode:'warn' — استخراج مکانیکی از validate.ts،
// بدون تغییر رفتار (#40).

import type { Issue } from './types';


export function isDev(): boolean {
  return globalThis.__ZENITH_DEV__ !== false;
}

export type WarnReporter = (message: string, issues: readonly Issue[]) => void;

export let warnReporter: WarnReporter | undefined;

/**
 * اتصال reporter هشدار برای `mode:'warn'` (مثلاً `logger.warn`).
 * با `undefined` بازمی‌گردد به حالت پیش‌فرض (بی‌اثر — سکوت prod).
 */
export function setSchemaWarnReporter(fn: WarnReporter | undefined): void {
  warnReporter = fn;
}
