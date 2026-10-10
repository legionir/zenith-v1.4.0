// #142 — موتور اعتبارسنجی (SPEC §۲.۲): validate/safeValidate/defineOptions/
// parseConfigAttr با کدهای رزورشده ZEN-1001/1002/1003/1004 (کاتالوگ #171).
//
// سیاست L0 (گیت layering): بدون console در src — مسیر `mode:'warn'` از یک
// reporter تزریق‌شده عبور می‌کند (الگوی duck-seam DEC-021؛ مصرف‌کننده مثل
// runtime می‌تواند آن را به @zenith/logger وصل کند). پیش‌فرض reporter هیچ
// کاری نمی‌کند تا prod ساکت بماند.

import { createReservedError } from '@zenith/errors';
import { defineDefaults, parseDuration } from '@zenith/shared';
import type { Schema } from './s';
import type {
  Issue,
  ResolvedValidateOptions,
  SafeResult,
  SchemaNode,
  ValidateOptions,
} from './types';

function isDev(): boolean {
  return globalThis.__ZENITH_DEV__ !== false;
}

export type WarnReporter = (message: string, issues: readonly Issue[]) => void;

let warnReporter: WarnReporter | undefined;

/**
 * اتصال reporter هشدار برای `mode:'warn'` (مثلاً `logger.warn`).
 * با `undefined` بازمی‌گردد به حالت پیش‌فرض (بی‌اثر — سکوت prod).
 */
export function setSchemaWarnReporter(fn: WarnReporter | undefined): void {
  warnReporter = fn;
}

