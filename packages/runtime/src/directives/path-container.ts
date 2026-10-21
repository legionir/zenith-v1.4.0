/** Clone one legacy model/persist path container without JSON conversion. @internal */
export function clonePathContainer(value: unknown): Record<string, unknown> {
  return (Array.isArray(value) ? [...value] : { ...(value as object) }) as unknown as Record<string, unknown>;
}
