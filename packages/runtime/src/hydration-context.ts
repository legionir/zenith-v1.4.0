/** Legacy hydration keeps raw keys and get-only unwrapping; unlike the main context. @internal */
export function buildContext(state: Record<string, unknown>): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};
  for (const key of Object.keys(state)) {
    const value = state[key];
    // Always expose the raw value under the bare key.
    ctx[key] = value;
    // Expose a `$key` getter that unwraps Signals.
    Object.defineProperty(ctx, `$${key}`, {
      get() {
        if (value && typeof (value as { get?: unknown }).get === 'function') return (value as { get(): unknown }).get();
        return value;
      },
      configurable: true,
      enumerable: true,
    });
  }
  return ctx;
}
