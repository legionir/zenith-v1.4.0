// packages/schema/src/validate-options.ts
//
// defineOptions و قرارداد DEFAULTS — استخراج مکانیکی از validate.ts،
// بدون تغییر رفتار (#40).

import { defineDefaults } from '@zenith/shared';
import type { Schema } from './s';
import type { SchemaNode } from './types';
import { isPlainObject } from './validate-check';
import { validate } from './validate-engine';


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
      if (user !== undefined && user !== null && !isPlainObject(user)) {
        return validate<T>(schema, user, { name });
      }
      const merged: Record<string, unknown> = {
        ...(DEFAULTS as Record<string, unknown>),
      };
      if (isPlainObject(user)) {
        for (const [k, v] of Object.entries(user)) {
          if (v !== undefined) {
            merged[k] = v;
          }
        }
      }
      return validate<T>(schema, merged, { name });
    },
    schema,
  };
}