function resolveOpts(opts?: ValidateOptions): ResolvedValidateOptions {
  return {
    mode: opts?.mode ?? (isDev() ? 'throw' : 'warn'),
    strict: opts?.strict ?? true,
    coerce: opts?.coerce ?? false,
    abortEarly: opts?.abortEarly ?? false,
    name: opts?.name,
  };
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function issue(
  path: (string | number)[],
  code: Issue['code'],
  expected: string,
  value: unknown,
  extra?: string,
): Issue {
  return {
    path: [...path],
    code,
    expected,
    received: typeOf(value),
    message: extra ?? `expected ${expected}, got ${typeOf(value)}`,
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** coercion فقط برای kindهای عددی/بولی/duration (attribute → typed). */
function coerceValue(node: SchemaNode, value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (node.kind === 'number') {
    if (text === '') return value;
    const n = Number(text);
    return Number.isNaN(n) ? value : n;
  }
  if (node.kind === 'boolean') {
    if (text === 'true') return true;
    if (text === 'false') return false;
    return value;
  }
  if (node.kind === 'duration') {
    const d = parseDuration(text as string);
    return d === 'never' || Number.isNaN(d) ? value : (d as number);
  }
  return value;
}

interface Ctx {
  opts: ResolvedValidateOptions;
  issues: Issue[];
  stop: boolean;
}

function check(
  node: SchemaNode,
  value: unknown,
  path: (string | number)[],
  ctx: Ctx,
): { ok: boolean; value: unknown } {
  const add = (i: Issue): { ok: false; value: unknown } => {
    ctx.issues.push(i);
    if (ctx.opts.abortEarly) ctx.stop = true;
    return { ok: false, value };
  };

  if (ctx.stop) return { ok: true, value };

  switch (node.kind) {
    case 'default': {
      if (value === undefined) return { ok: true, value: node.value };
      return check(node.inner, value, path, ctx);
    }
    case 'optional': {
      if (value === undefined) return { ok: true, value: undefined };
      return check(node.inner, value, path, ctx);
    }
    case 'union': {
      const expected = node.options.map((o) => describe(o)).join(' | ');
      for (const alt of node.options) {
        const sub: Ctx = { opts: ctx.opts, issues: [], stop: false };
        const r = check(alt, value, path, sub);
        if (r.ok && sub.issues.length === 0) return r;
      }
      return add(issue(path, 'ZEN-1001', expected, value));
    }
    case 'custom': {
      let ok = false;
      try {
        ok = node.check(value);
      } catch {
        ok = false;
      }
      return ok ? { ok: true, value } : add(issue(path, 'ZEN-1001', node.expected, value));
    }
    case 'object': {
      const raw = ctx.opts.coerce ? coerceValue(node, value) : value;
      if (!isPlainObject(raw)) return add(issue(path, 'ZEN-1001', 'object', raw));
      const out: Record<string, unknown> = {};
      const known = new Set(Object.keys(node.shape));
      for (const key of Object.keys(raw)) {
        if (!known.has(key)) {
          if (ctx.opts.strict) {
            add(
              issue(
                [...path, key],
                'ZEN-1002',
                `known keys: ${[...known].join(', ')}`,
                raw[key],
                `unknown option "${key}"`,
              ),
            );
            if (ctx.stop) break;
          }
          continue; // strict:false ⇒ کلید ناشناخته نادیده گرفته می‌شود
        }
      }
      for (const [key, child] of Object.entries(node.shape)) {
        if (ctx.stop) break;
        const hasOwn = Object.prototype.hasOwnProperty.call(raw, key);
        const childRaw = hasOwn ? raw[key] : undefined;
        if (!hasOwn && child.kind !== 'default' && child.kind !== 'optional') {
          add(
            issue(
              [...path, key],
              'ZEN-1001',
              describe(child),
              undefined,
              'missing required option',
            ),
          );
          if (ctx.stop) break;
          continue;
        }
        const r = check(child, childRaw, [...path, key], ctx);
        if (r.ok && !(child.kind === 'optional' && r.value === undefined)) out[key] = r.value;
      }
      // اگر خود گره default بود مقدار جایگزین شده؛ اینجا value ساختارFindObject است
      return { ok: ctx.issues.length === 0, value: out };
    }
    case 'record': {
      const raw = value;
      if (!isPlainObject(raw)) return add(issue(path, 'ZEN-1001', 'record', raw));
      const out: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(raw)) {
        const r = check(node.value, v, [...path, key], ctx);
        if (ctx.stop) break;
        out[key] = r.value;
      }
      return { ok: ctx.issues.length === 0, value: out };
    }
    case 'array': {
      if (!Array.isArray(value)) return add(issue(path, 'ZEN-1001', 'array', value));
      const out: unknown[] = [];
      for (let i = 0; i < value.length; i++) {
        const r = check(node.item, value[i], [...path, i], ctx);
        if (ctx.stop) break;
        out.push(r.value);
      }
      return { ok: ctx.issues.length === 0, value: out };
    }
    default: {
      // leaf kinds: string/number/boolean/enum/duration/fn/signal/element
      let v = value;
      if (ctx.opts.coerce) v = coerceValue(node, v);
      switch (node.kind) {
        case 'string': {
          if (typeof v !== 'string') return add(issue(path, 'ZEN-1001', 'string', v));
          if (node.min !== undefined && v.length < node.min)
            return add(issue(path, 'ZEN-1004', `length ≥ ${node.min}`, v));
          if (node.max !== undefined && v.length > node.max)
            return add(issue(path, 'ZEN-1004', `length ≤ ${node.max}`, v));
          if (node.pattern !== undefined) {
            let re: RegExp | null = null;
            try {
              re = new RegExp(node.pattern);
            } catch {
              re = null;
            }
            if (!re || !re.test(v))
              return add(issue(path, 'ZEN-1001', `pattern ${node.pattern}`, v));
          }
          return { ok: true, value: v };
        }
        case 'number': {
          if (typeof v !== 'number' || !Number.isFinite(v))
            return add(issue(path, 'ZEN-1001', 'number', v));
          if (node.int && !Number.isInteger(v)) return add(issue(path, 'ZEN-1001', 'integer', v));
          if (node.min !== undefined && v < node.min)
            return add(issue(path, 'ZEN-1004', `≥ ${node.min}`, v));
          if (node.max !== undefined && v > node.max)
            return add(issue(path, 'ZEN-1004', `≤ ${node.max}`, v));
          return { ok: true, value: v };
        }
        case 'boolean': {
          if (typeof v !== 'boolean') return add(issue(path, 'ZEN-1001', 'boolean', v));
          return { ok: true, value: v };
        }
        case 'enum': {
          if (node.values.some((x) => Object.is(x, v))) return { ok: true, value: v };
          return add(
            issue(
              path,
              'ZEN-1001',
              `enum(${node.values.map((x) => JSON.stringify(x)).join('|')})`,
              v,
            ),
          );
        }
        case 'duration': {
          let ms = v;
          if (typeof v === 'string') {
            const d = parseDuration(v);
            ms = d === 'never' ? Number.NaN : (d as number);
          }
          if (typeof ms !== 'number' || !Number.isFinite(ms))
            return add(issue(path, 'ZEN-1001', 'duration (ms number or "30s"/"5m"/"1h")', v));
          if (ms < 0) return add(issue(path, 'ZEN-1004', 'duration ≥ 0', v));
          if (node.min !== undefined && ms < node.min)
            return add(issue(path, 'ZEN-1004', `≥ ${node.min}ms`, v));
          if (node.max !== undefined && ms > node.max)
            return add(issue(path, 'ZEN-1004', `≤ ${node.max}ms`, v));
          return { ok: true, value: ms };
        }
        case 'fn': {
          if (typeof v !== 'function') return add(issue(path, 'ZEN-1001', 'function', v));
          return { ok: true, value: v };
        }
        case 'signal': {
          // duck: هر ظرف با get تابع (Readable در shared — DEC-021).
          if (isPlainObject(v) || typeof v === 'function') {
            const get = (v as { get?: unknown }).get;
            if (typeof get === 'function') return { ok: true, value: v };
          }
          return add(issue(path, 'ZEN-1001', 'signal (object with get())', v));
        }
        case 'element': {
          if (isPlainObject(v) && (v as { nodeType?: unknown }).nodeType === 1)
            return { ok: true, value: v };
          return add(issue(path, 'ZEN-1001', 'element (nodeType 1)', v));
        }
        default:
          return add(issue(path, 'ZEN-1001', 'unknown schema kind', value));
      }
    }
  }
}

function describe(node: SchemaNode): string {
  switch (node.kind) {
    case 'string':
      return 'string';
    case 'number':
      return node.int ? 'integer' : 'number';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return `enum(${node.values.map((x) => JSON.stringify(x)).join('|')})`;
    case 'duration':
      return 'duration';
    case 'fn':
      return 'function';
    case 'signal':
      return 'signal';
    case 'element':
      return 'element';
    case 'array':
      return 'array';
    case 'record':
    case 'object':
      return 'object';
    case 'union':
      return node.options.map(describe).join(' | ');
    case 'optional':
      return `${describe(node.inner)} | undefined`;
    case 'default':
      return describe(node.inner);
    case 'custom':
      return node.expected;
    default:
      return 'unknown';
  }
}

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

// ── defineOptions ──

function collectDefaults(node: SchemaNode): unknown | typeof MISSING {
  switch (node.kind) {
    case 'default': {
      const inner = collectDefaults(node.inner);
      return node.value !== undefined ? node.value : inner;
    }
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node.shape)) {
        const v = collectDefaults(child);
        if (v !== MISSING) out[key] = v;
      }
      return out;
    }
    case 'optional':
      return MISSING;
    default:
      return MISSING;
  }
}
const MISSING = Symbol('missing');

