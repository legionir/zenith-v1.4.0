// packages/logger/src/redact.ts
//
// #143 — پوشش مقادیر حساس در details (SPEC §۲.۳ گزینهٔ `redact`).
//
// کپی ساختاری می‌سازد (ورودی کاربر هرگز دستکاری نمی‌شود) و کلیدهای
// redact‌شده را با `'***'` جایگزین می‌کند؛ چرخه با '[Circular]' برچسب
// می‌خورد تا JSON.stringify هرگز throw نکند (sink خراب ≠ برنامه خراب).

/** پیش‌فرض SPEC §۲.۳؛ با گزینهٔ `redact` جایگزین (نه ادغام) می‌شود. */
export const DEFAULT_REDACT: readonly string[] = [
  'token',
  'password',
  'authorization',
  'secret',
  'cookie',
];

function walk(value: unknown, keys: readonly string[], seen: Set<object>): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  let out: unknown;
  if (Array.isArray(value)) {
    out = value.map((item) => walk(item, keys, seen));
  } else if (
    Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null
  ) {
    const rec: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // مطابقت نام حساس‌به‌case نیست (token/Token/TOKEN همه پوشیده می‌شوند).
      rec[k] = keys.some((r) => r.toLowerCase() === k.toLowerCase()) ? '***' : walk(v, keys, seen);
    }
    out = rec;
  } else {
    // کلاس/Map/Set/Date و…: عیناً می‌مانند (sink خودش serialize می‌کند).
    out = value;
  }
  seen.delete(value);
  return out;
}

/**
 * کپی ساختاری `details` با مقادیر پوشیده‌شده برای کلیدهای `keys`
 * (عمق‌به‌عمق، آرایه‌ها و آبجکت‌های تودرتو). `undefined` بدون تغییر می‌ماند.
 */
export function redactDetails(
  details: Record<string, unknown> | undefined,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  if (details === undefined) return undefined;
  return walk(details, keys, new Set()) as Record<string, unknown>;
}
