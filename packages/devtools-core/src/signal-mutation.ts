/**
 * Time-travel is an explicit dynamic mutation boundary, not a claim that a
 * heterogeneous Signal<T> can safely accept every unknown value. Snapshot
 * callers own payload compatibility; callers catch readonly/disposed failures.
 * Reflect.apply preserves the real receiver without manufacturing a writable
 * Signal<unknown> or erasing generics with `any`.
 * @internal
 */
export function writeInspectedSignal(signal: object, value: unknown): void {
  resolveInspectedWriter(signal)(value);
}

/** Resolve native property access before the caller checks its operation epoch. @internal */
export function resolveInspectedWriter(signal: object): (value: unknown) => void {
  const setter: unknown = Reflect.get(signal, 'set');
  if (typeof setter !== 'function') throw new TypeError('Inspected signal has no writable setter.');
  return value => { Reflect.apply(setter, signal, [value]); };
}
