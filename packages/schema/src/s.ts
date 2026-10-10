// #142 — سازنده‌های schema `s.*` (SPEC §۲.۲).
//
// گره‌ها plain-object و serializeپذیرند (سازگار با JSON/SSR؛ هیچ class و
// هیچ closure جز s.custom نیست). فانتوم‌تایپ `__type` فقط در سطح نوع است.
import type { SchemaNode } from './types';

/**
 * schema تایپ‌شده: همان `SchemaNode` با برند نوعِ خروجی `__type` (فقط در
 * سطح type؛ هیچ‌وقت در runtime مقدار نمی‌گیرد).
 */
export interface Schema<T = unknown> {
  readonly kind: string;
  readonly [key: string]: unknown;
  /** فانتوم‌تایپ — inference-only. */
  readonly __type?: T;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;

export type ShapeOf<S extends Record<string, Schema<unknown>>> = {
  [K in keyof S]: Infer<S[K]>;
};

function node<T>(n: SchemaNode): Schema<T> {
  return n as unknown as Schema<T>;
}

export interface StringOpts {
  min?: number;
  max?: number;
  pattern?: string;
}
export interface NumberOpts {
  min?: number;
  max?: number;
  int?: boolean;
}

/** سازنده‌های گره schema (SPEC §۲.۲ `s`). */
export const s = {
  string(opts: StringOpts = {}): Schema<string> {
    return node({ kind: 'string', ...opts });
  },
  number(opts: NumberOpts = {}): Schema<number> {
    return node({ kind: 'number', ...opts });
  },
  boolean(): Schema<boolean> {
    return node({ kind: 'boolean' });
  },
  enum<const V extends readonly (string | number | boolean)[]>(values: V): Schema<V[number]> {
    return node({ kind: 'enum', values: [...values] });
  },
  /** میلی‌ثانیهٔ `number ≥ 0`؛ با `coerce` رشته‌های `"30s"/"5m"/"1h"/"500ms"` هم پذیرفته می‌شوند. */
  duration(opts: { min?: number; max?: number } = {}): Schema<number> {
    return node({ kind: 'duration', ...opts });
  },
  fn(): Schema<(...args: never[]) => unknown> {
    return node({ kind: 'fn' });
  },
  /** ظرف واکنش‌گرِ دارای `get()` — همان قرارداد `Readable` در shared (DEC-021، duck). */
  signal<T = unknown>(): Schema<{ get(): T }> {
    return node({ kind: 'signal' });
  },
  /** گره DOM با duck-type `nodeType === 1` (بدون وابستگی به instanceof در SSR). */
  element(): Schema<{ nodeType: number }> {
    return node({ kind: 'element' });
  },
  array<S extends Schema<unknown>>(item: S): Schema<Infer<S>[]> {
    return node({ kind: 'array', item: item as unknown as SchemaNode });
  },
  record<S extends Schema<unknown>>(value: S): Schema<Record<string, Infer<S>>> {
    return node({ kind: 'record', value: value as unknown as SchemaNode });
  },
  object<S extends Record<string, Schema<unknown>>>(shape: S): Schema<ShapeOf<S>> {
    return node({ kind: 'object', shape: { ...shape } as Record<string, SchemaNode> });
  },
  union<A extends readonly [Schema<unknown>, Schema<unknown>, ...Schema<unknown>[]]>(
    options: A,
  ): Schema<Infer<A[number]>> {
    return node({ kind: 'union', options: [...options] as SchemaNode[] });
  },
  optional<S extends Schema<unknown>>(inner: S): Schema<Infer<S> | undefined> {
    return node({ kind: 'optional', inner: inner as unknown as SchemaNode });
  },
  default<S extends Schema<unknown>>(inner: S, value: Infer<S>): Schema<Infer<S>> {
    return node({ kind: 'default', inner: inner as unknown as SchemaNode, value });
  },
  /** گره userland؛ `expected` در پیام/JSON Schema برای ابزارها نمایش داده می‌شود. */
  custom<T = unknown>(check: (v: unknown) => boolean, expected = 'custom'): Schema<T> {
    return node({ kind: 'custom', check, expected });
  },
};

/** آیا مقدار یک گره schema معتبر است؟ (سازگار با serialize/JSON round-trip جز `custom`). */
export function isSchemaNode(value: unknown): value is SchemaNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { kind?: unknown }).kind === 'string'
  );
}
