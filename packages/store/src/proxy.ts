/** Keys that can mutate or impersonate an object's prototype are not state patches. */
export const isSafeStateKey = (key: PropertyKey): boolean => key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
export function isPlainStateObject(value: unknown): value is Record<PropertyKey, unknown> {
  if (!value || typeof value !== 'object') return false;
  const prototype: unknown = Object.getPrototypeOf(value); return prototype === null || prototype === Object.prototype;
}
const DEEP_MERGE_MAX_DEPTH = 10;
export function deepMerge<T>(target: T, source: Partial<T>, depth = 0): T {
  const result = { ...target } as Record<PropertyKey, unknown>;
  if (depth >= DEEP_MERGE_MAX_DEPTH || !source || typeof source !== 'object') return result as T;
  for (const key of Reflect.ownKeys(source)) {
    if (!isSafeStateKey(key)) continue;
    const value: unknown = Reflect.get(source, key), previous = result[key];
    Object.defineProperty(result, key, { value: isPlainStateObject(value) && isPlainStateObject(previous) ? deepMerge(previous, value, depth + 1) : value, writable: true, enumerable: true, configurable: true });
  }
  return result as T;
}
const mutating = new Set<PropertyKey>(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);
/** Per-store identity cache; cycles/aliases retain one live proxy and one owner. */
export function createProxyFactory() {
  const cache = new WeakMap<object, object>(), proxies = new WeakSet<object>();
  function createInPlaceDeepProxy<T>(value: T, onMutation: () => void): T {
    if (!value || typeof value !== 'object' || (!Array.isArray(value) && !isPlainStateObject(value))) return value;
    if (proxies.has(value)) return value;
    const cached = cache.get(value); if (cached) return cached as T;
    const proxy = new Proxy(value, {
      get(target, key, receiver) {
        const next: unknown = Reflect.get(target, key, receiver);
        if (Array.isArray(target) && mutating.has(key) && next === Reflect.get(Array.prototype, key)) {
          return (...args: unknown[]) => { try { const result: unknown = Reflect.apply(next as (...values: unknown[]) => unknown, target, args); return result === target ? receiver : result; } finally { onMutation(); } };
        }
        // A proxy must return the exact value of a non-configurable readonly property.
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        if (descriptor && !descriptor.configurable && 'value' in descriptor && !descriptor.writable) return next;
        return createInPlaceDeepProxy(next, onMutation);
      },
      set(target, key, next) {
        if (!isSafeStateKey(key)) return false;
        const success = Reflect.set(target, key, next, target); if (success) onMutation(); return success;
      },
      deleteProperty(target, key) {
        const existed = Object.hasOwn(target, key), success = Reflect.deleteProperty(target, key); if (existed && success) onMutation(); return success;
      },
      defineProperty(target, key, descriptor) {
        if (!isSafeStateKey(key)) return false;
        const success = Reflect.defineProperty(target, key, descriptor); if (success) onMutation(); return success;
      },
      setPrototypeOf() { return false; },
    });
    cache.set(value, proxy); proxies.add(proxy); return proxy;
  }
  return { createInPlaceDeepProxy };
}
