// packages/shared/src/options.ts
//
// #141 — ابزارهای گزینه‌ها و attribute (SPEC §۰.۲/§۰.۳/§۲.۱):
//   • mergeOptions: ادغام امن در برابر prototype pollution؛
//   • defineDefaults: DEFAULTS فریزشدهٔ عمیق؛
//   • parseDuration/parseBooleanAttr/parseNumberAttr: گرامر attribute.

import { invariant } from './assert';

// کلیدهایی که می‌توانند زنجیرهٔ prototype را آلوده کنند؛ حتی اگر own key
// باشند هرگز کپی نمی‌شوند (معیار پذیرش #141).
const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * ادغام امن `user` روی `defaults`:
 * - نتیجه شیء تازه است و `defaults` دست‌نخورده می‌ماند؛
 * - فقط کلیدهای **خودِ** `user` که در defaults وجود دارند اعمال می‌شوند
 *   (کلید ناشناخته و property به‌ارث‌رسیده حذف می‌شوند)؛
 * - `__proto__`/`constructor`/`prototype` هرگز کپی نمی‌شوند؛
 * - مقدار `undefined` یعنی «پیش‌فرض بماند»؛
 * - شیءهای تودرتو recursively ادغام می‌شوند.
 */
export function mergeOptions<T extends object>(defaults: T, user?: unknown): T {
  const base = defaults as Record<string, unknown>;
  const out: Record<string, unknown> = Object.assign({}, base);
  if (!isPlainObject(user)) return out as T;
  for (const key of Object.keys(user)) {
    if (UNSAFE_KEYS.has(key)) continue;
    if (!(key in base)) continue;
    const value = user[key];
    if (value === undefined) continue;
    out[key] =
      isPlainObject(value) && isPlainObject(base[key])
        ? mergeOptions(base[key] as object, value)
        : value;
  }
  return out as T;
}

function deepFreeze<T>(value: T): T {
  if (!isPlainObject(value) && !Array.isArray(value)) return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/**
 * پیش‌فرض یک پکیج (SPEC §۰.۲: هر پکیج `DEFAULTS` فریزشده export می‌کند).
 * فریز عمیق از تغییر تصادفی/مغرضانه جلوگیری می‌کند.
 *
 * @throws {ZenithError} ZEN-1090 برای ورودی غیر از آبجکت صاف.
 */
export function defineDefaults<T extends object>(defaults: T): Readonly<T> {
  invariant(isPlainObject(defaults), 'defineDefaults فقط آبجکت صاف می‌پذیرد', {
    details: { received: Array.isArray(defaults) ? 'array' : typeof defaults },
  });
  return deepFreeze(defaults) as Readonly<T>;
}

// «مدت‌زمان در attribute: 500ms، 30s، 5m، 1h، یا عدد (= ms). مقدار never یعنی
// بدون انقضا» (SPEC §۰.۲).
const DURATION_UNITS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };

/**
 * تبدیل مقدار duration به میلی‌ثانیه.
 *
 * @param value عدد (ms) یا رشته: `"500ms"`/`"30s"`/`"5m"`/`"1h"`/`"30"`/`"never"`.
 * @returns میلی‌ثانیه (`number >= 0`)، `'never'` برای بدون‌انقضا، یا `NaN`
 *          برای ورودی نامعتبر (مثلاً `"-1"`, `"abc"`, عدد منفی/non-finite).
 */
export function parseDuration(value: string | number): number | 'never' {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
  }
  const text = value.trim().toLowerCase();
  if (text === 'never') return 'never';
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/.exec(text);
  if (!match) return Number.NaN;
  const num = Number(match[1]);
  if (!Number.isFinite(num)) return Number.NaN;
  return num * (DURATION_UNITS[match[2] ?? 'ms'] ?? 1);
}

/**
 * boolean attribute (SPEC §۰.۳): نبود attribute → `def`؛ وجود بدون مقدار
 * (`zen-x=""`) → `true`؛ `"false"` → `false`؛ `"true"` → `true`؛
 * هر مقدار دیگر → `def`.
 */
export function parseBooleanAttr(value: string | null, def: boolean): boolean {
  if (value === null) return def;
  const text = value.trim().toLowerCase();
  if (text === '' || text === 'true') return true;
  if (text === 'false') return false;
  return def;
}

/**
 * عدد attribute (SPEC §۰.۳): literal عددی؛ نبود attribute/مقدار خالی/
 * غیرعددی/`:`expression → `def` (expression را خود directive resolve می‌کند).
 */
export function parseNumberAttr(value: string | null, def: number): number {
  if (value === null) return def;
  const text = value.trim();
  if (text === '' || text.startsWith(':')) return def;
  const num = Number(text);
  return Number.isFinite(num) ? num : def;
}
