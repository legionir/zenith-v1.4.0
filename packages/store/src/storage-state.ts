import type { ReferenceRegistry } from '@zenith/shared';
const scopes = new WeakMap<object, Map<string, string>>();
/** Per-owner SSR fallback; no data from a previous request is restored. */
export function memoryFor(scope: Pick<ReferenceRegistry<unknown>, 'subscribe'>): Map<string, string> {
  let values = scopes.get(scope);
  if (!values) { values = new Map(); scopes.set(scope, values); const owned = values; scope.subscribe(name => { if (name === null) owned.clear(); }); }
  return values;
}
export function clearMemoryFor(scope: object): void { scopes.get(scope)?.clear(); }
