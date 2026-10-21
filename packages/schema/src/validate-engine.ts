// packages/schema/src/validate-engine.ts
//
// موتور validate/safeValidate — استخراج مکانیکی از validate.ts،
// بدون تغییر رفتار (#40).

import { createReservedError } from '@zenith/errors';
import { check, resolveOpts, type Ctx } from './validate-check';
import { warnReporter } from './validate-reporter';
import type { Schema } from './s';
import type { ResolvedValidateOptions, SafeResult, SchemaNode, ValidateOptions } from './types';


/** نتیجهٔ داخلی: issues + مقدار (روی موفقیت همیشه مقدار محاسبه‌شده با defaults/coerce). */
function run<T>(schema: Schema<T>, input: unknown, opts?: ValidateOptions): SafeResult<T> {
  const resolved = resolveOpts(opts);
  const ctx: Ctx = { opts: resolved, issues: [], stop: false };
  const r = check(schema as unknown as SchemaNode, input, [], ctx);
  if (ctx.issues.length === 0) return { ok: true, value: r.value as T };
  return { ok: false, issues: ctx.issues };
}

/** اعتبارسنجی بدون throw؛ `{ ok:true, value }` یا `{ ok:false, issues }`. */
export function safeValidate<T>(
  schema: Schema<T>,
  input: unknown,
  opts?: Omit<ValidateOptions, 'mode'>,
): SafeResult<T> {
  return run(schema, input, { ...opts, mode: 'result' });
}

function fail(res: SafeResult<unknown> & { ok: false }, resolved: ResolvedValidateOptions): never {
  const first = res.issues[0]!;
  const pathText = first.path.length > 0 ? first.path.join('.') : '<root>';
  throw createReservedError(first.code, {
    details: {
      name: resolved.name,
      path: pathText,
      expected: first.expected,
      received: first.received,
      issues: res.issues,
    },
    context: { api: resolved.name },
  });
}

/**
 * اعتبارسنجی با رفتار `mode`:
 *  - throw (dev پیش‌فرض): ZEN-1001/1002/1004 با مسیر/انتظار/مقدار در details.
 *  - warn (prod پیش‌فرض): reporter تزریق‌شده را صدا می‌زند؛ مقدار خام برمی‌گردد.
 *  - result: بدون اثر جانبی؛ مقدار خام برمی‌گردد.
 */
export function validate<T>(schema: Schema<T>, input: unknown, opts?: ValidateOptions): T {
  const resolved = resolveOpts(opts);
  const res = run(schema, input, { ...opts, mode: 'result' });
  if (res.ok) return res.value;
  if (resolved.mode === 'throw') {
    fail(res, resolved);
  }
  if (resolved.mode === 'warn' && warnReporter) {
    const first = res.issues[0]!;
    const where = resolved.name ? `${resolved.name}: ` : '';
    warnReporter(
      `[schema] ${where}${first.code} at ${first.path.join('.') || '<root>'} — ` +
        `expected ${first.expected}, got ${first.received}`,
      res.issues,
    );
  }
  return input as T;
}
