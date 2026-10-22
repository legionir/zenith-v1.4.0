// packages/schema/src/validate-check.ts
//
// هسته بازگشتی اعتبارسنجی (check/describe) — استخراج مکانیکی از
// validate.ts، بدون تغییر رفتار (#40).

import { parseDuration } from '@zenith/shared';
import { isDev } from './validate-reporter';
import type { Issue, ResolvedValidateOptions, SchemaNode, ValidateOptions } from './types';


export function resolveOpts(opts?: ValidateOptions): ResolvedValidateOptions {
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

export function isPlainObject(v: unknown): v is Record<string, unknown> {
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

export interface Ctx {
  opts: ResolvedValidateOptions;
  issues: Issue[];
  // #116/DEC-032: این «stop» یک فیلد بولی نتیجه است، نه متد چرخهٔ عمر —
  // در گیت cleanup-hygiene allowlist شده.
  stop: boolean;
}

export function check(
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
