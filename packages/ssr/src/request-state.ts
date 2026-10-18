import type { Disposer } from '@zenith/shared';
import { signal, untrack } from '@zenith/state';
import { createReservedError } from '@zenith/errors';
/** Explicit ownership for signals created by the request snapshot. @public */
export interface RequestStateOptions { cleanup: Disposer; invalid?: () => Error; }
/** Snapshot data without transferring the source signals' ownership. @public */
export function cloneRequestState(input: Record<string, unknown>, options: RequestStateOptions): Record<string, unknown> {
  const { cleanup } = options;
  const invalid = options.invalid ?? (() => createReservedError('ZEN-1001', { details: { expected: 'snapshot-compatible request state' } }));
  const seen = new WeakMap<object, unknown>();
  const copy = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    if (value instanceof Date) { const result = new Date(value.getTime()); seen.set(value, result); return result; }
    if (value instanceof RegExp) { const result = new RegExp(value.source, value.flags); result.lastIndex = value.lastIndex; seen.set(value, result); return result; }
    if (value instanceof Map) { const result = new Map<unknown, unknown>(); seen.set(value, result); for (const [key, item] of value) result.set(copy(key), copy(item)); return result; }
    if (value instanceof Set) { const result = new Set<unknown>(); seen.set(value, result); for (const item of value) result.add(copy(item)); return result; }
    // Resolve the data method without invoking a hostile `get` accessor.
    let cursor: object | null = value; let read: (() => unknown) | undefined;
    while (cursor && value !== input) {
      const descriptor = Object.getOwnPropertyDescriptor(cursor, 'get');
      if (descriptor) { if (!('value' in descriptor)) throw invalid(); const method: unknown = descriptor.value; if (typeof method === 'function') read = () => method.call(value); break; }
      cursor = Object.getPrototypeOf(cursor) as object | null;
    }
    if (read) { const result = signal<unknown>(undefined); seen.set(value, result); cleanup.add(result); result.set(copy(untrack(read))); return result; }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw invalid();
    const result: Record<string, unknown> | unknown[] = Array.isArray(value) ? new Array<unknown>(value.length) : Object.create(prototype === null ? null : Object.prototype) as Record<string, unknown>; seen.set(value, result);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!descriptor.enumerable) continue;
      if (!('value' in descriptor)) throw invalid();
      Object.defineProperty(result, key, { value: copy(descriptor.value), enumerable: true, writable: true, configurable: true });
    }
    return result;
  };
  if (!input || typeof input !== 'object' || Array.isArray(input) || (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)) throw invalid();
  return copy(input) as Record<string, unknown>;
}
