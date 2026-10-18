/** Native strict property assignment at the legacy in-place state boundary. @internal */
export function assignStateKey(state: unknown, input: { key: PropertyKey; value: unknown }): void {
  const { key, value } = input;
  // State's generic type is caller-declared. Reflect preserves native rejection
  // of primitive targets, and false must throw just like strict assignment.
  if (!Reflect.set(state as object, key, value)) throw new TypeError(`Cannot assign store property ${String(key)}.`);
}
