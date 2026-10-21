import { effect, untrack } from '@zenith/state';
import { toValue, type MaybeReactive, type Cleanup } from '@zenith/shared';
import { defineOptions, validate, type Schema } from '@zenith/schema';

/** Internal mapped shape: callbacks remain callbacks; only Readable containers unwrap. */
export type ReactiveUIOptions<T> = { [K in keyof T]: MaybeReactive<T[K]> };

/** Runtime safety cannot depend on dev logging (malformed options must not mutate DOM). */
export function strictUIOptions<T>(name: string, schema: Schema<T>) {
  const base = /* @__PURE__ */ defineOptions<T>(name, schema);
  return { ...base, resolve(input?: unknown): T { return Object.freeze(validate<T>(schema, input === undefined ? {} : input, { name, mode: 'throw', strict: true, coerce: true })); } };
}

export function resolveUIOptions<T extends object>(source: ReactiveUIOptions<T>, resolve: (input: unknown) => T): T {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return resolve(source);
  const values: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(source) as Array<keyof T>) { const value = source[key]; if (value !== undefined) values[String(key)] = toValue<unknown>(value); }
  return resolve(values);
}

/** Compare primitive collection options without schema-created array identity churn. */
export function sameUIValue(left: unknown, right: unknown): boolean {
  return Object.is(left, right) || (Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, i) => Object.is(value, right[i])));
}

/** Track option reads, not arbitrary state read by configuration callbacks. */
export function watchUIOptions<T extends object>(source: ReactiveUIOptions<T>, resolve: (input: unknown) => T, initial: T, apply: (next: T, previous: T) => void): Cleanup {
  let previous = initial;
  return effect(() => {
    const next = resolveUIOptions(source, resolve);
    if (!Object.keys(next).some(key => !sameUIValue(Reflect.get(next, key), Reflect.get(previous, key))) && !Object.keys(previous).some(key => !Object.hasOwn(next, key))) return;
    const before = previous;
    // Advance the comparison baseline only after apply completes. Controllers
    // own rollback of their DOM/activation transactions if apply throws.
    untrack(() => apply(next, before)); previous = next;
  });
}

/** Forward only concrete config keys while preserving each readable dependency. */
export function projectUIOptions<T extends object, K extends keyof T>(source: ReactiveUIOptions<T>, keys: readonly K[]): Pick<ReactiveUIOptions<T>, K> {
  const result = Object.create(null) as Pick<ReactiveUIOptions<T>, K>;
  for (const key of keys) Object.defineProperty(result, key, { enumerable: true, value: { get: () => toValue<unknown>(source[key]) } });
  return result;
}
