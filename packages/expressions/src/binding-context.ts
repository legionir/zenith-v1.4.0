/** Structural readable; no dependency on the state engine or DOM. */
function read(value: unknown): unknown {
  return value !== null && (typeof value === 'object' || typeof value === 'function') && typeof (value as { get?: unknown }).get === 'function'
    ? (value as { get(): unknown }).get() : value;
}

/**
 * Lazy expression view over state and lexical locals. Locals take precedence;
 * `name` and `$name` resolve to the same current value unless `$name` exists
 * explicitly. Reads unwrap structural signals while preserving effect tracking.
 * Does not eagerly evaluate getters or copy a reactive parent context.
 * @public
 */
export function createBindingContext(state: Record<string, unknown>, locals: Record<string, unknown> = {}): Record<string, unknown> {
  const contains = (source: object, key: PropertyKey) => Object.hasOwn(source, key) || (key in source && !(key in Object.prototype));
  const sourceFor = (key: PropertyKey) => contains(locals, key) ? locals : contains(state, key) ? state : undefined;
  const resolveKey = (key: PropertyKey) => !sourceFor(key) && typeof key === 'string' && key.startsWith('$') ? key.slice(1) : key;
  return new Proxy(Object.create(null) as Record<string, unknown>, {
    has: (_, key) => sourceFor(resolveKey(key)) !== undefined,
    get(_, key) {
      const actual = resolveKey(key), source = sourceFor(actual);
      return source ? read(Reflect.get(source, actual)) : undefined;
    },
    ownKeys: () => [...new Set([...Reflect.ownKeys(state), ...Reflect.ownKeys(locals)])],
    getOwnPropertyDescriptor(_, key) {
      const actual = resolveKey(key), source = sourceFor(actual);
      if (!source) return undefined;
      return { configurable: true, enumerable: Object.hasOwn(source, key), get: () => read(Reflect.get(source, actual)) };
    },
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  });
}
