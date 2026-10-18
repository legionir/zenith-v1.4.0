/**
 * Dirty comparison for field data, not a decoder or JSON serialization hook.
 * Plain enumerable data is structural (including cycles); native/class/accessor
 * values are identity-based. Inspection failure/budget exhaustion conservatively
 * differs; the 10,000-pair budget also bounds virtual graphs produced by proxies.
 * @internal
 */
export function equalFormValue(left: unknown, right: unknown): boolean {
  const pending: Array<readonly [unknown, unknown]> = [[left, right]];
  const visited = new WeakMap<object, WeakSet<object>>();
  let remaining = 10000;
  try {
    while (pending.length) {
      if (--remaining < 0) return false;
      const pair = pending.pop(); if (!pair) break;
      const [a, b] = pair;
      if (Object.is(a, b)) continue;
      if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
      const arrays = Array.isArray(a);
      if (arrays !== Array.isArray(b)) return false;
      if (arrays) {
        const aLength: unknown = Object.getOwnPropertyDescriptor(a, 'length')?.value;
        const bLength: unknown = Object.getOwnPropertyDescriptor(b, 'length')?.value;
        if (aLength !== bLength) return false;
      } else {
        const aPrototype: unknown = Object.getPrototypeOf(a), bPrototype: unknown = Object.getPrototypeOf(b);
        if ((aPrototype !== null && aPrototype !== Object.prototype) || (bPrototype !== null && bPrototype !== Object.prototype)) return false;
      }
      const seen = visited.get(a);
      if (seen?.has(b)) continue;
      if (seen) seen.add(b); else visited.set(a, new WeakSet([b]));
      const keys = Reflect.ownKeys(a).filter(key => Object.getOwnPropertyDescriptor(a, key)?.enumerable);
      const otherKeys = new Set(Reflect.ownKeys(b).filter(key => Object.getOwnPropertyDescriptor(b, key)?.enumerable));
      if (keys.length !== otherKeys.size || keys.length > remaining) return false;
      for (const key of keys) {
        if (!otherKeys.has(key)) return false;
        const first = Object.getOwnPropertyDescriptor(a, key), second = Object.getOwnPropertyDescriptor(b, key);
        // Do not invoke application getters/toJSON merely to mark a field dirty.
        if (!first || !second || !('value' in first) || !('value' in second)) return false;
        const firstValue: unknown = first.value, secondValue: unknown = second.value;
        pending.push([firstValue, secondValue]);
      }
    }
    return true;
  } catch { return false; }
}