export interface DefinedOptions<T> {
  readonly DEFAULTS: Readonly<T>;
  resolve(user?: unknown): T;
  readonly schema: Schema<T>;
}

/**
 * قرارداد SPEC §۰.۲: هر پکیج `DEFAULTS` فریزشده + resolveٔ اعتبارسنجی‌شده دارد.
 * `defaults` صریح بر مقادیر `s.default` در schema اولویت دارد.
 */
export function defineOptions<T>(
  name: string,
  schema: Schema<T>,
  defaults?: Partial<T>,
): DefinedOptions<T> {
  const fromSchema = collectDefaults(schema as unknown as SchemaNode);
  const base =
    defaults !== undefined
      ? defaults
      : fromSchema !== MISSING
        ? (fromSchema as Partial<T>)
        : ({} as Partial<T>);
  // T می‌تواند scalar باشد (defineOptions برای schema غیرobject هم)؛ defineDefaults
  // object می‌خواهد و structuredClone هر مقداری را می‌پذیرد.
  const DEFAULTS = defineDefaults(structuredClone(base) as T & object) as T & object;
  return {
    DEFAULTS,
    resolve(user?: unknown): T {
      if (user === undefined || user === null) return DEFAULTS as T;
      // ورودی undefined-مقدار در object کاربر ⇒ همان پیش‌فرض بماند (mergeOptions semantics)
      const merged = {
        ...(DEFAULTS as Record<string, unknown>),
        ...(user as Record<string, unknown>),
      };
      for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
      return validate<T>(schema, merged, { name });
    },
    schema,
  };
}

// ── parseConfigAttr ──

/**
 * خواندن JSON از attribute element با اعتبارسنجی schema.
 * نبود attribute ⇒ فقط پیش‌فرض‌های schema (resolve({}))؛ JSON خراب ⇒ ZEN-1003.
 */
export function parseConfigAttr<T>(el: Element, attr: string, schema: Schema<T>): T {
  const raw = el.getAttribute(attr);
  if (raw === null || raw.trim() === '') {
    return validate<T>(schema, {}, { name: attr, coerce: true });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw createReservedError('ZEN-1003', {
      details: { attr, value: raw },
      cause: e,
    });
  }
  return validate<T>(schema, parsed, { name: attr, coerce: true });
}
